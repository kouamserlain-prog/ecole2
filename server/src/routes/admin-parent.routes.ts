import express from 'express';
import { body, validationResult } from 'express-validator';
import type { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import type { AuthRequest } from '../middleware/auth.middleware';
import type { SchoolContextRequest } from '../utils/school-context.util';
import { guardAdminParentRoute } from '../middleware/admin-parent-school-guard.middleware';
import {
  assertStudentInSchool,
  scopedParentWhere,
  SchoolAccessDeniedError,
} from '../utils/school-access-guard.util';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from '../utils/admin-user-initial-password.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';

const router = express.Router();

router.use('/parents/:id', guardAdminParentRoute);
router.use('/parents/:parentId', guardAdminParentRoute);

const userPublic = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const PARENT_RELATIONS = ['father', 'mother', 'guardian', 'other'] as const;

async function assertParentOwnsStudent(parentId: string, studentId: string): Promise<boolean> {
  const link = await prisma.studentParent.findFirst({
    where: { parentId, studentId },
    select: { id: true },
  });
  return Boolean(link);
}

router.get('/parents', async (req: SchoolContextRequest, res) => {
  try {
    const rows = await prisma.parent.findMany({
      where: scopedParentWhere(req.schoolId!),
      include: {
        user: { select: userPublic },
        _count: { select: { students: true, contacts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/parents',
  [
    body('email').isEmail().normalizeEmail(),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('password')
      .optional({ values: 'falsy' })
      .trim()
      .custom(optionalPasswordPolicyValidator)
      .withMessage(PASSWORD_POLICY_HINT),
    body('phone').optional({ values: 'falsy' }).trim(),
    body('profession').optional({ values: 'falsy' }).trim(),
    body('studentId').isString().notEmpty(),
    body('relation').optional().isIn(PARENT_RELATIONS),
  ],
  async (req: SchoolContextRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        email: rawEmail,
        firstName,
        lastName,
        password,
        phone,
        profession,
        studentId,
        relation,
      } = req.body as {
        email: string;
        firstName: string;
        lastName: string;
        password?: string;
        phone?: string;
        profession?: string;
        studentId: string;
        relation?: string;
      };

      const email = rawEmail.trim().toLowerCase();

      try {
        await assertStudentInSchool(studentId, req.schoolId, req.school?.isDefault ?? false);
      } catch (e) {
        if (e instanceof SchoolAccessDeniedError) {
          return res.status(e.status).json({ error: e.message });
        }
        throw e;
      }

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: { select: { email: true } } },
      });
      if (!student) {
        return res.status(404).json({ error: 'Élève introuvable' });
      }

      const studentEmail = String(student.user?.email ?? '')
        .trim()
        .toLowerCase();
      if (studentEmail && studentEmail === email) {
        return res.status(400).json({
          error: "L'e-mail du parent ne peut pas être identique à celui de l'élève.",
        });
      }

      const rel =
        relation && PARENT_RELATIONS.includes(relation as (typeof PARENT_RELATIONS)[number])
          ? relation
          : 'guardian';

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { parentProfile: true },
      });

      if (existingUser && existingUser.role !== 'PARENT') {
        return res.status(400).json({
          error: 'Cet e-mail est déjà utilisé par un compte avec un autre rôle.',
        });
      }

      let setupEmailSent = false;
      let parentId: string;

      if (existingUser) {
        const parent =
          existingUser.parentProfile ??
          (await prisma.parent.create({ data: { userId: existingUser.id } }));
        parentId = parent.id;

        const existingLink = await prisma.studentParent.findFirst({
          where: { parentId, studentId },
        });
        if (existingLink) {
          return res.status(409).json({
            error: 'Ce parent est déjà rattaché à cet élève.',
          });
        }

        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            ...(phone?.trim() ? { phone: phone.trim() } : {}),
          },
        });
        if (profession?.trim()) {
          await prisma.parent.update({
            where: { id: parentId },
            data: { profession: profession.trim() },
          });
        }

        await prisma.studentParent.create({
          data: { parentId, studentId, relation: rel },
        });
      } else {
        const { hashedPassword, shouldSendSetupEmail } =
          await resolveAdminProvidedOrInvitePassword(password);

        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone?.trim() || undefined,
            role: 'PARENT',
            isActive: true,
            parentProfile: {
              create: {
                ...(profession?.trim() ? { profession: profession.trim() } : {}),
              },
            },
          },
          include: { parentProfile: true },
        });

        if (!user.parentProfile) {
          return res.status(500).json({ error: 'Profil parent non créé' });
        }
        parentId = user.parentProfile.id;

        await prisma.studentParent.create({
          data: { parentId, studentId, relation: rel },
        });

        if (shouldSendSetupEmail) {
          try {
            await inviteNewUserToSetPassword(user.id, user.email, user.firstName);
            setupEmailSent = true;
          } catch (inviteErr) {
            console.error('Invitation mot de passe (parent):', inviteErr);
          }
        }
      }

      const parent = await prisma.parent.findUnique({
        where: { id: parentId },
        include: {
          user: { select: userPublic },
          _count: { select: { students: true, contacts: true } },
        },
      });

      res.status(201).json({ parent, setupEmailSent, linkedExistingUser: Boolean(existingUser) });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  },
);

