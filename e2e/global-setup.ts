import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

const ROOT = path.resolve(__dirname, '..');
const FLAG_PATH = path.join(__dirname, '.e2e-ready.json');

export default async function globalSetup(): Promise<void> {
  loadEnv({ path: path.join(ROOT, 'server/.env') });

  const ready = Boolean(process.env.DATABASE_URL);
  const reason = ready
    ? ''
    : 'DATABASE_URL manquant — copiez server/.env.example vers server/.env et configurez MongoDB.';

  fs.writeFileSync(FLAG_PATH, JSON.stringify({ ready, reason }), 'utf8');

  if (!ready) {
    console.warn(`\n[E2E] Prérequis non satisfaits — les tests seront ignorés.\n→ ${reason}\n`);
  }
}
