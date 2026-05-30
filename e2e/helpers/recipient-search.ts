import { expect, type Page } from '@playwright/test';

const RECIPIENT_SEARCH = 'Rechercher un destinataire';
const LOADING_CONTACTS = 'Chargement des contacts…';

/** Attend la fin du chargement des contacts dans la modale « Nouveau message ». */
export async function waitForRecipientContactsLoaded(page: Page): Promise<void> {
  const loading = page.getByText(LOADING_CONTACTS);
  if (await loading.isVisible().catch(() => false)) {
    await expect(loading).not.toBeVisible({ timeout: 90_000 });
  }
}

/** Saisie dans le champ destinataire (attend le debounce 200 ms). */
export async function typeRecipientQuery(page: Page, query: string): Promise<void> {
  const input = page.getByRole('searchbox', { name: RECIPIENT_SEARCH });
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(query);
  await page.waitForTimeout(350);
}

/** Clique sur un filtre de rôle dans la recherche destinataire. */
export async function filterRecipientsByRole(page: Page, roleLabel: string): Promise<void> {
  await page
    .getByRole('group', { name: 'Filtrer par rôle' })
    .getByRole('button', { name: roleLabel, exact: true })
    .click();
  await page.waitForTimeout(350);
}

/** Vérifie qu’au moins un résultat contient le texte attendu. */
export async function expectRecipientResults(page: Page, text: string | RegExp): Promise<void> {
  const matcher = typeof text === 'string' ? new RegExp(text, 'i') : text;
  await expect(page.getByText(matcher).first()).toBeVisible({ timeout: 10_000 });
}

/** Vérifie qu’aucun message « aucun destinataire » n’est affiché dans le panneau. */
export async function expectRecipientResultsNotEmpty(page: Page): Promise<void> {
  await expect(page.getByText('Aucun destinataire trouvé.')).not.toBeVisible({ timeout: 3_000 });
}
