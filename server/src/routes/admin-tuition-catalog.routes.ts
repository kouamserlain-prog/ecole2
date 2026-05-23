import express from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  addDays,
  parseScheduleLines,
  splitTotalByPercents,
} from '../utils/tuition-catalog.util';
import {
  getLevelTuitionRates,
  upsertLevelTuitionRates,
  resolveTuitionAmountForStudent,
  TUITION_LEVELS,
} from '../utils/tuition-level-amount.util';

const router = express.Router();

// --- Montants fixes de scolarité par niveau ---

router.get('/tuition-level-rates', async (req, res) => {
  try {
    const academicYear = String(req.query.academicYear ?? '').trim();
    if (!academicYear) {
      return res.status(400).json({ error: 'academicYear est requis' });
    }
    const rates = await getLevelTuitionRates(academicYear);
    res.json({ academicYear, levels: TUITION_LEVELS, rates });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

router.get('/tuition-level-rates/resolve', async (req, res) => {
  try {
    const studentId = String(req.query.studentId ?? '').trim();
    const academicYear = String(req.query.academicYear ?? '').trim();
    if (!studentId || !academicYear) {
      return res.status(400).json({ error: 'studentId et academicYear sont requis' });
    }
    const resolved = await resolveTuitionAmountForStudent(studentId, academicYear);
    if (!resolved) {
      return res.status(404).json({
        error: 'Aucun montant de scolarité défini pour le niveau de cet élève.',
      });
    }
    res.json(resolved);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

router.put('/tuition-level-rates', async (req, res) => {
  try {
    const { academicYear, rates } = req.body as {
      academicYear?: string;
      rates?: { level: string; amount: number }[];
    };
    if (!academicYear || !Array.isArray(rates)) {
      return res.status(400).json({ error: 'academicYear et rates[] sont requis' });
    }
    const saved = await upsertLevelTuitionRates(String(academicYear), rates);
    const updated = await getLevelTuitionRates(String(academicYear));
    res.json({
      message: 'Montants par niveau enregistrés',
      saved: saved.length,
      rates: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    res.status(400).json({ error: msg });
  }
});

// --- Catalogue de frais ---

router.get('/tuition-fee-catalog', async (_req, res) => {
  try {
    const rows = await prisma.tuitionFeeCatalog.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      include: {
        class: { select: { id: true, name: true, level: true, academicYear: true } },
      },
    });
    res.json(rows);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

router.post('/tuition-fee-catalog', async (req, res) => {
  try {
    const {
      label,
      academicYear,
      scope,
      classLevel,
      classId,
      programLabel,
      feeType,
      billingPeriod,
      defaultAmount,
      periodLabelHint,
      sortOrder,
      isActive,
    } = req.body;
    if (!label || defaultAmount == null) {
      return res.status(400).json({ error: 'label et defaultAmount sont requis' });
    }
    const row = await prisma.tuitionFeeCatalog.create({
      data: {
        label: String(label).trim(),
        academicYear: academicYear ? String(academicYear) : null,
        scope: scope || 'BY_LEVEL',
        classLevel: classLevel ? String(classLevel) : null,
        classId: classId || null,
        programLabel: programLabel ? String(programLabel) : null,
        feeType: feeType || 'TUITION',
        billingPeriod: billingPeriod || 'ONE_TIME',
        defaultAmount: Number(defaultAmount),
        periodLabelHint: periodLabelHint ? String(periodLabelHint) : null,
        sortOrder: sortOrder != null ? Number(sortOrder) : 0,
        isActive: isActive !== false,
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
      },
    });
    res.status(201).json(row);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

router.put('/tuition-fee-catalog/:id', async (req, res) => {
  try {
    const {
      label,
      academicYear,
      scope,
      classLevel,
      classId,
      programLabel,
      feeType,
      billingPeriod,
      defaultAmount,
      periodLabelHint,
      sortOrder,
      isActive,
    } = req.body;
    const row = await prisma.tuitionFeeCatalog.update({
      where: { id: req.params.id },
      data: {
        ...(label !== undefined && { label: String(label).trim() }),
        ...(academicYear !== undefined && { academicYear: academicYear ? String(academicYear) : null }),
        ...(scope !== undefined && { scope }),
        ...(classLevel !== undefined && { classLevel: classLevel ? String(classLevel) : null }),
        ...(classId !== undefined && { classId: classId || null }),
        ...(programLabel !== undefined && { programLabel: programLabel ? String(programLabel) : null }),
        ...(feeType !== undefined && { feeType }),
        ...(billingPeriod !== undefined && { billingPeriod }),
        ...(defaultAmount !== undefined && { defaultAmount: Number(defaultAmount) }),
        ...(periodLabelHint !== undefined && {
          periodLabelHint: periodLabelHint ? String(periodLabelHint) : null,
        }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
      },
    });
    res.json(row);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

router.delete('/tuition-fee-catalog/:id', async (req, res) => {
  try {
    await prisma.tuitionFeeCatalog.delete({ where: { id: req.params.id } });
    res.json({ message: 'Supprimé' });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

// --- Gabarits d’échéancier ---

router.get('/tuition-payment-schedule-templates', async (_req, res) => {
  try {
    const rows = await prisma.tuitionPaymentScheduleTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

router.post('/tuition-payment-schedule-templates', async (req, res) => {
  try {
    const { name, description, academicYear, lines, isActive } = req.body;
    if (!name) return res.status(400).json({ error: 'name est requis' });
    const parsed = parseScheduleLines(lines);
    const row = await prisma.tuitionPaymentScheduleTemplate.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description) : null,
        academicYear: academicYear ? String(academicYear) : null,
        lines: parsed as unknown as Prisma.InputJsonValue,
        isActive: isActive !== false,
      },
    });
    res.status(201).json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    res.status(400).json({ error: msg });
  }
});

router.put('/tuition-payment-schedule-templates/:id', async (req, res) => {
  try {
    const { name, description, academicYear, lines, isActive } = req.body;
    const data: Prisma.TuitionPaymentScheduleTemplateUpdateInput = {};
    if (name !== undefined) data.name = String(name).trim();
    if (description !== undefined) data.description = description ? String(description) : null;
    if (academicYear !== undefined) data.academicYear = academicYear ? String(academicYear) : null;
    if (lines !== undefined) {
      data.lines = parseScheduleLines(lines) as unknown as Prisma.InputJsonValue;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const row = await prisma.tuitionPaymentScheduleTemplate.update({
      where: { id: req.params.id },
      data,
    });
    res.json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    res.status(400).json({ error: msg });
  }
});

router.delete('/tuition-payment-schedule-templates/:id', async (req, res) => {
  try {
    await prisma.tuitionPaymentScheduleTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Supprimé' });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/** Applique un poste du catalogue : une ligne de frais par élève (montant net après remise éventuelle). */
router.post('/tuition-fee-catalog/apply-to-students', async (req, res) => {
  try {
    const {
      catalogId,
      academicYear,
      anchorDueDate,
      classId,
      studentIds,
      discountAmount,
      scholarshipLabel,
      descriptionExtra,
    } = req.body;
    if (!catalogId || !academicYear || !anchorDueDate) {
      return res.status(400).json({ error: 'catalogId, academicYear et anchorDueDate sont requis' });
    }
    const catalog = await prisma.tuitionFeeCatalog.findUnique({ where: { id: catalogId } });
    if (!catalog || !catalog.isActive) {
      return res.status(404).json({ error: 'Barème introuvable ou inactif' });
    }

    let students = await prisma.student.findMany({
      where: {
        isActive: true,
        ...(classId && { classId: String(classId) }),
        ...(Array.isArray(studentIds) && studentIds.length > 0 && { id: { in: studentIds as string[] } }),
      },
      include: { class: { select: { level: true, id: true } } },
    });

    if (!classId && (!studentIds || studentIds.length === 0)) {
      return res.status(400).json({ error: 'classId ou studentIds est requis' });
    }

    if (catalog.scope === 'BY_CLASS' && catalog.classId) {
      students = students.filter((s) => s.classId === catalog.classId);
    }
    if (catalog.scope === 'BY_LEVEL' && catalog.classLevel) {
      students = students.filter((s) => s.class?.level === catalog.classLevel);
    }

    if (students.length === 0) {
      return res.status(404).json({ error: 'Aucun élève ne correspond au barème et aux filtres' });
    }

    const disc = discountAmount != null ? Math.max(0, Number(discountAmount)) : 0;
    const base = Number(catalog.defaultAmount);
    const amount = Math.max(0, Math.round(base - disc));
    const due = new Date(anchorDueDate);
    if (Number.isNaN(due.getTime())) {
      return res.status(400).json({ error: 'anchorDueDate invalide' });
    }

    const period = `${catalog.label} | ${academicYear}`;
    const descParts = [catalog.programLabel, descriptionExtra, scholarshipLabel && disc > 0 ? `Remise: ${disc} FCFA` : null]
      .filter(Boolean)
      .join(' — ');

    const created: unknown[] = [];
    const skipped: { studentId: string; reason: string }[] = [];

    for (const st of students) {
      const existing = await prisma.tuitionFee.findFirst({
        where: { studentId: st.id, academicYear: String(academicYear), period },
      });
      if (existing) {
        skipped.push({ studentId: st.id, reason: 'Frais déjà existant pour cette période' });
        continue;
      }
      const fee = await prisma.tuitionFee.create({
        data: {
          studentId: st.id,
          academicYear: String(academicYear),
          period,
          amount,
          dueDate: due,
          description: descParts || null,
          feeType: catalog.feeType,
          billingPeriod: catalog.billingPeriod,
          baseAmount: base,
          discountAmount: disc,
          scholarshipLabel: scholarshipLabel ? String(scholarshipLabel) : null,
          catalogId: catalog.id,
        },
      });
      created.push(fee);
    }

    res.status(201).json({
      message: 'Frais créés à partir du catalogue',
      created: created.length,
      skipped: skipped.length,
      details: { created, skipped },
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/** Applique un gabarit d’échéancier : plusieurs lignes de frais pour un élève. */
router.post('/tuition-payment-schedule-templates/apply-to-student', async (req, res) => {
  try {
    const {
      scheduleTemplateId,
      studentId,
      academicYear,
      anchorDueDate,
      totalAmount,
      feeType,
      scholarshipLabel,
      catalogId,
      discountAmount: discountAmountRaw,
    } = req.body;
    if (!scheduleTemplateId || !studentId || !academicYear || !anchorDueDate || totalAmount == null) {
      return res.status(400).json({
        error: 'scheduleTemplateId, studentId, academicYear, anchorDueDate et totalAmount sont requis',
      });
    }
    const tpl = await prisma.tuitionPaymentScheduleTemplate.findUnique({
      where: { id: scheduleTemplateId },
    });
    if (!tpl || !tpl.isActive) {
      return res.status(404).json({ error: 'Gabarit introuvable ou inactif' });
    }
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ error: 'Élève introuvable' });

    const lines = parseScheduleLines(tpl.lines);
    const gross = Math.round(Number(totalAmount));
    if (Number.isNaN(gross) || gross < 0) {
      return res.status(400).json({ error: 'totalAmount invalide' });
    }
    const discTotal =
      discountAmountRaw != null ? Math.min(gross, Math.max(0, Math.round(Number(discountAmountRaw)))) : 0;
    const net = Math.max(0, gross - discTotal);
    const amounts = splitTotalByPercents(net, lines);
    const discParts =
      discTotal > 0 ? splitTotalByPercents(discTotal, lines) : lines.map(() => 0);
    const anchor = new Date(anchorDueDate);
    if (Number.isNaN(anchor.getTime())) {
      return res.status(400).json({ error: 'anchorDueDate invalide' });
    }

    const created: unknown[] = [];
    const skipped: { period: string; reason: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const period = `${line.label} | ${academicYear} | ${i + 1}/${lines.length}`;
      const existing = await prisma.tuitionFee.findFirst({
        where: { studentId, academicYear: String(academicYear), period },
      });
      if (existing) {
        skipped.push({ period, reason: 'Déjà existant' });
        continue;
      }
      const due = addDays(anchor, line.dueOffsetDays);
      const lineDisc = discParts[i] ?? 0;
      const lineBase = amounts[i] + lineDisc;
      const fee = await prisma.tuitionFee.create({
        data: {
          studentId,
          academicYear: String(academicYear),
          period,
          amount: amounts[i],
          dueDate: due,
          description: scholarshipLabel ? String(scholarshipLabel) : `Échéance ${i + 1}/${lines.length}`,
          feeType: feeType || 'TUITION',
          billingPeriod: 'ONE_TIME',
          baseAmount: lineBase,
          discountAmount: lineDisc,
          scholarshipLabel: scholarshipLabel ? String(scholarshipLabel) : null,
          scheduleTemplateId: tpl.id,
          installmentIndex: i + 1,
          catalogId: catalogId || null,
        },
      });
      created.push(fee);
    }

    res.status(201).json({
      message: 'Échéancier appliqué',
      created: created.length,
      skipped: skipped.length,
      details: { created, skipped },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    res.status(400).json({ error: msg });
  }
});

export default router;
