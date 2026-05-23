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

export async function resolveTuitionAmountForStudent(
  studentId: string,
  academicYear: string,
): Promise<ResolvedTuitionForStudent | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: { select: { level: true } } },
  });
  if (!student?.class?.level) return null;

  const catalog = await findLevelTuitionCatalog(academicYear, student.class.level);
  if (!catalog) return null;

  return {
    amount: Math.round(Number(catalog.defaultAmount)),
    classLevel: normalizeClassLevel(student.class.level),
    catalogId: catalog.id,
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

  const resolved = await resolveTuitionAmountForStudent(params.studentId, params.academicYear);
  if (!resolved) {
    throw new TuitionLevelAmountError(
      'Aucun montant de scolarité défini pour le niveau de cet élève. Configurez les montants par niveau (onglet Frais → barèmes).',
    );
  }

  const base = resolved.amount;
  const net = Math.max(0, base - disc);

  if (params.amount != null && params.amount !== '') {
    const requested = Math.round(Number(params.amount));
    if (!Number.isNaN(requested) && requested !== net && requested !== base) {
      throw new TuitionLevelAmountError(
        `Le montant de scolarité est fixé à ${base} FCFA pour le niveau ${resolved.classLevel} (net après remise : ${net} FCFA).`,
      );
    }
  }

  return {
    amount: net,
    baseAmount: base,
    discountAmount: disc,
    catalogId: params.catalogId ?? resolved.catalogId,
  };
}
