import fs from 'node:fs';
import path from 'node:path';

const adminPath = path.join('src', 'routes', 'admin.routes.ts');
const lines = fs.readFileSync(adminPath, 'utf8').split(/\r?\n/);
const studentsBody = lines.slice(149, 1042).join('\n');
const classesBody = lines.slice(1043, 1180).join('\n');

const studentsHeader = `import express from 'express';
import type { Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from '../utils/admin-user-initial-password.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';
import { generateDigitalCardPublicId } from '../utils/digital-card.util';
import { buildStudentEnrollmentDossierPayload } from '../utils/student-enrollment-dossier.util';
import { deleteStoredUploadUrl } from '../utils/upload-persist.util';
import { resolveStoredFileAccessUrl } from '../utils/upload-access-token.util';
import QRCode from 'qrcode';
import type { SchoolContextRequest } from '../utils/school-context.util';
import { studentScopeWhere } from '../utils/school-context.util';

const router = express.Router();

`;

const classesHeader = `import express from 'express';
import type { Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import type { SchoolContextRequest } from '../utils/school-context.util';
import { classScopeWhere } from '../utils/school-context.util';

const router = express.Router();

`;

fs.writeFileSync(
  path.join('src', 'routes', 'admin-students.routes.ts'),
  studentsHeader + studentsBody + '\n\nexport default router;\n',
);
fs.writeFileSync(
  path.join('src', 'routes', 'admin-classes.routes.ts'),
  classesHeader + classesBody + '\n\nexport default router;\n',
);

const newLines = [
  ...lines.slice(0, 47),
  "import adminStudentsRoutes from './admin-students.routes';",
  "import adminClassesRoutes from './admin-classes.routes';",
  ...lines.slice(47, 149),
  'router.use(adminStudentsRoutes);',
  'router.use(adminClassesRoutes);',
  '',
  ...lines.slice(1180),
];
fs.writeFileSync(adminPath, newLines.join('\n'));
console.log('Extracted students:', studentsBody.split('\n').length, 'lines');
console.log('Extracted classes:', classesBody.split('\n').length, 'lines');
console.log('admin.routes.ts now:', newLines.length, 'lines');
