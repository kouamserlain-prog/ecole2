import { expect, test } from '@playwright/test';
import { waitForApiHealthy } from './helpers/api-health';
import { readE2eReadyFlag } from './helpers/e2e-ready';
import { loginAs, TEST_USERS } from './helpers/login';
import {
  expectRecipientResults,
  expectRecipientResultsNotEmpty,
  filterRecipientsByRole,
  typeRecipientQuery,
  waitForRecipientContactsLoaded,
} from './helpers/recipient-search';

const e2eFlag = readE2eReadyFlag();
const API_BASE = (
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api'
).replace(/\/+$/, '');

const domReady = { waitUntil: 'domcontentloaded' as const };

test.describe('Recherche destinataire — Nouveau message', () => {
  let teacherLoginOk = true;

  test.beforeAll(async ({ request }) => {
    if (!e2eFlag.ready) return;
    await waitForApiHealthy(request);
    const res = await request.post(`${API_BASE}/auth/login`, {
      data: { email: TEST_USERS.admin, password: 'password123' },
    });
    if (!res.ok()) {
      e2eFlag.ready = false;
      e2eFlag.reason = `Connexion seed impossible (${res.status()}). Exécutez npm run prisma:seed.`;
      return;
    }
    const teacherRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: TEST_USERS.teacher, password: 'password123' },
    });
    teacherLoginOk = teacherRes.ok();
  });

  test.beforeEach(async ({ request }) => {
    test.skip(!e2eFlag.ready, e2eFlag.reason);
    await waitForApiHealthy(request);
  });

  test('Admin — modale messagerie affiche des contacts', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAs(page, TEST_USERS.admin);
    await page.goto('/admin?tab=communication', domReady);
    await page.getByRole('button', { name: 'Messagerie', exact: true }).click();
    await page.getByRole('button', { name: 'Nouveau message' }).click();
    await expect(page.getByRole('searchbox', { name: 'Rechercher un destinataire' })).toBeVisible();
    await waitForRecipientContactsLoaded(page);

    await filterRecipientsByRole(page, 'Enseignant');
    await typeRecipientQuery(page, 'Marie');
    await expectRecipientResultsNotEmpty(page);
    await expectRecipientResults(page, /marie/i);
  });

  test('Enseignant — compose affiche des contacts', async ({ page }) => {
    test.skip(!teacherLoginOk, 'teacher1@school.com indisponible');
    await loginAs(page, TEST_USERS.teacher);
    await page.goto('/teacher?tab=messaging', domReady);
    await page.getByRole('button', { name: 'Nouveau message' }).click();
    await expect(page.getByRole('searchbox', { name: 'Rechercher un destinataire' })).toBeVisible();
    await waitForRecipientContactsLoaded(page);

    await filterRecipientsByRole(page, 'Administrateur');
    await expectRecipientResultsNotEmpty(page);
    await expectRecipientResults(page, /admin/i);
  });

  test('Parent — compose affiche des contacts', async ({ page }) => {
    await loginAs(page, TEST_USERS.parent);
    await page.goto('/parent?tab=communication', domReady);
    await page.getByRole('button', { name: 'Nouveau message' }).click();
    await expect(page.getByRole('searchbox', { name: 'Rechercher un destinataire' })).toBeVisible();
    await waitForRecipientContactsLoaded(page);

    await typeRecipientQuery(page, 'Marie');
    await expectRecipientResultsNotEmpty(page);
    await expectRecipientResults(page, 'Marie');
  });

  test('Éducateur — compose affiche des contacts', async ({ page }) => {
    await loginAs(page, TEST_USERS.educator);
    await page.goto('/educator?tab=messaging', domReady);
    await page.getByRole('button', { name: 'Nouveau message' }).click();
    await expect(page.getByRole('searchbox', { name: 'Rechercher un destinataire' })).toBeVisible();
    await waitForRecipientContactsLoaded(page);

    await filterRecipientsByRole(page, 'Administrateur');
    await expectRecipientResultsNotEmpty(page);
    await expectRecipientResults(page, /admin/i);
  });

  test('Infirmier (staff) — compose affiche des contacts', async ({ page }) => {
    await loginAs(page, TEST_USERS.nurse);
    await page.goto('/staff?tab=communication_mgmt', domReady);
    await page.getByRole('button', { name: 'Communication' }).click();
    await page.getByRole('button', { name: 'Nouveau message' }).click();
    await expect(page.getByRole('searchbox', { name: 'Rechercher un destinataire' })).toBeVisible();
    await waitForRecipientContactsLoaded(page);

    await filterRecipientsByRole(page, 'Administrateur');
    await expectRecipientResultsNotEmpty(page);
    await expectRecipientResults(page, /admin|dupont|jean/i);
  });
});
