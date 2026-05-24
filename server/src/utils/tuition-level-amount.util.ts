import type { TuitionFeeCatalog } from '@prisma/client';
import prisma from './prisma';

/** Niveaux scolaires pour lesquels un montant de scolarité fixe peut être défini. */
export const TUITION_LEVELS = [
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Terminale',
] as const;

export type TuitionLevelRateRow = {
  level: string;
  amount: number | null;
  catalogId: string | null;
};

export function normalizeClassLevel(level: string): string {
  return level.trim();
}

function catalogMatchesLevel(catalog: TuitionFeeCatalog, classLevel: string): boolean {
  const norm = normalizeClassLevel(classLevel);
  const catLevel = catalog.classLevel ? normalizeClassLevel(catalog.classLevel) : '';
  return catLevel === norm;
}

/** Barème scolarité actif pour un niveau et une année (priorité à l’année exacte). */
export async function findLevelTuitionCatalog(
  academicYear: string,
  classLevel: string,
): Promise<TuitionFeeCatalog | null> {
  const norm = normalizeClassLevel(classLevel);
  if (!norm) return null;

  const rows = await prisma.tuitionFeeCatalog.findMany({
    where: {
      feeType: 'TUITION',
      scope: 'BY_LEVEL',
      isActive: true,
      classLevel: norm,
      OR: [{ academicYear: String(academicYear) }, { academicYear: null }],
    },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
  });

  const yearRow = rows.find((r) => r.academicYear === String(academicYear));
  if (yearRow) return yearRow;
  return rows.find((r) => !r.academicYear) ?? null;
}

export async function getLevelTuitionRates(academicYear: string): Promise<TuitionLevelRateRow[]> {
  const year = String(academicYear);
  const knownLevels = new Set<string>([...TUITION_LEVELS]);
  const extraFromClasses = await prisma.class.findMany({
    select: { level: true },
    distinct: ['level'],
  });
  for (const c of extraFromClasses) {
    if (c.level.trim()) knownLevels.add(normalizeClassLevel(c.level));
  }

  const rows: TuitionLevelRateRow[] = [];
  for (const level of Array.from(knownLevels).sort((a, b) => a.localeCompare(b, 'fr'))) {
    const catalog = await findLevelTuitionCatalog(year, level);
    rows.push({
      level,
      amount: catalog ? Number(catalog.defaultAmount) : null,
      catalogId: catalog?.id ?? null,
    });
  }
  return rows;
}

export async function upsertLevelTuitionRates(
  academicYear: string,
  rates: { level: string; amount: number }[],
): Promise<TuitionFeeCatalog[]> {
  const year = String(academicYear);
  const saved: TuitionFeeCatalog[] = [];

  for (const { level, amount } of rates) {
    const norm = normalizeClassLevel(level);
    if (!norm) continue;
    const value = Math.round(Number(amount));
    if (Number.isNaN(value) || value < 0) {
      throw new Error(`Montant invalide pour le niveau « ${norm} ».`);
    }

    const existing = await prisma.tuitionFeeCatalog.findFirst({
      where: {
        feeType: 'TUITION',
        scope: 'BY_LEVEL',
        classLevel: norm,
        academicYear: year,
      },
    });

    if (existing) {
      saved.push(
        await prisma.tuitionFeeCatalog.update({
          where: { id: existing.id },
          data: {
            defaultAmount: value,
            label: `Scolarité ${norm}`,
            isActive: true,
          },
        }),
      );
      continue;
    }

    saved.push(
      await prisma.tuitionFeeCatalog.create({
        data: {
          label: `Scolarité ${norm}`,
          academicYear: year,
          scope: 'BY_LEVEL',
          classLevel: norm,
          feeType: 'TUITION',
          billingPeriod: 'ANNUAL',
          defaultAmount: value,
          periodLabelHint: 'Scolarité',
          sortOrder: (() => {
            const i = TUITION_LEVELS.indexOf(norm as (typeof TUITION_LEVELS)[number]);
            return i >= 0 ? i : 100;
          })(),
          isActive: true,
        },
      }),
    );
  }

  return saved;
}

export type ResolvedTuitionForStudent = {
  amount: number;
  classLevel: string;
  catalogId: string;
};

