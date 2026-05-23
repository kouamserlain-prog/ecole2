import express from 'express';
import { body, validationResult } from 'express-validator';
import type { StaffCategory, SupportStaffKind } from '@prisma/client';
import prisma from '../utils/prisma';
import { generateToken } from '../utils/jwt.util';
import { hashPassword, comparePassword, assertPasswordPolicy, PASSWORD_POLICY_HINT } from '../utils/password.util';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import {
  createPasswordResetToken,
  sendPasswordResetEmail,
  sendTransactionalHtmlEmail,
  verifyResetToken,
  markTokenAsUsed,
} from '../utils/email.util';
import {
  authLoginLimiter,
  authRegisterLimiter,
  authForgotPasswordLimiter,
  authResetPasswordLimiter,
  gdprExportLimiter,
  gdprErasureRequestLimiter,
} from '../middleware/rate-limit.middleware';
import { decryptSessionUserPayload } from '../utils/student-sensitive-crypto.util';
import {
  resolveVisibleStaffModules,
  syncStaffVisibleModulesIfStale,
} from '../utils/staff-visible-modules.util';
import { buildGdprDataExport } from '../utils/gdpr-data-export.util';
import QRCode from 'qrcode';
import { generateTwoFactorSecret, verifyTwoFactorToken } from '../utils/two-factor.util';

const router = express.Router();

async function withSyncedStaffModules<
  T extends {
    staffProfile?: {
      id: string;
      staffCategory: StaffCategory;
      supportKind: SupportStaffKind | null;
      visibleStaffModules: string[];
    } | null;
  },
>(user: T): Promise<T> {
  if (!user.staffProfile) return user;
  const sp = user.staffProfile;
  await syncStaffVisibleModulesIfStale(sp);
  const visibleStaffModules = resolveVisibleStaffModules(
    sp.staffCategory,
    sp.supportKind,
    sp.visibleStaffModules,
  );
  return {
    ...user,
    staffProfile: { ...sp, visibleStaffModules },
  };
}

