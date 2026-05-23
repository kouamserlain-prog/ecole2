import fs from 'fs';
import type { Request } from 'express';
import { getFileUrl } from '../middleware/upload.middleware';
import {
  buildSafeUploadFilename,
  deleteBlobByUrl,
  isVercelBlobUrl,
  uploadBufferToBlob,
  useBlobStorage,
} from './blob-storage.util';
import { deleteUploadedFileByPublicUrl } from './deleteUpload.util';

export type PersistUploadOptions = {
  req?: Request;
  /** En local : chemin relatif `/uploads/...` (branding). Sur Blob : URL absolue. */
  relative?: boolean;
};

function ensureMulterFilename(file: Express.Multer.File): void {
  if (!file.filename) {
    file.filename = buildSafeUploadFilename(file.fieldname, file.originalname);
  }
}

export async function persistUploadedFile(
  file: Express.Multer.File,
  folder: string,
  options?: PersistUploadOptions,
): Promise<string> {
  ensureMulterFilename(file);

  if (useBlobStorage()) {
    if (!file.buffer?.length) {
      throw new Error('Fichier en mémoire manquant pour le stockage Blob.');
    }
    return uploadBufferToBlob(folder, file.filename, file.buffer, file.mimetype);
  }

  const relative = getFileUrl(file.filename, folder);
  if (options?.relative) {
    return relative;
  }
  if (options?.req) {
    const host = options.req.get('host');
    if (host) {
      return `${options.req.protocol}://${host}${relative}`;
    }
  }
  return relative;
}

/** Supprime un fichier temporaire disque ou annule avant persistance Blob. */
export function discardUploadedFile(file: Express.Multer.File | undefined): void {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch {
    /* ignore */
  }
}

/** Supprime un fichier stocké (Blob ou disque local). */
export async function deleteStoredUploadUrl(storedUrl: string): Promise<void> {
  if (!storedUrl?.trim()) return;
  if (isVercelBlobUrl(storedUrl)) {
    await deleteBlobByUrl(storedUrl);
    return;
  }
  deleteUploadedFileByPublicUrl(storedUrl);
}
