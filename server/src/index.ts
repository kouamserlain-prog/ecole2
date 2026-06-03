import dotenv from 'dotenv';
import { ensureJwtConfiguration } from './utils/jwt.util';
import { useBlobStorage } from './utils/blob-storage.util';
import { createApp } from './app/createApp';
import { startScheduledMongoBackups } from './jobs/scheduled-mongodb-backup';
import { startScheduledTuitionReminders } from './jobs/scheduled-tuition-reminders';
import { startScheduledAppointmentReminders } from './jobs/scheduled-appointment-reminders';
import {
  logDatabaseUrlDiagnostics,
  logProductionEnvDiagnostics,
} from './utils/production-env-diagnostics.util';

dotenv.config();

try {
  ensureJwtConfiguration();
} catch (e) {
  console.error(e);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

logDatabaseUrlDiagnostics();
logProductionEnvDiagnostics();

if (process.env.NODE_ENV === 'production' && !process.env.SENSITIVE_FIELD_ENCRYPTION_KEY?.trim()) {
  console.warn(
    '[Sécurité] SENSITIVE_FIELD_ENCRYPTION_KEY est absent — les champs élève sensibles (adresse, urgence, santé) sont stockés en clair. Définissez une clé forte et ré-enregistrez les données si besoin.'
  );
}

if (process.env.VERCEL === '1' && !useBlobStorage()) {
  console.error(
    '[Uploads] BLOB_READ_WRITE_TOKEN manquant — les fichiers uploadés ne seront pas conservés après un redéploiement. Ajoutez un Blob store : Vercel → Storage → Blob → Connect to project.',
  );
}

const app = createApp();
const PORT = process.env.PORT || 5000;

if (process.env.VERCEL !== '1') {
  startScheduledMongoBackups();
  startScheduledTuitionReminders();
  startScheduledAppointmentReminders();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
