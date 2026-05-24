import type { PrismaClient } from '@prisma/client';
import { assertScheduleConstraints } from './timetable-constraints.util';

export type ScheduleImportRow = {
  className: string;
  courseName?: string;
  courseCode?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
};

export type ScheduleImportResult = {
  created: number;
  skipped: number;
  errors: Array<{ line: number; message: string }>;
};

const DAY_MAP: Record<string, number> = {
  dimanche: 0,
  sunday: 0,
  lundi: 1,
  monday: 1,
  mardi: 2,
  tuesday: 2,
  mercredi: 3,
  wednesday: 3,
  jeudi: 4,
  thursday: 4,
  vendredi: 5,
  friday: 5,
  samedi: 6,
  saturday: 6,
};

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): string {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  return semi >= comma ? ';' : ',';
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function parseDayOfWeek(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (t in DAY_MAP) return DAY_MAP[t];
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && n >= 0 && n <= 6) return n;
  return null;
}

export function parseTimeRange(
  combinedOrStart: string,
  endOptional?: string,
): { startTime: string; endTime: string } | null {
  const normalizeTime = (t: string) => {
    const m = t.trim().match(/^(\d{1,2})[:h.](\d{2})$/i);
    if (!m) return null;
    const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
    const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  if (endOptional?.trim()) {
    const start = normalizeTime(combinedOrStart);
    const end = normalizeTime(endOptional);
    if (start && end) return { startTime: start, endTime: end };
    return null;
  }

  const combined = combinedOrStart.trim();
  const rangeMatch = combined.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (rangeMatch) {
    const start = normalizeTime(rangeMatch[1]);
    const end = normalizeTime(rangeMatch[2]);
    if (start && end) return { startTime: start, endTime: end };
  }

  const single = normalizeTime(combined);
  if (single) {
    const [h, m] = single.split(':').map(Number);
    const endMin = h * 60 + m + 60;
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    return { startTime: single, endTime: end };
  }
  return null;
}

export function parseScheduleCsv(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeKey);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    if (cells.every((c) => !c.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

export function mapRawRowToImport(row: Record<string, string>): ScheduleImportRow | { error: string } {
  const className = pick(row, 'classe', 'class', 'class_name', 'nom_classe');
  const courseName = pick(row, 'matiere', 'matière', 'course', 'subject', 'matiere_nom') || undefined;
  const courseCode = pick(row, 'code_matiere', 'code_matière', 'course_code', 'code', 'code_matiere') || undefined;
  const dayRaw = pick(row, 'jour', 'day', 'day_of_week', 'jour_semaine');
  const startRaw = pick(row, 'heure_debut', 'heure_début', 'start', 'start_time', 'debut', 'début');
  const endRaw = pick(row, 'heure_fin', 'end', 'end_time', 'fin');
  const heureCombined = pick(row, 'heure', 'horaire', 'time', 'creneau', 'créneau');
  const room = pick(row, 'salle', 'room', 'salle_cours') || null;

  if (!className) {
    return { error: 'Colonne « Classe » manquante ou vide' };
  }

  const dayOfWeek = parseDayOfWeek(dayRaw);
  if (dayOfWeek == null) {
    return { error: `Jour invalide : « ${dayRaw || '(vide)'} »` };
  }

  const resolvedCourseName = courseName || pick(row, 'matiere', 'matière') || undefined;
  if (!resolvedCourseName && !courseCode) {
    return { error: 'Matière ou code matière requis' };
  }

  const times = startRaw
    ? parseTimeRange(startRaw, endRaw)
    : parseTimeRange(heureCombined || pick(row, 'heure'));
  if (!times) {
    return { error: 'Heure invalide (utilisez 08:00 - 09:00 ou colonnes Heure début / Heure fin)' };
  }

  return {
    className,
    courseName: resolvedCourseName,
    courseCode: courseCode || undefined,
    dayOfWeek,
    startTime: times.startTime,
    endTime: times.endTime,
    room: room || null,
  };
}

export const SCHEDULE_IMPORT_CSV_TEMPLATE = `Classe;Jour;Heure début;Heure fin;Matière;Code matière;Salle
6ème A;Lundi;08:00;09:00;Mathématiques;;Salle 101
6ème A;Mardi;10:00;11:00;Français;;Salle 102`;

export async function importSchedulesFromCsv(
  prisma: PrismaClient,
  opts: {
    csv: string;
    schoolId?: string | null;
    defaultClassId?: string;
    clearExisting?: boolean;
    skipConstraintErrors?: boolean;
  },
): Promise<ScheduleImportResult> {
  const rawRows = parseScheduleCsv(opts.csv);
  const parsed: Array<{ line: number; row: ScheduleImportRow } | { line: number; error: string }> = [];

  rawRows.forEach((raw, idx) => {
    const line = idx + 2;
    const mapped = mapRawRowToImport(raw);
    if ('error' in mapped) {
      parsed.push({ line, error: mapped.error });
    } else {
      parsed.push({ line, row: mapped });
    }
  });

  return importSchedulesFromRows(prisma, {
    ...opts,
    entries: parsed,
  });
}

async function importSchedulesFromRows(
  prisma: PrismaClient,
  opts: {
    schoolId?: string | null;
    defaultClassId?: string;
    clearExisting?: boolean;
    skipConstraintErrors?: boolean;
    entries: Array<{ line: number; row: ScheduleImportRow } | { line: number; error: string }>;
  },
): Promise<ScheduleImportResult> {
  const result: ScheduleImportResult = { created: 0, skipped: 0, errors: [] };
  const skipErrors = opts.skipConstraintErrors !== false;

  const classWhere =
    opts.schoolId != null && opts.schoolId !== ''
      ? { schoolId: opts.schoolId }
      : {};

  const classes = await prisma.class.findMany({
    where: classWhere,
    select: { id: true, name: true },
  });
  const classByName = new Map(
    classes.map((c) => [c.name.trim().toLowerCase(), c] as const),
  );

  let defaultClass: { id: string; name: string } | null = null;
  if (opts.defaultClassId) {
    defaultClass = classes.find((c) => c.id === opts.defaultClassId) ?? null;
  }

  const courses = await prisma.course.findMany({
    where: { classId: { in: classes.map((c) => c.id) } },
    select: { id: true, name: true, code: true, classId: true },
  });

  const coursesByClass = new Map<string, typeof courses>();
  for (const course of courses) {
    const list = coursesByClass.get(course.classId) ?? [];
    list.push(course);
    coursesByClass.set(course.classId, list);
  }

  const resolveClass = (className: string) => {
    if (defaultClass && className.trim().toLowerCase() === defaultClass.name.trim().toLowerCase()) {
      return defaultClass;
    }
    return classByName.get(className.trim().toLowerCase()) ?? null;
  };

  const resolveCourse = (classId: string, name?: string, code?: string) => {
    const list = coursesByClass.get(classId) ?? [];
    if (code?.trim()) {
      const byCode = list.find((c) => c.code.trim().toLowerCase() === code.trim().toLowerCase());
      if (byCode) return byCode;
    }
    if (name?.trim()) {
      const norm = name.trim().toLowerCase();
      const byName = list.find((c) => c.name.trim().toLowerCase() === norm);
      if (byName) return byName;
    }
    return null;
  };

  const toCreate: Array<{ line: number; classId: string; courseId: string; row: ScheduleImportRow }> = [];

  for (const entry of opts.entries) {
    if ('error' in entry) {
      result.errors.push({ line: entry.line, message: entry.error });
      result.skipped++;
      continue;
    }

    const cls = resolveClass(entry.row.className);
    if (!cls) {
      result.errors.push({
        line: entry.line,
        message: `Classe introuvable : « ${entry.row.className} »`,
      });
      result.skipped++;
      continue;
    }

    const course = resolveCourse(cls.id, entry.row.courseName, entry.row.courseCode);
    if (!course) {
      result.errors.push({
        line: entry.line,
        message: `Matière introuvable pour ${entry.row.className} : « ${entry.row.courseName || entry.row.courseCode} »`,
      });
      result.skipped++;
      continue;
    }

    toCreate.push({ line: entry.line, classId: cls.id, courseId: course.id, row: entry.row });
  }

  if (opts.clearExisting && toCreate.length > 0) {
    const classIds = opts.defaultClassId
      ? [opts.defaultClassId]
      : [...new Set(toCreate.map((t) => t.classId))];
    await prisma.schedule.deleteMany({ where: { classId: { in: classIds } } });
  }

  for (const item of toCreate) {
    try {
      await assertScheduleConstraints(prisma, {
        classId: item.classId,
        courseId: item.courseId,
        dayOfWeek: item.row.dayOfWeek,
        startTime: item.row.startTime,
        endTime: item.row.endTime,
        room: item.row.room,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Contrainte non respectée';
      if (skipErrors) {
        result.errors.push({ line: item.line, message });
        result.skipped++;
        continue;
      }
      throw e;
    }

    await prisma.schedule.create({
      data: {
        classId: item.classId,
        courseId: item.courseId,
        dayOfWeek: item.row.dayOfWeek,
        startTime: item.row.startTime,
        endTime: item.row.endTime,
        room: item.row.room,
      },
    });
    result.created++;
  }

  return result;
}