router.get('/parents/:id', async (req, res) => {
  try {
    const parent = await prisma.parent.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: userPublic },
        contacts: { orderBy: { sortOrder: 'asc' } },
        interactionLogs: { orderBy: { createdAt: 'desc' }, take: 250 },
        consents: { orderBy: { updatedAt: 'desc' }, take: 100 },
        students: {
          include: {
            student: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
                class: { select: { id: true, name: true, level: true } },
                pickupAuthorizations: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });
    if (!parent) {
      return res.status(404).json({ error: 'Parent introuvable' });
    }
    res.json(parent);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/parents/:id/students',
  [body('studentId').isString().notEmpty(), body('relation').optional().isString()],
  async (req: SchoolContextRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const parent = await prisma.parent.findUnique({ where: { id: req.params.id } });
      if (!parent) {
        return res.status(404).json({ error: 'Parent introuvable' });
      }

      const { studentId, relation } = req.body as { studentId: string; relation?: string };
      try {
        await assertStudentInSchool(studentId, req.schoolId, req.school?.isDefault ?? false);
      } catch (e) {
        if (e instanceof SchoolAccessDeniedError) {
          return res.status(e.status).json({ error: e.message });
        }
        throw e;
      }
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (!student) {
        return res.status(404).json({ error: 'Élève introuvable' });
      }

      const rel =
        relation && PARENT_RELATIONS.includes(relation as (typeof PARENT_RELATIONS)[number])
          ? relation
          : 'guardian';

      const existing = await prisma.studentParent.findFirst({
        where: { parentId: parent.id, studentId },
      });
      if (existing) {
        return res.status(409).json({ error: 'Cet élève est déjà rattaché à ce parent' });
      }

      const link = await prisma.studentParent.create({
        data: {
          parentId: parent.id,
          studentId,
          relation: rel,
        },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
              class: { select: { id: true, name: true, level: true } },
            },
          },
        },
      });

      res.status(201).json(link);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  }
);

router.delete('/parents/:id/students/:studentId', async (req: SchoolContextRequest, res) => {
  try {
    try {
      await assertStudentInSchool(req.params.studentId, req.schoolId, req.school?.isDefault ?? false);
    } catch (e) {
      if (e instanceof SchoolAccessDeniedError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }
    const link = await prisma.studentParent.findFirst({
      where: { parentId: req.params.id, studentId: req.params.studentId },
    });
    if (!link) {
      return res.status(404).json({ error: 'Lien parent-élève introuvable' });
    }
    await prisma.studentParent.delete({ where: { id: link.id } });
    res.json({ message: 'Lien supprimé' });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/parents/:id', async (req, res) => {
  try {
    const parent = await prisma.parent.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!parent) {
      return res.status(404).json({ error: 'Parent introuvable' });
    }

    const {
      firstName,
      lastName,
      phone,
      isActive,
      profession,
      preferredLocale,
      notifyEmail,
      notifySms,
      portalShowFees,
      portalShowGrades,
      portalShowAttendance,
      internalNotes,
    } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: parent.userId },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(phone !== undefined && { phone: phone || null }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
      });
      await tx.parent.update({
        where: { id: req.params.id },
        data: {
          ...(profession !== undefined && { profession: profession || null }),
          ...(preferredLocale !== undefined && { preferredLocale: preferredLocale || null }),
          ...(notifyEmail !== undefined && { notifyEmail: Boolean(notifyEmail) }),
          ...(notifySms !== undefined && { notifySms: Boolean(notifySms) }),
          ...(portalShowFees !== undefined && { portalShowFees: Boolean(portalShowFees) }),
          ...(portalShowGrades !== undefined && { portalShowGrades: Boolean(portalShowGrades) }),
          ...(portalShowAttendance !== undefined && {
            portalShowAttendance: Boolean(portalShowAttendance),
          }),
          ...(internalNotes !== undefined && {
            internalNotes: internalNotes === null || internalNotes === '' ? null : String(internalNotes),
          }),
        },
      });
    });

    const updated = await prisma.parent.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: userPublic },
        contacts: { orderBy: { sortOrder: 'asc' } },
        interactionLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        consents: { orderBy: { updatedAt: 'desc' } },
        students: {
          include: {
            student: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
                class: { select: { id: true, name: true } },
                pickupAuthorizations: { orderBy: { createdAt: 'desc' } },
              },
            },
          },
        },
      },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/parents/:id/contacts',
  [body('label').trim().notEmpty(), body('phone').optional().trim(), body('email').optional().trim()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const parent = await prisma.parent.findUnique({ where: { id: req.params.id } });
      if (!parent) {
        return res.status(404).json({ error: 'Parent introuvable' });
      }
      const { label, phone, email, sortOrder } = req.body;
      const row = await prisma.parentContact.create({
        data: {
          parentId: req.params.id,
          label: String(label).trim(),
          phone: phone ? String(phone).trim() : null,
          email: email ? String(email).trim() : null,
          sortOrder: sortOrder != null ? Number(sortOrder) : 0,
        },
      });
      res.status(201).json(row);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  }
);

