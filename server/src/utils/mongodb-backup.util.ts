import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BACKUP_FILE_PREFIX = 'mongo-backup-';
export const BACKUP_FILE_SUFFIX = '.archive.gz';
const UPLOAD_BACKUP_PREFIX = 'mongo-backup-upload-';

export const SERVERLESS_MONGODB_BACKUP_MESSAGE =
  'Sauvegarde locale indisponible sur cet hébergement (serverless). Utilisez les sauvegardes Atlas ou un serveur avec MongoDB Database Tools et un disque inscriptible.';

/** Vercel / Lambda : pas de mongodump ni de dossier persistant sous /var/task. */
export function isMongoBackupFilesystemWritable(): boolean {
  if (process.env.VERCEL === '1') return false;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return false;
  if (process.env.LAMBDA_TASK_ROOT) return false;
  const cwd = process.cwd();
  if (cwd === '/var/task' || cwd.startsWith('/var/task/')) return false;
  return true;
}

export function getBackupDir(): string {
  const raw = process.env.MONGODB_BACKUP_DIR?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  if (!isMongoBackupFilesystemWritable()) {
    return path.join('/tmp', 'school-manager-mongodb-backups');
  }
  return path.resolve(process.cwd(), 'backups', 'mongodb');
}

async function ensureBackupDir(): Promise<{ ok: true; dir: string } | { ok: false; error: string }> {
  if (!isMongoBackupFilesystemWritable()) {
    return { ok: false, error: SERVERLESS_MONGODB_BACKUP_MESSAGE };
  }
  const dir = getBackupDir();
  try {
    await fs.mkdir(dir, { recursive: true });
    return { ok: true, dir };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

function getRetentionDays(): number {
  const n = Number.parseInt(process.env.MONGODB_BACKUP_RETENTION_DAYS ?? '14', 10);
  return Number.isFinite(n) && n >= 1 ? n : 14;
}

async function pruneOldBackups(backupDir: string, retentionDays: number): Promise<void> {
  const names = await fs.readdir(backupDir).catch(() => []);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const name of names) {
    if (!name.startsWith(BACKUP_FILE_PREFIX) || !name.endsWith(BACKUP_FILE_SUFFIX)) continue;
    const full = path.join(backupDir, name);
    const st = await fs.stat(full).catch(() => null);
    if (st && st.mtimeMs < cutoff) {
      await fs.unlink(full).catch(() => {});
    }
  }
}

function runMongodump(uri: string, archivePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('mongodump', [`--uri=${uri}`, `--archive=${archivePath}`, '--gzip'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            'mongodump introuvable. Installez MongoDB Database Tools (mongodump) et ajoutez-le au PATH.'
          )
        );
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mongodump a quitté avec le code ${code}. ${stderr.trim()}`));
    });
  });
}

export type MongoBackupResult = { ok: true; archivePath: string; filename: string } | { ok: false; error: string };

export type MongoRestoreResult = { ok: true } | { ok: false; error: string };

export type MongoBackupListItem = {
  filename: string;
  size: number;
  createdAt: string;
};

export function isValidBackupFilename(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  return (
    name.startsWith(BACKUP_FILE_PREFIX) || name.startsWith(UPLOAD_BACKUP_PREFIX)
  ) &&
    name.endsWith(BACKUP_FILE_SUFFIX) &&
    !name.includes('..') &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('\0');
}

/** Chemin absolu d’une archive du dossier de sauvegarde (anti path traversal). */
export function resolveBackupArchivePath(filename: string): string | null {
  if (!isValidBackupFilename(filename)) return null;
  const backupDir = path.normalize(getBackupDir());
  const full = path.normalize(path.join(backupDir, filename));
  if (!full.startsWith(backupDir + path.sep) && full !== backupDir) return null;
  return full;
}

export async function listMongoBackups(): Promise<MongoBackupListItem[]> {
  if (!isMongoBackupFilesystemWritable()) return [];
  const backupDir = getBackupDir();
  const names = await fs.readdir(backupDir).catch(() => []);
  const items: MongoBackupListItem[] = [];
  for (const name of names) {
    if (!isValidBackupFilename(name)) continue;
    const full = path.join(backupDir, name);
    const st = await fs.stat(full).catch(() => null);
    if (!st?.isFile()) continue;
    items.push({
      filename: name,
      size: st.size,
      createdAt: st.mtime.toISOString(),
    });
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

function runMongorestore(uri: string, archivePath: string, drop: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [`--uri=${uri}`, `--archive=${archivePath}`, '--gzip'];
    if (drop) args.push('--drop');
    const child = spawn('mongorestore', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            'mongorestore introuvable. Installez MongoDB Database Tools (mongorestore) et ajoutez-le au PATH.'
          )
        );
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mongorestore a quitté avec le code ${code}. ${stderr.trim()}`));
    });
  });
}

/**
 * Sauvegarde complète de la base pointée par DATABASE_URL (mongodump --gzip).
 * Nécessite l’outil en ligne de commande `mongodump` (MongoDB Database Tools).
 */
export async function runMongoBackup(): Promise<MongoBackupResult> {
  const uri = process.env.DATABASE_URL?.trim();
  if (!uri) {
    return { ok: false, error: 'DATABASE_URL est absent.' };
  }

  const ensured = await ensureBackupDir();
  if (!ensured.ok) {
    return { ok: false, error: ensured.error };
  }
  const backupDir = ensured.dir;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${BACKUP_FILE_PREFIX}${stamp}${BACKUP_FILE_SUFFIX}`;
  const archivePath = path.join(backupDir, filename);

  try {
    await runMongodump(uri, archivePath);
    await pruneOldBackups(backupDir, getRetentionDays());
    return { ok: true, archivePath, filename };
  } catch (e) {
    await fs.unlink(archivePath).catch(() => {});
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/**
 * Restaure une archive mongodump (--gzip). Remplace les collections existantes (--drop).
 */
export async function runMongoRestore(archivePath: string): Promise<MongoRestoreResult> {
  const uri = process.env.DATABASE_URL?.trim();
  if (!uri) {
    return { ok: false, error: 'DATABASE_URL est absent.' };
  }
  if (!isMongoBackupFilesystemWritable()) {
    return { ok: false, error: SERVERLESS_MONGODB_BACKUP_MESSAGE };
  }

  try {
    const st = await fs.stat(archivePath);
    if (!st.isFile()) {
      return { ok: false, error: 'Archive introuvable.' };
    }
    await runMongorestore(uri, archivePath, true);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

export function buildUploadedBackupFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${UPLOAD_BACKUP_PREFIX}${stamp}${BACKUP_FILE_SUFFIX}`;
}
