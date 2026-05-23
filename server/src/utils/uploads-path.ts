import path from 'path';

/**
 * Répertoire racine des uploads (disque local uniquement).
 * Sur Vercel, les fichiers vont dans Vercel Blob si `BLOB_READ_WRITE_TOKEN` est défini (voir blob-storage.util).
 * Sans token Blob sur Vercel, `/tmp` reste un repli éphémère (non persistant).
 */
export function getUploadsRootDir(): string {
  if (process.env.VERCEL === '1') {
    return path.join('/tmp', 'school-manager-uploads');
  }
  return path.join(__dirname, '../../uploads');
}

/**
 * Préfixe d’URL public pour les fichiers servis par Express.
 * Sur Vercel (experimentalServices), seul le préfixe `/api` atteint le runtime Express :
 * les assets doivent être demandés en `/api/uploads/...`, pas `/uploads/...` (sinon 404 côté Next).
 */
export function getPublicUploadsUrlPrefix(): string {
  return process.env.VERCEL === '1' ? '/api/uploads' : '/uploads';
}