export type ResolvedTuitionForClass = {
  amount: number;
  classId: string;
  className: string;
  classLevel: string;
  catalogId: string;
  source: 'BY_CLASS' | 'BY_LEVEL';
};

/** Barème scolarité actif pour une classe et une année (priorité à l’année exacte). */
export async function findClassTuitionCatalog(
  academicYear: string,
  classId: string,
): Promise<TuitionFeeCatalog | null> {
  if (!classId.trim()) return null;

  const rows = await prisma.tuitionFeeCatalog.findMany({
    where: {
      feeType: 'TUITION',
      scope: 'BY_CLASS',
      classId: classId.trim(),
      isActive: true,
      OR: [{ academicYear: String(academicYear) }, { academicYear: null }],
    },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
  });

  const yearRow = rows.find((r) => r.academicYear === String(academicYear));
  if (yearRow) return yearRow;
  return rows.find((r) => !r.academicYear) ?? null;
}

export type ClassTuitionRateRow = {
  classId: string;
  className: string;
  classLevel: string;
  academicYear: string | null;
  amount: number | null;
  catalogId: string | null;
};

export async function getClassTuitionRates(academicYear: string): Promise<ClassTuitionRateRow[]> {
  const year = String(academicYear);
  const allClasses = await prisma.class.findMany({
    select: { id: true, name: true, level: true, academicYear: true },
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
  });

  const rows: ClassTuitionRateRow[] = [];
  for (const cls of allClasses) {
    const catalog = await findClassTuitionCatalog(year, cls.id);
    rows.push({
      classId: cls.id,
      className: cls.name,
      classLevel: normalizeClassLevel(cls.level),
      academicYear: cls.academicYear,
      amount: catalog ? Number(catalog.defaultAmount) : null,
      catalogId: catalog?.id ?? null,
    });
  }
  return rows;
}

export async function upsertClassTuitionRates(
  academicYear: string,
  rates: { classId: string; amount: number }[],
): Promise<TuitionFeeCatalog[]> {
  const year = String(academicYear);
  const saved: TuitionFeeCatalog[] = [];

  for (const { classId, amount } of rates) {
    if (!classId?.trim()) continue;
    const value = Math.round(Number(amount));
    if (Number.isNaN(value) || value < 0) {
      throw new Error('Montant invalide pour une classe.');
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId.trim() },
      select: { id: true, name: true, level: true },
    });
    if (!cls) continue;

    const existing = await prisma.tuitionFeeCatalog.findFirst({
      where: {
        feeType: 'TUITION',
        scope: 'BY_CLASS',
        classId: cls.id,
        academicYear: year,
      },
    });

    const label = `Scolarité ${cls.name}`;

    if (existing) {
      saved.push(
        await prisma.tuitionFeeCatalog.update({
          where: { id: existing.id },
          data: {
            defaultAmount: value,
            label,
            classLevel: normalizeClassLevel(cls.level),
            isActive: true,
          },
        }),
      );
      continue;
    }

    saved.push(
      await prisma.tuitionFeeCatalog.create({
        data: {
          label,
          academicYear: year,
          scope: 'BY_CLASS',
          classId: cls.id,
          classLevel: normalizeClassLevel(cls.level),
          feeType: 'TUITION',
          billingPeriod: 'ANNUAL',
          defaultAmount: value,
          periodLabelHint: 'Scolarité',
          sortOrder: 100,
          isActive: true,
        },
      }),
    );
  }

  return saved;
}

/** Montant de scolarité pour une classe : barème classe, sinon barème du niveau. */
export async function resolveTuitionForClass(
  classId: string,
  academicYear: string,
): Promise<ResolvedTuitionForClass | null> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, level: true, academicYear: true },
  });
  if (!cls) return null;

  const year = String(academicYear || cls.academicYear || '').trim();
  if (!year) return null;

  const classCatalog = await findClassTuitionCatalog(year, cls.id);
  if (classCatalog) {
    return {
      amount: Math.round(Number(classCatalog.defaultAmount)),
      classId: cls.id,
      className: cls.name,
      classLevel: normalizeClassLevel(cls.level),
      catalogId: classCatalog.id,
      source: 'BY_CLASS',
    };
  }

  const levelCatalog = await findLevelTuitionCatalog(year, cls.level);
  if (!levelCatalog) return null;

  return {
    amount: Math.round(Number(levelCatalog.defaultAmount)),
    classId: cls.id,
    className: cls.name,
    classLevel: normalizeClassLevel(cls.level),
    catalogId: levelCatalog.id,
    source: 'BY_LEVEL',
  };
}

