/** Journalise les variables manquantes en production (sans exposer de secrets). */
export function logProductionEnvDiagnostics(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing: string[] = [];
  const jwt = (process.env.JWT_SECRET ?? '').trim();
  if (!jwt || jwt.length < 32) missing.push('JWT_SECRET (≥ 32 caractères)');

  const db = (process.env.DATABASE_URL ?? '').trim();
  if (!db) missing.push('DATABASE_URL');

  const frontend = (process.env.FRONTEND_URL ?? '').trim();
  if (!frontend) missing.push('FRONTEND_URL');

  const nfc = (process.env.NFC_API_KEY ?? '').trim();
  if (!nfc || nfc.length < 32) {
    console.warn(
      '[Config] NFC_API_KEY absent ou faible — les routes NFC / reconnaissance faciale seront indisponibles jusqu’à configuration.',
    );
  }

  if (!process.env.SENSITIVE_FIELD_ENCRYPTION_KEY?.trim()) {
    console.warn(
      '[Config] SENSITIVE_FIELD_ENCRYPTION_KEY absent — champs sensibles élève non chiffrés.',
    );
  }

  if (process.env.VERCEL === '1' && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.warn('[Config] BLOB_READ_WRITE_TOKEN absent — uploads non persistants sur Vercel.');
  }

  if (missing.length > 0) {
    console.error(
      `[Config] Variables obligatoires manquantes en production : ${missing.join(', ')}`,
    );
  }
}

/** Message d’erreur utilisateur pour échec Prisma (connexion, timeout). */
export function prismaConnectionErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'P1001' || code === 'P1017') {
    return 'Base de données inaccessible. Réessayez dans quelques instants ou contactez l’administrateur.';
  }
  if (code === 'P1003' || code === 'P1012') {
    return 'Configuration base de données invalide sur le serveur.';
  }
  const msg = 'message' in error ? String((error as { message: unknown }).message) : '';
  if (/connect|ECONNREFUSED|Server selection timed out/i.test(msg)) {
    return 'Impossible de joindre la base de données.';
  }
  if (/DNS resolution|réseau impossible|network unreachable|10051/i.test(msg)) {
    return 'Impossible de joindre MongoDB (réseau ou DATABASE_URL invalide — mot de passe avec « @ » à encoder en %40).';
  }
  if (/ReplicaSetNoPrimary|Server selection timeout/i.test(msg)) {
    return 'MongoDB Atlas injoignable : vérifiez replicaSet dans DATABASE_URL (copiez l’URI standard depuis Atlas → Connect) et l’accès réseau (IP autorisée).';
  }
  return null;
}

/** Détecte une URI MongoDB dont le mot de passe contient un « @ » non encodé. */
export function databaseUrlMisconfigurationHint(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith('mongodb')) return null;

  const withoutScheme = trimmed.replace(/^mongodb\+srv:\/\//, '').replace(/^mongodb:\/\//, '');
  const pathStart = withoutScheme.indexOf('/');
  const authority =
    pathStart >= 0 ? withoutScheme.slice(0, pathStart) : withoutScheme.split('?')[0] ?? '';
  const atCount = (authority.match(/@/g) ?? []).length;
  if (atCount > 1) {
    return 'DATABASE_URL semble mal formée : encodez les « @ » du mot de passe en %40 (et les autres caractères spéciaux en URL).';
  }
  return null;
}

export function logDatabaseUrlDiagnostics(): void {
  const db = (process.env.DATABASE_URL ?? '').trim();
  if (!db) return;
  const hint = databaseUrlMisconfigurationHint(db);
  if (hint) console.error(`[Config] ${hint}`);
}
