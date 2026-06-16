// spec: apps/comp-app/specs/employees-filters.md
// app: Consulting Comp App (comp-app) — Employees tab, top search-bar filters
//
// STATUS: UNVERIFIED — authored offline from a static DOM snapshot. The automation host currently
// has no network route to the app's internal IP, so these tests have NOT been executed. Run them
// (`npx playwright test --project=comp-app`) and apply the healer once access is available.
//
// The placeholder data values below were NOT observed live (the <tbody> rows weren't captured).
// Update them against real data before/at first run.

import { test, expect } from '@playwright/test';
import { EmployeesPage } from '../pages/EmployeesPage';

// TODO: confirm these against live Employees data.
const OFFICE = 'London';
const COUNTRY = 'United Kingdom';
const NO_MATCH_OFFICE = 'Zzz No Such Office';

test.describe('Employees Tab — Filtering (top search bar)', () => {
  let employees: EmployeesPage;

  test.beforeEach(async ({ page }) => {
    employees = new EmployeesPage(page);
    await employees.goto();
  });

  // 1. Default load shows the Employees table with rows
  test('Default load shows the Employees table with rows', async () => {
    await expect(employees.employeesTab).toHaveAttribute('aria-selected', 'true');
    await expect(employees.table).toBeVisible();
    expect(await employees.rowCount()).toBeGreaterThan(0);
  });

  // 2. Filter by Office returns only matching rows
  test('Filter by Office returns only matching rows', async () => {
    await employees.selectOffice(OFFICE);
    await employees.search();

    const offices = await employees.columnValues('Office');
    expect(offices.length).toBeGreaterThan(0);
    for (const office of offices) {
      expect(office).toContain(OFFICE);
    }
  });

  // 3. Filter by Country narrows the result set
  test('Filter by Country narrows the result set', async () => {
    const defaultCount = await employees.rowCount();

    await employees.selectCountry(COUNTRY);
    await employees.search();

    const filteredCount = await employees.rowCount();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(defaultCount);
  });

  // 4. Combining Country + Office applies both (AND)
  test('Combining Country and Office filters applies both', async () => {
    await employees.selectCountry(COUNTRY);
    await employees.selectOffice(OFFICE);
    await employees.search();

    const offices = await employees.columnValues('Office');
    for (const office of offices) {
      expect(office).toContain(OFFICE);
    }
  });

  // 5. Off-Cycle checkbox filters to off-cycle employees
  test('Off-Cycle checkbox filters to off-cycle employees', async () => {
    await employees.toggleOffCycle();
    await employees.search();

    const values = await employees.columnValues('Off-Cycle');
    expect(values.length).toBeGreaterThan(0);
    // TODO: confirm the truthy off-cycle rendering (e.g. "Yes" / a check icon) against live data,
    // then tighten this from "non-empty" to an exact expected value.
    for (const value of values) {
      expect(value.trim()).not.toBe('');
    }
  });

  // 6. Clear resets all filters and restores the full list
  test('Clear resets all filters and restores the full list', async () => {
    const defaultCount = await employees.rowCount();

    await employees.selectOffice(OFFICE);
    await employees.search();
    expect(await employees.rowCount()).toBeLessThanOrEqual(defaultCount);

    await employees.clear();
    // NOTE: if the app requires re-running Search after Clear, the healer should add
    // `await employees.search();` here before the assertion.
    expect(await employees.rowCount()).toBe(defaultCount);
  });

  // 7. A filter with no matches shows the empty state
  test('A filter with no matches shows the empty state', async () => {
    await employees.selectOffice(NO_MATCH_OFFICE);
    await employees.search();

    await expect(employees.emptyPlaceholder).toBeVisible();
    expect(await employees.rowCount()).toBe(0);
  });
});
