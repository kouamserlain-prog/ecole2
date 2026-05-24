import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from '../utils/admin-user-initial-password.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';
import {
  educatorClassAssignmentInclude,
  parseEducatorClassIds,
  syncEducatorClassAssignments,
} from '../utils/educator-class-assignment.util';

const router = express.Router();


// Rechercher un éducateur par NFC ID
router.get('/educators/nfc/:nfcId', async (req, res) => {
  try {
    const { nfcId } = req.params;

    const educator = await prisma.educator.findFirst({
      where: { nfcId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    res.json(educator);
  } catch (error: any) {
    console.error('Error finding educator by NFC:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Lister tous les éducateurs
router.get('/educators', async (req, res) => {
  try {
    const educators = await prisma.educator.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
        ...educatorClassAssignmentInclude,
      },
    });

    res.json(
      educators.map((e) => ({
        ...e,
        assignedClasses: e.classAssignments.map((a) => a.class),
      })),
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un éducateur
router.post(
  '/educators',
  [
    body('email').isEmail(),
    body('password')
      .optional({ values: 'falsy' })
      .trim()
      .custom(optionalPasswordPolicyValidator)
      .withMessage(PASSWORD_POLICY_HINT),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('employeeId').notEmpty(),
    body('specialization').notEmpty(),
    body('hireDate').isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        employeeId,
        specialization,
        hireDate,
        contractType,
        salary,
        classIds: classIdsRaw,
      } = req.body;

      const classIds = parseEducatorClassIds(classIdsRaw);

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      const existingEmployee = await prisma.educator.findUnique({
        where: { employeeId },
      });

      if (existingEmployee) {
        return res.status(400).json({ error: 'Ce numéro d\'employé existe déjà' });
      }

      const { hashedPassword, shouldSendSetupEmail } = await resolveAdminProvidedOrInvitePassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: 'EDUCATOR',
          educatorProfile: {
            create: {
              employeeId,
              specialization,
              hireDate: new Date(hireDate),
              contractType: contractType || 'CDI',
              salary,
            },
          },
        },
        include: {
          educatorProfile: true,
        },
      });

      if (shouldSendSetupEmail) {
        try {
          await inviteNewUserToSetPassword(user.id, user.email, user.firstName);
        } catch (inviteErr) {
          console.error('Invitation mot de passe (éducateur):', inviteErr);
        }
      }

      const educatorId = user.educatorProfile?.id;
      if (educatorId && classIds.length > 0) {
        await syncEducatorClassAssignments(educatorId, classIds);
      }

      const { password: _pw, ...userWithoutPassword } = user;
      res.status(201).json({ ...userWithoutPassword, passwordSetupEmailSent: shouldSendSetupEmail });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtenir un éducateur par ID
router.get('/educators/:id', async (req, res) => {
  try {
    const educator = await prisma.educator.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
        ...educatorClassAssignmentInclude,
      },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    res.json({
      ...educator,
      assignedClasses: educator.classAssignments.map((a) => a.class),
    });
  } catch (error: any) {
    console.error('Erreur dans /admin/educators/:id:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Mettre à jour un éducateur
router.put('/educators/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      specialization,
      contractType,
      salary,
      isActive,
      nfcId,
      classIds: classIdsRaw,
    } = req.body;

    const educator = await prisma.educator.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    // Mettre à jour l'utilisateur
    await prisma.user.update({
      where: { id: educator.userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Mettre à jour le profil éducateur
    const updatedEducator = await prisma.educator.update({
      where: { id: req.params.id },
      data: {
        ...(specialization !== undefined && { specialization }),
        ...(contractType !== undefined && { contractType }),
        ...(salary !== undefined && { salary }),
        ...(nfcId !== undefined && { nfcId: nfcId || null }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
        ...educatorClassAssignmentInclude,
      },
    });

    if (classIdsRaw !== undefined) {
      await syncEducatorClassAssignments(req.params.id, parseEducatorClassIds(classIdsRaw));
    }

    const withAssignments = await prisma.educator.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
        ...educatorClassAssignmentInclude,
      },
    });

    res.json({
      ...(withAssignments ?? updatedEducator),
      assignedClasses: (withAssignments ?? updatedEducator).classAssignments.map((a) => a.class),
    });
  } catch (error: any) {
    console.error('Erreur dans /admin/educators/:id PUT:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer un éducateur
router.delete('/educators/:id', async (req, res) => {
  try {
    const educator = await prisma.educator.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    // Utiliser une transaction pour supprimer toutes les relations dans le bon ordre
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les évaluations de conduite créées par cet éducateur
      // Note: On ne supprime pas les évaluations, on les garde pour l'historique
      // Mais on pourrait mettre à jour evaluatedByRole si nécessaire

      // 2. Supprimer le profil éducateur
      await tx.educator.delete({
        where: { id: req.params.id },
      });

      // 3. Supprimer l'utilisateur associé
      await tx.user.delete({
        where: { id: educator.userId },
      });
    });

    res.json({ message: 'Éducateur supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'éducateur:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la suppression',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


export default router;
