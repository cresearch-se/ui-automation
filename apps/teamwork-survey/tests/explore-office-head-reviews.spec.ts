import { test, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * THROWAWAY DEBUG HELPER — not a real test. Companion to dump-page.spec.ts, focused on tab 1
 * (Office Head Reviews). Captures the facts the test plan still lists as unknown, so the page object
 * and tests can be written from real DOM/text instead of guesses:
 *   - dropdown option lists (all options, even though antd virtualises long lists)
 *   - form + table DOM, action-icon markup, column sorting behaviour, column filter popups
 *   - [MUTATING] submit alert/toast text, form state after submit, the "already exists" message and
 *     what Yes / No do, edit-mode state (labels, disabled fields), delete confirm text, Cancel/OK.
 *
 *   Read-only part (safe):
 *     npx playwright test explore-office-head --project=teamwork-survey --headed -g "read-only"
 *
 *   Mutating part (creates ONE review on staging, then deletes it in a finally block):
 *     PowerShell:  $env:DUMP_MUTATE = "1"; npx playwright test explore-office-head --project=teamwork-survey --headed -g "mutating"
 *
 * Output: teamwork-dump/office-head/ — send index.md (+ the .html / .png files) back.
 */
const OUT = path.join('teamwork-dump', 'office-head');
const TAG = `UITEST-DUMP-${Date.now()}`;

const report: string[] = [];
const add = (s: string) => report.push(s);
const flush = (name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), report.join('\n\n'), 'utf-8');
};
const save = (name: string, content: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), content, 'utf-8');
};

