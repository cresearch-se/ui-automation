import { type Page, type Locator, expect } from '@playwright/test';
import { type OfficeHead, currentReviewPeriod } from '../data/officeHeadReviews.data';
import { normalize } from '../utils/text';

/**
 * Shared base for the "review form + My Submissions table" tabs of the Reviews app. Tabs 1, 2 and 4
 * share this layout (antd Form + Jodit editor + antd Table); a tab only supplies its route and the
 * id of its person dropdown. Page objects only FIND things and DO things — assertions live in tests
 * (the few `expect`s here are synchronisation: "wait until the UI is ready").
 *
 * Locator rules learnt from the live DOM (see specs/app-notes.md):
 *  - tabs are plain links in #navTabs, not role=tab;
 *  - antd ids such as rc_select_17 are dynamic → fields are found via their stable `label[for]`;
 *  - dropdowns are NOT searchable and their option list is virtual → scroll to read/choose options;
 *  - dropdown / toast / popover / filter panels render in <body> portals → locate them from `page`;
 *  - row icons have no accessible name → found by the svg `data-icon` inside the button.
 */
export const COLUMN = { head: 0, office: 1, period: 2, comments: 3, date: 4, action: 5 } as const;
export type ColumnIndex = (typeof COLUMN)[keyof typeof COLUMN];

export interface ReviewTabConfig {
  /** Route relative to the project baseURL (`.../reviews/`). */
  route: string;
  /** Visible tab name in the nav. */
  tabName: string;
  /** `label[for]` of the person dropdown (Office Head = `OfficerEmpNo`). */
  personFieldId: string;
}

const EDIT_ICON = 'svg[data-icon="pen-to-square"]';
const DELETE_ICON = 'svg[data-icon="trash-can"]';

export class ReviewTabPage {
  readonly tabLinks: Locator;

  // --- form
  readonly form: Locator;
  readonly reviewPeriodSelect: Locator;
  readonly personSelect: Locator;
  readonly ratingField: Locator;
  readonly editor: Locator;
  readonly editorPlaceholder: Locator;
  readonly statusBar: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  // --- duplicate-review prompt (inline, shown when period + person already have a review)
  readonly duplicateMessage: Locator;
  readonly yesButton: Locator;
  readonly noButton: Locator;

  // --- table
  readonly table: Locator;
  readonly rows: Locator;
  readonly actionableRows: Locator;
  readonly emptyPlaceholder: Locator;
  readonly pageSize: Locator;

  // --- portals
  readonly toastAny: Locator;
  readonly deletePopover: Locator;
  readonly filterPopup: Locator;

  constructor(
    readonly page: Page,
    readonly config: ReviewTabConfig,
  ) {
    this.tabLinks = page.locator('#navTabs a.nav-link');

    this.form = page.locator('form.ant-form');
    this.reviewPeriodSelect = this.formItem('ReviewYear').locator('.ant-select');
    this.personSelect = this.formItem(config.personFieldId).locator('.ant-select');
    this.ratingField = this.form.locator('#ReviewRating');
    this.editor = this.form.locator('.jodit-wysiwyg');
    this.editorPlaceholder = this.form.locator('.jodit-placeholder');
    this.statusBar = this.form.locator('.jodit-status-bar');
    this.submitButton = this.form.getByRole('button', { name: 'Submit', exact: true });
    this.cancelButton = this.form.getByRole('button', { name: 'Cancel', exact: true });

    this.duplicateMessage = page.getByText('A review already exists for the selected office head and period');
    this.yesButton = page.getByRole('button', { name: 'Yes', exact: true });
    this.noButton = page.getByRole('button', { name: 'No', exact: true });

    this.table = page.locator('.ant-table');
    this.rows = this.table.locator('tbody tr.ant-table-row');
    this.actionableRows = this.rows.filter({ has: page.locator(`button:has(${DELETE_ICON})`) });
    this.emptyPlaceholder = this.table.locator('tr.ant-table-placeholder');
    this.pageSize = page.locator('.ant-pagination .ant-select-selection-item');

    this.toastAny = page.locator('.ant-notification-notice, .ant-message-notice');
    this.deletePopover = page.locator('.ant-popover:not(.ant-popover-hidden)');
    this.filterPopup = page.locator('.ant-table-filter-dropdown:visible');
  }

  // ------------------------------------------------------------------ navigation

  async goto() {
    await this.page.goto(this.config.route);
    await this.waitUntilLoaded();
  }

