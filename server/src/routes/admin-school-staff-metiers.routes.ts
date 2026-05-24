import { Router } from 'express';
import type { SupportStaffKind } from '@prisma/client';
import type { SchoolContextRequest } from '../utils/school-context.util';
import prisma from '../utils/prisma';
import {
  DEFAULT_SUPPORT_KIND_LABELS,
  listSchoolStaffMetiers,
  seedSchoolStaffMetiers,
  SUPPORT_STAFF_KINDS,
} from '../utils/school-staff-metiers.util';
import {
  normalizeStaffModuleId,
  STAFF_MODULE_LABELS,
  type StaffModuleId,
} from '../utils/staff-visible-modules.util';

const router = Router();

const KIND_SET = new Set<string>(SUPPORT_STAFF_KINDS);

router.get('/school-staff-metiers', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const metiers = await listSchoolStaffMetiers(schoolId);
    res.json({
      metiers,
      moduleLabels: STAFF_MODULE_LABELS,
      defaultKindLabels: DEFAULT_SUPPORT_KIND_LABELS,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ error: msg });
  }
});

router.put('/school-staff-metiers/:supportKind', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const supportKind = String(req.params.supportKind ?? '').trim() as SupportStaffKind;
    if (!KIND_SET.has(supportKind)) {
      return res.status(400).json({ error: 'Type de métier invalide' });
    }

    const { label, description, defaultModules, isActive, sortOrder } = req.body ?? {};

    const existing = await prisma.schoolStaffMetier.findUnique({
      where: { schoolId_supportKind: { schoolId, supportKind } },
    });
    if (!existing) {
      await seedSchoolStaffMetiers(schoolId);
    }

    const modules: StaffModuleId[] = [];
    if (Array.isArray(defaultModules)) {
      const set = new Set<StaffModuleId>(['overview']);
      for (const raw of defaultModules) {
        const id = normalizeStaffModuleId(raw);
        if (id) set.add(id);
      }
      modules.push(...set);
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) {
      data.label = typeof label === 'string' && label.trim() ? label.trim() : null;
    }
    if (description !== undefined) {
      data.description =
        typeof description === 'string' && description.trim() ? description.trim() : null;
    }
    if (modules.length > 0) data.defaultModules = modules;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (sortOrder !== undefined && sortOrder !== null && !Number.isNaN(Number(sortOrder))) {
      data.sortOrder = Number(sortOrder);
    }

    const updated = await prisma.schoolStaffMetier.update({
      where: { schoolId_supportKind: { schoolId, supportKind } },
      data,
    });

    const metiers = await listSchoolStaffMetiers(schoolId);
    const row = metiers.find((m) => m.supportKind === supportKind);
    res.json(row ?? updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ error: msg });
  }
});

/** Réinitialise les métiers de l’établissement actif aux défauts plateforme. */
router.post('/school-staff-metiers/seed-defaults', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    await prisma.schoolStaffMetier.deleteMany({ where: { schoolId } });
    const count = await seedSchoolStaffMetiers(schoolId);
    const metiers = await listSchoolStaffMetiers(schoolId);
    res.json({ ok: true, count, metiers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ error: msg });
  }
});

export default router;
