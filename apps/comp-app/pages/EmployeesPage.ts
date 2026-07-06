import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Comp App "Employees" tab and its top search-bar filters.
 *
 * The app is built with Ant Design (antd), so locators lean on antd's stable class structure
 * (`.ant-select`, `.ant-table`, `.ant-checkbox-wrapper`) plus role/text locators where possible.
 *
 * STATUS: authored offline from a static DOM snapshot — selectors are best-effort and should be
 * validated with a live run + healer pass once network access to the app exists.
 */
export class EmployeesPage {
  readonly page: Page;
  /** The Employees tab button in the tablist (outside the panel). */
  readonly employeesTab: Locator;
  /**
   * Root of the Employees tab PANEL. react-bootstrap keeps every tab's panel mounted at once, so
   * unscoped selectors like `.ant-table` match ALL tabs (8+ tables). Every element inside the
   * Employees view MUST be located relative to this root to avoid strict-mode violations.
   * (Portal-rendered antd dropdowns are the exception — see the *dropdown getters below.)
   */
  readonly root: Locator;
  readonly searchButton: Locator;
  readonly clearButton: Locator;
  readonly offCycleCheckbox: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly emptyPlaceholder: Locator;

  constructor(page: Page) {
    this.page = page;
    this.employeesTab = page.getByRole('tab', { name: 'Employees', exact: true });
    // Exact id — won't match #home-tabs-tabpane-employeesjancycle.
    this.root = page.locator('#home-tabs-tabpane-employees');
    this.searchButton = this.root.getByRole('button', { name: 'Search' });
    this.clearButton = this.root.getByRole('button', { name: 'Clear' });
    this.offCycleCheckbox = this.root
      .locator('label.ant-checkbox-wrapper', { hasText: 'Off-Cycle' })
      .locator('input[type="checkbox"]');
    this.table = this.root.locator('.ant-table').first();
    this.rows = this.table.locator('.ant-table-tbody tr.ant-table-row');
    this.emptyPlaceholder = this.table.locator('.ant-table-placeholder');
  }

  /** Navigate to the app and ensure the Employees tab is open with its table visible. */
  async goto() {
    await this.page.goto('Home');
    await this.openEmployeesTab();
  }

  async openEmployeesTab() {
    // SPA renders behind a loading spinner (~6-10s) — wait for the tab before touching it,
    // otherwise we act on the still-loading page. Don't rely on load/network state here.
    await expect(this.employeesTab).toBeVisible({ timeout: 30_000 });
    const selected = await this.employeesTab.getAttribute('aria-selected');
    if (selected !== 'true') {
      await this.employeesTab.click();
    }
    await expect(this.table).toBeVisible({ timeout: 30_000 });
  }

  // --- Top search-bar selects -------------------------------------------------

  /** Locate a top-bar antd select by its placeholder text (e.g. "Select country"). */
  private selectByPlaceholder(placeholder: string): Locator {
    return this.root.locator('.ant-select').filter({
      has: this.page.locator('.ant-select-selection-placeholder', { hasText: placeholder }),
    });
  }

  get countrySelect(): Locator { return this.selectByPlaceholder('Select country'); }
  get officeSelect(): Locator { return this.selectByPlaceholder('Select office'); }
  get groupSelect(): Locator { return this.selectByPlaceholder('Select group'); }

  /**
   * Open an antd select and choose one or more option labels. antd renders the option list in a
   * portal at <body> level (`.ant-select-dropdown`), so options are located globally, not within
   * the select. For multi-selects the dropdown stays open between picks; Escape closes it.
   */
  async chooseInSelect(select: Locator, values: string[]) {
    await select.click();
    for (const value of values) {
      await this.page
        .locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: value })
        .first()
        .click();
    }
    await this.page.keyboard.press('Escape');
  }

  async selectCountry(...values: string[]) { await this.chooseInSelect(this.countrySelect, values); }
  async selectOffice(...values: string[]) { await this.chooseInSelect(this.officeSelect, values); }
  async selectGroup(...values: string[]) { await this.chooseInSelect(this.groupSelect, values); }

  async toggleOffCycle() { await this.offCycleCheckbox.click(); }

  async search() { await this.searchButton.click(); }
  async clear() { await this.clearButton.click(); }

  // --- Table inspection -------------------------------------------------------

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  /** Return the text of every cell in the column whose header `aria-label` matches `headerLabel`. */
  async columnValues(headerLabel: string): Promise<string[]> {
    const index = await this.columnIndex(headerLabel);
    if (index < 0) throw new Error(`Column "${headerLabel}" not found in the Employees table header`);
    // nth-child is 1-based. NOTE: antd fixed columns can render duplicate cells; if assertions on a
    // pinned column misbehave, the healer should scope to the non-fixed cell variant.
    return this.rows.locator(`td:nth-child(${index + 1})`).allInnerTexts();
  }

  private async columnIndex(headerLabel: string): Promise<number> {
    const headers = this.table.locator('.ant-table-thead th');
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      const th = headers.nth(i);
      const label = (await th.getAttribute('aria-label'))?.trim();
      if (label === headerLabel) return i;
      // Fall back to header text (the th may expose its name via text, not aria-label).
      const text = (await th.innerText()).trim();
      if (text === headerLabel || text.split('\n')[0].trim() === headerLabel) return i;
    }
    return -1;
  }

  // --- Per-column funnel filters ----------------------------------------------
  // antd "column filter": a funnel icon in the header opens a dropdown (portal at <body> level)
  // with a checkbox menu + OK/Reset buttons. NOTE: the dropdown internals were NOT captured in the
  // offline DOM snapshot, so these target antd's DEFAULT structure — validate on first live run.

  /** A column header cell located by its `aria-label`. */
  private headerCell(headerLabel: string): Locator {
    return this.table.locator(`.ant-table-thead th[aria-label="${headerLabel}"]`);
  }

  /** The funnel (filter) trigger inside a given column's header. */
  columnFilterTrigger(headerLabel: string): Locator {
    return this.headerCell(headerLabel).locator('.ant-table-filter-trigger');
  }

  /** The currently-open antd filter dropdown (rendered in a body-level portal). */
  get filterDropdown(): Locator {
    return this.page.locator('.ant-table-filter-dropdown:visible');
  }

  async openColumnFilter(headerLabel: string) {
    await this.columnFilterTrigger(headerLabel).click();
    await expect(this.filterDropdown).toBeVisible();
  }

  /** Tick one or more option labels in the open filter dropdown (antd default checkbox menu). */
  async chooseFilterOption(...values: string[]) {
    for (const value of values) {
      await this.filterDropdown
        .locator('.ant-dropdown-menu-item', { hasText: value })
        .first()
        .click();
    }
  }

  /** Click OK in the open filter dropdown to apply the selection. */
  async applyFilter() {
    await this.filterDropdown.getByRole('button', { name: 'OK' }).click();
  }

  /** Click Reset in the open filter dropdown to clear it. */
  async resetFilter() {
    await this.filterDropdown.getByRole('button', { name: 'Reset' }).click();
  }

  /** Whether a column's funnel is in the active (filtered) state. */
  async isColumnFilterActive(headerLabel: string): Promise<boolean> {
    const cls = await this.columnFilterTrigger(headerLabel).getAttribute('class');
    return cls?.includes('active') ?? false;
  }
}
