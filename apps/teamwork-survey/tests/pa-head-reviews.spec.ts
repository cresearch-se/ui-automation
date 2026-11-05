// spec: apps/teamwork-survey/specs/practice-head-reviews.md   (app knowledge: specs/app-notes.md)
// app: Teamwork Survey / Reviews — tab 2 "Practice Head Reviews" (officer role)
//
// STATUS: written from a live dump of staging (2026-11-05) and tab 1's proven flows; not yet run green.
//
// Layout of this file
//   1. Page basics        — read-only
//   2. Flows that change data — each test creates its own tagged review (fixture cleans up)
//   3. Full cycle for ALL 20 practice heads — submit → edit (icon) → edit (duplicate) → delete
//
// Shared helper wording: in the page object, `person.office` is the PRACTICE AREA (column "Practice Area").

import { test, expect } from '../fixtures/paHeadReviews.fixture';
import { type PracticeHeadReviewsPage } from '../pages/PracticeHeadReviewsPage';
import { COLUMN } from '../pages/ReviewTabPage';
import {
  FILTERABLE_COLUMNS,
  FLOW_HEAD,
  FORM_LABELS,
  MESSAGES,
  PRACTICE_HEADS,
  SEARCHES,
  SORTABLE_COLUMNS,
  SORT_FILTER_HEADS,
  TABLE_HEADERS,
  UNSORTABLE_COLUMNS,
  VALIDATION_HEAD,
  currentReviewPeriod,
  optionText,
  type PracticeHead,
} from '../data/paHeadReviews.data';
import { NOT_SELECTED, REVIEW_PERIOD_FORMAT, STAGE, TAB_NAMES } from '../data/officeHeadReviews.data';
import { compareText, compareUsDates, isSorted, normalize, stamped, submittedDateCandidates } from '../utils/text';

// ---------------------------------------------------------------------------------------------------
// Shared assertions (used by several tests)
// ---------------------------------------------------------------------------------------------------

/** Form is in "new review" state: nothing chosen, editor empty, no Cancel button. */
async function expectBlankForm(reviews: PracticeHeadReviewsPage) {
  await expect(reviews.selectedValue(reviews.reviewPeriodSelect)).toHaveText(NOT_SELECTED);
  await expect(reviews.selectedValue(reviews.personSelect)).toHaveText(NOT_SELECTED);
  await expect(reviews.editor).toHaveText('');
  await expect(reviews.cancelButton).toBeHidden();
}

/** Form is in edit mode for `head`: period + head locked, comments loaded, Submit + Cancel shown. */
async function expectEditMode(reviews: PracticeHeadReviewsPage, head: PracticeHead, comments: string) {
  await expect(reviews.reviewPeriodSelect).toHaveClass(/ant-select-disabled/);
  await expect(reviews.personSelect).toHaveClass(/ant-select-disabled/);
  await expect(reviews.selectedValue(reviews.reviewPeriodSelect)).toHaveText(currentReviewPeriod());
  await expect(reviews.selectedValue(reviews.personSelect)).toHaveText(optionText(head));
  await expect(reviews.editor).toHaveText(comments);
  await expect(reviews.submitButton).toBeVisible();
  await expect(reviews.cancelButton).toBeVisible();
}

/** A row shows exactly what was submitted. */
async function expectRowValues(reviews: PracticeHeadReviewsPage, row: ReturnType<PracticeHeadReviewsPage['rowWithText']>, head: PracticeHead, comments: string) {
  await expect(reviews.cell(row, COLUMN.head)).toHaveText(head.name);
  await expect(reviews.cell(row, COLUMN.office)).toHaveText(head.office); // the Practice Area column
  await expect(reviews.cell(row, COLUMN.period)).toHaveText(currentReviewPeriod());
  await expect(reviews.cell(row, COLUMN.comments)).toHaveText(comments);
  await expect(reviews.cell(row, COLUMN.date)).toHaveText(new RegExp(`^(${submittedDateCandidates().join('|')})$`));
}

