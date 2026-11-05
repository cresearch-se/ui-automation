// spec: apps/teamwork-survey/specs/principal-teamwork-survey.md   (app knowledge: specs/app-notes.md)
// app: Teamwork Survey / Reviews — tab "Principal Teamwork Survey" (4th tab for this user, 5th for some others)
//
// STATUS: written from a live dump of staging (2026-11-05); not yet run. The two toast texts in MESSAGES are an
// assumption until the first run prints the real ones (`[save]   toast: ...` lines in the run log).
//
// The list of principals is NOT fixed: every data-changing test picks its principal(s) at random from the dropdown
// (never someone who already has a survey on screen) and prints the choice (`[pick] ...`).
//
// Layout of this file
//   1. Page basics        — read-only
//   2. Flows that change data — each test creates its own tagged survey (fixture cleans up)
//   3. Full cycle for 5 random principals — submit → edit (icon) → edit (duplicate) → delete

import { test, expect } from '../fixtures/principalSurvey.fixture';
import { PRINCIPAL_COLUMN, type PrincipalSurveyPage } from '../pages/PrincipalSurveyPage';
import { type Person } from '../pages/ReviewTabPage';
import {
  BANNER_LINK_HREF_PART,
  BANNER_LINK_TEXT,
  BANNER_TEXT,
  FILTERABLE_COLUMNS,
  FORM_LABELS,
  MESSAGES,
  PRINCIPAL_NAME_FORMAT,
  RATING_OPTIONS,
  SORTABLE_COLUMNS,
  TABLE_HEADERS,
  UNSORTABLE_COLUMNS,
  currentSurveyPeriod,
} from '../data/principalSurvey.data';
import { NOT_SELECTED, REVIEW_PERIOD_FORMAT, STAGE, TAB_NAMES } from '../data/officeHeadReviews.data';
import { compareText, compareUsDates, isSorted, normalize, stamped, submittedDateCandidates } from '../utils/text';

const TAB_NAME = 'Principal Teamwork Survey';
const compareNumbers = (a: string, b: string) => Number(a) - Number(b);

// ---------------------------------------------------------------------------------------------------
// Shared assertions (used by several tests)
// ---------------------------------------------------------------------------------------------------

/** Form is in "new survey" state: nothing chosen, both editors empty, no Cancel button. */
async function expectBlankForm(reviews: PrincipalSurveyPage) {
  await expect(reviews.selectedValue(reviews.reviewPeriodSelect)).toHaveText(NOT_SELECTED);
  await expect(reviews.selectedValue(reviews.principalSelect)).toHaveText(NOT_SELECTED);
  await expect(reviews.selectedValue(reviews.ratingSelect)).toHaveText(NOT_SELECTED);
  await expect(reviews.demonstratedEditor).toHaveText('');
  await expect(reviews.improveEditor).toHaveText('');
  await expect(reviews.cancelButton).toBeHidden();
}

/** Form is in edit mode: period + principal locked, Rating and both editors loaded and editable, Submit + Cancel shown. */
async function expectEditMode(reviews: PrincipalSurveyPage, who: Person, rating: string, comments: string) {
  await expect(reviews.reviewPeriodSelect).toHaveClass(/ant-select-disabled/);
  await expect(reviews.principalSelect).toHaveClass(/ant-select-disabled/);
  await expect(reviews.ratingSelect).not.toHaveClass(/ant-select-disabled/); // the rating can be changed
  await expect(reviews.selectedValue(reviews.reviewPeriodSelect)).toHaveText(currentSurveyPeriod());
  await expect(reviews.selectedValue(reviews.principalSelect)).toHaveText(who.name);
  await expect(reviews.selectedValue(reviews.ratingSelect)).toHaveText(rating);
  await expect(reviews.demonstratedEditor).toHaveText(comments);
  await expect(reviews.improveEditor).toHaveText(reviews.improveFor(comments));
  await expect(reviews.submitButton).toBeVisible();
  await expect(reviews.cancelButton).toBeVisible();
}

