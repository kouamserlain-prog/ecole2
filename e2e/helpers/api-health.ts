import type { APIRequestContext, Page } from '@playwright/test';

const API_BASE = (
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api'
).replace(/\/+$/, '');

/** Attend que l’API réponde (health) avant les scénarios navigateur. */
export async function waitForApiHealthy(
  request: APIRequestContext,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<void> {
  const attempts = options.attempts ?? 40;
  const delayMs = options.delayMs ?? 500;
  const healthUrl = `${API_BASE}/health`;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await request.get(healthUrl, { timeout: 5_000 });
      if (res.ok()) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error(`API injoignable après ${attempts} tentatives (${healthUrl})`);
}

/** Attend que l’API réponde depuis le contexte navigateur (même origine CORS que l’app). */
export async function waitForBrowserApi(
  page: Page,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  const healthUrl = `${API_BASE}/health`;
  const timeoutMs = options.timeoutMs ?? 60_000;
  await page.waitForFunction(
    async (url) => {
      try {
        const res = await fetch(url);
        return res.ok;
      } catch {
        return false;
      }
    },
    healthUrl,
    { timeout: timeoutMs },
  );
}
