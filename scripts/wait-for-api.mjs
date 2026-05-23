/**
 * Attend que l’API réponde avant de lancer Next (évite ECONNREFUSED au démarrage).
 */
const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');
const healthUrl = `${base}/api/health`;
const maxAttempts = 60;
const delayMs = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      console.log(`[wait-for-api] API prête (${healthUrl})`);
      process.exit(0);
    }
  } catch {
    /* retry */
  }
  if (attempt === 1) {
    console.log(`[wait-for-api] En attente de l’API sur ${healthUrl}…`);
  }
  await sleep(delayMs);
}

console.error(`[wait-for-api] API injoignable après ${maxAttempts} tentatives.`);
process.exit(1);