  /** The SPA renders behind a spinner; wait for the form AND for the table to show rows or "No data". */
  async waitUntilLoaded() {
    await expect(this.submitButton).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first().or(this.emptyPlaceholder)).toBeVisible({ timeout: 60_000 });
  }

  async openTab(name: string) {
    await this.tabLinks.filter({ hasText: name }).click();
    await this.waitUntilLoaded();
  }

  // ------------------------------------------------------------------ form: fields

  private formItem(labelFor: string): Locator {
    return this.form.locator('.ant-form-item').filter({ has: this.page.locator(`label[for="${labelFor}"]`) });
  }

  /** Labels of the fields the user can see in the form, top to bottom (hidden fields such as Rating are skipped). */
  async formLabels(): Promise<string[]> {
    const labels = await this.form.locator('.ant-form-item label:visible').allInnerTexts();
    return labels.map(normalize).filter(Boolean);
  }

  /** The text currently shown in a dropdown (`----- Select -----` until something is chosen). */
  selectedValue(select: Locator): Locator {
    return select.locator('.ant-select-selection-item');
  }

  fieldError(text: string): Locator {
    return this.form.getByText(text);
  }

  private dropdownOptions(): Locator {
    return this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  }

  private dropdownScroller(): Locator {
    return this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .rc-virtual-list-holder');
  }

  private async renderedOptionTexts(): Promise<string[]> {
    return (await this.dropdownOptions().allInnerTexts()).map(normalize);
  }

  /** Read EVERY option of a dropdown (the list is virtual, so scroll and collect), then close it. */
  async readOptions(select: Locator): Promise<string[]> {
    await select.click();
    await expect(this.dropdownOptions().first()).toBeVisible();
    const holder = this.dropdownScroller();
    await holder.evaluate((el) => { el.scrollTop = 0; });

    const collected: string[] = [];
    for (let i = 0; i < 50; i++) {
      for (const text of await this.renderedOptionTexts()) {
        if (!collected.includes(text)) collected.push(text);
      }
      const atBottom = await holder.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
      if (atBottom) break;
      const before = (await this.renderedOptionTexts()).join('|');
      await holder.evaluate((el) => { el.scrollTop += el.clientHeight - 10; });
      await expect.poll(async () => (await this.renderedOptionTexts()).join('|')).not.toBe(before);
    }
    await this.page.keyboard.press('Escape');
    await expect(this.dropdownOptions()).toHaveCount(0);
    return collected;
  }

  /** Choose an option by its whitespace-normalised text, scrolling the virtual list until it renders. */
  async chooseOption(select: Locator, text: string) {
    await select.click();
    await expect(this.dropdownOptions().first()).toBeVisible();
    const holder = this.dropdownScroller();
    await holder.evaluate((el) => { el.scrollTop = 0; });

    for (let i = 0; i < 50; i++) {
      const index = (await this.renderedOptionTexts()).indexOf(normalize(text));
      if (index >= 0) {
        await this.dropdownOptions().nth(index).click();
        return;
      }
      const atBottom = await holder.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
      if (atBottom) break;
      const before = (await this.renderedOptionTexts()).join('|');
      await holder.evaluate((el) => { el.scrollTop += el.clientHeight - 10; });
      await expect.poll(async () => (await this.renderedOptionTexts()).join('|')).not.toBe(before);
    }
    throw new Error(`Option not found in dropdown: "${text}"`);
  }

  /** Defaults to the current-year period; throws "Option not found" if the admin entered a wrong one. */
  async selectReviewPeriod(period = currentReviewPeriod()) {
    await this.chooseOption(this.reviewPeriodSelect, period);
  }

  async selectPerson(person: OfficeHead) {
    await this.chooseOption(this.personSelect, `${person.name} - ${person.office}`);
  }

  /** Replace the Comments editor content (Jodit contenteditable). */
  async setComments(text: string) {
    await this.editor.click();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Backspace');
    if (text) await this.page.keyboard.type(text);
  }

  // ------------------------------------------------------------------ form: flows

  /** Fill the form and click Submit (no waiting on the outcome — tests assert the toast / row). */
  async fillAndSubmit(person: OfficeHead, comments: string, period = currentReviewPeriod()) {
    await this.selectReviewPeriod(period);
    await this.selectPerson(person);
    await this.setComments(comments);
    await this.submitButton.click();
  }

  /**
   * SETUP helper (not a test step): make sure `person` has exactly one current-period review whose
   * comment is `comments`; returns its row. Clears any existing review for that person first so the
   * duplicate prompt can't interfere.
   */
  async createReview(person: OfficeHead, comments: string): Promise<Locator> {
    await this.removeExistingReviewsFor(person);
    await this.fillAndSubmit(person, comments);
    const row = this.rowWithText(comments);
    await expect(row).toHaveCount(1);
    await this.dismissToasts();
    return row;
  }

  /** Re-select an existing period + person combo and accept the "edit this review?" prompt. */
  async startEditViaDuplicate(person: OfficeHead, period = currentReviewPeriod()) {
    await this.selectReviewPeriod(period);
    await this.selectPerson(person);
    await expect(this.duplicateMessage).toBeVisible();
    await this.yesButton.click();
    await expect(this.cancelButton).toBeVisible();
  }

  async openEdit(row: Locator) {
    await this.actionButton(row, 'edit').click();
    await expect(this.cancelButton).toBeVisible();
  }

  async cancelEdit() {
    await this.cancelButton.click();
    await expect(this.cancelButton).toBeHidden();
  }

  // ------------------------------------------------------------------ table

  rowWithText(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  cell(row: Locator, column: ColumnIndex): Locator {
    return row.locator('td').nth(column);
  }

  actionButton(row: Locator, kind: 'edit' | 'delete'): Locator {
    return row.locator(`button:has(${kind === 'edit' ? EDIT_ICON : DELETE_ICON})`);
  }

  headerCell(name: string): Locator {
    return this.table.locator('thead th').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
  }

  async headerTexts(): Promise<string[]> {
    return (await this.table.locator('thead th').allInnerTexts()).map(normalize);
  }

  async columnTexts(column: ColumnIndex): Promise<string[]> {
    return (await this.rows.locator(`td:nth-child(${column + 1})`).allInnerTexts()).map(normalize);
  }

  async sortBy(columnName: string) {
    await this.headerCell(columnName).click();
  }

  // ------------------------------------------------------------------ delete

  deletePopoverTitle(): Locator {
    return this.deletePopover.locator('.ant-popconfirm-title');
  }

  deletePopoverText(): Locator {
    return this.deletePopover.locator('.ant-popconfirm-description');
  }

  /** Click the trash icon and answer the confirmation. Caller asserts the outcome (toast / row). */
  async deleteRow(row: Locator, answer: 'OK' | 'Cancel' = 'OK') {
    await this.actionButton(row, 'delete').click();
    await expect(this.deletePopover).toBeVisible();
    await this.deletePopover.getByRole('button', { name: answer, exact: true }).click();
    await expect(this.deletePopover).toBeHidden();
  }

  /** Delete the person's current-period review(s) left over from earlier runs / manual testing. */
  async removeExistingReviewsFor(person: OfficeHead) {
    const existing = this.actionableRows
      .filter({ hasText: person.name })
      .filter({ hasText: person.office })
      .filter({ hasText: currentReviewPeriod() });
    await this.deleteWhilePresent(existing);
  }

  /** Delete every row carrying `tag` (test teardown). Reloads first so a half-finished UI can't block it. */
  async deleteRowsWithTag(tag: string) {
    if ((await this.rowWithText(tag).count()) === 0) return;
    await this.goto();
    await this.deleteWhilePresent(this.actionableRows.filter({ hasText: tag }));
  }

  private async deleteWhilePresent(rows: Locator) {
    for (let guard = 0; guard < 50; guard++) {
      const count = await rows.count();
      if (count === 0) return;
      await this.deleteRow(rows.first());
      await expect(rows).toHaveCount(count - 1);
      await this.dismissToasts();
    }
    throw new Error('Could not clear reviews — delete kept leaving rows behind');
  }

  // ------------------------------------------------------------------ toasts

  toast(text: string): Locator {
    return this.toastAny.filter({ hasText: text }).first();
  }

  /** Close lingering toasts so the next toast assertion can't match a stale one. */
  async dismissToasts() {
    for (const close of await this.page.locator('.ant-notification-notice-close').all()) {
      await close.click().catch(() => {});
    }
    await expect(this.toastAny).toHaveCount(0, { timeout: 15_000 });
  }

  // ------------------------------------------------------------------ column filters

  filterTrigger(columnName: string): Locator {
    return this.headerCell(columnName).locator('.ant-table-filter-trigger');
  }

  async openFilter(columnName: string) {
    await this.filterTrigger(columnName).click();
    await expect(this.filterPopup).toBeVisible();
  }

  filterSearch(): Locator {
    return this.filterPopup.getByPlaceholder('Search in filters');
  }

  filterOptions(): Locator {
    return this.filterPopup.locator('.ant-dropdown-menu-item');
  }

  filterOption(text: string): Locator {
    return this.filterOptions().filter({ hasText: text });
  }

  filterButton(name: 'OK' | 'Reset'): Locator {
    return this.filterPopup.getByRole('button', { name, exact: true });
  }

  /** Open a column filter, tick the given values and apply with OK. */
  async applyFilter(columnName: string, values: string[]) {
    await this.openFilter(columnName);
    for (const value of values) await this.filterOption(value).click();
    await this.filterButton('OK').click();
    await expect(this.filterPopup).toBeHidden();
  }

  async resetFilter(columnName: string) {
    await this.openFilter(columnName);
    await this.filterButton('Reset').click();
    await this.page.keyboard.press('Escape');
    await expect(this.filterPopup).toBeHidden();
  }
}