export async function resolveTuitionAmountForStudent(
  studentId: string,
  academicYear: string,
): Promise<ResolvedTuitionForStudent | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: { select: { id: true, level: true, academicYear: true } } },
  });
  if (!student?.classId || !student.class) return null;

  const year = String(academicYear || student.class.academicYear || '').trim();
  if (!year) return null;

  const resolved = await resolveTuitionForClass(student.classId, year);
  if (!resolved) return null;

  return {
    amount: resolved.amount,
    classLevel: resolved.classLevel,
    catalogId: resolved.catalogId,
  };
}

export class TuitionLevelAmountError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Pour les frais de type TUITION : impose le montant du barème niveau (remise via discountAmount uniquement).
 */
export async function enforceTuitionFeeAmounts(params: {
  studentId: string;
  academicYear: string;
  feeType?: string | null;
  amount?: number | string | null;
  baseAmount?: number | string | null;
  discountAmount?: number | string | null;
  catalogId?: string | null;
}): Promise<{
  amount: number;
  baseAmount: number;
  discountAmount: number;
  catalogId: string | null;
}> {
  const feeType = params.feeType ?? 'TUITION';
  const disc =
    params.discountAmount != null ? Math.max(0, Math.round(Number(params.discountAmount))) : 0;

  if (feeType !== 'TUITION') {
    let amountValue = params.amount != null ? Math.round(Number(params.amount)) : 0;
    const baseVal = params.baseAmount != null ? Math.round(Number(params.baseAmount)) : null;
    if (baseVal != null && !Number.isNaN(baseVal)) {
      amountValue = Math.max(0, baseVal - disc);
    } else if (disc > 0 && amountValue > 0) {
      amountValue = Math.max(0, amountValue - disc);
    }
    if (amountValue <= 0) {
      throw new TuitionLevelAmountError('Le montant à payer doit être strictement positif.');
    }
    return {
      amount: amountValue,
      baseAmount: baseVal ?? amountValue,
      discountAmount: disc,
      catalogId: params.catalogId ?? null,
    };
  }

  const manualBaseRaw = params.baseAmount;
  const manualBase =
    manualBaseRaw != null && manualBaseRaw !== ''
      ? Math.round(Number(manualBaseRaw))
      : NaN;
  if (!Number.isNaN(manualBase) && manualBase > 0) {
    return {
      amount: Math.max(0, manualBase - disc),
      baseAmount: manualBase,
      discountAmount: disc,
      catalogId: params.catalogId ?? null,
    };
  }

  const resolved = await resolveTuitionAmountForStudent(params.studentId, params.academicYear);
  if (!resolved) {
    const manualAmount =
      params.amount != null && params.amount !== '' ? Math.round(Number(params.amount)) : NaN;
    if (!Number.isNaN(manualAmount) && manualAmount > 0) {
      return {
        amount: Math.max(0, manualAmount - disc),
        baseAmount: manualAmount,
        discountAmount: disc,
        catalogId: params.catalogId ?? null,
      };
    }
    throw new TuitionLevelAmountError(
      'Aucun montant de scolarité défini pour la classe ou le niveau de cet élève. Saisissez un montant ou configurez le barème.',
    );
  }

  const base = resolved.amount;
  const net = Math.max(0, base - disc);

  if (params.amount != null && params.amount !== '') {
    const requested = Math.round(Number(params.amount));
    if (!Number.isNaN(requested) && requested > 0 && requested !== net) {
      return {
        amount: Math.max(0, requested),
        baseAmount: !Number.isNaN(manualBase) && manualBase > 0 ? manualBase : requested,
        discountAmount: disc,
        catalogId: params.catalogId ?? resolved.catalogId,
      };
    }
  }

  return {
    amount: net,
    baseAmount: base,
    discountAmount: disc,
    catalogId: params.catalogId ?? resolved.catalogId,
  };
}