/** A row shows exactly what was submitted. */
async function expectRowValues(reviews: PrincipalSurveyPage, row: ReturnType<PrincipalSurveyPage['rowWithText']>, who: Person, rating: string, comments: string) {
  await expect(reviews.cell(row, PRINCIPAL_COLUMN.name)).toHaveText(who.name);
  await expect(reviews.cell(row, PRINCIPAL_COLUMN.period)).toHaveText(currentSurveyPeriod());
  await expect(reviews.cell(row, PRINCIPAL_COLUMN.rating)).toHaveText(rating);
  await expect(reviews.cell(row, PRINCIPAL_COLUMN.demonstrated)).toHaveText(comments);
  await expect(reviews.cell(row, PRINCIPAL_COLUMN.improve)).toHaveText(reviews.improveFor(comments));
  await expect(reviews.cell(row, PRINCIPAL_COLUMN.date)).toHaveText(new RegExp(`^(${submittedDateCandidates().join('|')})$`));
}

// ===================================================================================================
// 1. PAGE BASICS (read-only)
// ===================================================================================================
test.describe('Principal Teamwork Survey — page basics (read-only)', () => {
  test('is reached by clicking its tab by name and is the active tab; the other officer tabs are there too', async ({ reviews }) => {
    await expect(reviews.page).toHaveURL(/\/principalteamworksurvey$/);
    await expect(reviews.tabLinks.filter({ hasText: TAB_NAME })).toHaveClass(/active/);
    // Position-independent: this tab is 4th for some logins and 5th for others, so check by name only.
    for (const name of TAB_NAMES) await expect(reviews.tabLinks.filter({ hasText: name }), name).toHaveCount(1);
  });

  test('the blue notice shows the exact expected wording and its link opens the guidance in a new tab', async ({ reviews }) => {
    await expect(reviews.banner).toHaveCount(1);
    await expect(reviews.banner).toBeVisible();
    expect(normalize((await reviews.banner.textContent()) ?? '')).toBe(BANNER_TEXT);

    const link = reviews.banner.getByRole('link');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText(BANNER_LINK_TEXT);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('href', new RegExp(BANNER_LINK_HREF_PART)); // not clicked: it is a SharePoint document
  });

  test('form starts empty with the expected defaults', async ({ reviews }) => {
    await expect(reviews.selectedValue(reviews.reviewPeriodSelect)).toHaveText(NOT_SELECTED);
    await expect(reviews.selectedValue(reviews.principalSelect)).toHaveText(NOT_SELECTED);
    await expect(reviews.selectedValue(reviews.ratingSelect)).toHaveText(NOT_SELECTED);
    await expect(reviews.demonstratedEditor).toHaveText('');
    await expect(reviews.improveEditor).toHaveText('');
    await expect(reviews.statusBars).toHaveCount(2);
    for (const bar of await reviews.statusBars.all()) {
      await expect(bar).toContainText(/chars:\s*0/i);
      await expect(bar).toContainText(/words:\s*0/i);
    }
    await expect(reviews.submitButton).toBeEnabled();
    await expect(reviews.cancelButton).toBeHidden(); // Cancel exists in edit mode only
  });

  test('form has exactly five fields: Review Period, Principal Name, Rating and the two questions', async ({ reviews }) => {
    expect(await reviews.formLabels()).toEqual(FORM_LABELS);
    await expect(reviews.form.locator('.ant-select:visible')).toHaveCount(3); // period, principal, rating
    await expect(reviews.form.locator('.jodit-wysiwyg')).toHaveCount(2);
  });

  test('Review Period offers the survey period: July 01 of this fiscal year to June 30 of the next', async ({ reviews }) => {
    const options = await reviews.readOptions(reviews.reviewPeriodSelect);
    // Other periods are allowed; only the standard one must be there.
    expect(options, 'Admin must configure the period July 01 – June 30 of the current survey year').toContain(currentSurveyPeriod());
    for (const option of options) expect(option).toMatch(REVIEW_PERIOD_FORMAT);
  });

  test('Rating offers 10 down to 1', async ({ reviews }) => {
    expect(await reviews.readRatingOptions()).toEqual(RATING_OPTIONS);
  });

  test('Principal Name dropdown lists principals as "Last, First", each once', async ({ reviews }) => {
    const options = await reviews.readPrincipalOptions();
    expect(options.length).toBeGreaterThan(0); // the list is not fixed, so only its shape is checked
    for (const option of options) expect(option).toMatch(PRINCIPAL_NAME_FORMAT);
    expect(new Set(options).size, 'a principal appears twice').toBe(options.length);
  });

  test('typing in the Principal Name dropdown narrows it to matching names', async ({ reviews }) => {
    const [who] = await reviews.randomPrincipals(1);
    const typed = who.name.slice(0, 3);
    await reviews.principalSelect.click();
    await reviews.page.keyboard.type(typed);

    const shown = reviews.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    await expect(shown.filter({ hasText: who.name })).toHaveCount(1);
    for (const text of await shown.allInnerTexts()) expect(normalize(text).toLowerCase()).toContain(typed.toLowerCase());

    // After typing, Escape only clears the text, so click away to close the list.
    await reviews.page.mouse.click(2, 2);
    await expect(shown).toHaveCount(0);
  });

  test('each comments editor has its own counter', async ({ reviews }) => {
    await reviews.setComments('sdgdfg');
    // The bar reads "Chars: 6Words: 1" with no gap, so `\b` can't end the number; (?!\d) can.
    await expect(reviews.statusBars.nth(0)).toContainText(/chars:\s*6(?!\d)/i);
    await expect(reviews.statusBars.nth(0)).toContainText(/words:\s*1(?!\d)/i);
    await expect(reviews.statusBars.nth(1)).toContainText(/chars:\s*0(?!\d)/i); // the other editor is untouched

    await reviews.setImprove('hello world');
    // "hello world" is 11 characters, but the Jodit counter does not count the space → Chars: 10.
    await expect(reviews.statusBars.nth(1)).toContainText(/chars:\s*10(?!\d)/i);
    await expect(reviews.statusBars.nth(1)).toContainText(/words:\s*2(?!\d)/i);
    await expect(reviews.statusBars.nth(0)).toContainText(/chars:\s*6(?!\d)/i);
  });

  test('table headers are exactly the expected seven', async ({ reviews }) => {
    expect(await reviews.headerTexts()).toEqual(TABLE_HEADERS);
  });

  test('sort arrows and filter funnels are on the right columns only', async ({ reviews }) => {
    for (const name of SORTABLE_COLUMNS) {
      await expect(reviews.headerCell(name).locator('.ant-table-column-sorter'), `${name} sorter`).toBeVisible();
    }
    for (const name of UNSORTABLE_COLUMNS) {
      await expect(reviews.headerCell(name).locator('.ant-table-column-sorter'), `${name} sorter`).toHaveCount(0);
    }
    for (const name of FILTERABLE_COLUMNS) {
      await expect(reviews.filterTrigger(name), `${name} funnel`).toBeVisible();
    }
    for (const name of TABLE_HEADERS.filter((h) => !FILTERABLE_COLUMNS.includes(h))) {
      await expect(reviews.filterTrigger(name), `${name} funnel`).toHaveCount(0);
    }
  });

  // --- mandatory-field validation (nothing is saved: Submit is blocked client-side) ------------------
  test('Submit with everything empty shows all five required-field errors', async ({ reviews }) => {
    await reviews.submitButton.click();
    // "Comments are required." appears once per editor.
    await expect(reviews.errors).toHaveText([
      MESSAGES.reviewPeriodRequired,
      MESSAGES.principalRequired,
      MESSAGES.ratingRequired,
      MESSAGES.commentsRequired,
      MESSAGES.commentsRequired,
    ]);
    await expect(reviews.toast(MESSAGES.submitted)).toBeHidden();
  });

  const REQUIRED_FIELDS = [
    { missing: 'Review Period', error: MESSAGES.reviewPeriodRequired },
    { missing: 'Principal Name', error: MESSAGES.principalRequired },
    { missing: 'Rating', error: MESSAGES.ratingRequired },
    { missing: 'first question (behaviors demonstrated)', error: MESSAGES.commentsRequired },
    { missing: 'second question (behaviors to improve)', error: MESSAGES.commentsRequired },
  ];
  for (const { missing, error } of REQUIRED_FIELDS) {
    test(`Submit with only the ${missing} missing shows just that error`, async ({ reviews }) => {
      const [who] = await reviews.randomPrincipals(1);
      if (missing !== 'Review Period') await reviews.selectReviewPeriod();
      if (missing !== 'Principal Name') await reviews.selectPerson(who);
      if (missing !== 'Rating') await reviews.selectRating('5');
      if (!missing.startsWith('first')) await reviews.setComments('validation only');
      if (!missing.startsWith('second')) await reviews.setImprove('validation only');

      await reviews.submitButton.click();

      await expect(reviews.errors).toHaveText([error]);
    });
  }

  test('a required-field error clears once the field is filled', async ({ reviews }) => {
    await reviews.submitButton.click();
    await expect(reviews.errors).toHaveCount(5);

    await reviews.selectRating('5');
    // The error clears on change, not only on the next Submit.
    await expect(reviews.errors).toHaveText([
      MESSAGES.reviewPeriodRequired,
      MESSAGES.principalRequired,
      MESSAGES.commentsRequired,
      MESSAGES.commentsRequired,
    ]);
  });
});

