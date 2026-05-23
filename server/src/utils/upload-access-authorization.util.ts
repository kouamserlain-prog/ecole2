import prisma from './prisma';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  normalizeUploadRequestPath,
  uploadRelativePathFromStoredUrl,
} from './sensitive-upload-path.util';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'STAFF']);

function urlMatchesStored(stored: string, requestPath: string): boolean {
  const rel = uploadRelativePathFromStoredUrl(stored);
  if (!rel) return false;
  return normalizeUploadRequestPath(rel) === normalizeUploadRequestPath(requestPath);
}

/** Vérifie si l’utilisateur authentifié peut lire ce fichier sensible. */
export async function userCanAccessSensitiveUpload(
  user: NonNullable<AuthRequest['user']>,
  requestPath: string,
): Promise<boolean> {
  const path = normalizeUploadRequestPath(requestPath);
  if (!path) return false;

  const pathLower = path.toLowerCase();

  if (pathLower.includes('/identity-documents/')) {
    const doc = await prisma.identityDocument.findFirst({
      where: { fileUrl: { contains: path.split('/').pop() ?? '___none___' } },
      select: { studentId: true, student: { select: { userId: true, schoolId: true } } },
    });
    if (!doc) return false;

    if (user.role === 'STUDENT') {
      return doc.student.userId === user.id;
    }
    if (ADMIN_ROLES.has(user.role)) {
      if (user.role === 'SUPER_ADMIN') return true;
      if (!doc.student.schoolId) return user.role === 'ADMIN';
      const member = await prisma.schoolMember.findFirst({
        where: { userId: user.id, schoolId: doc.student.schoolId },
      });
      return !!member;
    }
    if (user.role === 'PARENT') {
      const link = await prisma.studentParent.findFirst({
        where: { parent: { userId: user.id }, studentId: doc.studentId },
      });
      return !!link;
    }
    return false;
  }

  if (pathLower.includes('/admission-documents/')) {
    return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STAFF';
  }

  if (pathLower.includes('/teacher-admin-documents/')) {
    if (user.role === 'SUPER_ADMIN') return true;
    if (ADMIN_ROLES.has(user.role)) return true;
    if (user.role === 'TEACHER') {
      const filename = path.split('/').pop() ?? '';
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!teacher) return false;
      const docs = await prisma.teacherAdministrativeDocument.findMany({
        where: { teacherId: teacher.id },
        select: { fileUrl: true },
      });
      return docs.some((d) => urlMatchesStored(d.fileUrl, path));
    }
    return false;
  }

  return false;
}
