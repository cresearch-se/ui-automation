# Test Plan — Comp App: Employees Tab Filtering (Top Search Bar)

**App:** Consulting Comp App ("comp app") — *Consultant Career Path and Compensation*
**URL:** `https://appstaging.cornerstone.com/consultingcomp/Home`
**Area under test:** the **Employees** tab → the top **search bar** filters (not the per-column funnel filters)
**Auth:** SSO; session seeded once via `apps/comp-app/auth.setup.ts` (storageState)
**Tests file:** `apps/comp-app/tests/employees-filters.spec.ts`
**Page Object:** `apps/comp-app/pages/EmployeesPage.ts`

> ⚠️ **Status: UNVERIFIED.** Authored offline from a static DOM snapshot because the automation host
> (AWS box) currently has no network route to the app's internal IP (`10.180.x.x`). Selectors and
> especially expected data values must be validated with a live run + healer pass once access exists.

---

## Page facts (from DOM snapshot)

**Tabs (react-bootstrap):** Employees (default), Employees Jan Cycle, Main, Comp Structure,
PRP Utilization, Performance Multipliers, But for Employees, Configuration.

**Top search bar (`.searchrow`) controls, left → right:**
- **Country** — Ant Design multi-select, placeholder "Select country"
- **Office** — antd multi-select, placeholder "Select office"
- **Group** — antd multi-select, placeholder "Select group"
- **Off-Cycle** — checkbox (label "Off-Cycle")
- **Terminated Users** — date-range picker (Start date / End date)
- **Departed from** — single select (default value `01-01-2026`)
- **Search** button, **Clear** button
- **Export to Excel** + **Refresh** icon buttons (out of scope here)

**Table:** Ant Design `.ant-table` (bordered, fixed header/columns). Relevant columns for assertions:
`Office` (visible column → lets us verify Office filtering per row), `Off-Cycle`, plus Name, Title,
Advisor, Job Levels, Perf Ratings, Status, dates, etc.

---

## Assumptions
- Starting state: logged in via SSO, Employees tab is the default active tab, table loaded with rows.
- Each scenario is independent and resets via fresh navigation (`beforeEach`).
- Expected filter values (`OFFICE`, `COUNTRY`, `NO_MATCH_OFFICE`) are placeholders in the spec marked
  `// TODO: confirm against live data` — the `<tbody>` rows were not captured offline.

---

## Scenarios

### 1. Default load shows the Employees table with rows
**Steps:** Navigate to `/Home`.
**Expected:** Employees tab is active (`aria-selected="true"`); the `.ant-table` is visible; row count > 0.

### 2. Filter by Office returns only matching rows
**Steps:** In the **Office** select, choose one office → click **Search**.
**Expected:** Every visible row's **Office** cell contains the selected office; at least one row shown.

### 3. Filter by Country narrows the result set
**Steps:** Capture default row count → choose a **Country** → **Search**.
**Expected:** Result row count ≤ default count and > 0 (table updated). (Country may not be a visible
column, so we assert on row-count change rather than per-row value.)

### 4. Combining Country + Office applies both (AND)
**Steps:** Choose a **Country**, then an **Office** → **Search**.
**Expected:** Every visible row's **Office** cell contains the selected office (both filters respected).

### 5. Off-Cycle checkbox filters to off-cycle employees
**Steps:** Tick the **Off-Cycle** checkbox → **Search**.
**Expected:** Rows are returned and each row's **Off-Cycle** cell reflects an off-cycle value.
*(TODO: confirm the truthy rendering — text "Yes" vs. an icon — against live data.)*

### 6. Clear resets all filters and restores the full list
**Steps:** Note default count → apply an Office filter + **Search** (count drops) → click **Clear**.
**Expected:** Filters cleared and the full, unfiltered list is restored (row count back to default).
*(NOTE: if the app needs a Search after Clear, the healer should add that step.)*

### 7. A filter with no matches shows the empty state
**Steps:** Choose an Office value that matches nothing → **Search**.
**Expected:** The antd empty placeholder (`.ant-table-placeholder`, "No data") is shown; row count = 0.

---

## Column funnel filters (`apps/comp-app/tests/employees-column-filters.spec.ts`)

Separate from the top search bar, many columns expose an antd **funnel** icon
(`.ant-table-filter-trigger`) that opens a per-column filter dropdown. Funnel columns observed:
Name, Title, Office, Advisor, the four Job Level columns, Job Change, Off-Cycle, the four Perf Rating
columns, and Status.

> ⚠️ Extra caveat: the funnel **dropdown internals** were not captured offline (they render in a
> portal on click), so tests target Ant Design's **default** checkbox-menu + OK/Reset structure.

### F1. Opening a column funnel shows its filter dropdown
Click a column's funnel (Status) → the `.ant-table-filter-dropdown` opens with selectable options.

### F2. Selecting a value and applying filters the column
Open Status funnel → tick a value → **OK** → every visible row's Status cell matches; funnel shows active.

### F3. Reset clears the column funnel and restores the list
Apply a Status funnel filter (count drops) → reopen → **Reset** → funnel inactive, full list restored.

### F4. Funnels on two columns combine (AND)
Apply Status funnel, then Title funnel → rows respect both columns' selected values.

### F5. A column funnel combines with a top-bar filter
Apply an Office top-bar filter + Search, then a Status funnel → rows respect both Office and Status.