// ===================================================================================================
// 2. FLOWS THAT CHANGE DATA (each test creates its own tagged survey, fixture deletes it)
// ===================================================================================================
test.describe('Principal Teamwork Survey — flows that change data', () => {
  // Not `serial`: a failure there skips every later test. The project runs this file in order in one worker.
  test.describe.configure({ timeout: 120_000 });

  // --- submit ----------------------------------------------------------------------------------------
  test('Submit adds the survey, shows the success toast and resets the form', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    reviews.rating = '6';

    const comments = stamped(tag, STAGE.created);
    await reviews.fillAndSubmit(who, comments);

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    const row = reviews.rowWithText(tag);
    await expect(row).toHaveCount(1);
    await expectRowValues(reviews, row, who, '6', comments);
    await expectBlankForm(reviews);
  });

  for (const rating of ['1', '5', '10']) {
    test(`a survey with Rating ${rating} is saved and shown with that rating`, async ({ reviews, tag }) => {
      const [who] = await reviews.randomPrincipals(1);
      reviews.rating = rating;
      const row = await reviews.createReview(who, tag);
      await reviews.expectRatingCell(row, rating);
    });
  }

  test('a reviewed principal stays selectable in the Principal Name dropdown', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.createReview(who, tag);
    expect(await reviews.readPrincipalOptions()).toContain(who.name);
  });

  // --- edit via the Edit icon --------------------------------------------------------------------------
  test('Edit icon loads the survey: period + principal locked, rating and both answers editable, saves with Submit', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    reviews.rating = '4';
    const row = await reviews.createReview(who, tag);

    await reviews.openEdit(row);
    await expectEditMode(reviews, who, '4', stamped(tag, STAGE.created));

    await reviews.selectRating('9');
    await reviews.setComments(stamped(tag, STAGE.editedViaIcon));
    await reviews.setImprove(reviews.improveFor(stamped(tag, STAGE.editedViaIcon)));
    await reviews.submit();

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible(); // same toast for add and update
    await expectRowValues(reviews, row, who, '9', stamped(tag, STAGE.editedViaIcon));
    await expect(reviews.rowWithText(tag)).toHaveCount(1); // updated in place, no second row
    await expectBlankForm(reviews); // saving an edit returns the form to the blank "new survey" state
  });

  test('changing only the Rating of an existing survey is saved', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    reviews.rating = '2';
    const row = await reviews.createReview(who, tag);

    await reviews.openEdit(row);
    await reviews.selectRating('7');
    await reviews.submit();

    await reviews.expectRatingCell(row, '7');
    await expect(reviews.cell(row, PRINCIPAL_COLUMN.demonstrated)).toHaveText(stamped(tag, STAGE.created)); // answers unchanged
  });

  test('the success toast closes with its × button', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.fillAndSubmit(who, stamped(tag, STAGE.created));

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    await reviews.page.locator('.ant-notification-notice-close').first().click();
    await expect(reviews.toast(MESSAGES.submitted)).toBeHidden();
  });

  test('the success toast dismisses itself without any click', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.fillAndSubmit(who, stamped(tag, STAGE.created));

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    await expect(reviews.toast(MESSAGES.submitted)).toBeHidden({ timeout: 30_000 });
  });

  test('Cancel in edit mode discards the changes (edit-icon route)', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    reviews.rating = '3';
    const row = await reviews.createReview(who, tag);

    await reviews.openEdit(row);
    await reviews.selectRating('10');
    await reviews.setComments(stamped(tag, STAGE.cancelledEdit));
    await reviews.setImprove(stamped(tag, STAGE.cancelledEdit));
    await reviews.cancelEdit();

    await expectRowValues(reviews, row, who, '3', stamped(tag, STAGE.created)); // original, unchanged
    await expectBlankForm(reviews); // Cancel resets the form to the blank "new survey" state
  });

  // --- edit via the duplicate prompt ---------------------------------------------------------------------
  test('selecting an already-reviewed combination shows the "review already exists" prompt', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.createReview(who, tag);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(who);

    await expect(reviews.duplicateMessage).toBeVisible();
    await expect(reviews.page.getByText(MESSAGES.duplicate)).toBeVisible();
    await expect(reviews.yesButton).toBeVisible();
    await expect(reviews.noButton).toBeVisible();
    await expect(reviews.submitButton).toBeDisabled(); // Submit is blocked while the prompt is up
  });

  test('no duplicate prompt for a combination without a survey', async ({ reviews }) => {
    const [who] = await reviews.randomPrincipals(1);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(who);

    // Negative check (can pass early); the positive test above proves the prompt does appear when it should.
    await expect(reviews.duplicateMessage).toBeHidden();
  });

  test('duplicate prompt → No loads nothing into the form', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.createReview(who, tag);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(who);
    await expect(reviews.duplicateMessage).toBeVisible();
    await reviews.noButton.click();

    await expect(reviews.demonstratedEditor).toHaveText('');
    await expect(reviews.improveEditor).toHaveText('');
    await expect(reviews.cancelButton).toBeHidden();
    await expect(reviews.duplicateMessage).toBeHidden(); // the prompt goes away after No
  });

  test('duplicate prompt → Yes loads the survey; edited answers save', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    reviews.rating = '8';
    const row = await reviews.createReview(who, tag);

    await reviews.startEditViaDuplicate(who);
    await expectEditMode(reviews, who, '8', stamped(tag, STAGE.created));

    await reviews.setComments(stamped(tag, STAGE.editedViaDuplicate));
    await reviews.setImprove(reviews.improveFor(stamped(tag, STAGE.editedViaDuplicate)));
    await reviews.submit();

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    await expectRowValues(reviews, row, who, '8', stamped(tag, STAGE.editedViaDuplicate));
    await expect(reviews.rowWithText(tag)).toHaveCount(1); // overridden, not duplicated
  });

  test('Cancel in edit mode discards the changes (duplicate-prompt route)', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    const row = await reviews.createReview(who, tag);

    await reviews.startEditViaDuplicate(who);
    await reviews.setComments(stamped(tag, STAGE.cancelledEdit));
    await reviews.cancelEdit();

    await expect(reviews.cell(row, PRINCIPAL_COLUMN.demonstrated)).toHaveText(stamped(tag, STAGE.created));
  });

  // --- delete ------------------------------------------------------------------------------------------
  test('Delete asks for confirmation; Cancel keeps the survey', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    const row = await reviews.createReview(who, tag);

    await reviews.actionButton(row, 'delete').click();
    await expect(reviews.deletePopoverTitle()).toHaveText(MESSAGES.deleteTitle(who.name));
    await expect(reviews.deletePopoverText()).toHaveText(MESSAGES.deleteText);
    await reviews.deletePopover.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(reviews.deletePopover).toBeHidden();
    await expect(row).toHaveCount(1);
  });

  test('Delete → OK removes the survey, shows the toast, and the principal can be reviewed again', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    const row = await reviews.createReview(who, tag);

    await reviews.deleteRow(row, 'OK');

    await expect(reviews.toast(MESSAGES.deleted)).toBeVisible();
    await expect(row).toHaveCount(0);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(who);
    await expect(reviews.duplicateMessage).toBeHidden(); // fresh again
  });

  test('surveys from a past period have no Edit/Delete buttons', async ({ reviews }) => {
    const pastRows = reviews.rows.filter({ hasNotText: currentSurveyPeriod() });
    test.skip((await pastRows.count()) === 0, 'No past-period surveys in My Submissions to check');

    for (const row of await pastRows.all()) {
      await expect(reviews.actionButton(row, 'edit')).toHaveCount(0);
      await expect(reviews.actionButton(row, 'delete')).toHaveCount(0);
    }
  });

  // --- table: sorting, filtering, paging (needs several rows → create them) -------------------------------
  const RATINGS = ['2', '9', '5']; // distinct, so sorting and the Rating filter have something to work on

  /** Create one tagged survey for each of three random principals, with ratings 2, 9 and 5. */
  async function createSortFilterReviews(reviews: PrincipalSurveyPage, tag: string): Promise<Person[]> {
    const people = await reviews.randomPrincipals(3);
    for (const [i, who] of people.entries()) {
      reviews.rating = RATINGS[i];
      await reviews.createReview(who, `${tag}-${i}`);
    }
    return people;
  }

  const SORT_COLUMNS = [
    { name: 'Principal Name', column: PRINCIPAL_COLUMN.name, compare: compareText },
    { name: 'Rating', column: PRINCIPAL_COLUMN.rating, compare: compareNumbers },
    { name: 'Date Submitted', column: PRINCIPAL_COLUMN.date, compare: compareUsDates },
  ];
  for (const { name, column, compare } of SORT_COLUMNS) {
    test(`sorts by ${name}: ascending, then descending`, async ({ reviews, tag }) => {
      await createSortFilterReviews(reviews, tag);

      await reviews.sortBy(name);
      await expect.poll(async () => isSorted(await reviews.columnTexts(column), 'asc', compare)).toBe(true);

      await reviews.sortBy(name);
      await expect.poll(async () => isSorted(await reviews.columnTexts(column), 'desc', compare)).toBe(true);
    });
  }

  for (const filter of ['Principal Name', 'Rating'] as const) {
    test(`${filter} filter: search, tick, OK narrows the table; Reset restores it`, async ({ reviews, tag }) => {
      const people = await createSortFilterReviews(reviews, tag);
      const total = await reviews.rows.count();
      const value = filter === 'Principal Name' ? people[1].name : RATINGS[1];
      const search = filter === 'Principal Name' ? value.slice(0, 3) : value;
      const index = filter === 'Principal Name' ? PRINCIPAL_COLUMN.name : PRINCIPAL_COLUMN.rating;

      await reviews.openFilter(filter);
      await expect(reviews.filterSearch()).toBeVisible();
      await expect(reviews.filterButton('OK')).toBeVisible();
      await expect(reviews.filterButton('Reset')).toBeVisible();
      await expect(reviews.filterOption(value)).toBeVisible();

      await reviews.filterSearch().fill(search);
      await expect
        .poll(async () =>
          (await reviews.filterOptions().allInnerTexts()).every((t) => normalize(t).toLowerCase().includes(search.toLowerCase())),
        )
        .toBe(true);
      await expect(reviews.filterOption(value)).toBeVisible();
      await reviews.filterSearch().fill('');

      await reviews.filterOption(value).click();
      await reviews.filterButton('OK').click();
      await expect(reviews.filterPopup).toBeHidden();

      await expect
        .poll(async () => {
          const cells = await reviews.columnTexts(index);
          return cells.length > 0 && cells.every((c) => c === value);
        })
        .toBe(true);

      await reviews.resetFilter(filter);
      await expect(reviews.rows).toHaveCount(total);
    });
  }

  test('filter Reset stays disabled until a value is ticked', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.createReview(who, tag);

    await reviews.openFilter('Principal Name');
    await expect(reviews.filterOption(who.name)).toBeVisible();
    await expect(reviews.filterButton('Reset')).toBeDisabled();

    await reviews.filterOption(who.name).click();
    await expect(reviews.filterButton('Reset')).toBeEnabled();
  });

  test('Principal Name filter: ticking two values shows rows for both', async ({ reviews, tag }) => {
    const [a, b] = await createSortFilterReviews(reviews, tag);

    await reviews.applyFilter('Principal Name', [a.name, b.name]);

    await expect
      .poll(async () => {
        const cells = await reviews.columnTexts(PRINCIPAL_COLUMN.name);
        return cells.includes(a.name) && cells.includes(b.name) && cells.every((c) => [a.name, b.name].includes(c));
      })
      .toBe(true);
  });

  test('Review Period filter: options are valid periods and filtering keeps only that period', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.createReview(who, tag);

    await reviews.openFilter('Review Period');
    await expect(reviews.filterOptions().first()).toBeVisible(); // the list renders a moment after the popup opens
    const options = (await reviews.filterOptions().allInnerTexts()).map(normalize);
    expect(options).toContain(currentSurveyPeriod()); // count not asserted: other periods can also appear
    for (const option of options) expect(option).toMatch(REVIEW_PERIOD_FORMAT);

    await reviews.filterOption(currentSurveyPeriod()).click();
    await reviews.filterButton('OK').click();

    await expect
      .poll(async () => {
        const cells = await reviews.columnTexts(PRINCIPAL_COLUMN.period);
        return cells.length > 0 && cells.every((c) => c === currentSurveyPeriod());
      })
      .toBe(true);
  });

  test('pagination defaults to 30 per page', async ({ reviews, tag }) => {
    const [who] = await reviews.randomPrincipals(1);
    await reviews.createReview(who, tag);
    await expect(reviews.pageSize).toHaveText(MESSAGES.defaultPageSize);
  });
});