async function openPage(page: Page) {
  await page.goto('officeheadreview');
  await page.getByText('Review Period', { exact: false }).first().waitFor({ timeout: 90_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

// Stable hooks from the live DOM: each antd form item has <label for="ReviewYear|OfficerEmpNo|Review">.
// (antd ids like rc_select_17 are dynamic — never used.) The hidden Rating item is excluded by :visible.
const selects = (page: Page) => page.locator('form .ant-select:visible');
const formSelect = (page: Page, labelFor: string) =>
  page.locator('.ant-form-item', { has: page.locator(`label[for="${labelFor}"]`) }).locator('.ant-select').first();
const reviewPeriodSelect = (page: Page) => formSelect(page, 'ReviewYear');
const officeHeadSelect = (page: Page) => formSelect(page, 'OfficerEmpNo');
const dropdownOptions = (page: Page) =>
  page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');

/** Read EVERY option of an antd select (virtual list renders only ~8 at a time → scroll and collect). */
async function allOptions(page: Page, select: Locator): Promise<string[]> {
  await select.click();
  await dropdownOptions(page).first().waitFor({ timeout: 10_000 });
  const seen = new Set<string>();
  const ordered: string[] = [];
  const holder = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .rc-virtual-list-holder');
  for (let i = 0; i < 80; i++) {
    const texts = await dropdownOptions(page).allInnerTexts();
    let added = 0;
    for (const t of texts.map(norm)) {
      if (!seen.has(t)) { seen.add(t); ordered.push(t); added++; }
    }
    if (added === 0 && i > 0) break;
    await holder.evaluate((el) => (el.scrollTop += el.clientHeight - 10)).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Escape');
  return ordered;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Choose an option by its whitespace-normalised text (e.g. "Bickford, Eric - New York"). The selects are
 * NOT searchable (readonly input), and the list is virtual, so scroll the list until the option renders.
 */
async function chooseByText(page: Page, select: Locator, text: string) {
  await select.click();
  const holder = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .rc-virtual-list-holder');
  await dropdownOptions(page).first().waitFor({ timeout: 10_000 });
  await holder.evaluate((el) => (el.scrollTop = 0)).catch(() => {});
  for (let i = 0; i < 40; i++) {
    const texts = (await dropdownOptions(page).allInnerTexts()).map(norm);
    const idx = texts.indexOf(norm(text));
    if (idx >= 0) {
      await dropdownOptions(page).nth(idx).click();
      return;
    }
    await holder.evaluate((el) => (el.scrollTop += el.clientHeight - 10)).catch(() => {});
    await page.waitForTimeout(150);
  }
  throw new Error(`Option not found in dropdown: ${text}`);
}

const selectedText = async (select: Locator) =>
  norm(await select.locator('.ant-select-selection-item').innerText().catch(() => ''));

const rowsLocator = (page: Page) => page.locator('.ant-table-tbody tr.ant-table-row:visible');

async function tableRows(page: Page): Promise<string[][]> {
  return rowsLocator(page).evaluateAll((trs) =>
    trs.map((r) => Array.from(r.querySelectorAll('td')).map((c) => (c as HTMLElement).innerText.trim())),
  );
}

async function startObserver(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__added = [];
    new MutationObserver((ms) =>
      ms.forEach((m) =>
        m.addedNodes.forEach((n) => {
          const t = ((n as HTMLElement).innerText || n.textContent || '').trim();
          if (t && t.length < 300) w.__added.push(t);
        }),
      ),
    ).observe(document.body, { childList: true, subtree: true });
  });
}
const takeAdded = async (page: Page) =>
  Array.from(new Set(await page.evaluate(() => { const w = window as any; const a = w.__added || []; w.__added = []; return a; })));

async function formState(page: Page) {
  return page.evaluate(() => {
    const vis = (e: Element) => !!(e as HTMLElement).offsetParent;
    return {
      selects: Array.from(document.querySelectorAll('.ant-select')).filter(vis).map((e) => ({
        text: (e as HTMLElement).innerText.trim(),
        disabled: e.classList.contains('ant-select-disabled'),
      })),
      editor: Array.from(document.querySelectorAll('[contenteditable="true"]')).filter(vis).map((e) => (e as HTMLElement).innerText.trim()),
      counter: Array.from(document.querySelectorAll('*')).filter((e) => vis(e) && /CHARS:\s*\d+/.test((e as HTMLElement).innerText || '') && e.children.length < 4).map((e) => (e as HTMLElement).innerText.trim().replace(/\s+/g, ' ')).slice(-1),
      buttons: Array.from(document.querySelectorAll('button')).filter(vis).map((b) => `${b.innerText.trim() || b.getAttribute('aria-label') || '(icon)'} | disabled=${(b as HTMLButtonElement).disabled}`),
      errors: Array.from(document.querySelectorAll('[class*="error"], .text-danger, .ant-form-item-explain')).filter(vis).map((e) => (e as HTMLElement).innerText.trim()).filter(Boolean),
    };
  });
}

async function typeComment(page: Page, text: string) {
  const editor = page.locator('[contenteditable="true"]:visible').first();
  await editor.click();
  await page.keyboard.type(text);
}

test.describe('Office Head Reviews — exploration', () => {
  test.beforeEach(() => { report.length = 0; });

  test('read-only: form, options, table, sort, filters', async ({ page }) => {
    test.setTimeout(240_000);
    await openPage(page);
    add(`# Office Head Reviews — read-only dump\n- URL: ${page.url()}`);
    save('landing.aria.yml', await page.locator('body').ariaSnapshot());
    await page.screenshot({ path: path.join(OUT, 'landing.png'), fullPage: true });

    // --- dropdowns
    add(`- visible .ant-select count: ${await selects(page).count()} (0 = dropdowns are NOT antd — see landing.aria.yml)`);
    if ((await selects(page).count()) >= 2) {
      const periods = await allOptions(page, reviewPeriodSelect(page));
      const heads = await allOptions(page, officeHeadSelect(page));
      add(`## Review Period options (${periods.length})\n${periods.map((p) => `- ${p}`).join('\n')}`);
      add(`## Office Head options (${heads.length})\n${heads.map((h) => `- ${h}`).join('\n')}`);
      save('select-markup.html', await reviewPeriodSelect(page).evaluate((e) => e.outerHTML));
    }

    // --- tabs
    const tabs = await page.locator('[role="tab"], .nav-tabs .nav-link, .nav-pills .nav-link').allInnerTexts();
    add(`## Tabs\n${tabs.map((t, i) => `${i + 1}. ${t.trim()}`).join('\n')}`);

    // --- table
    const headers = await page.locator('.ant-table-thead th:visible').allInnerTexts();
    add(`## Table headers\n${JSON.stringify(headers.map((h) => h.trim()))}`);
    const rows = await tableRows(page);
    add(`## Rows (${rows.length})\n${JSON.stringify(rows.slice(0, 10), null, 1)}`);
    const firstRow = rowsLocator(page).first();
    if (await firstRow.count()) save('first-row.html', await firstRow.evaluate((e) => e.outerHTML));
    save('table-header.html', await page.locator('.ant-table-thead:visible').first().evaluate((e) => e.outerHTML).catch(() => ''));
    add(`## Pagination\n${(await page.locator('.ant-pagination:visible').first().innerText().catch(() => '(none)')).replace(/\s+/g, ' ')}`);

    // --- sorting: click each sorter, record column 1 + date column order
    const sorters = page.locator('.ant-table-thead th.ant-table-column-has-sorters:visible');
    const sorterCount = await sorters.count();
    add(`## Sorting (${sorterCount} sortable headers)`);
    for (let i = 0; i < sorterCount; i++) {
      const th = sorters.nth(i);
      const name = (await th.innerText()).trim();
      const states: string[] = [];
      for (let click = 0; click < 3; click++) {
        await th.click();
        await page.waitForTimeout(400);
        const aria = await th.getAttribute('aria-sort');
        const vals = (await tableRows(page)).map((r) => r.join(' | ').slice(0, 70));
        states.push(`click ${click + 1}: aria-sort=${aria}; rows=${JSON.stringify(vals)}`);
      }
      add(`### ${name}\n${states.join('\n')}`);
    }

    // --- filter popups
    const funnels = page.locator('.ant-table-thead th:visible .ant-table-filter-trigger');
    const funnelCount = await funnels.count();
    add(`## Column filters (${funnelCount} funnels)`);
    for (let i = 0; i < funnelCount; i++) {
      const th = funnels.nth(i).locator('xpath=ancestor::th');
      const name = (await th.innerText()).trim();
      await funnels.nth(i).click();
      const dd = page.locator('.ant-table-filter-dropdown:visible');
      await dd.waitFor({ timeout: 5000 }).catch(() => {});
      const items = await dd.locator('li, label').allInnerTexts().catch(() => []);
      add(`### ${name}\noptions: ${JSON.stringify(items.map((x) => x.trim()).filter(Boolean))}`);
      save(`filter-popup-${i}.html`, await dd.evaluate((e) => e.outerHTML).catch(() => ''));
      await page.keyboard.press('Escape'); // (a click at 5,5 would hit the nav "Toggle navigation" button)
    }

    flush('index-readonly.md');
    console.log(report.join('\n\n'));
  });

  test('mutating: submit → duplicate → edit → delete (cleans up)', async ({ page }) => {
    test.skip(process.env.DUMP_MUTATE !== '1', 'set DUMP_MUTATE=1 to run (creates + deletes one review)');
    test.setTimeout(300_000);
    await openPage(page);
    await startObserver(page);
    add(`# Office Head Reviews — mutating dump\n- tag: ${TAG}`);

    const rowWithTag = () => rowsLocator(page).filter({ hasText: TAG });
    try {
      // 0. empty submit → validation
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(500);
      add(`## 0. Empty submit\nstate: ${JSON.stringify(await formState(page), null, 1)}\nadded: ${JSON.stringify(await takeAdded(page))}`);

      // 1. find an office head WITHOUT an existing review (no "already exists" message)
      await chooseByText(page, reviewPeriodSelect(page), (await allOptions(page, reviewPeriodSelect(page)))[0]);
      const heads = await allOptions(page, officeHeadSelect(page));
      let chosen = '';
      for (const head of heads) {
        await chooseByText(page, officeHeadSelect(page), head);
        const dup = await page.getByText(/already exists/i).first().isVisible().catch(() => false);
        await page.waitForTimeout(400);
        if (!(await page.getByText(/already exists/i).first().isVisible().catch(() => false)) && !dup) { chosen = head; break; }
      }
      add(`## 1. Chosen (no existing review)\nperiod: ${await selectedText(reviewPeriodSelect(page))}\nhead: ${chosen}`);
      if (!chosen) throw new Error('Every office head already has a review for the first period — nothing to submit.');

      // 2. submit
      await typeComment(page, TAG);
      await takeAdded(page);
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(1500);
      add(`## 2. After submit\nadded to DOM (alert/toast text lives here): ${JSON.stringify(await takeAdded(page))}\nform: ${JSON.stringify(await formState(page), null, 1)}\nnew row: ${JSON.stringify(await tableRows(page).then((r) => r.filter((x) => x.join(' ').includes(TAG))))}`);
      await page.screenshot({ path: path.join(OUT, 'after-submit.png'), fullPage: true });
      if (await rowWithTag().count()) save('submitted-row.html', await rowWithTag().first().evaluate((e) => e.outerHTML));

      // 3. duplicate: reselect same combination → message → No
      const period = (await allOptions(page, reviewPeriodSelect(page)))[0];
      await chooseByText(page, reviewPeriodSelect(page), period);
      await chooseByText(page, officeHeadSelect(page), chosen);
      await page.waitForTimeout(800);
      const msg = page.getByText(/already exists/i).first();
      add(`## 3. Duplicate message\nvisible: ${await msg.isVisible().catch(() => false)}\ntext: ${await msg.innerText().catch(() => '')}`);
      save('duplicate-message.html', await msg.locator('xpath=..').evaluate((e) => e.outerHTML).catch(() => ''));
      await page.getByRole('button', { name: 'No', exact: true }).click();
      await page.waitForTimeout(800);
      add(`### After NO\nmessage still visible: ${await msg.isVisible().catch(() => false)}\nform: ${JSON.stringify(await formState(page), null, 1)}`);

      // 4. duplicate → Yes → edit-mode form
      await chooseByText(page, officeHeadSelect(page), chosen).catch(() => {});
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: 'Yes', exact: true }).click();
      await page.waitForTimeout(1000);
      add(`### After YES (edit mode)\nform: ${JSON.stringify(await formState(page), null, 1)}`);
      await page.screenshot({ path: path.join(OUT, 'edit-mode-via-yes.png'), fullPage: true });

      // 5. edit comment and save
      const editor = page.locator('[contenteditable="true"]:visible').first();
      await editor.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' EDITED');
      await takeAdded(page);
      const saveBtn = page.getByRole('button', { name: /submit|update|save/i }).first();
      add(`save button label: ${await saveBtn.innerText().catch(() => '?')}`);
      await saveBtn.click();
      await page.waitForTimeout(1500);
      add(`### After saving edit\nadded: ${JSON.stringify(await takeAdded(page))}\nform: ${JSON.stringify(await formState(page), null, 1)}\nrow: ${JSON.stringify(await tableRows(page).then((r) => r.filter((x) => x.join(' ').includes(TAG))))}`);

      // 6. edit via the Edit icon
      await rowWithTag().first().locator('button:has(svg[data-icon="pen-to-square"])').click();
      await page.waitForTimeout(1000);
      add(`## 6. Edit via icon\nform: ${JSON.stringify(await formState(page), null, 1)}`);
      save('action-cell.html', await rowWithTag().first().locator('td').last().evaluate((e) => e.outerHTML));
    } finally {
      // 7. delete (also the cleanup). Cancel first, then OK.
      try {
        await page.reload();
        await page.getByText('Review Period').first().waitFor({ timeout: 60_000 });
        await startObserver(page);
        const row = rowsLocator(page).filter({ hasText: TAG }).first();
        if (await row.count()) {
          // Real markup: Action cell holds two icon-only buttons (pen-to-square = edit, trash-can = delete);
          // the delete confirmation is an antd Popconfirm (.ant-popover), not a modal.
          const trash = row.locator('button:has(svg[data-icon="trash-can"])');
          const dlg = page.locator('.ant-popover:not(.ant-popover-hidden)').filter({ hasText: /delete/i }).first();
          await trash.click();
          await dlg.waitFor({ timeout: 5000 });
          add(`## 7. Delete confirm\ntext: ${(await dlg.innerText()).replace(/\n+/g, ' / ')}`);
          save('delete-dialog.html', await dlg.evaluate((e) => e.outerHTML));
          await page.screenshot({ path: path.join(OUT, 'delete-dialog.png') });
          await dlg.getByRole('button', { name: 'Cancel' }).click();
          await page.waitForTimeout(800);
          add(`after Cancel → row still present: ${(await rowsLocator(page).filter({ hasText: TAG }).count()) > 0}`);
          await trash.click();
          await dlg.waitFor({ timeout: 5000 });
          await takeAdded(page);
          await dlg.getByRole('button', { name: 'OK' }).click();
          await page.waitForTimeout(1500);
          add(`after OK → row present: ${(await rowsLocator(page).filter({ hasText: TAG }).count()) > 0}\nadded: ${JSON.stringify(await takeAdded(page))}`);
        } else {
          add('## 7. Cleanup: no row with the tag found (nothing to delete).');
        }
      } catch (e) {
        add(`## 7. ⚠️ Cleanup/delete step failed: ${(e as Error).message.split('\n')[0]}\nDELETE the row containing "${TAG}" manually from My Submissions!`);
      }
      flush('index-mutating.md');
      console.log(report.join('\n\n'));
    }
  });
});