// Inscription
router.post(
  '/register',
  authRegisterLimiter,
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').custom(assertPasswordPolicy).withMessage(PASSWORD_POLICY_HINT),
    body('firstName').notEmpty().withMessage('Prénom requis'),
    body('lastName').notEmpty().withMessage('Nom requis'),
    body('role')
      .isIn(['STUDENT', 'PARENT'])
      .withMessage(
        'Inscription publique réservée aux rôles élève et parent. Les autres comptes sont créés par l’administration.'
      ),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const emailNorm = String(req.body.email ?? '')
        .trim()
        .toLowerCase();
      const { password, firstName, lastName, role, phone } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email: emailNorm },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      // Hasher le mot de passe
      const hashedPassword = await hashPassword(password);

      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: {
          email: emailNorm,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      // Générer le token
      const token = generateToken(user.id, user.email, user.role);

      res.status(201).json({
        message: 'Inscription réussie',
        user,
        token,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';
      const status = message.includes('mot de passe') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  }
);

// Connexion
router.post(
  '/login',
  authLoginLimiter,
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const emailNorm = String(req.body.email ?? '')
        .trim()
        .toLowerCase();
      const { password, twoFactorCode } = req.body;

      // Trouver l'utilisateur (tous les profils pour le même schéma que /auth/me)
      const user = await prisma.user.findUnique({
        where: { email: emailNorm },
        include: {
          teacherProfile: true,
          studentProfile: true,
          parentProfile: true,
          educatorProfile: true,
          staffProfile: true,
        },
      });

      // Logs de débogage en mode développement
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Tentative de connexion:', {
          email: emailNorm,
          userExists: !!user,
          isActive: user?.isActive,
        });
      }

      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Utilisateur non trouvé:', emailNorm);
        }
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      if (!user.isActive) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Utilisateur inactif:', emailNorm);
        }
        return res.status(401).json({ error: 'Votre compte a été désactivé. Contactez l\'administrateur.' });
      }

      if (
        user.role === 'STUDENT' &&
        user.studentProfile &&
        user.studentProfile.enrollmentStatus === 'SUSPENDED'
      ) {
        return res.status(403).json({
          error:
            'Votre inscription est suspendue. Vous ne pouvez pas accéder à l’espace élève. Contactez l’administration.',
          code: 'ENROLLMENT_SUSPENDED',
        });
      }

      // Vérifier le mot de passe (bcrypt peut lever si le hash stocké est invalide)
      let isValidPassword = false;
      try {
        isValidPassword = await comparePassword(password, user.password);
      } catch (compareErr: unknown) {
        console.error('Erreur bcrypt.compare (hash invalide en base ?):', compareErr);
        return res.status(500).json({
          error:
            'Erreur de vérification du mot de passe. Réinitialisez le mot de passe ou contactez un administrateur.',
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Vérification du mot de passe:', {
          email: emailNorm,
          isValid: isValidPassword,
        });
      }

      if (!isValidPassword) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Mot de passe incorrect pour:', emailNorm);
        }
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      const twoFactor = await prisma.userTwoFactorSettings.findUnique({
        where: { userId: user.id },
      });
      if (twoFactor?.enabled) {
        if (!twoFactorCode || typeof twoFactorCode !== 'string') {
          return res.status(401).json({
            error: 'Code 2FA requis',
            code: 'TWO_FACTOR_REQUIRED',
          });
        }
        const ok2fa = verifyTwoFactorToken(twoFactor.secretEncrypted, twoFactorCode);
        if (!ok2fa) {
          return res.status(401).json({
            error: 'Code 2FA invalide',
            code: 'TWO_FACTOR_INVALID',
          });
        }
        await prisma.userTwoFactorSettings.update({
          where: { userId: user.id },
          data: { lastVerifiedAt: new Date() },
        });
      }

      // Générer le token
      let token: string;
      try {
        token = generateToken(user.id, user.email, user.role);
      } catch (jwtErr: any) {
        console.error('Erreur JWT generateToken:', jwtErr);
        return res.status(500).json({
          error:
            jwtErr?.message ||
            'Impossible de générer la session. Vérifiez JWT_SECRET et JWT_EXPIRES_IN sur le serveur.',
        });
      }

      // Retourner les données utilisateur (sans le mot de passe)
      const { password: _, ...userWithoutPassword } = user;
      const userForSession = await withSyncedStaffModules(userWithoutPassword);

      res.json({
        message: 'Connexion réussie',
        user: decryptSessionUserPayload(userForSession),
        token,
        twoFactorEnabled: Boolean(twoFactor?.enabled),
      });
    } catch (error: any) {
      console.error('Erreur lors de la connexion:', error);
      res.status(500).json({ 
        error: error.message || 'Erreur serveur lors de la connexion',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Mettre à jour le profil de l'utilisateur
router.put('/me', authenticate, async (req: any, res) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(avatar !== undefined && { avatar }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        teacherProfile: true,
        studentProfile: {
          include: {
            class: true,
          },
        },
        parentProfile: true,
      },
    });

    res.json(decryptSessionUserPayload(updatedUser));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer le profil de l'utilisateur connecté
router.get('/me', authenticate, async (req: any, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        teacherProfile: {
          select: {
            id: true,
            employeeId: true,
            specialization: true,
            hireDate: true,
            contractType: true,
            salary: true,
          },
        },
        studentProfile: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
            parents: {
              include: {
                parent: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        parentProfile: {
          include: {
            contacts: { orderBy: { sortOrder: 'asc' } },
            consents: { take: 50, orderBy: { updatedAt: 'desc' } },
            students: {
              include: {
                student: {
                  include: {
                    class: {
                      select: {
                        id: true,
                        name: true,
                        level: true,
                      },
                    },
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                    pickupAuthorizations: { take: 15, orderBy: { createdAt: 'desc' } },
                  },
                },
              },
            },
          },
        },
        educatorProfile: {
          select: {
            id: true,
            employeeId: true,
            specialization: true,
            hireDate: true,
            contractType: true,
            salary: true,
          },
        },
        staffProfile: {
          select: {
            id: true,
            employeeId: true,
            staffCategory: true,
            supportKind: true,
            jobTitle: true,
            department: true,
            hireDate: true,
            contractType: true,
            salary: true,
            visibleStaffModules: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const userForSession = await withSyncedStaffModules(user);
    res.json(decryptSessionUserPayload(userForSession));
  } catch (error: any) {
    console.error('Erreur dans /auth/me:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/2fa/setup', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { secretEncrypted, otpauthUrl } = generateTwoFactorSecret(user.email);
    await prisma.userTwoFactorSettings.upsert({
      where: { userId: user.id },
      update: {
        enabled: false,
        method: 'TOTP',
        secretEncrypted,
      },
      create: {
        userId: user.id,
        enabled: false,
        method: 'TOTP',
        secretEncrypted,
      },
    });

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    res.json({ otpauthUrl, qrCodeDataUrl });
  } catch (error: any) {
    console.error('POST /auth/2fa/setup:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/2fa/verify', authenticate, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code requis' });
    }
    const settings = await prisma.userTwoFactorSettings.findUnique({
      where: { userId: req.user!.id },
    });
    if (!settings) return res.status(404).json({ error: 'Configuration 2FA introuvable' });

    const ok = verifyTwoFactorToken(settings.secretEncrypted, code);
    if (!ok) return res.status(400).json({ error: 'Code invalide' });

    await prisma.userTwoFactorSettings.update({
      where: { userId: req.user!.id },
      data: {
        enabled: true,
        lastVerifiedAt: new Date(),
      },
    });
    res.json({ ok: true, enabled: true });
  } catch (error: any) {
    console.error('POST /auth/2fa/verify:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/2fa/disable', authenticate, async (req: AuthRequest, res) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const valid = await comparePassword(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Mot de passe invalide' });

    await prisma.userTwoFactorSettings.updateMany({
      where: { userId: req.user!.id },
      data: { enabled: false },
    });
    res.json({ ok: true, enabled: false });
  } catch (error: any) {
    console.error('POST /auth/2fa/disable:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Demande de réinitialisation de mot de passe
router.post(
  '/forgot-password',
  authForgotPasswordLimiter,
  [body('email').isEmail().withMessage('Email invalide')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const emailNorm = String(req.body.email ?? '')
        .trim()
        .toLowerCase();

      const user = await prisma.user.findUnique({
        where: { email: emailNorm },
      });

      // Pour la sécurité, ne pas révéler si l'email existe
      // On retourne toujours le même message
      if (!user || !user.isActive) {
        return res.json({
          message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
        });
      }

      // Créer un token de réinitialisation
      const token = await createPasswordResetToken(user.id);

      // Envoyer l'email de réinitialisation
      await sendPasswordResetEmail(emailNorm, token, user.firstName);

      res.json({
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
      });
    } catch (error: any) {
      console.error('Erreur lors de la demande de réinitialisation:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
  }
);

// Réinitialisation de mot de passe avec token
router.post(
  '/reset-password',
  authResetPasswordLimiter,
  [
    body('token').notEmpty().withMessage('Token requis'),
    body('password').custom(assertPasswordPolicy).withMessage(PASSWORD_POLICY_HINT),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      // Vérifier le token
      const tokenVerification = await verifyResetToken(token);
      if (!tokenVerification.valid || !tokenVerification.userId) {
        return res.status(400).json({ error: 'Token invalide ou expiré' });
      }

      // Hasher le nouveau mot de passe
      const hashedPassword = await hashPassword(password);

      // Mettre à jour le mot de passe de l'utilisateur
      await prisma.user.update({
        where: { id: tokenVerification.userId },
        data: { password: hashedPassword },
      });

      // Marquer le token comme utilisé
      await markTokenAsUsed(token);

      // Enregistrer l'événement de sécurité
      await prisma.securityEvent.create({
        data: {
          userId: tokenVerification.userId,
          type: 'password_reset',
          description: 'Mot de passe réinitialisé via le lien de réinitialisation',
          severity: 'info',
        },
      });

      res.json({
        message: 'Mot de passe réinitialisé avec succès',
      });
    } catch (error: unknown) {
      console.error('Erreur lors de la réinitialisation:', error);
      const message = error instanceof Error ? error.message : 'Erreur serveur';
      const status = message.includes('mot de passe') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  }
);

// —— RGPD : portabilité et demandes d’effacement ——

router.get('/gdpr/export', authenticate, gdprExportLimiter, async (req: AuthRequest, res) => {
  try {
    const payload = await buildGdprDataExport(req.user!.id);
    const safeName = `${req.user!.email.replace(/[^a-zA-Z0-9._-]/g, '_')}-${new Date().toISOString().slice(0, 10)}`;
    const filename = `school-manager-donnees-${safeName}.json`;

    try {
      await prisma.securityEvent.create({
        data: {
          userId: req.user!.id,
          type: 'gdpr_data_export',
          description: 'Export JSON des données personnelles (droit de portabilité)',
          ipAddress: req.ip || req.socket.remoteAddress || undefined,
          userAgent: req.get('user-agent') || undefined,
          severity: 'info',
        },
      });
    } catch (_) {
      /* ne pas bloquer l’export */
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error: unknown) {
    console.error('GET /auth/gdpr/export:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/gdpr/erasure-request',
  authenticate,
  gdprErasureRequestLimiter,
  [body('details').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.user!.role === 'ADMIN') {
        return res.status(403).json({
          error:
            'Pour les comptes administrateurs, l’effacement ou la limitation se fait selon une procédure interne. Contactez le responsable du traitement (DPO / direction).',
        });
      }

      const details =
        typeof req.body?.details === 'string' ? req.body.details.trim().slice(0, 2000) : '';

      await prisma.securityEvent.create({
        data: {
          userId: req.user!.id,
          type: 'gdpr_erasure_request',
          description: `Demande d'effacement / limitation RGPD — ${req.user!.email}${details ? ` — ${details}` : ''}`,
          ipAddress: req.ip || req.socket.remoteAddress || undefined,
          userAgent: req.get('user-agent') || undefined,
          severity: 'warning',
        },
      });

      const to = process.env.GDPR_CONTACT_EMAIL?.trim() || process.env.EMAIL_FROM?.trim();
      if (to) {
        const subject = `[RGPD] Demande concernant les données — ${req.user!.email}`;
        const text = [
          `Compte : ${req.user!.email} (${req.user!.role})`,
          `ID utilisateur : ${req.user!.id}`,
          details ? `Précisions : ${details}` : '(aucune précision)',
          '',
          'Traiter cette demande conformément au RGPD et aux obligations de conservation du service scolaire.',
        ].join('\n');
        const esc = (s: string) =>
          s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        await sendTransactionalHtmlEmail(
          to,
          subject,
          text,
          `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`
        );
      }

      res.json({
        message:
          'Votre demande a été enregistrée. Le responsable du traitement peut vous contacter pour confirmer l’identité ou expliquer les éventuelles obligations de conservation.',
      });
    } catch (error: unknown) {
      console.error('POST /auth/gdpr/erasure-request:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  }
);

export default router;