// ===================================================================================================
// 3. FULL CYCLE FOR 5 RANDOM PRINCIPALS
// ===================================================================================================
test.describe('Principal Teamwork Survey — full cycle for 5 random principals', () => {
  test.describe.configure({ timeout: 150_000 });

  const START_RATINGS = ['10', '1', '5', '7', '3'];
  const EDIT_RATINGS = ['2', '9', '6', '4', '8'];

  for (const [i, startRating] of START_RATINGS.entries()) {
    test(`random principal ${i + 1} of 5 (rating ${startRating}): submit → edit (icon) → edit (duplicate prompt) → delete`, async ({ reviews, tag }) => {
      const [who] = await reviews.randomPrincipals(1);
      reviews.rating = startRating;
      const row = reviews.rowWithText(tag);

      await test.step('submit a new survey', async () => {
        await reviews.fillAndSubmit(who, stamped(tag, STAGE.created));
        await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
        await expect(row).toHaveCount(1);
        await expectRowValues(reviews, row, who, startRating, stamped(tag, STAGE.created));
      });

      await test.step('edit through the Edit icon (change the rating and both answers)', async () => {
        await reviews.dismissToasts();
        await reviews.openEdit(row);
        await expectEditMode(reviews, who, startRating, stamped(tag, STAGE.created));
        await reviews.selectRating(EDIT_RATINGS[i]);
        await reviews.setComments(stamped(tag, STAGE.editedViaIcon));
        await reviews.setImprove(reviews.improveFor(stamped(tag, STAGE.editedViaIcon)));
        await reviews.submit();
        await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
        await expectRowValues(reviews, row, who, EDIT_RATINGS[i], stamped(tag, STAGE.editedViaIcon));
      });

      await test.step('edit through the "review already exists" prompt (Yes)', async () => {
        await reviews.dismissToasts();
        await reviews.startEditViaDuplicate(who);
        await expectEditMode(reviews, who, EDIT_RATINGS[i], stamped(tag, STAGE.editedViaIcon));
        await reviews.setComments(stamped(tag, STAGE.editedViaDuplicate));
        await reviews.setImprove(reviews.improveFor(stamped(tag, STAGE.editedViaDuplicate)));
        await reviews.submit();
        await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
        await expectRowValues(reviews, row, who, EDIT_RATINGS[i], stamped(tag, STAGE.editedViaDuplicate));
        await expect(row).toHaveCount(1);
      });

      await test.step('delete the survey', async () => {
        await reviews.dismissToasts();
        await reviews.deleteRow(row, 'OK');
        await expect(reviews.toast(MESSAGES.deleted)).toBeVisible();
        await expect(row).toHaveCount(0);
      });
    });
  }
});
