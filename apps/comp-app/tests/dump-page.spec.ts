import { test } from '@playwright/test';
import fs from 'node:fs';

/**
 * THROWAWAY DEBUG HELPER — not a real test.
 *
 * Claude Code runs on a remote box that cannot reach this app, so it can't observe the live DOM to
 * pick correct locators. This spec captures the live page here on the LOCAL machine and writes it to
 * disk, so the snapshot can be pasted back to Claude to fix locators. See CLAUDE.md / memory
 * "split-brain-workflow".
 *
 * Run (uses the saved auth session via the comp-app-edge project):
 *   npx playwright test dump-page --project=comp-app-edge
 *
 * Then open the generated files at the repo root and paste their contents into the chat:
 *   - page-snapshot.aria.yml  (accessibility tree — best for locators)
 *   - page-snapshot.html      (raw HTML — fallback / attribute detail)
 *
 * Tweak the navigation/interactions below to reach whatever page state you need snapshotted.
 */
test('dump page snapshot', async ({ page }) => {
  await page.goto('Home');
  // This SPA shows a loading spinner then renders content asynchronously (~6-10s), so
  // 'networkidle' fires too early and captures only the spinner. Wait for a real app element.
  await page.getByRole('tab', { name: 'Employees', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });

  // Accessibility tree of the whole page — this is what Claude reads to choose role/name locators.
  const aria = await page.locator('body').ariaSnapshot();
  fs.writeFileSync('page-snapshot.aria.yml', aria, 'utf-8');

  // Raw HTML as a fallback (class names, data-* attributes, antd internals).
  const html = await page.content();
  fs.writeFileSync('page-snapshot.html', html, 'utf-8');

  console.log('Wrote page-snapshot.aria.yml and page-snapshot.html to the repo root — paste them to Claude.');
});
