import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PrincipalSurveyPage } from '../pages/PrincipalSurveyPage';
import { normalize } from '../utils/text';

/**
 * THROWAWAY DEBUG HELPER — not a real test. Run it explicitly, then send teamwork-dump/principal.md back:
 *
 *   npx playwright test dump-principal --project=teamwork-survey --workers=1 --reporter=list
 *
 * Claude Code cannot open the app, so this records what the "Principal Teamwork Survey" tab really shows: the banner
 * text and link, labels, the Principal / Rating / Review Period lists, the two comment editors, the table headers and
 * their sort/filter icons, existing rows, filter option lists, the validation messages, the "survey already exists"
 * prompt, the edit view and the delete confirmation.
 * It SAVES and DELETES NOTHING: it only reads, opens popups / the edit view and closes them again (No / Cancel / click away).
 */
const OUT = 'teamwork-dump';

test('dump principal teamwork survey tab', async ({ page }) => {
  test.setTimeout(480_000);
  fs.mkdirSync(OUT, { recursive: true });
  // One missing element costs 15s and becomes an ERROR line instead of hanging the whole dump.
  page.setDefaultTimeout(15_000);
  const report: string[] = [];
  // Written after every section, so a hang or crash still leaves everything gathered so far.
  const save = () => fs.writeFileSync(path.join(OUT, 'principal.md'), report.join('\n\n'), 'utf-8');
  const add = (title: string, body: string | string[]) => {
    report.push(`## ${title}\n${Array.isArray(body) ? body.map((l) => `- ${l}`).join('\n') || '(none)' : body}`);
    save();
  };
  const attempt = async (title: string, work: () => Promise<string | string[]>) => {
    try {
      add(title, await work());
    } catch (e) {
      add(title, `ERROR: ${(e as Error).message.split('\n')[0]}`);
    }
  };

  const tab = new PrincipalSurveyPage(page);
  await tab.goto();
  report.push(`# Principal Teamwork Survey dump\n- URL: ${page.url()}\n- Today: ${new Date().toDateString()}`);
  save();

  await attempt('Tab names (and which is active)', async () => {
    const names = (await tab.tabLinks.allInnerTexts()).map(normalize);
    const classes = await tab.tabLinks.evaluateAll((els) => els.map((e) => e.className));
    return names.map((n, i) => `${i}: ${n}${/\bactive\b/.test(classes[i]) ? '  [active]' : ''}`);
  });

  await attempt('Banner (exact text, JSON-quoted so odd characters show)', async () => {
    const banner = tab.banner;
    const text = (await banner.textContent()) ?? '';
    const link = banner.locator('a');
    return [
      `count of banners: ${await banner.count()}`,
      `textContent: ${JSON.stringify(text)}`,
      `normalized: ${normalize(text)}`,
      `link text: ${JSON.stringify(await link.first().textContent())}`,
      `link href: ${await link.first().getAttribute('href')}`,
      `link target: ${await link.first().getAttribute('target')}`,
    ];
  });

  await attempt('Visible form labels', async () => await tab.formLabels());
  await attempt('Selected values before choosing anything', async () => [
    `Review Period: ${normalize(await tab.selectedValue(tab.reviewPeriodSelect).innerText())}  [disabled: ${/ant-select-disabled/.test((await tab.reviewPeriodSelect.getAttribute('class')) ?? '')}]`,
    `Principal Name: ${normalize(await tab.selectedValue(tab.principalSelect).innerText())}`,
    `Rating: ${normalize(await tab.selectedValue(tab.ratingSelect).innerText())}`,
  ]);
  await attempt('Comment editors', async () => {
    const lines: string[] = [`editors: ${await tab.form.locator('.jodit-wysiwyg').count()}`];
    const statusBars = await tab.form.locator('.jodit-status-bar').allInnerTexts();
    statusBars.forEach((s, i) => lines.push(`status bar ${i}: ${normalize(s)}`));
    const placeholders = await tab.form.locator('.jodit-placeholder').allInnerTexts();
    placeholders.forEach((s, i) => lines.push(`placeholder ${i}: ${JSON.stringify(normalize(s))}`));
    lines.push(`buttons in form: ${(await tab.form.getByRole('button').allInnerTexts()).map(normalize).filter(Boolean).join(' | ')}`);
    return lines;
  });

  await attempt('Review Period options', async () => await tab.readOptions(tab.reviewPeriodSelect));
  await attempt('Rating options', async () => await tab.readRatingOptions());

  let principals: string[] = [];
  await attempt('Principal Name options (all, in order)', async () => {
    principals = await tab.readPrincipalOptions();
    return [`count: ${principals.length}`, ...principals];
  });

  await attempt('Does typing filter the Principal Name dropdown?', async () => {
    await tab.goto();
    const typed = principals[0]?.slice(0, 3) ?? 'a';
    await tab.principalSelect.click();
    await page.keyboard.type(typed);
    await page.waitForTimeout(1000);
    const shown = (await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allInnerTexts()).map(normalize);
    await page.mouse.click(2, 2);
    return [`typed "${typed}" -> ${shown.length} options shown (of ${principals.length})`, ...shown.slice(0, 10)];
  });

  await attempt('Table headers (sort / filter icons)', async () => {
    await tab.goto();
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
    for (let i = 0; i < (await tab.rows.count()); i++) {
      const cells = (await tab.rows.nth(i).locator('td').allInnerTexts()).map(normalize);
      const icons = await tab.rows.nth(i).locator('button svg').evaluateAll((els) => els.map((e) => e.getAttribute('data-icon')));
      lines.push(`${cells.join(' | ')}  [icons: ${icons.join(', ')}]`);
    }
    return lines;
  });
  await attempt('Page size', async () => normalize(await tab.pageSize.first().innerText()));

  for (const header of ['Principal Name', 'Review Period', 'Rating']) {
    await attempt(`Filter options: ${header}`, async () => {
      await tab.goto(); // fresh page: no panel left open by the previous section
      await tab.openFilter(header);
      await tab.filterOptions().first().waitFor({ timeout: 10_000 }).catch(() => {});
      const options = (await tab.filterOptions().allInnerTexts()).map(normalize);
      const reset = await tab.filterButton('Reset').isDisabled();
      const search = await tab.filterSearch().isVisible();
      await page.mouse.click(2, 2);
      const closed = await tab.filterPopup.waitFor({ state: 'hidden', timeout: 5_000 }).then(() => true, () => false);
      return [`search box: ${search}; Reset disabled: ${reset}; panel closed afterwards: ${closed}`, ...options];
    });
  }

  await attempt('Validation messages after an empty Submit', async () => {
    await tab.goto();
    await tab.submitButton.click();
    await page.waitForTimeout(1000);
    return (await tab.form.locator('.ant-form-item-explain-error').allInnerTexts()).map(normalize);
  });

  // Needs an existing row: the first row's principal.
  await tab.goto();
  const firstPerson = normalize((await tab.rows.first().locator('td').first().innerText().catch(() => '')) || '');
  if (firstPerson) {
    await attempt(`Duplicate prompt (first row: ${firstPerson})`, async () => {
      await tab.goto();
      const option = (await tab.readPrincipalOptions()).find((o) => o.startsWith(firstPerson));
      if (!option) return `no dropdown option starts with "${firstPerson}"`;
      // The period may already be preselected; only choose one if it still reads "----- Select -----".
      if ((await tab.selectedValue(tab.reviewPeriodSelect).innerText()).includes('-----')) {
        const [firstPeriod] = await tab.readOptions(tab.reviewPeriodSelect);
        await tab.chooseOption(tab.reviewPeriodSelect, firstPeriod);
      }
      try {
        await tab.chooseOption(tab.principalSelect, option);
      } catch (e) {
        const visible = (await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allInnerTexts()).map(normalize);
        return [`chooseOption failed: ${(e as Error).message.split('\n')[0]}`, `wanted: ${option}`, `visible options (${visible.length}): ${visible.join(' ; ')}`];
      }
      await page.waitForTimeout(1500);
      const prompt = page.getByText(/already exists/i).first();
      const text = (await prompt.isVisible()) ? normalize(await prompt.innerText()) : '(no prompt shown)';
      const buttons = (await page.getByRole('button').allInnerTexts()).map(normalize).filter((t) => /^(yes|no|submit|cancel)$/i.test(t));
      const submitEnabled = await tab.submitButton.isEnabled();
      if (await tab.noButton.isVisible()) await tab.noButton.click();
      return [`option chosen: ${option}`, `prompt: ${text}`, `buttons: ${buttons.join(', ')}`, `Submit enabled: ${submitEnabled}`];
    });

    await attempt('Edit view of the first row (opened, then Cancelled, nothing saved)', async () => {
      await tab.goto();
      const row = tab.actionableRows.first();
      await tab.actionButton(row, 'edit').click();
      await tab.cancelButton.waitFor();
      const lines = [
        `Review Period: ${normalize(await tab.selectedValue(tab.reviewPeriodSelect).innerText())}  [disabled: ${/ant-select-disabled/.test((await tab.reviewPeriodSelect.getAttribute('class')) ?? '')}]`,
        `Principal Name: ${normalize(await tab.selectedValue(tab.principalSelect).innerText())}  [disabled: ${/ant-select-disabled/.test((await tab.principalSelect.getAttribute('class')) ?? '')}]`,
        `Rating: ${normalize(await tab.selectedValue(tab.ratingSelect).innerText())}  [disabled: ${/ant-select-disabled/.test((await tab.ratingSelect.getAttribute('class')) ?? '')}]`,
        `demonstrated editor: ${JSON.stringify(normalize(await tab.demonstratedEditor.innerText()))}`,
        `improve editor: ${JSON.stringify(normalize(await tab.improveEditor.innerText()))}`,
        `buttons: ${(await tab.form.getByRole('button').allInnerTexts()).map(normalize).filter((t) => /^(submit|cancel)$/i.test(t)).join(', ')}`,
      ];
      await tab.cancelButton.click();
      return lines;
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

  await page.screenshot({ path: path.join(OUT, 'principal.png'), fullPage: true }).catch(() => {});
  console.log(`\n${report.join('\n\n')}\n\nWrote ${OUT}/principal.md`);
});
