import fs from 'node:fs/promises';
import multer from 'multer';
import {
  buildUploadedBackupFilename,
  getBackupDir,
  isMongoBackupFilesystemWritable,
  SERVERLESS_MONGODB_BACKUP_MESSAGE,
} from '../utils/mongodb-backup.util';

const MAX_BYTES = Number.parseInt(process.env.MONGODB_BACKUP_MAX_UPLOAD_MB ?? '1024', 10) * 1024 * 1024;

export const mongoBackupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!isMongoBackupFilesystemWritable()) {
        cb(new Error(SERVERLESS_MONGODB_BACKUP_MESSAGE), '');
        return;
      }
      const dir = getBackupDir();
      fs.mkdir(dir, { recursive: true })
        .then(() => cb(null, dir))
        .catch((err) => cb(err as Error, dir));
    },
    filename: (_req, file, cb) => {
      const original = file.originalname?.toLowerCase() ?? '';
      if (original.endsWith('.archive.gz')) {
        cb(null, buildUploadedBackupFilename());
      } else {
        cb(null, buildUploadedBackupFilename());
      }
    },
  }),
  limits: { fileSize: Number.isFinite(MAX_BYTES) && MAX_BYTES > 0 ? MAX_BYTES : 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname?.toLowerCase() ?? '';
    if (name.endsWith('.archive.gz') || file.mimetype === 'application/gzip' || file.mimetype === 'application/x-gzip') {
      cb(null, true);
      return;
    }
    cb(new Error('Seuls les fichiers .archive.gz (mongodump) sont acceptés.'));
  },
});
