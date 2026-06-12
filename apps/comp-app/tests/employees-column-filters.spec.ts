// spec: apps/comp-app/specs/employees-filters.md (column funnel filters)
// app: Consulting Comp App (comp-app) — Employees tab, per-column funnel filters
//
// STATUS: UNVERIFIED — authored offline. Two layers of uncertainty here:
//   1. Same as the top-bar tests: no live run yet (no network route to the internal app).
//   2. The funnel DROPDOWN internals were never captured (they render in a portal on click), so the
//      dropdown selectors target Ant Design's DEFAULT checkbox-menu + OK/Reset structure. If your
//      funnels use a custom (e.g. search-box) dropdown, the healer must adjust EmployeesPage helpers.
//
// Data values below are placeholders — confirm against live data before/at first run.

import { test, expect } from '@playwright/test';
import { EmployeesPage } from '../pages/EmployeesPage';

// TODO: confirm these against live Employees data.
const STATUS = 'Active';
const TITLE = 'Partner';
const OFFICE = 'London';

test.describe('Employees Tab — Column Funnel Filters', () => {
  let employees: EmployeesPage;

  test.beforeEach(async ({ page }) => {
    employees = new EmployeesPage(page);
    await employees.goto();
  });

  // 1. Opening a column funnel shows its filter dropdown with options
  test('Opening a column funnel shows its filter dropdown', async () => {
    await employees.openColumnFilter('Status');
    await expect(employees.filterDropdown).toBeVisible();
    await expect(employees.filterDropdown.locator('.ant-dropdown-menu-item').first()).toBeVisible();
  });

  // 2. Selecting a value and applying filters the column
  test('Selecting a value and applying filters the column', async () => {
    await employees.openColumnFilter('Status');
    await employees.chooseFilterOption(STATUS);
    await employees.applyFilter();

    const statuses = await employees.columnValues('Status');
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) {
      expect(status).toContain(STATUS);
    }
    expect(await employees.isColumnFilterActive('Status')).toBe(true);
  });

  // 3. Reset clears the column funnel and restores the list
  test('Reset clears the column funnel and restores the list', async () => {
    const defaultCount = await employees.rowCount();

    await employees.openColumnFilter('Status');
    await employees.chooseFilterOption(STATUS);
    await employees.applyFilter();
    expect(await employees.rowCount()).toBeLessThanOrEqual(defaultCount);

    await employees.openColumnFilter('Status');
    await employees.resetFilter();
    // NOTE: antd's default Reset applies immediately. If this app requires re-confirming, the healer
    // should add an applyFilter()/OK here.
    expect(await employees.isColumnFilterActive('Status')).toBe(false);
    expect(await employees.rowCount()).toBe(defaultCount);
  });

  // 4. Funnels on two columns combine (AND)
  test('Funnels on two columns combine', async () => {
    await employees.openColumnFilter('Status');
    await employees.chooseFilterOption(STATUS);
    await employees.applyFilter();

    await employees.openColumnFilter('Title');
    await employees.chooseFilterOption(TITLE);
    await employees.applyFilter();

    for (const status of await employees.columnValues('Status')) {
      expect(status).toContain(STATUS);
    }
    for (const title of await employees.columnValues('Title')) {
      expect(title).toContain(TITLE);
    }
  });

  // 5. A column funnel combines with a top-bar filter
  test('A column funnel combines with a top-bar filter', async () => {
    await employees.selectOffice(OFFICE);
    await employees.search();

    await employees.openColumnFilter('Status');
    await employees.chooseFilterOption(STATUS);
    await employees.applyFilter();

    for (const office of await employees.columnValues('Office')) {
      expect(office).toContain(OFFICE);
    }
    for (const status of await employees.columnValues('Status')) {
      expect(status).toContain(STATUS);
    }
  });
});
