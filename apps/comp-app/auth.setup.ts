import { test as setup, expect } from '@playwright/test';

/**
 * Comp App authentication setup.
 *
 * Logs into the Consulting Comp App via SSO ONCE and saves the browser session to a storageState
 * file. The `comp-app` project (see playwright.config.ts) depends on this and reuses the saved
 * session, so individual tests start already authenticated.
 *
 * Credentials come from the environment (never hardcode / commit them):
 *   COMP_APP_USERNAME, COMP_APP_PASSWORD
 * Set them as real env vars, or put them in a gitignored `.env` (see .env.example) if you have
 * `dotenv` installed.
 *
 * STATUS: the SSO interaction below is a TEMPLATE — it was written without observing the live
 * identity-provider screens. Verify/adjust the selectors on first run (healer).
 */

const authFile = 'playwright/.auth/comp-app.json';

setup('authenticate to comp-app via SSO', async ({ page }) => {
  const username = process.env.COMP_APP_USERNAME;
  const password = process.env.COMP_APP_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'Missing credentials: set COMP_APP_USERNAME and COMP_APP_PASSWORD (env vars or .env) before running comp-app tests.',
    );
  }

  // Hitting the app unauthenticated should redirect to the SSO / identity provider.
  await page.goto('Home');

  // --- SSO LOGIN FLOW (TEMPLATE — confirm selectors against the live IdP) -----------------
  // Microsoft-style SSO is usually a multi-step form. Uncomment/adjust once the real flow is seen:
  //
  // await page.getByRole('textbox', { name: /email|user/i }).fill(username);
  // await page.getByRole('button', { name: /next/i }).click();
  // await page.getByRole('textbox', { name: /password/i }).fill(password);
  // await page.getByRole('button', { name: /sign in/i }).click();
  // await page.getByRole('button', { name: /yes|stay signed in/i }).click(); // optional KMSI prompt
  // ----------------------------------------------------------------------------------------

  // Consider login successful once the app's Employees tab is visible.
  await expect(page.getByRole('tab', { name: 'Employees' })).toBeVisible({ timeout: 60_000 });

  await page.context().storageState({ path: authFile });
});
