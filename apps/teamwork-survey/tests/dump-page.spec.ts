import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * THROWAWAY DEBUG HELPER — not a real test. Excluded from normal runs by name: run it explicitly.
 *
 * Claude Code cannot sign in to this app from its own machine (Windows integrated auth), so it can't
 * see the live DOM. Run this on a machine where you CAN open the app (e.g. your laptop), then send
 * the contents of the `teamwork-dump/` folder back so page objects + tests can be written from facts.
 *
 *   npx playwright test dump-page --project=teamwork-survey --headed
 *
 * It opens the app, finds the top-level tabs, and for the FIRST 3 tabs clicks each one and records:
 * an ARIA snapshot, headings, buttons, inputs/selects, tables (headers + first rows), and links.
 * Output: teamwork-dump/index.md (summary) + teamwork-dump/tab-<n>-<name>.aria.yml (full snapshots).
 * Nothing is submitted or changed — it only reads and clicks tabs.
 */
const OUT = 'teamwork-dump';
const TAB_SELECTOR = '[role="tab"], .nav-tabs .nav-link, .nav-pills .nav-link, .ant-tabs-tab';
const MAX_TABS = 3;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tab';

test('dump first tabs', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  const report: string[] = [];
  const add = (s: string) => report.push(s);

  await page.goto('officeheadreview');
  // Wait until the SPA gets past its loading spinner and renders something.
  await page.waitForFunction(() => (document.body.innerText || '').trim().length > 0, null, { timeout: 90_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  add(`# Teamwork Survey dump\n- URL: ${page.url()}\n- Title: ${await page.title()}`);

  const tabs = page.locator(TAB_SELECTOR);
  const tabCount = await tabs.count();
  const tabNames = (await tabs.allInnerTexts()).map((t) => t.trim());
  add(`## Tabs found (${tabCount})\n${tabNames.map((t, i) => `${i + 1}. ${JSON.stringify(t)}`).join('\n') || '(none matched — see top-level snapshot)'}`);

  fs.writeFileSync(path.join(OUT, 'tab-0-landing.aria.yml'), await page.locator('body').ariaSnapshot(), 'utf-8');
  await page.screenshot({ path: path.join(OUT, 'tab-0-landing.png'), fullPage: true });

  const list = async (sel: string, pick: (el: Element) => string) =>
    page.locator(sel).evaluateAll((els, fn) => els.map((e) => (new Function('e', `return (${fn})(e)`))(e)), pick.toString()).catch(() => []);

  for (let i = 0; i < Math.min(MAX_TABS, tabCount); i++) {
    const name = tabNames[i] || `tab-${i + 1}`;
    try {
      await tabs.nth(i).click();
      await page.waitForTimeout(3000); // let async data render
      await page.waitForLoadState('networkidle').catch(() => {});

      const file = `tab-${i + 1}-${slug(name)}`;
      fs.writeFileSync(path.join(OUT, `${file}.aria.yml`), await page.locator('body').ariaSnapshot(), 'utf-8');
      await page.screenshot({ path: path.join(OUT, `${file}.png`), fullPage: true });

      const headings = await list('h1,h2,h3,h4,h5', (e) => `${e.tagName}: ${(e.textContent || '').trim()}`);
      const buttons = await list('button, [role="button"]', (e) => `${(e.textContent || '').trim() || e.getAttribute('aria-label') || '(icon)'} | disabled=${(e as HTMLButtonElement).disabled}`);
      const fields = await list('input, textarea, select, .ant-select, [role="combobox"]', (e) =>
        `${e.tagName.toLowerCase()} type=${e.getAttribute('type')} name=${e.getAttribute('name')} id=${e.id} placeholder=${e.getAttribute('placeholder')} aria-label=${e.getAttribute('aria-label')} class=${(e.getAttribute('class') || '').slice(0, 60)}`);
      const tables = await page.locator('table').evaluateAll((ts) =>
        ts.map((t) => ({
          headers: Array.from(t.querySelectorAll('th')).map((h) => (h.textContent || '').trim()),
          rows: t.querySelectorAll('tbody tr').length,
          firstRows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 3).map((r) => Array.from(r.querySelectorAll('td')).map((c) => (c.textContent || '').trim().slice(0, 40))),
        })),
      ).catch(() => []);

      add(
        `## Tab ${i + 1}: ${JSON.stringify(name)}  (files: ${file}.aria.yml / .png)\n` +
          `### Headings\n${headings.map((h) => `- ${h}`).join('\n') || '(none)'}\n` +
          `### Buttons\n${buttons.map((b) => `- ${b}`).join('\n') || '(none)'}\n` +
          `### Fields\n${fields.map((f) => `- ${f}`).join('\n') || '(none)'}\n` +
          `### Tables\n${tables.length ? JSON.stringify(tables, null, 2) : '(none)'}`,
      );
    } catch (e) {
      add(`## Tab ${i + 1}: ${JSON.stringify(name)}\n⚠️ ERROR: ${(e as Error).message.split('\n')[0]}`);
    }
  }

  const out = report.join('\n\n');
  fs.writeFileSync(path.join(OUT, 'index.md'), out, 'utf-8');
  console.log(`\n${out}\n\nWrote ${OUT}/ — send the whole folder (or at least index.md + the .aria.yml files) back.`);
});
