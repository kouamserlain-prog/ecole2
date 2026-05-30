import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { verifyUploadAccessToken } from '../utils/upload-access-token.util';
import {
  isSensitiveUploadPath,
  normalizeUploadRequestPath,
} from '../utils/sensitive-upload-path.util';
import { userCanAccessSensitiveUpload } from '../utils/upload-access-authorization.util';
import type { AuthRequest } from './auth.middleware';
import prisma from '../utils/prisma';

function requestUploadPath(req: Request): string {
  const base = (req.baseUrl || '').replace(/\/api\/uploads$/, '/uploads');
  const segment = req.path || req.url.split('?')[0] || '';
  const combined = `${base}${segment}`.replace(/\\/g, '/');
  if (combined.includes('/uploads/')) {
    const idx = combined.indexOf('/uploads/');
    return normalizeUploadRequestPath(combined.slice(idx));
  }
  return normalizeUploadRequestPath(`/uploads${combined.startsWith('/') ? combined : `/${combined}`}`);
}

async function resolveUserFromBearer(req: Request): Promise<AuthRequest['user'] | null> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user?.isActive) return null;
    return { id: user.id, email: user.email, role: user.role };
  } catch {
    return null;
  }
}

/**
 * Bloque l’accès anonyme aux pièces d’identité, bulletins d’admission, dossiers RH enseignants.
 * Autorise : jeton signé `?access=` (15 min) ou session Bearer + contrôle métier.
 */
export async function protectSensitiveUploads(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const uploadPath = requestUploadPath(req);
  if (!isSensitiveUploadPath(uploadPath)) {
    next();
    return;
  }

  const accessToken =
    typeof req.query.access === 'string'
      ? req.query.access
      : typeof req.query.fileAccess === 'string'
        ? req.query.fileAccess
        : undefined;

  if (accessToken && verifyUploadAccessToken(uploadPath, accessToken)) {
    next();
    return;
  }

  const pathLower = uploadPath.toLowerCase();
  if (pathLower.includes('/identity-documents/')) {
    res.status(401).json({ error: 'Accès au fichier refusé. Connectez-vous ou utilisez un lien valide.' });
    return;
  }

  const user = await resolveUserFromBearer(req);
  if (user && (await userCanAccessSensitiveUpload(user, uploadPath))) {
    next();
    return;
  }

  res.status(401).json({ error: 'Accès au fichier refusé. Connectez-vous ou utilisez un lien valide.' });
}
