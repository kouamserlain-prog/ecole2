import fs from 'node:fs';
import path from 'node:path';

type E2eReadyFlag = { ready: boolean; reason: string };

export function readE2eReadyFlag(): E2eReadyFlag {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '.e2e-ready.json'), 'utf8');
    return JSON.parse(raw) as E2eReadyFlag;
  } catch {
    return { ready: false, reason: 'Configuration E2E non initialisée.' };
  }
}
