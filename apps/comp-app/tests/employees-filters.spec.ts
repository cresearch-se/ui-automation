// spec: apps/comp-app/specs/employees-filters.md
// app: Consulting Comp App (comp-app) — Employees tab, top search-bar filters
//
// Data + flow VERIFIED LIVE 2026-07-06 via dump-page:
//   - The table is EMPTY on load (0 rows, empty placeholder). Data loads only after clicking Search
//     (100 rows with no filters — note the grid appears to page at 100).
//   - Rows load asynchronously after Search, so count assertions poll with expect.poll.
//   - Office options are codes (CRB, CRBE, CRCH, CRDC, CRLA, CRNY, CRSF, CRSV, CRUK).
//   - Country/Group options are: BE-Brussels, UK-United Kingdom, US-United States.

import { test, expect } from '@playwright/test';
import { EmployeesPage } from '../pages/EmployeesPage';

const OFFICE = 'CRNY';                    // New York office code
const COUNTRY = 'US-United States';
const MISMATCH_COUNTRY = 'UK-United Kingdom'; // UK country + a US office (CRNY) => no matches

const POLL = { timeout: 15_000 };

test.describe('Employees Tab — Filtering (top search bar)', () => {
  let employees: EmployeesPage;

  test.beforeEach(async ({ page }) => {
    employees = new EmployeesPage(page);
    await employees.goto();
  });

  // 1. Default load is empty; Search loads the employee list
  test('Default load is empty and Search loads employees', async () => {
    await expect(employees.employeesTab).toHaveAttribute('aria-selected', 'true');
    await expect(employees.emptyPlaceholder).toBeVisible();
    expect(await employees.rowCount()).toBe(0);

    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);
  });

  // 2. Filtering by a single Office returns rows that all share that office
  test('Filter by Office returns only matching rows', async () => {
    await employees.selectOffice(OFFICE);
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);

    // Format-independent check: filtering to one office => every row shows the same office value.
    const offices = (await employees.columnValues('Office')).map((o) => o.trim());
    expect(new Set(offices).size).toBe(1);
  });

  // 3. Filter by Country does not widen the result set (pages at 100, so this is a <= check)
  test('Filter by Country narrows the result set', async () => {
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);
    const allCount = await employees.rowCount();

    await employees.selectCountry(COUNTRY);
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);
    expect(await employees.rowCount()).toBeLessThanOrEqual(allCount);
  });

  // 4. Combining Country + Office applies both (AND) — all rows share the one office
  test('Combining Country and Office filters applies both', async () => {
    await employees.selectCountry(COUNTRY);
    await employees.selectOffice(OFFICE);
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);

    const offices = (await employees.columnValues('Office')).map((o) => o.trim());
    expect(new Set(offices).size).toBe(1);
  });

  // 5. Off-Cycle checkbox applies without widening the result set
  test('Off-Cycle checkbox filters the list', async () => {
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);
    const allCount = await employees.rowCount();

    await employees.toggleOffCycle();
    await employees.search();
    // Off-cycle may legitimately return zero rows, so don't assert > 0 here.
    await expect(employees.table).toBeVisible();
    expect(await employees.rowCount()).toBeLessThanOrEqual(allCount);
  });

  // 6. Clear resets the filters; re-Search restores the full list
  test('Clear resets all filters and restores the full list', async () => {
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);
    const allCount = await employees.rowCount();

    await employees.selectOffice(OFFICE);
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);
    expect(await employees.rowCount()).toBeLessThanOrEqual(allCount);

    await employees.clear();
    await employees.search(); // default state requires a Search to populate
    await expect.poll(() => employees.rowCount(), POLL).toBe(allCount);
  });

  // 7. A filter combination with no matches shows the empty state
  test('A filter with no matches shows the empty state', async () => {
    // First load real rows so we prove they disappear.
    await employees.search();
    await expect.poll(() => employees.rowCount(), POLL).toBeGreaterThan(0);

    // UK country + a US office (CRNY) => no employees match.
    await employees.selectCountry(MISMATCH_COUNTRY);
    await employees.selectOffice(OFFICE);
    await employees.search();

    await expect(employees.emptyPlaceholder).toBeVisible();
    await expect.poll(() => employees.rowCount(), POLL).toBe(0);
  });
});
