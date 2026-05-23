import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { upload, identityUpload, digitalLibraryUpload, elearningUpload } from '../middleware/upload.middleware';
import prisma from '../utils/prisma';
import { resolveStoredFileAccessUrl } from '../utils/upload-access-token.util';
import { discardUploadedFile, persistUploadedFile } from '../utils/upload-persist.util';

const IDENTITY_TYPES = [
  'NATIONAL_ID',
  'BIRTH_CERTIFICATE',
  'PASSPORT',
  'RESIDENCE_PERMIT',
  'PHOTO_ID',
  'OTHER',
] as const;

const TEACHER_ADMIN_DOC_TYPES = [
  'CONTRACT',
  'DIPLOMA_COPY',
  'HR_LETTER',
  'CERTIFICATE',
  'OTHER',
] as const;

const router = express.Router();

router.use(authenticate);

router.post('/avatar', upload.single('avatar'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const fullUrl = await persistUploadedFile(req.file, 'avatars', { req });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatar: fullUrl },
    });

    res.json({
      message: 'Avatar uploadé avec succès',
      url: fullUrl,
    });
  } catch (error: any) {
    discardUploadedFile(req.file);
    res.status(500).json({ error: error.message });
  }
});

router.post('/assignment', upload.single('assignment'), async (req: any, res) => {
  try {
    const role = req.user?.role;
    if (!role || !['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      discardUploadedFile(req.file);
      return res.status(403).json({ error: 'Seuls les enseignants et administrateurs peuvent joindre des fichiers aux devoirs' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const fullUrl = await persistUploadedFile(req.file, 'assignments', { req });

    res.json({
      message: 'Fichier uploadé avec succès',
      url: fullUrl,
      filename: req.file.originalname,
    });
  } catch (error: any) {
    discardUploadedFile(req.file);
    res.status(500).json({ error: error.message });
  }
});

router.post('/course', upload.single('course'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const fullUrl = await persistUploadedFile(req.file, 'courses', { req });

    res.json({
      message: 'Image uploadée avec succès',
      url: fullUrl,
    });
  } catch (error: any) {
    discardUploadedFile(req.file);
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/identity-document',
  identityUpload.single('identityDocument'),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const role = req.user?.role;
      const { type, label, notes, studentId: bodyStudentId } = req.body;

      if (!type || !IDENTITY_TYPES.includes(type as (typeof IDENTITY_TYPES)[number])) {
        discardUploadedFile(req.file);
        return res.status(400).json({ error: 'Type de document invalide' });
      }

      let targetStudentId: string;

      if (role === 'ADMIN') {
        if (!bodyStudentId) {
          discardUploadedFile(req.file);
          return res.status(400).json({ error: 'studentId requis pour déposer le document sur un dossier élève' });
        }
        const st = await prisma.student.findUnique({ where: { id: String(bodyStudentId) } });
        if (!st) {
          discardUploadedFile(req.file);
          return res.status(404).json({ error: 'Élève introuvable' });
        }
        targetStudentId = st.id;
      } else if (role === 'STUDENT') {
        const st = await prisma.student.findFirst({ where: { userId: req.user.id } });
        if (!st) {
          discardUploadedFile(req.file);
          return res.status(404).json({ error: 'Profil élève introuvable' });
        }
        targetStudentId = st.id;
      } else {
        discardUploadedFile(req.file);
        return res.status(403).json({ error: 'Seuls les élèves et administrateurs peuvent déposer des pièces' });
      }

      const fileUrl = await persistUploadedFile(req.file, 'identity-documents', { req });

      const doc = await prisma.identityDocument.create({
        data: {
          studentId: targetStudentId,
          type: type as (typeof IDENTITY_TYPES)[number],
          label:
            type === 'OTHER' && label && String(label).trim()
              ? String(label).trim().slice(0, 120)
              : null,
          fileUrl,
          originalName: req.file.originalname.slice(0, 255),
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          notes: notes && String(notes).trim() ? String(notes).trim().slice(0, 500) : null,
          uploadedById: req.user.id,
        },
        include: {
          uploadedBy: { select: { firstName: true, lastName: true, role: true } },
        },
      });

      res.status(201).json({
        message: 'Document enregistré',
        document: {
          ...doc,
          fileUrl: resolveStoredFileAccessUrl(doc.fileUrl),
        },
      });
    } catch (error: any) {
      discardUploadedFile(req.file);
      console.error('POST /upload/identity-document:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
  }
);

router.post(
  '/teacher-admin-document',
  identityUpload.single('teacherAdminDocument'),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      if (req.user?.role !== 'ADMIN') {
        discardUploadedFile(req.file);
        return res.status(403).json({ error: 'Réservé aux administrateurs' });
      }

      const { type, label, notes, teacherId: bodyTeacherId } = req.body;

      if (!bodyTeacherId) {
        discardUploadedFile(req.file);
        return res.status(400).json({ error: 'teacherId requis' });
      }

      if (!type || !TEACHER_ADMIN_DOC_TYPES.includes(type as (typeof TEACHER_ADMIN_DOC_TYPES)[number])) {
        discardUploadedFile(req.file);
        return res.status(400).json({ error: 'Type de document invalide' });
      }

      const t = await prisma.teacher.findUnique({ where: { id: String(bodyTeacherId) } });
      if (!t) {
        discardUploadedFile(req.file);
        return res.status(404).json({ error: 'Enseignant introuvable' });
      }

      const fileUrl = await persistUploadedFile(req.file, 'teacher-admin-documents', { req });

      const doc = await prisma.teacherAdministrativeDocument.create({
        data: {
          teacherId: t.id,
          type: type as (typeof TEACHER_ADMIN_DOC_TYPES)[number],
          label:
            type === 'OTHER' && label && String(label).trim()
              ? String(label).trim().slice(0, 120)
              : null,
          fileUrl,
          originalName: req.file.originalname.slice(0, 255),
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          notes: notes && String(notes).trim() ? String(notes).trim().slice(0, 500) : null,
          uploadedById: req.user.id,
        },
        include: {
          uploadedBy: { select: { firstName: true, lastName: true, role: true } },
        },
      });

      res.status(201).json({
        message: 'Document enregistré',
        document: {
          ...doc,
          fileUrl: resolveStoredFileAccessUrl(doc.fileUrl),
        },
      });
    } catch (error: any) {
      discardUploadedFile(req.file);
      console.error('POST /upload/teacher-admin-document:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
  }
);

router.post('/digital-library', digitalLibraryUpload.single('digitalLibrary'), async (req: any, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    let allowed = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!allowed && role === 'STAFF') {
      const { assertStaffHasModule } = await import('../utils/staff-visible-modules.util');
      try {
        await assertStaffHasModule(userId, 'digital_library');
        allowed = true;
      } catch {
        allowed = false;
      }
    }
    if (!allowed) {
      discardUploadedFile(req.file);
      return res.status(403).json({ error: 'Droit insuffisant pour déposer une ressource numérique' });
    }

    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const fullUrl = await persistUploadedFile(req.file, 'digital-library', { req });

    res.json({
      message: 'Fichier déposé',
      url: fullUrl,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error: unknown) {
    discardUploadedFile(req.file);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/elearning', elearningUpload.single('elearning'), async (req: any, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      discardUploadedFile(req.file);
      return res.status(403).json({ error: 'Droit insuffisant' });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const fullUrl = await persistUploadedFile(req.file, 'elearning', { req });

    res.json({
      message: 'Fichier déposé',
      url: fullUrl,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error: unknown) {
    discardUploadedFile(req.file);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
