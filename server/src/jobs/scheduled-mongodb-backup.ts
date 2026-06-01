import cron from 'node-cron';
import { isMongoBackupFilesystemWritable, runMongoBackup } from '../utils/mongodb-backup.util';

function isScheduledBackupsEnabled(): boolean {
  const v = process.env.ENABLE_SCHEDULED_MONGODB_BACKUPS?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function getCronExpression(): string {
  const expr = process.env.MONGODB_BACKUP_CRON?.trim();
  if (expr && cron.validate(expr)) return expr;
  return '0 3 * * *';
}

/**
 * Planifie des sauvegardes MongoDB dans le processus API (un seul worker en prod recommandé).
 * Désactivé sur Vercel (pas de système de fichiers persistant).
 */
export function startScheduledMongoBackups(): void {
  if (!isMongoBackupFilesystemWritable()) return;
  if (!isScheduledBackupsEnabled()) return;

  const expression = getCronExpression();
  if (!cron.validate(expression)) {
    console.warn(
      `[Sauvegardes] MONGODB_BACKUP_CRON invalide (${expression}) — planification désactivée.`
    );
    return;
  }

  cron.schedule(expression, async () => {
    const result = await runMongoBackup();
    if (result.ok) {
      console.log(`[Sauvegardes] MongoDB OK → ${result.archivePath}`);
    } else {
      console.error(`[Sauvegardes] MongoDB échec : ${result.error}`);
    }
  });

  console.log(
    `[Sauvegardes] Planification MongoDB activée (cron: ${expression}). ` +
      'Pour plusieurs instances, utilisez plutôt une tâche cron système ou les sauvegardes Atlas.'
  );
}
