import fs from 'node:fs';
import path from 'node:path';

const adminPath = path.join('src', 'routes', 'admin.routes.ts');
const lines = fs.readFileSync(adminPath, 'utf8').split(/\r?\n/);

const startIdx = lines.findIndex((l) => l.includes('GESTION DES ENSEIGNANTS'));
const endIdx = lines.findIndex((l) => l.includes('GESTION DES ÉDUCATEURS'));
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error('Could not find teacher section boundaries', { startIdx, endIdx });
  process.exit(1);
}

const teachersBody = lines.slice(startIdx + 1, endIdx).join('\n');

const teachersHeader = `import express from 'express';
import type { Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from '../utils/admin-user-initial-password.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';
import { deleteStoredUploadUrl } from '../utils/upload-persist.util';
import { resolveStoredFileAccessUrl } from '../utils/upload-access-token.util';
import { punchTeacherCourseAttendance } from '../utils/attendance-punch.util';
import {
  isTeacherEngagementKind,
  normalizeTeacherEngagementKind,
} from '../utils/teacher-engagement-kind.util';

const router = express.Router();

`;

fs.writeFileSync(
  path.join('src', 'routes', 'admin-teachers.routes.ts'),
  teachersHeader + teachersBody + '\n\nexport default router;\n',
);

const importLine = "import adminTeachersRoutes from './admin-teachers.routes';";
const useLine = 'router.use(adminTeachersRoutes);';

let insertImportAt = lines.findIndex((l) => l.includes("import adminClassesRoutes"));
if (insertImportAt < 0) {
  insertImportAt = lines.findIndex((l) => l.includes("import adminStudentsRoutes"));
}
if (insertImportAt < 0) {
  console.error('Could not find adminStudentsRoutes import');
  process.exit(1);
}

const withImport = [
  ...lines.slice(0, insertImportAt + 1),
  importLine,
  ...lines.slice(insertImportAt + 1, startIdx),
  useLine,
  '',
  ...lines.slice(endIdx),
];

fs.writeFileSync(adminPath, withImport.join('\n'));
console.log('Extracted teachers:', teachersBody.split('\n').length, 'lines');
console.log('admin.routes.ts now:', withImport.length, 'lines');
