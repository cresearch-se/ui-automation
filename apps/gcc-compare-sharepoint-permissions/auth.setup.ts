import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import { SITES } from './sites';

/**
 * GCC SharePoint — authentication setup (MANUAL login capture).
 *
 * SharePoint Online (cresearch1.sharepoint.com) uses Microsoft 365 SSO, usually with MFA, which
 * is painful to script reliably. So instead of automating the login form, this setup opens a
 * **headed** browser and waits while YOU sign in by hand. Once the site's REST API answers with
 * your cookies, it saves the whole session to a storageState file that every later run reuses.
 *
 * Cookies are tenant-wide, so this one login covers every site listed in sites.ts.
 *
 * HOW TO RUN (do this once; re-run whenever the saved session expires):
 *   npx playwright test --project=gcc-sharepoint-setup
 * A real browser window opens on the SharePoint sign-in page. Complete SSO + MFA. When the
 * Facilities site finishes loading, the setup detects it, saves the session, and closes.
 *
 * The session is saved to playwright/.auth/gcc-sharepoint.json (gitignored).
 */

const authFile = 'playwright/.auth/gcc-sharepoint.json';

setup('capture SharePoint session (manual login)', async ({ page, playwright }) => {
  // Generous budget for a human to complete SSO + MFA.
  setup.setTimeout(5 * 60_000);

  const site = SITES[0];

  // Fast path: if we already have a saved session that still works, don't prompt for login.
  if (fs.existsSync(authFile)) {
    const ctx = await playwright.request.newContext({ storageState: authFile });
    try {
      const res = await ctx.get(`${site}_api/web?$select=Title`, {
        headers: { Accept: 'application/json;odata=nominal' },
      });
      if (res.ok()) {
        console.log(`\n>>> Existing session at ${authFile} is still valid — skipping manual login.\n`);
        return;
      }
    } catch {
      // fall through to manual login
    } finally {
      await ctx.dispose();
    }
    console.log('\n>>> Saved session is stale — re-authenticating.\n');
  }

  // Land on the first site. Unauthenticated, this redirects to the Microsoft sign-in flow.
  await page.goto(site, { waitUntil: 'domcontentloaded' });

  console.log('\n>>> Please sign in to SharePoint in the browser window (SSO + MFA). Waiting up to 5 min...\n');

  // Login is "done" once the site's REST API answers 200 with our freshly-acquired cookies.
  // This is exactly the access the scraper needs, so it's the most meaningful success signal.
  await expect
    .poll(
      async () => {
        try {
          const res = await page.request.get(`${site}_api/web?$select=Title`, {
            headers: { Accept: 'application/json;odata=nominal' },
          });
          return res.status();
        } catch {
          return 0;
        }
      },
      { message: 'Waiting for authenticated SharePoint access', timeout: 5 * 60_000, intervals: [2_000] },
    )
    .toBe(200);

  await page.context().storageState({ path: authFile });
  console.log(`\n>>> Login captured. Session saved to ${authFile}\n`);
});
