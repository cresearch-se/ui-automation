import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PracticeHeadReviewsPage } from '../pages/PracticeHeadReviewsPage';
import { currentReviewPeriod } from '../data/officeHeadReviews.data';
import { normalize } from '../utils/text';

/**
 * THROWAWAY DEBUG HELPER — not a real test. Run it explicitly, then send teamwork-dump/pa-head.md back:
 *
 *   npx playwright test dump-pa-head --project=teamwork-survey --workers=1 --reporter=list
 *
 * Claude Code cannot open the app, so this records what tab 2 (Practice Head Reviews) really shows: labels, the full
 * Practice Area Head list, the table headers and their sort/filter icons, existing rows, filter option lists, the
 * validation messages, the "review already exists" prompt and the delete confirmation.
 * It SAVES and DELETES NOTHING: it only reads, opens popups and closes them again (No / Cancel / Escape).
 */
const OUT = 'teamwork-dump';

test('dump practice head reviews tab', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  const report: string[] = [];
  const add = (title: string, body: string | string[]) =>
    report.push(`## ${title}\n${Array.isArray(body) ? body.map((l) => `- ${l}`).join('\n') || '(none)' : body}`);
  const attempt = async (title: string, work: () => Promise<string | string[]>) => {
    try {
      add(title, await work());
    } catch (e) {
      add(title, `ERROR: ${(e as Error).message.split('\n')[0]}`);
    }
  };

  const tab = new PracticeHeadReviewsPage(page);
  await tab.goto();
  report.push(`# Practice Head Reviews dump\n- URL: ${page.url()}\n- Current review period: ${currentReviewPeriod()}`);

  await attempt('Tab names', async () => (await tab.tabLinks.allInnerTexts()).map(normalize));
  await attempt('Visible form labels', async () => await tab.formLabels());
  await attempt('Hidden form labels (Rating?)', async () =>
    (await tab.form.locator('.ant-form-item-hidden label').allInnerTexts()).map(normalize));
  await attempt('Selected values before choosing anything', async () => [
    `Review Period: ${normalize(await tab.selectedValue(tab.reviewPeriodSelect).innerText())}`,
    `Practice Area Head: ${normalize(await tab.selectedValue(tab.personSelect).innerText())}`,
  ]);
  await attempt('Comments editor', async () => [
    `placeholder: ${normalize(await tab.editorPlaceholder.innerText().catch(() => '(none)'))}`,
    `status bar: ${normalize(await tab.statusBar.innerText())}`,
    `buttons in form: ${(await tab.form.getByRole('button').allInnerTexts()).map(normalize).join(' | ')}`,
  ]);

  await attempt('Review Period options', async () => await tab.readOptions(tab.reviewPeriodSelect));

  let practiceHeads: string[] = [];
  await attempt('Practice Area Head options (all, in order)', async () => {
    practiceHeads = await tab.readPracticeHeadOptions();
    return [`count: ${practiceHeads.length}`, ...practiceHeads];
  });

  await attempt('Does typing filter the Practice Area Head dropdown?', async () => {
    const typed = practiceHeads[0]?.slice(0, 3) ?? 'a';
    await tab.personSelect.click();
    await page.keyboard.type(typed);
    await page.waitForTimeout(1000);
    const shown = (await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allInnerTexts()).map(normalize);
    await page.keyboard.press('Escape');
    return [`typed "${typed}" -> ${shown.length} options shown (of ${practiceHeads.length})`, ...shown.slice(0, 10)];
  });

  await attempt('Table headers (sort / filter icons)', async () => {
    const headers = tab.table.locator('thead th');
    const lines: string[] = [];
    for (let i = 0; i < (await headers.count()); i++) {
      const th = headers.nth(i);
      const sorter = (await th.locator('.ant-table-column-sorter').count()) > 0;
      const filter = (await th.locator('.ant-table-filter-trigger').count()) > 0;
      lines.push(`${i}: "${normalize(await th.innerText())}" sort=${sorter} filter=${filter}`);
    }
    return lines;
  });

  await attempt('Rows on screen (cells; action icons)', async () => {
    const lines: string[] = [];
    const rows = tab.rows;
    for (let i = 0; i < (await rows.count()); i++) {
      const cells = (await rows.nth(i).locator('td').allInnerTexts()).map(normalize);
      const icons = await rows.nth(i).locator('button svg').evaluateAll((els) => els.map((e) => e.getAttribute('data-icon')));
      lines.push(`${cells.join(' | ')}  [icons: ${icons.join(', ')}]`);
    }
    return lines;
  });
  await attempt('Page size', async () => normalize(await tab.pageSize.first().innerText()));

  for (const header of ['PA Head', 'Practice Area', 'Review Period']) {
    await attempt(`Filter options: ${header}`, async () => {
      await tab.openFilter(header);
      await tab.filterOptions().first().waitFor({ timeout: 10_000 }).catch(() => {});
      const options = (await tab.filterOptions().allInnerTexts()).map(normalize);
      const reset = await tab.filterButton('Reset').isDisabled();
      const search = await tab.filterSearch().isVisible();
      await page.keyboard.press('Escape');
      return [`search box: ${search}; Reset disabled: ${reset}`, ...options];
    });
  }

  await attempt('Validation messages after an empty Submit', async () => {
    await tab.submitButton.click();
    await page.waitForTimeout(1000);
    return (await tab.form.locator('.ant-form-item-explain-error').allInnerTexts()).map(normalize);
  });

  // Needs an existing row: the first row's person.
  const firstRow = tab.rows.first();
  const firstPerson = normalize((await firstRow.locator('td').first().innerText().catch(() => '')) || '');
  if (firstPerson) {
    await attempt(`Duplicate prompt (first row: ${firstPerson})`, async () => {
      await tab.goto();
      const option = (await tab.readPracticeHeadOptions()).find((o) => o.startsWith(firstPerson));
      if (!option) return `no dropdown option starts with "${firstPerson}"`;
      await tab.selectReviewPeriod();
      await tab.chooseOption(tab.personSelect, option);
      await page.waitForTimeout(1500);
      const prompt = page.getByText(/already exists/i).first();
      const text = (await prompt.isVisible()) ? normalize(await prompt.innerText()) : '(no prompt shown)';
      const buttons = (await page.getByRole('button').allInnerTexts()).map(normalize).filter((t) => /^(yes|no|submit|cancel)$/i.test(t));
      const submitEnabled = await tab.submitButton.isEnabled();
      if (await tab.noButton.isVisible()) await tab.noButton.click();
      return [`option chosen: ${option}`, `prompt: ${text}`, `buttons: ${buttons.join(', ')}`, `Submit enabled: ${submitEnabled}`];
    });

    await attempt('Delete confirmation (Cancelled, nothing deleted)', async () => {
      await tab.goto();
      const row = tab.actionableRows.first();
      await tab.actionButton(row, 'delete').click();
      await tab.deletePopover.waitFor();
      const lines = [
        `title: ${normalize(await tab.deletePopoverTitle().innerText())}`,
        `text: ${normalize(await tab.deletePopoverText().innerText())}`,
        `buttons: ${(await tab.deletePopover.getByRole('button').allInnerTexts()).map(normalize).join(', ')}`,
      ];
      await tab.deletePopover.getByRole('button', { name: 'Cancel', exact: true }).click();
      return lines;
    });
  }

  const out = report.join('\n\n');
  fs.writeFileSync(path.join(OUT, 'pa-head.md'), out, 'utf-8');
  await page.screenshot({ path: path.join(OUT, 'pa-head.png'), fullPage: true });
  console.log(`\n${out}\n\nWrote ${OUT}/pa-head.md`);
});
