import fs from 'node:fs';
import path from 'node:path';

const adminPath = path.join('src', 'routes', 'admin.routes.ts');
const lines = fs.readFileSync(adminPath, 'utf8').split(/\r?\n/);

function findMarker(substr) {
  const idx = lines.findIndex((l) => l.includes(substr));
  if (idx < 0) throw new Error(`Marker not found: ${substr}`);
  return idx;
}

const sections = [
  { start: 'INSCRIPTIONS & ADMISSIONS', end: 'GESTION MATÉRIELLE' },
  { start: 'GESTION DES ÉDUCATEURS', end: 'GESTION ACADÉMIQUE' },
  { start: 'GESTION DES ENSEIGNANTS', end: 'GESTION DES ÉDUCATEURS' },
  { start: 'GESTION DES CLASSES', end: 'GESTION DES ENSEIGNANTS' },
  { start: 'GESTION DES ÉLÈVES', end: 'GESTION DES CLASSES' },
].map((s) => ({
  ...s,
  startIdx: findMarker(s.start),
  endIdx: findMarker(s.end),
}));

sections.sort((a, b) => b.startIdx - a.startIdx);

let result = [...lines];
for (const s of sections) {
  if (s.endIdx <= s.startIdx) throw new Error(`Invalid: ${s.start}`);
  result = [...result.slice(0, s.startIdx), ...result.slice(s.endIdx)];
  console.log(`Removed ${s.start} (${s.endIdx - s.startIdx} lines)`);
}

const extraImports = [
  "import adminStudentsRoutes from './admin-students.routes';",
  "import adminClassesRoutes from './admin-classes.routes';",
  "import adminTeachersRoutes from './admin-teachers.routes';",
  "import adminEducatorsRoutes from './admin-educators.routes';",
  "import adminAdmissionsRoutes from './admin-admissions.routes';",
  "import adminSchoolStaffMetiersRoutes from './admin-school-staff-metiers.routes';",
];

const extraUses = [
  'router.use(adminSchoolStaffMetiersRoutes);',
  'router.use(adminStudentsRoutes);',
  'router.use(adminClassesRoutes);',
  'router.use(adminTeachersRoutes);',
  'router.use(adminEducatorsRoutes);',
  'router.use(adminAdmissionsRoutes);',
];

const schoolsImportIdx = result.findIndex((l) => l.includes("import adminSchoolsRoutes"));
const staffImportIdx = result.findIndex((l) => l.includes("import staffAdminRoutes"));
const libUseIdx = result.findIndex((l) => l.includes('router.use(libraryManagementRoutes)'));
const staffUseIdx = result.findIndex((l) => l.includes('router.use(staffAdminRoutes)'));

const importsToAdd = extraImports.filter((imp) => !result.some((l) => l.trim() === imp.trim()));
const usesToAdd = extraUses.filter((u) => !result.some((l) => l.trim() === u.trim()));

const metiersImport = importsToAdd.find((i) => i.includes('Metiers'));
const metiersUse = usesToAdd.find((u) => u.includes('Metiers'));
const otherImports = importsToAdd.filter((i) => !i.includes('Metiers'));
const otherUses = usesToAdd.filter((u) => !u.includes('Metiers'));

result = [
  ...result.slice(0, schoolsImportIdx + 1),
  ...otherImports,
  ...result.slice(schoolsImportIdx + 1, staffImportIdx + 1),
  ...(metiersImport ? [metiersImport] : []),
  ...result.slice(staffImportIdx + 1, libUseIdx + 1),
  ...otherUses,
  ...(metiersUse ? [metiersUse] : []),
  '',
  ...result.slice(libUseIdx + 1),
];

fs.writeFileSync(adminPath, result.join('\n'));
console.log('admin.routes.ts:', result.length, 'lines');
