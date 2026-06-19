import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../../utils/prisma';
import type { AuthRequest } from '../../middleware/auth.middleware';

const router = express.Router();

const KINDS = ['EBOOK', 'PDF', 'PEDAGOGICAL'] as const;
const ROLES = ['STUDENT', 'TEACHER', 'PARENT', 'EDUCATOR', 'STAFF'] as const;

router.get('/library/digital-resources', async (req, res) => {
  try {
    const { kind, isActive, q } = req.query;
    const where: Record<string, unknown> = {};
    if (kind && typeof kind === 'string') where.kind = kind;
    if (isActive === 'false') where.isActive = false;
    else if (isActive !== 'all') where.isActive = true;
    if (q && typeof q === 'string' && q.trim()) {
      const s = q.trim();
      where.OR = [{ title: { contains: s } }, { author: { contains: s } }, { subject: { contains: s } }];
    }
    const rows = await prisma.digitalLibraryResource.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/library/digital-resources',
  [
    body('title').trim().notEmpty(),
    body('kind').isIn(KINDS),
    body('fileUrl').trim().notEmpty(),
    body('onlineAccessEnabled').optional().isBoolean(),
    body('tempDownloadEnabled').optional().isBoolean(),
    body('downloadTtlHours').optional().isInt({ min: 1, max: 168 }),
    body('allowedRoles').optional().isArray(),
  ],
  async (req: AuthRequest, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const {
        title,
        author,
        description,
        kind,
        fileUrl,
        fileName,
        mimeType,
        fileSizeBytes,
        coverImageUrl,
        subject,
        level,
        onlineAccessEnabled,
        tempDownloadEnabled,
        downloadTtlHours,
        allowedRoles,
        isActive,
        publishedAt,
      } = req.body;

      const roles = Array.isArray(allowedRoles)
        ? allowedRoles.map((r: string) => String(r).toUpperCase()).filter((r: string) => ROLES.includes(r as never))
        : [];

      const created = await prisma.digitalLibraryResource.create({
        data: {
          title: String(title).trim(),
          author: author ? String(author).trim() : null,
          description: description ? String(description).trim() : null,
          kind,
          fileUrl: String(fileUrl).trim(),
          fileName: fileName ? String(fileName).trim() : null,
          mimeType: mimeType ? String(mimeType).trim() : null,
          fileSizeBytes: fileSizeBytes != null ? Number(fileSizeBytes) : null,
          coverImageUrl: coverImageUrl ? String(coverImageUrl).trim() : null,
          subject: subject ? String(subject).trim() : null,
          level: level ? String(level).trim() : null,
          onlineAccessEnabled: onlineAccessEnabled !== false,
          tempDownloadEnabled: tempDownloadEnabled !== false,
          downloadTtlHours: downloadTtlHours != null ? Number(downloadTtlHours) : 48,
          allowedRoles: roles,
          isActive: isActive !== false,
          publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
          createdById: req.user?.id ?? null,
        },
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  },
);

router.put('/library/digital-resources/:id', async (req, res) => {
  try {
    const existing = await prisma.digitalLibraryResource.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Ressource introuvable' });

    const b = req.body ?? {};
    const roles =
      b.allowedRoles !== undefined && Array.isArray(b.allowedRoles)
        ? b.allowedRoles.map((r: string) => String(r).toUpperCase()).filter((r: string) => ROLES.includes(r as never))
        : undefined;

    const updated = await prisma.digitalLibraryResource.update({
      where: { id: req.params.id },
      data: {
        ...(b.title !== undefined && { title: String(b.title).trim() }),
        ...(b.author !== undefined && { author: b.author ? String(b.author).trim() : null }),
        ...(b.description !== undefined && { description: b.description ? String(b.description).trim() : null }),
        ...(b.kind !== undefined && KINDS.includes(b.kind) && { kind: b.kind }),
        ...(b.fileUrl !== undefined && { fileUrl: String(b.fileUrl).trim() }),
        ...(b.fileName !== undefined && { fileName: b.fileName ? String(b.fileName).trim() : null }),
        ...(b.mimeType !== undefined && { mimeType: b.mimeType ? String(b.mimeType).trim() : null }),
        ...(b.fileSizeBytes !== undefined && {
          fileSizeBytes: b.fileSizeBytes == null ? null : Number(b.fileSizeBytes),
        }),
        ...(b.coverImageUrl !== undefined && { coverImageUrl: b.coverImageUrl ? String(b.coverImageUrl).trim() : null }),
        ...(b.subject !== undefined && { subject: b.subject ? String(b.subject).trim() : null }),
        ...(b.level !== undefined && { level: b.level ? String(b.level).trim() : null }),
        ...(b.onlineAccessEnabled !== undefined && { onlineAccessEnabled: Boolean(b.onlineAccessEnabled) }),
        ...(b.tempDownloadEnabled !== undefined && { tempDownloadEnabled: Boolean(b.tempDownloadEnabled) }),
        ...(b.downloadTtlHours !== undefined && { downloadTtlHours: Number(b.downloadTtlHours) }),
        ...(roles !== undefined && { allowedRoles: roles }),
        ...(b.isActive !== undefined && { isActive: Boolean(b.isActive) }),
        ...(b.publishedAt !== undefined && { publishedAt: b.publishedAt ? new Date(b.publishedAt) : null }),
      },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.delete('/library/digital-resources/:id', async (req, res) => {
  try {
    const existing = await prisma.digitalLibraryResource.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Ressource introuvable' });

    await prisma.digitalLibraryResource.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Ressource archivée' });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/library/digital-resources/:id/restore', async (req, res) => {
  try {
    const existing = await prisma.digitalLibraryResource.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Ressource introuvable' });
    if (existing.isActive) {
      return res.status(400).json({ error: 'Cette ressource n’est pas archivée' });
    }

    const updated = await prisma.digitalLibraryResource.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