// ===================================================================================================
// 1. PAGE BASICS (read-only)
// ===================================================================================================
test.describe('Practice Head Reviews — page basics (read-only)', () => {
  test('clicking the second tab opens Practice Head Reviews, with all 4 officer tabs shown', async ({ reviews }) => {
    await expect(reviews.page).toHaveURL(/\/paheadreview$/);
    await expect(reviews.tabLinks).toHaveText(TAB_NAMES);
    await expect(reviews.tabLinks.nth(1)).toHaveClass(/active/);
  });

  test('form starts empty with the expected defaults', async ({ reviews }) => {
    await expect(reviews.selectedValue(reviews.reviewPeriodSelect)).toHaveText(NOT_SELECTED);
    await expect(reviews.selectedValue(reviews.personSelect)).toHaveText(NOT_SELECTED);
    await expect(reviews.editorPlaceholder).toHaveText(MESSAGES.commentsPlaceholder);
    await expect(reviews.statusBar).toContainText(/chars:\s*0/i);
    await expect(reviews.statusBar).toContainText(/words:\s*0/i);
    await expect(reviews.submitButton).toBeEnabled();
    await expect(reviews.cancelButton).toBeHidden(); // Cancel exists in edit mode only
    await expect(reviews.ratingField).toBeHidden(); // Rating field lingers hidden in the DOM
  });

  test('form has exactly three fields, labelled Review Period, Practice Area Head and Comments', async ({ reviews }) => {
    expect(await reviews.formLabels()).toEqual(FORM_LABELS);
    await expect(reviews.form.locator('.ant-select:visible')).toHaveCount(2);
    await expect(reviews.editor).toHaveCount(1);
  });

  test('Review Period offers the standard period: Jan 01 – Dec 31 of the current year', async ({ reviews }) => {
    const options = await reviews.readOptions(reviews.reviewPeriodSelect);
    // Other periods (staging also has Oct 05 – Oct 12) are allowed; only the standard one must be there.
    expect(options, 'Admin must configure the period Jan 01 – Dec 31 of the current year').toContain(currentReviewPeriod());
    for (const option of options) expect(option).toMatch(REVIEW_PERIOD_FORMAT);
  });

  test('Practice Area Head dropdown lists exactly the 20 expected people, in order', async ({ reviews }) => {
    const options = await reviews.readPracticeHeadOptions();
    expect(options).toEqual(PRACTICE_HEADS.map(optionText));
  });

  for (const { typed, expected } of SEARCHES) {
    test(`typing "${typed}" in the Practice Area Head dropdown narrows it to ${expected.length} match(es)`, async ({ reviews }) => {
      await reviews.typeInPracticeHeadSearch(typed);
      await expect(reviews.openDropdownOptions).toHaveText(expected);
      await reviews.closeDropdown();
    });
  }

  test('comments counter updates as you type', async ({ reviews }) => {
    await reviews.setComments('sdgdfg');
    // The bar reads "Chars: 6Words: 1" with no gap, so `\b` can't end the number; (?!\d) can.
    await expect(reviews.statusBar).toContainText(/chars:\s*6(?!\d)/i);
    await expect(reviews.statusBar).toContainText(/words:\s*1(?!\d)/i);

    await reviews.setComments('hello world');
    // "hello world" is 11 characters, but the Jodit counter does not count the space → Chars: 10.
    await expect(reviews.statusBar).toContainText(/chars:\s*10(?!\d)/i);
    await expect(reviews.statusBar).toContainText(/words:\s*2(?!\d)/i);
  });

  test('table headers are exactly the expected six', async ({ reviews }) => {
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
  test('Submit with everything empty shows all three required-field errors', async ({ reviews }) => {
    await reviews.submitButton.click();
    await expect(reviews.fieldError(MESSAGES.reviewPeriodRequired)).toBeVisible();
    await expect(reviews.fieldError(MESSAGES.practiceHeadRequired)).toBeVisible();
    await expect(reviews.fieldError(MESSAGES.commentsRequired)).toBeVisible();
    await expect(reviews.toast(MESSAGES.submitted)).toBeHidden();
  });

  const REQUIRED_FIELDS = [
    { missing: 'Review Period', error: MESSAGES.reviewPeriodRequired },
    { missing: 'Practice Area Head', error: MESSAGES.practiceHeadRequired },
    { missing: 'Comments', error: MESSAGES.commentsRequired },
  ];
  for (const { missing, error } of REQUIRED_FIELDS) {
    test(`Submit with only ${missing} missing shows just that error`, async ({ reviews }) => {
      if (missing !== 'Review Period') await reviews.selectReviewPeriod();
      if (missing !== 'Practice Area Head') await reviews.selectPerson(VALIDATION_HEAD);
      if (missing !== 'Comments') await reviews.setComments('validation only');

      await reviews.submitButton.click();

      await expect(reviews.fieldError(error)).toBeVisible();
      for (const other of REQUIRED_FIELDS.filter((f) => f.missing !== missing)) {
        await expect(reviews.fieldError(other.error)).toBeHidden();
      }
    });
  }

  test('a required-field error clears once the field is filled', async ({ reviews }) => {
    await reviews.submitButton.click();
    await expect(reviews.fieldError(MESSAGES.reviewPeriodRequired)).toBeVisible();

    await reviews.selectReviewPeriod();
    await expect(reviews.fieldError(MESSAGES.reviewPeriodRequired)).toBeHidden();
  });
});

// ===================================================================================================
// 2. FLOWS THAT CHANGE DATA (each test creates its own tagged review, fixture deletes it)
// ===================================================================================================
test.describe('Practice Head Reviews — flows that change data', () => {
  // Not `serial`: a failure there skips every later test. The project runs this file in order in one worker.
  test.describe.configure({ timeout: 90_000 });

  // --- submit ----------------------------------------------------------------------------------------
  test('Submit adds the review, shows the success toast and resets the form', async ({ reviews, tag }) => {
    await reviews.removeExistingReviewsFor(FLOW_HEAD);

    const comments = stamped(tag, STAGE.created);
    await reviews.fillAndSubmit(FLOW_HEAD, comments);

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    const row = reviews.rowWithText(tag);
    await expect(row).toHaveCount(1);
    await expectRowValues(reviews, row, FLOW_HEAD, comments);
    await expectBlankForm(reviews);
  });

  test('a reviewed head stays selectable in the Practice Area Head dropdown', async ({ reviews, tag }) => {
    await reviews.createReview(FLOW_HEAD, tag);
    expect(await reviews.readPracticeHeadOptions()).toContain(optionText(FLOW_HEAD));
  });

  // --- edit via the Edit icon --------------------------------------------------------------------------
  test('Edit icon loads the review: period + head locked, only comments editable, saves with Submit', async ({ reviews, tag }) => {
    const row = await reviews.createReview(FLOW_HEAD, tag);

    await reviews.openEdit(row);
    await expectEditMode(reviews, FLOW_HEAD, stamped(tag, STAGE.created));

    await reviews.setComments(stamped(tag, STAGE.editedViaIcon));
    await reviews.submit();

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible(); // same toast for add and update
    await expect(reviews.cell(row, COLUMN.comments)).toHaveText(stamped(tag, STAGE.editedViaIcon));
    await expect(reviews.cell(row, COLUMN.head)).toHaveText(FLOW_HEAD.name);
    await expect(reviews.cell(row, COLUMN.office)).toHaveText(FLOW_HEAD.office);
    await expect(reviews.cell(row, COLUMN.period)).toHaveText(currentReviewPeriod());
    await expect(reviews.rowWithText(tag)).toHaveCount(1); // updated in place, no second row
    await expect(reviews.cancelButton).toBeHidden();
    await expectBlankForm(reviews); // saving an edit returns the form to the blank "new review" state
  });

  test('the success toast closes with its × button', async ({ reviews, tag }) => {
    await reviews.removeExistingReviewsFor(FLOW_HEAD);
    await reviews.fillAndSubmit(FLOW_HEAD, stamped(tag, STAGE.created));

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    await reviews.page.locator('.ant-notification-notice-close').first().click();
    await expect(reviews.toast(MESSAGES.submitted)).toBeHidden();
  });

  test('the success toast dismisses itself without any click', async ({ reviews, tag }) => {
    await reviews.removeExistingReviewsFor(FLOW_HEAD);
    await reviews.fillAndSubmit(FLOW_HEAD, stamped(tag, STAGE.created));

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    await expect(reviews.toast(MESSAGES.submitted)).toBeHidden({ timeout: 30_000 });
  });

  test('Cancel in edit mode discards the changes (edit-icon route)', async ({ reviews, tag }) => {
    const row = await reviews.createReview(FLOW_HEAD, tag);

    await reviews.openEdit(row);
    await reviews.setComments(stamped(tag, STAGE.cancelledEdit));
    await reviews.cancelEdit();

    await expect(reviews.cell(row, COLUMN.comments)).toHaveText(stamped(tag, STAGE.created)); // original, unchanged
    await expectBlankForm(reviews);
  });

  // --- edit via the duplicate prompt ---------------------------------------------------------------------
  test('selecting an already-reviewed combination shows the "review already exists" prompt', async ({ reviews, tag }) => {
    await reviews.createReview(FLOW_HEAD, tag);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(FLOW_HEAD);

    await expect(reviews.duplicateMessage).toBeVisible();
    await expect(reviews.page.getByText(MESSAGES.duplicate)).toBeVisible();
    await expect(reviews.yesButton).toBeVisible();
    await expect(reviews.noButton).toBeVisible();
    await expect(reviews.submitButton).toBeDisabled(); // Submit is blocked while the prompt is up
  });

  test('no duplicate prompt for a combination without a review', async ({ reviews }) => {
    await reviews.removeExistingReviewsFor(FLOW_HEAD);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(FLOW_HEAD);

    // Negative check (can pass early); the positive test above proves the prompt does appear when it should.
    await expect(reviews.duplicateMessage).toBeHidden();
  });

  test('duplicate prompt → No loads nothing into the form', async ({ reviews, tag }) => {
    await reviews.createReview(FLOW_HEAD, tag);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(FLOW_HEAD);
    await expect(reviews.duplicateMessage).toBeVisible();
    await reviews.noButton.click();

    await expect(reviews.editor).toHaveText('');
    await expect(reviews.cancelButton).toBeHidden();
    await expect(reviews.duplicateMessage).toBeHidden(); // the prompt goes away after No
  });

  test('duplicate prompt → Yes loads the review; edited comments save', async ({ reviews, tag }) => {
    const row = await reviews.createReview(FLOW_HEAD, tag);

    await reviews.startEditViaDuplicate(FLOW_HEAD);
    await expectEditMode(reviews, FLOW_HEAD, stamped(tag, STAGE.created));

    await reviews.setComments(stamped(tag, STAGE.editedViaDuplicate));
    await reviews.submit();

    await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
    await expect(reviews.cell(row, COLUMN.comments)).toHaveText(stamped(tag, STAGE.editedViaDuplicate));
    await expect(reviews.rowWithText(tag)).toHaveCount(1); // overridden, not duplicated
  });

  test('Cancel in edit mode discards the changes (duplicate-prompt route)', async ({ reviews, tag }) => {
    const row = await reviews.createReview(FLOW_HEAD, tag);

    await reviews.startEditViaDuplicate(FLOW_HEAD);
    await reviews.setComments(stamped(tag, STAGE.cancelledEdit));
    await reviews.cancelEdit();

    await expect(reviews.cell(row, COLUMN.comments)).toHaveText(stamped(tag, STAGE.created));
  });

  // --- delete ------------------------------------------------------------------------------------------
  test('Delete asks for confirmation; Cancel keeps the review', async ({ reviews, tag }) => {
    const row = await reviews.createReview(FLOW_HEAD, tag);

    await reviews.actionButton(row, 'delete').click();
    await expect(reviews.deletePopoverTitle()).toHaveText(MESSAGES.deleteTitle(FLOW_HEAD));
    await expect(reviews.deletePopoverText()).toHaveText(MESSAGES.deleteText);
    await reviews.deletePopover.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(reviews.deletePopover).toBeHidden();
    await expect(row).toHaveCount(1);
  });

  test('Delete → OK removes the review, shows the toast, and the head can be reviewed again', async ({ reviews, tag }) => {
    const row = await reviews.createReview(FLOW_HEAD, tag);

    await reviews.deleteRow(row, 'OK');

    await expect(reviews.toast(MESSAGES.deleted)).toBeVisible();
    await expect(row).toHaveCount(0);

    await reviews.selectReviewPeriod();
    await reviews.selectPerson(FLOW_HEAD);
    await expect(reviews.duplicateMessage).toBeHidden(); // fresh again
  });

  test('reviews from a past period have no Edit/Delete buttons', async ({ reviews }) => {
    const pastRows = reviews.rows.filter({ hasNotText: currentReviewPeriod() });
    test.skip((await pastRows.count()) === 0, 'No past-period reviews in My Submissions to check');

    for (const row of await pastRows.all()) {
      await expect(reviews.actionButton(row, 'edit')).toHaveCount(0);
      await expect(reviews.actionButton(row, 'delete')).toHaveCount(0);
    }
  });

  // --- table: sorting, filtering, paging (needs several rows → create them) -------------------------------
  /** Create one tagged review per SORT_FILTER_HEADS entry so sort/filter have distinct values to work on. */
  async function createSortFilterReviews(reviews: PracticeHeadReviewsPage, tag: string) {
    for (const [i, head] of SORT_FILTER_HEADS.entries()) {
      await reviews.createReview(head, `${tag}-${i}`);
    }
  }

  const SORT_COLUMNS = [
    { name: 'PA Head', column: COLUMN.head, compare: compareText },
    { name: 'Practice Area', column: COLUMN.office, compare: compareText },
    { name: 'Date Submitted', column: COLUMN.date, compare: compareUsDates },
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

  const [headA, headB] = SORT_FILTER_HEADS;
  const VALUE_FILTERS = [
    { column: 'PA Head', index: COLUMN.head, value: headB.name, search: headB.name.slice(0, 4) },
    { column: 'Practice Area', index: COLUMN.office, value: headB.office, search: headB.office.slice(0, 3) },
  ];
  for (const { column, index, value, search } of VALUE_FILTERS) {
    test(`${column} filter: search, tick, OK narrows the table; Reset restores it`, async ({ reviews, tag }) => {
      await createSortFilterReviews(reviews, tag);
      const total = await reviews.rows.count();

      await reviews.openFilter(column);
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

      await reviews.resetFilter(column);
      await expect(reviews.rows).toHaveCount(total);
    });
  }

  test('filter Reset stays disabled until a value is ticked', async ({ reviews, tag }) => {
    await reviews.createReview(FLOW_HEAD, tag);

    await reviews.openFilter('PA Head');
    await expect(reviews.filterOption(FLOW_HEAD.name)).toBeVisible();
    await expect(reviews.filterButton('Reset')).toBeDisabled();

    await reviews.filterOption(FLOW_HEAD.name).click();
    await expect(reviews.filterButton('Reset')).toBeEnabled();
  });

  test('PA Head filter: ticking two values shows rows for both', async ({ reviews, tag }) => {
    await createSortFilterReviews(reviews, tag);

    await reviews.applyFilter('PA Head', [headA.name, headB.name]);

    await expect
      .poll(async () => {
        const cells = await reviews.columnTexts(COLUMN.head);
        return cells.includes(headA.name) && cells.includes(headB.name) && cells.every((c) => [headA.name, headB.name].includes(c));
      })
      .toBe(true);
  });

  test('Review Period filter: options are valid periods and filtering keeps only that period', async ({ reviews, tag }) => {
    await reviews.createReview(FLOW_HEAD, tag);

    await reviews.openFilter('Review Period');
    await expect(reviews.filterOptions().first()).toBeVisible(); // the list renders a moment after the popup opens
    const options = (await reviews.filterOptions().allInnerTexts()).map(normalize);
    expect(options).toContain(currentReviewPeriod()); // count not asserted: other periods can also appear
    for (const option of options) expect(option).toMatch(REVIEW_PERIOD_FORMAT);

    await reviews.filterOption(currentReviewPeriod()).click();
    await reviews.filterButton('OK').click();

    await expect
      .poll(async () => {
        const cells = await reviews.columnTexts(COLUMN.period);
        return cells.length > 0 && cells.every((c) => c === currentReviewPeriod());
      })
      .toBe(true);
  });

  test('pagination defaults to 30 per page', async ({ reviews, tag }) => {
    await reviews.createReview(FLOW_HEAD, tag);
    await expect(reviews.pageSize).toHaveText(MESSAGES.defaultPageSize);
  });
});

// ===================================================================================================
// 3. FULL CYCLE FOR EVERY PRACTICE HEAD
// ===================================================================================================
test.describe('Practice Head Reviews — full cycle for every practice head', () => {
  test.describe.configure({ timeout: 150_000 });

  for (const head of PRACTICE_HEADS) {
    test(`${optionText(head)}: submit → edit (icon) → edit (duplicate prompt) → delete`, async ({ reviews, tag }) => {
      await reviews.removeExistingReviewsFor(head); // any earlier/manual review for this head
      const row = reviews.rowWithText(tag);

      await test.step('submit a new review', async () => {
        await reviews.fillAndSubmit(head, stamped(tag, STAGE.created));
        await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
        await expect(row).toHaveCount(1);
        await expectRowValues(reviews, row, head, stamped(tag, STAGE.created));
      });

      await test.step('edit through the Edit icon', async () => {
        await reviews.dismissToasts();
        await reviews.openEdit(row);
        await expectEditMode(reviews, head, stamped(tag, STAGE.created));
        await reviews.setComments(stamped(tag, STAGE.editedViaIcon));
        await reviews.submit();
        await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
        await expect(reviews.cell(row, COLUMN.comments)).toHaveText(stamped(tag, STAGE.editedViaIcon));
      });

      await test.step('edit through the "review already exists" prompt (Yes)', async () => {
        await reviews.dismissToasts();
        await reviews.startEditViaDuplicate(head);
        await expectEditMode(reviews, head, stamped(tag, STAGE.editedViaIcon));
        await reviews.setComments(stamped(tag, STAGE.editedViaDuplicate));
        await reviews.submit();
        await expect(reviews.toast(MESSAGES.submitted)).toBeVisible();
        await expect(reviews.cell(row, COLUMN.comments)).toHaveText(stamped(tag, STAGE.editedViaDuplicate));
        await expect(row).toHaveCount(1);
      });

      await test.step('delete the review', async () => {
        await reviews.dismissToasts();
        await reviews.deleteRow(row, 'OK');
        await expect(reviews.toast(MESSAGES.deleted)).toBeVisible();
        await expect(row).toHaveCount(0);
      });
    });
  }
});
