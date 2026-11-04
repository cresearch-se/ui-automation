import { type Page, type Locator, type Request, type Response, expect } from '@playwright/test';
import { type OfficeHead, MESSAGES, STAGE, currentReviewPeriod } from '../data/officeHeadReviews.data';
import { normalize, stamped } from '../utils/text';

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
  /**
   * Route to land on first when the tab is reached the way a user does: open the app (first tab), then click the
   * tab. Omit to open `route` directly.
   */
  landingRoute?: string;
  /** Start of the inline "review already exists" text; defaults to the Office Head wording. */
  duplicateText?: string;
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

    this.duplicateMessage = page.getByText(config.duplicateText ?? 'A review already exists for the selected office head and period');
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
    const started = Date.now();
    if (this.config.landingRoute) {
      await this.page.goto(this.config.landingRoute);
      await expect(this.tabLinks.first()).toBeVisible({ timeout: 90_000 });
      await this.tabLinks.filter({ hasText: this.config.tabName }).click();
      await expect(this.page).toHaveURL(new RegExp(`/${this.config.route}$`));
    } else {
      await this.page.goto(this.config.route);
    }
    await this.waitUntilLoaded();
    const seconds = Math.round((Date.now() - started) / 1000);
    if (seconds >= 10) console.log(`[load] ${this.config.route} ready after ${seconds}s`); // slow staging shows up in the log
  }

  /** The SPA renders behind a spinner; wait for the form AND for the table to show rows or "No data". */
  async waitUntilLoaded() {
    await expect(this.submitButton).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first().or(this.emptyPlaceholder)).toBeVisible({ timeout: 60_000 });
    // antd can show "No data" while the submissions request is still in flight, which made cleanups count zero rows
    // and skip. Wait for the network to go quiet (capped: the app may keep making background calls).
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  async openTab(name: string) {
    await this.tabLinks.filter({ hasText: name }).click();
    await this.waitUntilLoaded();
  }

  // ------------------------------------------------------------------ form: fields

  private formItem(labelFor: string): Locator {
    return this.form.locator('.ant-form-item').filter({ has: this.page.locator(`label[for="${labelFor}"]`) });
  }

  /**
   * Labels of the fields the user can see in the form, top to bottom (hidden fields such as Rating are
   * skipped). The app prints them as `Review Period :`; the trailing colon is punctuation, so it is dropped.
   */
  async formLabels(): Promise<string[]> {
    const labels = await this.form.locator('.ant-form-item label:visible').allInnerTexts();
    return labels.map((label) => normalize(label).replace(/\s*:$/, '')).filter(Boolean);
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

  /**
   * Scroll the virtual list one page down and let it re-render. Returns false when it could not move
   * (already at the end). Two animation frames are enough for the list to render the new window.
   */
  private async scrollListDown(holder: Locator): Promise<boolean> {
    return holder.evaluate(async (el) => {
      const before = el.scrollTop;
      el.scrollTop += el.clientHeight - 10;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return el.scrollTop > before;
    });
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
      if (!(await this.scrollListDown(holder))) break;
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
        // The closing dropdown stays in the DOM for a moment; wait for it to go so the next dropdown's
        // locators don't match two lists.
        await expect(this.dropdownOptions()).toHaveCount(0);
        return;
      }
      if (!(await this.scrollListDown(holder))) break;
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
    // Leave the editor so the form picks the text up before anything (Submit) validates it.
    await this.page.keyboard.press('Tab');
  }

  // ------------------------------------------------------------------ form: flows

  /** Fill the form and click Submit (no waiting on the outcome — tests assert the toast / row). */
  async fillAndSubmit(person: OfficeHead, comments: string, period = currentReviewPeriod()) {
    await this.fillForm(person, comments, period);
    if (!(await this.submitIsEnabled())) {
      // Submit stays disabled while the "review already exists" prompt is up: an earlier cleanup missed a row.
      // Reload, clear the head again and retry once; the warning keeps the miss visible in the report.
      console.warn(`[cleanup] Submit disabled for ${person.name} (${person.office}) — ${await this.visibleRowsSummary()}`);
      await this.goto();
      await this.removeExistingReviewsFor(person);
      await this.fillForm(person, comments, period);
      if (!(await this.submitIsEnabled())) {
        const prompt = await this.duplicateMessage.isVisible();
        throw new Error(
          (prompt
            ? `A review already exists for ${person.name} (${person.office}) despite cleanup`
            : `Submit stayed disabled for ${person.name} (${person.office})`) + ` — ${await this.visibleRowsSummary()}`,
        );
      }
    }
    await this.submit();
  }

  /**
   * Click Submit (add or update) and give the server up to 30s to answer, logging the API calls with their timing
   * so a slow save shows up as `[save] POST ... -> 200 (14.8s)`. Does not assert: tests assert the toast / row.
   */
  async submit() {
    await this.logNetworkDuring(async () => {
      await this.submitButton.click();
      await this.toast(MESSAGES.submitted).waitFor({ timeout: 30_000 }).catch(() => {});
    }, 'save');
  }

  private async fillForm(person: OfficeHead, comments: string, period: string) {
    await this.selectReviewPeriod(period);
    await this.selectPerson(person);
    await this.setComments(comments);
  }

  /** Submit is enabled right after filling the form, unless the duplicate prompt or a pending save blocks it. */
  private async submitIsEnabled(): Promise<boolean> {
    try {
      await expect(this.submitButton).toBeEnabled({ timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  private async visibleRowsSummary(): Promise<string> {
    const rows = (await this.rows.allInnerTexts()).map(normalize);
    return `rows on screen: ${rows.length ? rows.join(' | ') : 'none'}`;
  }

  /**
   * SETUP helper (not a test step): make sure `person` has exactly one current-period review, created with the
   * comment "<tag> created"; returns a row locator that keeps matching after the comment is edited (matches on
   * `tag`). Clears any existing review for that person first so the duplicate prompt can't interfere.
   */
  async createReview(person: OfficeHead, tag: string): Promise<Locator> {
    await this.removeExistingReviewsFor(person);
    await this.fillAndSubmit(person, stamped(tag, STAGE.created));
    await expect(this.rowWithText(stamped(tag, STAGE.created))).toHaveCount(1);
    await this.dismissToasts();
    return this.rowWithText(tag);
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
    console.log(
      `[cleanup] ${person.name} (${person.office}): ${await this.rows.count()} rows on screen, ${await existing.count()} to delete`,
    );
    await this.deleteWhilePresent(existing);
  }

  /**
   * Delete every row carrying `tag` (test teardown). Reloads first so a half-finished UI can't block it.
   * After a failed test the page may be mid-load, so `reload` skips the "nothing on screen" shortcut.
   */
  async deleteRowsWithTag(tag: string, { reload = false } = {}) {
    if (!reload && (await this.rowWithText(tag).count()) === 0) return;
    await this.goto();
    await this.deleteWhilePresent(this.actionableRows.filter({ hasText: tag }));
  }

  private async deleteWhilePresent(rows: Locator) {
    for (let guard = 0; guard < 50; guard++) {
      const count = await rows.count();
      if (count === 0) return;
      console.log(`[cleanup] deleting (${count} left): ${normalize(await rows.first().innerText())}`);
      await this.logNetworkDuring(async () => {
        await this.deleteRow(rows.first());
        // The toast means the server confirmed the delete; without it the page can be left or closed while the
        // request is still pending and the row comes back.
        await expect(this.toast(MESSAGES.deleted)).toBeVisible();
        await expect(rows).toHaveCount(count - 1);
      });
      await this.dismissToasts();
    }
    throw new Error('Could not clear reviews — delete kept leaving rows behind');
  }

  /**
   * Run `action` and print the app's API calls made meanwhile (method, URL, status; body for non-GET calls),
   * so a delete the UI accepts but the server doesn't apply shows up in the log, also when `action` throws.
   */
  private async logNetworkDuring(action: () => Promise<void>, label = 'cleanup') {
    const lines: Promise<string>[] = [];
    const started = Date.now();
    const onResponse = (response: Response) => {
      const request = response.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) return;
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      lines.push(
        (async () => {
          const call = `${request.method()} ${response.url()} -> ${response.status()} (${seconds}s)`;
          if (request.method() === 'GET') return call;
          const body = await response.text().catch(() => '(body unavailable)');
          return `${call} ${body.slice(0, 300)}`;
        })(),
      );
    };
    const onFailed = (request: Request) => {
      lines.push(Promise.resolve(`${request.method()} ${request.url()} FAILED: ${request.failure()?.errorText}`));
    };
    this.page.on('response', onResponse);
    this.page.on('requestfailed', onFailed);
    try {
      await action();
    } finally {
      this.page.off('response', onResponse);
      this.page.off('requestfailed', onFailed);
      for (const line of await Promise.all(lines)) console.log(`[${label}]   ${line}`);
    }
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
