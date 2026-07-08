import { test as setup, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { SITES } from './sites';

/**
 * GCC SharePoint — authentication setup.
 *
 * SharePoint Online (cresearch1.sharepoint.com) uses Microsoft 365 SSO. This setup opens a
 * **headed** browser and captures the session to a storageState file that every later run reuses.
 * Cookies are tenant-wide, so this one login covers every site listed in sites.ts.
 *
 * Two modes, auto-selected:
 *   1. SCRIPTED — if GCC_SHAREPOINT_USERNAME / GCC_SHAREPOINT_PASSWORD are set, it types them into
 *      the Microsoft sign-in form for you. If your account then requires MFA (most do), just
 *      complete that one prompt in the open browser window — the setup keeps waiting.
 *   2. MANUAL   — if no env vars are set, you sign in entirely by hand.
 * Either way it finishes the moment the site's REST API answers with the new cookies.
 *
 * Set the credentials as real environment variables before running, e.g.:
 *   PowerShell:  $env:GCC_SHAREPOINT_USERNAME="you@cornerstone.com"; $env:GCC_SHAREPOINT_PASSWORD="…"
 *   cmd.exe:     set GCC_SHAREPOINT_USERNAME=you@cornerstone.com  &&  set GCC_SHAREPOINT_PASSWORD=…
 *   bash:        export GCC_SHAREPOINT_USERNAME=you@cornerstone.com GCC_SHAREPOINT_PASSWORD=…
 * (Or put them in a gitignored `.env` — see .env.example — if you install & wire up `dotenv`.)
 *
 * HOW TO RUN (once; re-run whenever the saved session expires):
 *   npx playwright test --project=gcc-sharepoint-setup
 *
 * The session is saved to playwright/.auth/gcc-sharepoint.json (gitignored).
 */

const authFile = 'playwright/.auth/gcc-sharepoint.json';

/**
 * Best-effort drive of the Microsoft 365 sign-in form. Every step is optional and short-timeout:
 * if an element isn't present (already past it, a different screen, MFA, etc.) we skip it and let
 * the REST poll below wait for the human to finish. Never throws.
 */
async function trySignIn(page: Page, username: string, password: string): Promise<void> {
  const fillIfVisible = async (selector: string, value: string) => {
    const field = page.locator(selector).first();
    try {
      await field.waitFor({ state: 'visible', timeout: 15_000 });
      await field.fill(value);
      return true;
    } catch {
      return false;
    }
  };
  const clickIfVisible = async (selector: string) => {
    const btn = page.locator(selector).first();
    try {
      await btn.waitFor({ state: 'visible', timeout: 8_000 });
      await btn.click();
      return true;
    } catch {
      return false;
    }
  };

  try {
    // Email → Next
    if (await fillIfVisible('input[type="email"], input[name="loginfmt"]', username)) {
      await clickIfVisible('#idSIButton9, input[type="submit"]');
    }
    // Password → Sign in
    if (await fillIfVisible('input[type="password"], input[name="passwd"]', password)) {
      await clickIfVisible('#idSIButton9, input[type="submit"]');
    }
    // "Stay signed in?" → Yes (harmless if it never appears)
    await clickIfVisible('#idSIButton9, input[type="submit"][value="Yes"]');
  } catch {
    // Swallow anything — the REST poll is the real success gate.
  }
}

setup('capture SharePoint session', async ({ page, playwright }) => {
  // Generous budget for SSO + a possible manual MFA step.
  setup.setTimeout(5 * 60_000);

  const site = SITES[0];

  // Fast path: if we already have a saved session that still works, don't log in again.
  if (fs.existsSync(authFile)) {
    const ctx = await playwright.request.newContext({ storageState: authFile });
    try {
      const res = await ctx.get(`${site}_api/web?$select=Title`, {
        headers: { Accept: 'application/json;odata=nominal' },
      });
      if (res.ok()) {
        console.log(`\n>>> Existing session at ${authFile} is still valid — skipping login.\n`);
        return;
      }
    } catch {
      // fall through to login
    } finally {
      await ctx.dispose();
    }
    console.log('\n>>> Saved session is stale — re-authenticating.\n');
  }

  // Land on the first site. Unauthenticated, this redirects to the Microsoft sign-in flow.
  await page.goto(site, { waitUntil: 'domcontentloaded' });

  const username = process.env.GCC_SHAREPOINT_USERNAME;
  const password = process.env.GCC_SHAREPOINT_PASSWORD;

  if (username && password) {
    console.log('\n>>> Credentials found — attempting scripted sign-in. Complete MFA in the window if prompted...\n');
    await trySignIn(page, username, password);
  } else {
    console.log('\n>>> No GCC_SHAREPOINT_USERNAME / GCC_SHAREPOINT_PASSWORD set — please sign in by hand.\n');
  }

  // Login is "done" once the site's REST API answers 200 with our freshly-acquired cookies.
  // This is exactly the access the scraper needs, so it's the most meaningful success signal —
  // and it patiently covers a manual MFA step whether login was scripted or manual.
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
