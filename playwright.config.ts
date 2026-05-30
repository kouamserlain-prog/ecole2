import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

/** Charge server/.env pour que le serveur API démarre avec DATABASE_URL. */
loadEnv({ path: path.resolve(__dirname, 'server/.env') });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:5000/api';
const e2eDatabaseConfigured = Boolean(process.env.DATABASE_URL);
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVERS === '1';

export default defineConfig({
  testDir: './e2e',
  globalSetup: path.resolve(__dirname, 'e2e/global-setup.ts'),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER || !e2eDatabaseConfigured
      ? undefined
      : [
        {
          command: 'npm run dev:server',
          url: `${apiBaseUrl.replace(/\/+$/, '')}/health`,
          reuseExistingServer,
          timeout: 120_000,
          cwd: '.',
          env: {
            ...process.env,
            FRONTEND_URL: baseURL,
          },
        },
        {
          command: 'npm run dev:web:wait',
          url: baseURL,
          reuseExistingServer,
          timeout: 120_000,
          cwd: '.',
          env: {
            ...process.env,
            NEXT_PUBLIC_API_URL: apiBaseUrl,
          },
        },
      ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
