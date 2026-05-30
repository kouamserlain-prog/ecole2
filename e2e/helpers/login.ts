import type { Page } from '@playwright/test';
import { waitForBrowserApi } from './api-health';

export const DEFAULT_PASSWORD = 'password123';

export const TEST_USERS = {
  admin: 'admin@school.com',
  teacher: 'teacher1@school.com',
  parent: 'parent1@school.com',
  educator: 'educator1@school.com',
  nurse: 'nurse@school.com',
} as const;

/** Connexion en deux étapes (email puis mot de passe). */
export async function loginAs(
  page: Page,
  email: string,
  password: string = DEFAULT_PASSWORD,
): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await waitForBrowserApi(page);
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('#login-email').fill(email);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(admin|teacher|parent|educator|staff|student|super-admin)(?:\?|$|\/)/, {
    timeout: 60_000,
  });
}
