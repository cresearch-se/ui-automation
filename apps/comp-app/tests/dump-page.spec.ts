import { test } from '@playwright/test';
import fs from 'node:fs';
import { EmployeesPage } from '../pages/EmployeesPage';

/**
 * THROWAWAY DEBUG HELPER — not a real test.
 *
 * Claude Code runs on a remote box that cannot reach this app, so it can't observe the live DOM or
 * the real data. This spec harvests the facts Claude needs to fix the filter tests and writes them
 * to `page-report.md` at the repo root. See CLAUDE.md / memory "split-brain-workflow".
 *
 * Run (uses the saved auth session via the comp-app-edge project):
 *   npx playwright test dump-page --project=comp-app-edge
 *
 * Then open `page-report.md` at the repo root and paste its contents into the chat.
 *
 * Each probe is wrapped in try/catch so a failure in one section still writes the rest.
 */
test('dump page snapshot', async ({ page }) => {
  const employees = new EmployeesPage(page);
  const report: string[] = [];
  const add = (s: string) => report.push(s);

  const probe = async (title: string, fn: () => Promise<string>) => {
    try {
      add(`## ${title}\n${await fn()}`);
    } catch (e) {
      add(`## ${title}\n⚠️ ERROR: ${(e as Error).message.split('\n')[0]}`);
    }
  };

  await employees.goto();

  // Does the table have rows on default load, or does it require clicking Search?
  await probe('Default load (before Search)', async () => {
    const rows = await employees.rowCount();
    const empty = await employees.emptyPlaceholder.isVisible();
    return `rowCount = ${rows}\nemptyPlaceholder visible = ${empty}`;
  });

  // Real Office option values (antd renders these in a body-level portal).
  const dropdownOptions = async () =>
    (await page.locator('.ant-select-dropdown:visible .ant-select-item-option').allInnerTexts())
      .map((t) => `  - ${t}`)
      .join('\n');

  await probe('Office select options', async () => {
    await employees.officeSelect.click();
    const opts = await dropdownOptions();
    await page.keyboard.press('Escape');
    return opts || '(none found)';
  });

  await probe('Country select options', async () => {
    await employees.countrySelect.click();
    const opts = await dropdownOptions();
    await page.keyboard.press('Escape');
    return opts || '(none found)';
  });

  await probe('Group select options', async () => {
    await employees.groupSelect.click();
    const opts = await dropdownOptions();
    await page.keyboard.press('Escape');
    return opts || '(none found)';
  });

  // Does clicking Search (no filters) load data?
  await probe('After Search (no filters)', async () => {
    await employees.search();
    await page.waitForTimeout(5000); // give the async fetch time to render
    const rows = await employees.rowCount();
    const empty = await employees.emptyPlaceholder.isVisible();
    return `rowCount = ${rows}\nemptyPlaceholder visible = ${empty}`;
  });

  const out = report.join('\n\n');
  fs.writeFileSync('page-report.md', out, 'utf-8');
  // Also dump the raw ARIA snapshot as a fallback.
  fs.writeFileSync('page-snapshot.aria.yml', await page.locator('body').ariaSnapshot(), 'utf-8');

  console.log('\n' + out + '\n');
  console.log('Wrote page-report.md and page-snapshot.aria.yml to the repo root — paste page-report.md to Claude.');
});