router.delete('/parents/:id/contacts/:contactId', async (req, res) => {
  try {
    const row = await prisma.parentContact.findFirst({
      where: { id: req.params.contactId, parentId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Contact introuvable' });
    }
    await prisma.parentContact.delete({ where: { id: row.id } });
    res.json({ message: 'Contact supprimé' });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/parents/:id/interactions', async (req, res) => {
  try {
    const rows = await prisma.parentInteraction.findMany({
      where: { parentId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/parents/:id/interactions',
  [body('channel').isIn(['PHONE', 'EMAIL', 'SMS', 'MEETING', 'PORTAL_MESSAGE', 'WHATSAPP', 'OTHER'])],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const parent = await prisma.parent.findUnique({ where: { id: req.params.id } });
      if (!parent) {
        return res.status(404).json({ error: 'Parent introuvable' });
      }
      const { channel, subject, body: textBody } = req.body;
      const row = await prisma.parentInteraction.create({
        data: {
          parentId: req.params.id,
          channel,
          subject: subject ? String(subject).slice(0, 200) : null,
          body: textBody ? String(textBody).slice(0, 8000) : null,
          createdByUserId: req.user?.id ?? null,
        },
      });
      res.status(201).json(row);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  }
);

router.delete('/parents/:id/interactions/:interactionId', async (req, res) => {
  try {
    const row = await prisma.parentInteraction.findFirst({
      where: { id: req.params.interactionId, parentId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Interaction introuvable' });
    }
    await prisma.parentInteraction.delete({ where: { id: row.id } });
    res.json({ message: 'Interaction supprimée' });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/parents/:id/consents/upsert', async (req: SchoolContextRequest, res) => {
  try {
    const parent = await prisma.parent.findUnique({ where: { id: req.params.id } });
    if (!parent) {
      return res.status(404).json({ error: 'Parent introuvable' });
    }
    const { studentId, consentType, granted, policyVersion, notes } = req.body;
    const allowed = [
      'IMAGE_PUBLICATION',
      'SCHOOL_TRIP',
      'MEDICAL_EMERGENCY',
      'DATA_PROCESSING',
      'COMMUNICATION_CHANNELS',
      'AUTHORIZED_PICKUP_POLICY',
    ];
    if (!consentType || !allowed.includes(consentType)) {
      return res.status(400).json({ error: 'consentType invalide' });
    }
    if (studentId) {
      try {
        await assertStudentInSchool(String(studentId), req.schoolId, req.school?.isDefault ?? false);
      } catch (e) {
        if (e instanceof SchoolAccessDeniedError) {
          return res.status(e.status).json({ error: e.message });
        }
        throw e;
      }
      const ok = await assertParentOwnsStudent(req.params.id, studentId);
      if (!ok) {
        return res.status(400).json({ error: 'Élève non lié à ce parent' });
      }
    }

    const existing = await prisma.parentConsent.findFirst({
      where: {
        parentId: req.params.id,
        consentType,
        ...(studentId ? { studentId } : { studentId: null }),
      },
    });

    if (existing) {
      const u = await prisma.parentConsent.update({
        where: { id: existing.id },
        data: {
          granted: Boolean(granted),
          policyVersion: policyVersion != null ? String(policyVersion).slice(0, 64) : null,
          notes: notes != null ? String(notes).slice(0, 2000) : null,
        },
      });
      return res.json(u);
    }

    const c = await prisma.parentConsent.create({
      data: {
        parentId: req.params.id,
        studentId: studentId || null,
        consentType,
        granted: Boolean(granted),
        policyVersion: policyVersion != null ? String(policyVersion).slice(0, 64) : null,
        notes: notes != null ? String(notes).slice(0, 2000) : null,
      },
    });
    res.status(201).json(c);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.delete('/parents/:id/consents/:consentId', async (req, res) => {
  try {
    const row = await prisma.parentConsent.findFirst({
      where: { id: req.params.consentId, parentId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Consentement introuvable' });
    }
    await prisma.parentConsent.delete({ where: { id: row.id } });
    res.json({ message: 'Supprimé' });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/parents/:id/pickup-authorizations', async (req: SchoolContextRequest, res) => {
  try {
    const { studentId, authorizedName, relationship, phone, identityNote, validFrom, validUntil, isActive } =
      req.body;
    if (!studentId || !authorizedName) {
      return res.status(400).json({ error: 'studentId et authorizedName sont requis' });
    }
    try {
      await assertStudentInSchool(String(studentId), req.schoolId, req.school?.isDefault ?? false);
    } catch (e) {
      if (e instanceof SchoolAccessDeniedError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }
    const ok = await assertParentOwnsStudent(req.params.id, studentId);
    if (!ok) {
      return res.status(403).json({ error: 'Élève non lié à ce parent' });
    }
    const row = await prisma.studentPickupAuthorization.create({
      data: {
        studentId,
        declaredByParentId: req.params.id,
        authorizedName: String(authorizedName).trim(),
        relationship: relationship ? String(relationship).slice(0, 120) : null,
        phone: phone ? String(phone).trim() : null,
        identityNote: identityNote ? String(identityNote).slice(0, 500) : null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: isActive !== false,
      },
    });
    res.status(201).json(row);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/parents/:parentId/pickup-authorizations/:pickupId', async (req: SchoolContextRequest, res) => {
  try {
    const row = await prisma.studentPickupAuthorization.findFirst({
      where: { id: req.params.pickupId },
    });
    if (!row) {
      return res.status(404).json({ error: 'Autorisation introuvable' });
    }
    try {
      await assertStudentInSchool(row.studentId, req.schoolId, req.school?.isDefault ?? false);
    } catch (e) {
      if (e instanceof SchoolAccessDeniedError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }
    const ok = await assertParentOwnsStudent(req.params.parentId, row.studentId);
    if (!ok) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const { authorizedName, relationship, phone, identityNote, validFrom, validUntil, isActive } = req.body;
    const updated = await prisma.studentPickupAuthorization.update({
      where: { id: row.id },
      data: {
        ...(authorizedName !== undefined && { authorizedName: String(authorizedName).trim() }),
        ...(relationship !== undefined && {
          relationship: relationship ? String(relationship).slice(0, 120) : null,
        }),
        ...(phone !== undefined && { phone: phone ? String(phone).trim() : null }),
        ...(identityNote !== undefined && {
          identityNote: identityNote ? String(identityNote).slice(0, 500) : null,
        }),
        ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : row.validFrom }),
        ...(validUntil !== undefined && {
          validUntil: validUntil === null || validUntil === '' ? null : new Date(validUntil),
        }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.delete('/parents/:parentId/pickup-authorizations/:pickupId', async (req: SchoolContextRequest, res) => {
  try {
    const row = await prisma.studentPickupAuthorization.findFirst({
      where: { id: req.params.pickupId },
    });
    if (!row) {
      return res.status(404).json({ error: 'Autorisation introuvable' });
    }
    try {
      await assertStudentInSchool(row.studentId, req.schoolId, req.school?.isDefault ?? false);
    } catch (e) {
      if (e instanceof SchoolAccessDeniedError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }
    const ok = await assertParentOwnsStudent(req.params.parentId, row.studentId);
    if (!ok) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    await prisma.studentPickupAuthorization.delete({ where: { id: row.id } });
    res.json({ message: 'Supprimé' });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
