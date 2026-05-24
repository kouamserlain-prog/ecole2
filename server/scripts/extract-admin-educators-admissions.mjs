import fs from 'node:fs';
import path from 'node:path';

const adminPath = path.join('src', 'routes', 'admin.routes.ts');
const lines = fs.readFileSync(adminPath, 'utf8').split(/\r?\n/);

function sectionBounds(startMarker, endMarker) {
  const startIdx = lines.findIndex((l) => l.includes(startMarker));
  const endIdx = lines.findIndex((l) => l.includes(endMarker));
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    throw new Error(`Bounds not found: ${startMarker} -> ${endMarker} (${startIdx}, ${endIdx})`);
  }
  return { startIdx, endIdx, body: lines.slice(startIdx + 1, endIdx).join('\n') };
}

const educators = sectionBounds('GESTION DES ÉDUCATEURS', 'GESTION ACADÉMIQUE');
const admissions = sectionBounds('INSCRIPTIONS & ADMISSIONS', 'GESTION MATÉRIELLE');

const educatorsHeader = `import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from '../utils/admin-user-initial-password.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';

const router = express.Router();

`;

const admissionsHeader = `import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';
import type { SchoolContextRequest } from '../utils/school-context.util';
import { admissionScopeWhere } from '../utils/school-context.util';
import { enrollStudentFromAdmission } from '../utils/admission-enroll.util';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = express.Router();

`;

fs.writeFileSync(
  path.join('src', 'routes', 'admin-educators.routes.ts'),
  educatorsHeader + educators.body + '\n\nexport default router;\n',
);
fs.writeFileSync(
  path.join('src', 'routes', 'admin-admissions.routes.ts'),
  admissionsHeader + admissions.body + '\n\nexport default router;\n',
);

const importEducators = "import adminEducatorsRoutes from './admin-educators.routes';";
const importAdmissions = "import adminAdmissionsRoutes from './admin-admissions.routes';";
const insertAt = lines.findIndex((l) => l.includes("import adminTeachersRoutes"));

const withoutSections = [
  ...lines.slice(0, insertAt + 1),
  importEducators,
  importAdmissions,
  ...lines.slice(insertAt + 1, educators.startIdx),
  'router.use(adminEducatorsRoutes);',
  'router.use(adminAdmissionsRoutes);',
  '',
  ...lines.slice(admissions.endIdx),
];

fs.writeFileSync(adminPath, withoutSections.join('\n'));
console.log('Educators:', educators.body.split('\n').length, 'lines');
console.log('Admissions:', admissions.body.split('\n').length, 'lines');
console.log('admin.routes.ts:', withoutSections.length, 'lines');
