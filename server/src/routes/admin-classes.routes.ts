import express from 'express';
import type { Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import type { SchoolContextRequest } from '../utils/school-context.util';
import { classScopeWhere } from '../utils/school-context.util';

const router = express.Router();

// ========== GESTION DES CLASSES ==========

// Lister toutes les classes
router.get('/classes', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const classes = await prisma.class.findMany({
      where: classScopeWhere(schoolId, req.school?.isDefault),
      include: {
        track: {
          select: { id: true, name: true, code: true, academicYear: true },
        },
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        students: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    res.json(classes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Créer une classe
router.post(
  '/classes',
  [
    body('name').notEmpty(),
    body('level').notEmpty(),
    body('academicYear').notEmpty(),
  ],
  async (req: SchoolContextRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, level, room, capacity, academicYear, teacherId, trackId } = req.body;
      const schoolId = req.schoolId!;

      const newClass = await prisma.class.create({
        data: {
          name,
          level,
          room,
          capacity: capacity || 30,
          academicYear,
          schoolId,
          teacherId,
          trackId: typeof trackId === 'string' && trackId.trim() ? trackId.trim() : undefined,
        },
        include: {
          track: {
            select: { id: true, name: true, code: true, academicYear: true },
          },
          teacher: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      res.status(201).json(newClass);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch('/classes/:id', async (req, res) => {
  try {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Classe introuvable' });
    }
    const b = req.body as Record<string, unknown>;
    const data: Prisma.ClassUncheckedUpdateInput = {};
    if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim();
    if (typeof b.level === 'string' && b.level.trim()) data.level = b.level.trim();
    if (b.room !== undefined) data.room = typeof b.room === 'string' ? b.room.trim() || null : null;
    if (b.capacity !== undefined) data.capacity = Number(b.capacity) || 30;
    if (typeof b.academicYear === 'string' && b.academicYear.trim()) {
      data.academicYear = b.academicYear.trim();
    }
    if (b.teacherId !== undefined) {
      data.teacherId = typeof b.teacherId === 'string' && b.teacherId.trim() ? b.teacherId.trim() : null;
    }
    if (b.trackId !== undefined) {
      data.trackId = typeof b.trackId === 'string' && b.trackId.trim() ? b.trackId.trim() : null;
    }
    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data,
      include: {
        track: { select: { id: true, name: true, code: true, academicYear: true } },
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
