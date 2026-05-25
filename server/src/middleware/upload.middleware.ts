import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getPublicUploadsUrlPrefix, getUploadsRootDir } from '../utils/uploads-path';
import {
  buildSafeUploadFilename,
  folderForUploadField,
  useBlobStorage,
} from '../utils/blob-storage.util';

const uploadsDir = getUploadsRootDir();
if (!useBlobStorage()) {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.error('uploads: impossible de créer le répertoire racine', err);
  }
}

const diskStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const folder = folderForUploadField(file.fieldname);
    const dir = path.join(uploadsDir, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, buildSafeUploadFilename(file.fieldname, file.originalname));
  },
});

const storage = useBlobStorage() ? multer.memoryStorage() : diskStorage;

const GENERAL_ALLOWED_MIMES_BY_EXT: Record<string, readonly string[]> = {
  '.jpeg': ['image/jpeg'],
  '.jpg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

function mimeAllowedForExtension(
  originalName: string,
  mimetype: string | undefined,
  allowedByExt: Record<string, readonly string[]>,
): boolean {
  const ext = path.extname(originalName).toLowerCase();
  const allowedMimes = allowedByExt[ext];
  if (!allowedMimes) return false;

  const normalizedMime = (mimetype || '').toLowerCase().split(';')[0].trim();
  if (!normalizedMime || normalizedMime === 'application/octet-stream') {
    return true;
  }
  return allowedMimes.includes(normalizedMime);
}

// Filtre des types de fichiers
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (mimeAllowedForExtension(file.originalname, file.mimetype, GENERAL_ALLOWED_MIMES_BY_EXT)) {
    return cb(null, true);
  }
  cb(new Error('Type de fichier non autorisé. Utilisez jpeg, jpg, png, gif, pdf, doc ou docx.'));
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter,
});

const digitalLibraryFilter = (req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /pdf|epub|mobi|doc|docx|xls|xlsx|ppt|pptx|zip|txt/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  if (extname) return cb(null, true);
  cb(new Error('Type non autorisé. Formats : PDF, EPUB, MOBI, DOC, DOCX, XLS, PPT, ZIP, TXT.'));
};

export const digitalLibraryUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: digitalLibraryFilter,
});

const elearningFilter = (req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /pdf|mp4|webm|mov|doc|docx|ppt|pptx|zip|txt|png|jpg|jpeg/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  if (extname) return cb(null, true);
  cb(new Error('Type non autorisé pour l’e-learning.'));
};

export const elearningUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: elearningFilter,
});

const BRANDING_ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/heic',
  'image/heif',
]);

const brandingExtOk = (name: string) =>
  /\.(jpeg|jpg|png|gif|webp|ico|heic|heif)$/i.test(path.extname(name));

const brandingFileFilter = (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname !== 'branding') {
    return fileFilter(_req as any, file, cb);
  }
  if (!brandingExtOk(file.originalname)) {
    return cb(
      new Error('Format non autorisé pour le logo. Utilisez une image (PNG, JPG, WEBP, ICO, HEIC…).')
    );
  }
  const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (BRANDING_ALLOWED_MIMES.has(mime)) {
    return cb(null, true);
  }
  return cb(
    new Error('Format non autorisé pour le logo. Utilisez une image (PNG, JPG, WEBP, ICO, HEIC…).')
  );
};

/** Logos / favicon établissement (champ fichier `branding`, max 5 Mo). */
export const brandingUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: brandingFileFilter,
});

/** Pièces d’identité : fichiers un peu plus volumineux (PDF scannés) */
export const identityUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

/** Bulletin 3e trimestre — formulaire public d’inscription (champ `term3ReportCard`). */
export const admissionReportCardUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpe?g|png|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = !file.mimetype || /pdf|image\/(jpeg|png|webp)/i.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(
      new Error(
        'Format non autorisé pour le bulletin. Utilisez un PDF ou une image (JPG, PNG, WEBP).',
      ),
    );
  },
});

export const getFileUrl = (filename: string, folder: string = 'general'): string => {
  const prefix = getPublicUploadsUrlPrefix();
  return `${prefix}/${folder}/${filename}`;
};
