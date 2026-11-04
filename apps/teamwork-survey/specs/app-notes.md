# Teamwork Survey / Reviews App — Application Notes

Living knowledge file about the app under test. Updated as the user shares more screens/details, so
nobody has to re-explain the app. **Source of truth for app behaviour; test plans reference this.**

> Status legend: ✅ confirmed by user/screenshot · ❓ open question / not yet described

## Scope assumptions (from user)
- **Review period rule (data-validation check):** an admin adds the period on another page. The dropdown
  must **include** the standard period **`January 01, <current year> - December 31, <current year>`**
  (e.g. 2026 → `January 01, 2026 - December 31, 2026`). ✅ **Decided 2026-10-30:** other periods are allowed
  and ignored (staging also lists `January 01, 2025 - December 31, 2025` and
  `October 01, 2026 - October 09, 2026`); the earlier "exactly one period" rule was dropped. A missing
  standard period fails the dedicated check ("admin must configure the period").
  - Compute the expected string from the current date at runtime (`currentReviewPeriod()`), don't hardcode.
  - All **other** tests use that standard period and read other options from the dropdown at runtime.
- **Review periods are managed by an admin on a separate page** (out of scope for now). For testing,
  treat **whatever options are currently in the Review Period dropdown as the valid set** — don't
  hardcode a year; read the options from the dropdown at runtime.

## Expected Office Head list (screenshots 10 & 11) ✅
The dropdown must contain **exactly these 9 entries, in exactly this order** (user confirmed order matters;
alphabetical by last name; office is shown bold in the dropdown). Tests assert the list matches — nobody
else may appear:

| # | Dropdown text | Table shows (Office Head / Office) |
|---|---------------|------------------------------------|
| 1 | `Bickford, Eric - New York` | `Bickford, Eric` / `New York` |
| 2 | `Brain, Carlos - Silicon Valley` | `Brain, Carlos` / `Silicon Valley` |
| 3 | `Leonard, Greg - London` | `Leonard, Greg` / `London` |
| 4 | `Leonard, Greg - Brussels` | `Leonard, Greg` / `Brussels` |
| 5 | `Marietta-Westberg, Jennifer - Washington D.C.` | `Marietta-Westberg, Jennifer` / `Washington D.C.` |
| 6 | `Mascari, Frank - Chicago` | `Mascari, Frank` / `Chicago` |
| 7 | `Pradhan, Ashish - Los Angeles` | `Pradhan, Ashish` / `Los Angeles` |
| 8 | `Schmirer, Gary - Boston` | `Schmirer, Gary` / `Boston` |
| 9 | `Zurek, Paul - San Francisco` | `Zurek, Paul` / `San Francisco` |

- **Greg Leonard appears twice** (London and Brussels) — ✅ confirmed: **same person, two locations**.
  Name alone is NOT a unique key; use name + office. Each location is its own entry/review.
- Offices seen: New York, Silicon Valley, London, Brussels, Washington D.C., Chicago, Los Angeles,
  Boston, San Francisco (9 offices). The Office column filter earlier listed only 4 (those with rows then).
- The logged-in user (Karumuri, Sowji) is not in the list.
- Dropdown is a long list that scrolls (screenshot 11 = the scrolled bottom: Schmirer, Zurek).

## Basics
- **Name:** Reviews (header title) — "Teamwork Survey" app.
- **Staging URL:** `https://appstaging.cornerstone.com/reviews/` (prod-style URL seen in screenshot:
  `https://apps.cornerstone.com/reviews/officeheadreview`). Tab 1 route: `/reviews/officeheadreview`.
- **Playwright project:** `teamwork-survey` (Edge, `baseURL` = `.../reviews/`).
- **Auth:** Windows integrated (NTLM, domain CRESEARCH) — handled via `httpCredentials` from
  `TEAMWORK_SURVEY_USERNAME` / `TEAMWORK_SURVEY_PASSWORD`. No setup project / storageState.
- **UI stack (looks like):** Ant Design (antd) — `-----Select-----` dropdowns, antd table with
  sort arrows + funnel filter icons, antd "No data" empty state — plus react-bootstrap-style nav tabs and
  a rich-text editor for comments. ❓ confirm via dump-page.
- Header shows the logged-in user (e.g. "Karumuri, Sowji") top-right.

## Roles & tabs
Tabs depend on who is logged in:

| Role | Tabs visible |
|------|--------------|
| Officer | **4 tabs** |
| Principal | **5 tabs** (one extra; ❓ not yet described) |

Tabs seen so far (officer view):
1. **Office Head Reviews** ✅ (described below)
2. **Practice Head Reviews** — looks like tab 1 (❓ details to come)
3. **Officer Teamwork Survey** — layout *differs* from tab 1 (❓ screenshot to come)
4. **Principal Teamwork Survey** — looks like tab 1 (❓ details to come)
5. (Principal only) ❓ unknown tab name/purpose

Default tab on load: Office Head Reviews (highlighted blue/active).

## Tab 1 — Office Head Reviews ✅
**Purpose:** a form to submit feedback/survey reviews about **Office Heads only**.

### Submission form (top panel)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Review Period | dropdown, default `----- Select -----` | yes (red *) | ✅ For **officers** the only period is `January 01, 20XX - December 31, 20XX` (current year). |
| Office Head | dropdown, default `----- Select -----` | yes (red *) | ✅ List of office heads. **Option text format (seen in screenshot 5): `Last, First - Office`** (e.g. `Marietta-Westberg, Jennifer - Washington D.C.`); the Jira note wrote it informally as `Schimmit Gary : Boston`. Last names can be hyphenated and offices can contain spaces/periods. ✅ Heads you've **already reviewed** are still listed (re-submitting triggers the "already exists" alert). |
| Comments | rich-text editor | yes (red *) | Placeholder: *"Please provide feedback regarding this individual's contributions, strength, and/or opportunities for growth."* |
| Submit | blue button | — | Below the editor |

- **Rich-text toolbar:** Bold, Italic, Underline, bullet list (dropdown), numbered list (dropdown),
  font family (dropdown), font size (dropdown), link, align left / center / right / justify.
- **Editor footer counter:** `CHARS: 0   WORDS: 0` (live character + word count). ❓ any max length?
- Labels use red `*` for required fields and a trailing colon (`Review Period :`).

### "My Submissions" table (bottom panel)
- Heading: **My Submissions**. Shows only the logged-in user's own submissions.
- Columns: **Office Head** (sort + filter), **Office** (sort + filter), **Review Period** (sort + filter),
  **Comments** (no sort/filter), **Date Submitted** (sort only), **Action**.
- Empty state: antd "No data" illustration (seen when user has no submissions).
- **Action** column: ✅ has an **Edit** button and a **Delete** button.
- ✅ **Rating column was removed recently** — it must NOT be present. (Older Jira wording mentions
  "rating"; treat that as stale. Only Comments is the editable content now.)
- ✅ **Sortable:** Office Head, Office, Review Period, Date Submitted. The arrows sort **alphabetically**
  (ascending then descending); Date Submitted presumably chronologically ❓. Review Period currently has
  only one value, so sorting it can't be meaningfully verified.
- ✅ **Filterable (funnel icon):** Review Period, Office Head, Office.
- ✅ Header names are verified against a reference screenshot (Jira image) — the expected headers are:
  Office Head, Office, Review Period, Comments, Date Submitted, Action.

### Column filter dropdown ✅ (screenshot 3 — funnel icon on Office Head)
- Clicking the funnel opens a small antd table-filter popup under the header containing:
  - **"Search in filters"** text box (type to narrow the options),
  - a **checkbox list** of the distinct values currently in the column (e.g. `Bickford, Eric`,
    `Brain, Carlos` — formatted `Last, First`, alphabetical),
  - **Reset** (greyed/disabled until something is ticked) and a blue **OK** button.
- Multi-select: tick one or more values → click **OK** → table shows only matching rows. **Reset**
  clears the filter.
- Popup renders in a `<body>` portal (antd), so locate it globally, not inside the tab panel.
- ✅ **Office** column has the same popup (screenshot 4): options `London`, `Los Angeles`, `New York`,
  `Silicon Valley` (alphabetical). Ticked row gets a light-blue highlight + blue checkmark, and
  **Reset turns active (blue)** once something is ticked.
- ❓ Option source unclear: screenshot 4 lists London/Los Angeles, which aren't among the 2 rows seen in
  screenshot 2 — either the table had more rows at that time, or options come from a fixed list
  (all offices) rather than the current rows. Verify via dump-page before asserting option lists.
- ✅ Review Period filter popup (screenshot 12) looks like the others (search, checkbox list, Reset/OK).
  In that screenshot it lists **two** options — `January 01, 2025 - December 31, 2025` and
  `January 01, 2026 - December 31, 2026` — matching the 2025 + 2026 rows in the table (so the options
  come from the **rows**, which also hints the Office filter options come from rows). User says
  in the real world only one period will show. ⇒ Tests must NOT hardcode the count: assert the options
  include the current-year period and that every option has the `Month DD, YYYY - Month DD, YYYY` format.
  (An old 2025 row can't be deleted — no Action buttons — so a 2nd option may persist.)
- ✅ **First live run (2026-10-30):** the **Review Period form dropdown** on staging lists three options —
  `January 01, 2025 - December 31, 2025`, `January 01, 2026 - December 31, 2026` and
  `October 01, 2026 - October 09, 2026`. Decision: the test only requires the standard current-year
  period to be present and ignores the others. Form labels carry a trailing colon in the UI
  (`Review Period :`, `Office Head :`, `Comments :`); the status bar reads `Chars: 6Words: 1` with no
  gap and **does not count spaces** (`hello world` → `Chars: 10  Words: 2`); the nav "Toggle navigation"
  button sits at the top-left corner of the page.
- Note: the user labelled screenshot 3 "sorting" but it shows the filter popup; **no screenshot of
  sorting yet** (sorting = the up/down arrows beside the header text).

### Filled form ✅ (screenshot 5)
- Once chosen, the dropdowns display the selected text in **bold**: `January 01, 2026 - December 31, 2026`
  and `Marietta-Westberg, Jennifer - Washington D.C.`. Review Period option format:
  `Month DD, YYYY - Month DD, YYYY`.
- Typing `sdgdfg` in Comments → counter reads **`CHARS: 6   WORDS: 1`** (counter updates live; no
  validation errors shown once fields are filled).
- Submit is a blue button below the editor.

### Submit flow ✅
1. Select Review Period, select Office Head (one not yet reviewed), enter Comments.
2. Click **Submit** → ✅ the entered data **immediately appears as a row in My Submissions** and the
   **form clears/resets** (dropdowns back to `----- Select -----`, Comments empty, counter `CHARS: 0
   WORDS: 0`). ✅ A **toast** also appears (screenshot 8) — this is the Jira "confirmation alert":
   - Text: **`Review has been successfully submitted.`**
   - Look: white card, blue "i" info icon, close **×** button, top-center under the "Reviews" header
     (antd `notification`/`message` style); auto-dismisses after a few seconds.
   - ✅ The **same toast with the same text** appears both when adding a new review and when updating an
     existing one (user confirmed).
   - Toast is rendered in a `<body>` portal and disappears on its own → assert quickly / with
     `expect(...).toBeVisible()` right after the click, not after other waits.
3. The new row's fields (Office Head, Office, Review Period, Comments, Date Submitted = today) must match
   what was entered.
- Suggested test data (from Jira): **Schimmit Gary : Boston** (✅ real dropdown format: `Schimmit, Gary - Boston` ❓ confirm).

### Mandatory-field validation ✅ (seen in screenshot 2)
- Clicking Submit with everything empty shows **inline red messages** under each field, and the two
  dropdowns get a **red border**:
  - `Review Period is required.`
  - `Office Head is required.`
  - `Comments are required.` (note: "are", not "is")
- Messages are inline text, not an alert/toast.
- ✅ **Verified by the live run (2026-11-03):** a required-field error clears as soon as the field is
  filled (on change, not only on the next Submit).

### My Submissions — what a row looks like ✅ (screenshot 2)
| Column | Example |
|--------|---------|
| Office Head | `Brain, Carlos` / `Bickford, Eric` — displayed as **`Last, First`** |
| Office | `Silicon Valley` / `New York` |
| Review Period | two lines: `January 01, 2026 -` / `December 31, 2026` |
| Comments | plain text (rich-text formatting ❓ rendered or stripped?) |
| Date Submitted | `MM/DD/YYYY` (e.g. `10/26/2026`) |
| Action | green **edit** (pencil-square) icon + red **trash** icon |

- Note the **format difference**: dropdown shows `Last, First - Office` in one string, the table shows
  `Last, First` and Office in separate columns — assertions must split the option text on ` - `
  (last separator, since names are hyphenated, e.g. `Marietta-Westberg`) to compare.
- Rows with white / light-grey zebra striping; header is dark teal-blue with white text.
- **Pagination** below the table: prev/next arrows, page number box, and a **page-size selector
  (default `30 / page`)**. With 30/page, a full run over all office heads may exceed one page — check
  count vs. page size.
- Existing staging data from manual testing (`Brain, Carlos`, `Bickford, Eric`, dated 10/26/2026) may be
  present — tests must not assume an empty table.

### Duplicate review ✅ (screenshot 6)
- It is **not a modal alert and it fires on selection, not on Submit**: as soon as the chosen Review
  Period + Office Head combination already has a review, an **inline red message** appears directly under
  the Office Head dropdown, with **Yes** (blue) and **No** (white/outline) buttons:
  > `A review already exists for the selected office head and period. Do you want to edit this review?`
- **Yes** → ✅ **loads the existing review into the form** (edit mode, same as the Action ▸ Edit icon:
  period + head disabled, existing comments prefilled; only Comments editable). Jira's "override the
  comments" = you change the comments and save.
- **No** → ✅ **nothing is loaded into the form** (existing comments are not filled in). ✅ **Verified by
  the live run (2026-11-03):** the prompt disappears after No. ❓ minor: whether the dropdown selection
  stays or resets.
- ✅ **While the prompt is up, the Submit button is disabled** (greyed out until Yes or No is clicked), and
  it stays disabled while a submission is in progress. A test that fills the form for a head that already
  has a review therefore hangs on `Submit.click()` — clear the head's current-year rows first.
- Seen with: Review Period `January 01, 2025 - December 31, 2025`, Office Head
  `Schmirer, Gary - Boston` (so **multiple review periods exist**, incl. 2025 — the earlier 2026-only
  assumption was just the data seen; Jira's "Schimmit Gary" is spelled `Schmirer, Gary` in the app).

### Two ways to edit a review ✅ (confirmed by user)
1. **Edit icon** in the Action column → form populates, period + head disabled, only Comments editable.
2. **Re-select** the same Office Head + Review Period in the normal form → inline "A review already
   exists… Do you want to edit this review?" with Yes / No → **Yes** loads that review into the form
   (edit mode), **No** loads nothing.
Both routes must be covered by tests.

### Edit behaviour ✅
- Clicking edit on a submission **populates the form** with that submission's data.
- In edit mode **Review Period and Office Head are DISABLED** (cannot change).
- **Only Comments is editable.**
- After saving, the updated comments show in My Submissions.
- ✅ The button stays **`Submit`** in edit mode (no "Update" label).
- ✅ **A `Cancel` button appears next to Submit in edit mode only** (screenshot 13; white/outline button in
  the previously empty second `.ant-space-item`; absent in normal "new review" mode). ✅ Confirmed: **Cancel
  exits edit mode and discards changes** — if you edit the comments and then click Cancel, the edits are
  NOT saved (row keeps its original comments). ✅ **Verified by the live run (2026-11-03):** after Cancel
  the form is back to blank (dropdowns `----- Select -----`, Comments empty). ❓ minor: whether a toast shows.
- ✅ In edit mode (screenshot 13) both dropdowns look **greyed out** (antd disabled: class
  `ant-select-disabled`) and show the row's values: `January 01, 2026 - December 31, 2026` and
  `Brain, Carlos - Silicon Valley` (note: the edit-mode Office Head text is `Last, First - Office`),
  Comments shows the saved text with `CHARS: 11 WORDS: 1`.
- Success toast after saving an edit: same style as the add toast (❓ exact text, likely identical).

### Delete behaviour ✅
- Delete (trash icon, Action column) opens a **confirmation dialog with `Cancel` and `OK`** buttons
  (antd Popconfirm popover: orange "!" warning icon, bold title, body text, Cancel (white) + OK (blue)).
  - **OK** → row is removed from My Submissions and a toast appears (screenshot 9, same style as the
    submit toast): **`Review has been successfully deleted.`**
  - **Cancel** → nothing deleted, row stays.
- Reference screenshot (7) was from the **survey tab**; same component, different nouns
  (`Delete Survey for the officer: Aganin, Alexander` / `Do you want to proceed to delete the survey ?`).
- ✅ **Tab 1 delete confirmation (captured DOM)** — an antd **Popconfirm** (popover anchored to the trash
  button), **not a modal** (corrects the "modal" wording above):
  - Container: `.ant-popover` > `.ant-popconfirm-inner-content`; `role="tooltip"` on `.ant-popover-inner`
    (so NOT `role=dialog`; no `.ant-modal`).
  - Title (`.ant-popconfirm-title`): **`Delete Review for the officer: Brain, Carlos`** — head shown as
    `Last, First` (no office); wording says "officer" even on this tab.
  - Description (`.ant-popconfirm-description`): **`Do you want to proceed to delete the review ?`**
    (space before `?`).
  - Buttons (`.ant-popconfirm-buttons`, small): **Cancel** (default) and **OK** (primary), orange
    `exclamation-circle` icon.
  - Locator: `page.locator('.ant-popover:not(.ant-popover-hidden)')`; buttons via
    `getByRole('button', { name: 'OK' })`. Rendered in a `<body>` portal.

### Cleanup policy ✅ (confirmed by user)
- Before the full cycle, **delete any existing current-period reviews for the 9 heads** (e.g. the
  `Brain, Carlos` and `Bickford, Eric` 2026 rows). Past-period rows (2025) have no delete button → leave them.
- After each test, delete whatever it created so the table returns to its starting state.
- ✅ **Staging is a test environment (user, 2026-11-04): it is fine to delete ANY current-year review of the
  9 heads, with or without a test tag.** `removeExistingReviewsFor(head)` runs at the start of every test
  that submits and deletes every row with a trash icon matching name + office + current period.
  The fixture teardown (`deleteRowsWithTag`) deletes only rows carrying that test's `UITEST-…` tag.
- Test comments are stamped with how far the review got: `<tag> created`, `<tag> edited via icon`,
  `<tag> edited via duplicate prompt`, `<tag> edit that gets cancelled`. A stale row on staging shows where
  its test stopped.

## Live-run findings (first full green run: 2026-11-04, 42 tests passed)
- **API** (base `https://appstaging.cornerstone.com/reviews/api/api/`): deleting a review is
  `POST DeleteOfficeHeadReview` (200, empty body); the page then refetches the table with
  `GET GetOfficeHeadMySubmissions` (200). The delete toast `Review has been successfully deleted.` means the
  server accepted the delete.
- **Table loads asynchronously.** antd can show "No data" (or no rows yet) while the submissions request is
  still in flight. A cleanup that counts rows at that moment sees nothing and skips, which left stale rows
  and made the next test's "already exists" prompt disable Submit. `waitUntilLoaded` therefore also waits
  for `networkidle` (capped at 15 s). This was the root cause of the long "Mascari/Zurek row is not
  deleted" investigation.
- **Server clock stamps Date Submitted, not the PC clock.** A review made at ~11 PM US time showed
  tomorrow's date (UTC). Tests accept either the PC date or the UTC date (`submittedDateCandidates()`).
- **Staging is slow:** saves can take over 5 s (Playwright's default expect timeout), so the
  `teamwork-survey` project uses `expect.timeout: 15 s`. Test timeouts: 90 s (data tests), 150 s (full cycle).
- **Comments field:** Jodit only updates the form when the editor loses focus; `setComments` ends with a Tab.
  Jodit's counter does not count spaces.
- **Dropdowns** are virtual lists inside `<body>` portals; a second dropdown holder stays in the DOM briefly,
  so wait for the options to be gone (count 0) after choosing an option.
- **Column filter popup:** the checkbox list renders a moment after the popup opens — wait for the first
  option before reading the list.
- **Delete popover:** `.ant-popover:not(.ant-popover-hidden)`; click `OK`, wait for the toast, then for the
  row count to drop by one.
- **Worker shutdown:** after a long data-changing run Playwright sometimes waits the full
  `worker-0 process did not exit within 300000ms` (5 min) and force-kills the worker; results are valid.
  The read-only group exits in about a minute, so the cause sits with the data-changing tests/cleanup
  code (still being narrowed down).

### Verified behaviours (by passing live tests, 2026-11-04)
Tab 1 form defaults, 4 officer tabs, three fields + labels, standard period present, 9 office heads in order,
counter, six headers, sort/filter controls on the right columns only, the three required-field errors (and
each alone), error clears on change, submit (toast + row + blank form), head stays selectable, edit by icon,
Cancel in both edit routes, duplicate prompt (shown / not shown / No / Yes), delete (Cancel keeps, OK removes +
toast + head reviewable again), past-period rows have no action buttons, sort by Office Head / Office /
Date Submitted (asc, desc), Office Head / Office / Review Period filters (search, tick, OK, Reset), two-value
filter, pagination `30 / page`, full cycle for all 9 heads.
- Caveat: the Date Submitted sort only proves anything while an older row (Brain's 2025 review, `02/24/2026`)
  is in the table — new rows all carry today's date.

### Full-coverage requirement ✅ (confirmed: all 9 heads, full cycle)
- For **all 9 heads**: submit → edit (icon) → edit (duplicate/Yes route) → delete. Not just submit.
- Applies to **this tab (Office Head Reviews)**; other tabs to be decided when described.
- (older wording below)
- Tests must **submit a review for EVERY office head in the dropdown**, then **edit and re-submit each
  one** (data-driven loop over the dropdown options).

### Behaviours still unknown (ask / verify)
- All toast + delete-confirmation texts are now known (update toast = add toast).
- ✅ The logged-in user (Karumuri, Sowji) is not in the Office Head list (the 9-entry check passes).
- ❓ Table default sort.
- ❓ Office / Review Period filter option source (fixed list vs the rows).
- ❓ Behaviour with more than 30 rows (needs 31 reviews; not automated).
- ❓ Toast auto-dismiss timing and the × button; Reset disabled until a value is ticked; form blank after
  saving an edit (no tests for these yet).
- ❓ Cleanup: tests create data on staging — delete rows at the end (Delete flow) to stay re-runnable.

## Tabs 2 & 4 (Practice Head Reviews, Principal Teamwork Survey)
Described as "look alike the first tab" — presumably same form/table pattern with different
dropdown label (Practice Head / Principal) and data. ❓ Awaiting details; do **not** assume identical.

## Tab 3 — Officer Teamwork Survey
Layout is different from tab 1. ❓ Awaiting screenshot.

## DOM facts for locators (pasted from the live page, tab 1, 2026-10-29) ✅
**Stack:** React + react-router + react-bootstrap navbar/tabs, **Ant Design Form/Select/Table**, and the
**Jodit** rich-text editor (NOT Quill). antd CSS-in-JS class `css-98ntnt` is generated — never select on it.
**antd/rc-select ids like `rc_select_17` are dynamic — never use them.**

**Navbar / tabs**
- Tabs are **plain links, not `role=tab`**: `#navTabs` → `.nav-item > a.nav-link` with
  `data-rr-ui-event-key` + `href`: `officeheadreview`, `paheadreview`, `officerteamworksurvey`,
  `principalteamworksurvey` (all under `/reviews/`). Active tab has class `active`. Locate with
  `page.locator('#navTabs').getByRole('link', { name: 'Office Head Reviews' })`. Tabs are separate
  **routes** (tab click = navigation, not just a pane switch).
- Header: brand link "Reviews" (`a.navbar-brand`), logged-in user in `span.navbar-text` (`Karumuri, Sowji`).
- Hamburger menu (`button.navbar-toggler`, aria-label "Toggle navigation") opens an offcanvas with links
  **Home**, **Impersonate** (`/reviews/impersonate`), **Admin** (`/reviews/admin`). Admin = where the
  review period is managed (out of scope). Impersonate ❓ lets you act as another user (maybe how to see
  the principal's 5th tab) — ask later.

**Form** (`form.ant-form`, each field is an `.ant-form-item` with a `<label for=…>`)
| Field | Label `for` | Notes |
|-------|-------------|-------|
| Review Period | `ReviewYear` | wrapper `div#ReviewYear` (has attr `select="2026"`) around an antd Select; selected text in `.ant-select-selection-item` (also `title=` the full text) |
| Office Head | `OfficerEmpNo` | antd Select with extra class `CustomSelect` |
| Rating | `ReviewRating` | **in the DOM but hidden** (`.ant-form-item-hidden`, value `0`) — leftover; tests assert it is NOT visible |
| Comments | `Review` | Jodit editor; the real field is a hidden `textarea#Review` holding **HTML** (`<p>sdgdfg</p>`) |
- **Selects are not searchable** (`input[readonly]`) — you can't type to filter; open and click an option.
- Select locator idea: `page.locator('.ant-form-item', { has: page.locator('label[for="OfficerEmpNo"]') }).locator('.ant-select')`.
- **Office Head option text** in the DOM has odd spacing/markup: `<span>Bickford, Eric   -  <span style="font-weight:600"> New York</span></span>`
  → `innerText` ≈ `Bickford, Eric   -   New York` (3 spaces before the dash, extra spaces after).
  **Normalise whitespace** (`.replace(/\s+/g,' ')`) before comparing to `Bickford, Eric - New York`.
  The option's underlying value (visible only in the a11y listbox) looks like `EmpNo-OfficeCode`
  (e.g. `1373-CRBE`, `5930-CRDC`, `5250-CRCH`) — not needed for tests.
- Option list is **virtual** (rc-virtual-list): 9 items need ~288px but max-height is 256px, so the list
  **scrolls** and not all options are in the DOM at once → scroll `.rc-virtual-list-holder` to read all 9.
- Dropdown panels render in `<body>` portals **outside `#root`**: `.ant-select-dropdown` (hidden ones keep
  class `ant-select-dropdown-hidden`) → use `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option`.
- **Comments / Jodit:** type into `.jodit-wysiwyg[contenteditable="true"]` (an inner `<p>` is created). Counter is in
  `.jodit-status-bar` as two spans `Chars: 6` and `Words: 1` (CSS uppercases them on screen →
  assert case-insensitively, DOM text is `Chars: N` / `Words: N`). Placeholder text is not in this DOM
  snapshot (editor held text) ❓. Toolbar buttons expose `aria-label`s: **Bold, Italic, Underline,
  Insert Unordered List, Insert Ordered List, Font family, Font size, Insert link, Align Left,
  Align Center, Align Right, Align Justify** (so the earlier "font colour" button is actually **Font family**).
  Jodit also has a hidden source-code (Ace) mode and a "Powered by Jodit" link.
- **Submit:** `button.ant-btn-primary` with text `Submit` (inside `.ant-space`). The `.ant-space` has a
  **second, empty `.ant-space-item`** next to Submit — probably where a Cancel/other button is rendered
  conditionally (e.g. in edit mode) ❓ look for it in edit mode.

**My Submissions table** (`.ant-table.ant-table-bordered`; heading `h4` "My Submissions")
- Column widths: Office Head 200, Office 110, Review Period 145, Comments 500, Date Submitted 150, Action 80.
- `th[aria-label]` exists only for the sortable columns: `Office Head`, `Office`, `Review Period`,
  `Date Submitted`. **Comments and Action `th` have no aria-label and no sorter** (locate by text).
- Sorting: `th.ant-table-column-has-sorters` containing `.ant-table-column-sorter-up/down` carets (click the
  header to cycle none → asc → desc); `aria-sort` appears on the th once sorted ❓ verify.
- Filter funnel: `.ant-table-filter-trigger` (aria-label "filter") on **Office Head, Office, Review Period only**.
- Empty state: `tr.ant-table-placeholder` with `.ant-empty-description` text `No data`.
- **Data rows** (captured, 3 rows): `tbody tr.ant-table-row`; 6 `td.ant-table-cell` in column order:
  1. Office Head — plain text `Brain, Carlos`
  2. Office — plain text `Silicon Valley`
  3. Review Period — `<span>January 01, 2026 - December 31, 2026</span>` (one line in DOM; wraps on screen)
  4. Comments — `<span style="text-wrap: wrap"><p>asfsafsfsdf</p></span>` → comments are stored/rendered as
     **HTML** (`<p>…</p>`); use `innerText`/`textContent`, not the raw HTML, when comparing to typed text.
  5. Date Submitted — `10/26/2026`
  6. Action — `div.ant-space.smallButton` with two `button.ant-btn-icon-only` (no text, **no aria-label**):
     - **Edit** = first button, svg `data-icon="pen-to-square"` (green)
     - **Delete** = second button, svg `data-icon="trash-can"` (red `#f5222d`)
     → locate with `row.locator('button:has(svg[data-icon="pen-to-square"])')` / `…"trash-can"`.
- ✅ **Rows from a past review period have NO Action buttons** (3rd row: `Brain, Carlos`, period
  `January 01, 2025 - December 31, 2025`, comment `treter`, date `02/24/2026`, empty Action cell) →
  only current-period reviews are editable/deletable. The table lists **all** of the user's reviews,
  including older periods, even though the dropdown only offers the current period.
  - ⇒ Same office head can appear on several rows (different periods). Identify a row by
    head + office + period (+ unique comment text), never by head alone.
  - ⇒ ❓ The Review Period **filter** popup may therefore list 2 options (2025 and 2026) if it is built from
    the rows — conflicts with "only one option"; verify.
  - ⇒ The 2025 period in screenshot 6 was *not* just an example for the table — a real 2025 review exists
    (for Carlos Brain); but the **dropdown** still only offers the current period (per user).
- **Pagination** (`ul.ant-pagination`, rendered once rows exist): prev/next buttons (disabled with one
  page), page item `li.ant-pagination-item-active` = `1`, and a **searchable** antd select with
  `aria-label="Page Size"` showing `30 / page`. (Careful: this is an `.ant-select` outside the form —
  scope form selects to `form` / by label `for`.)
- Empty table (earlier snapshot): no rows, no pagination, `tr.ant-table-placeholder`.
- **Pre-existing staging data seen:** `Brain, Carlos` (2026 + 2025) and `Bickford, Eric` (2026). For the
  "all 9 heads" cycle these two heads already have a 2026 review → the duplicate message will show for them.

**Form defaults seen (fresh load):** Review Period selection-item shows `----- Select -----` (title
attr same), Office Head `----- Select -----`; Comments: `p><br></p>` placeholder is
`span.jodit-placeholder` = *"Please provide feedback regarding this individual's contributions, strength,
and/or opportunities for growth."*; status bar `Chars: 0` / `Words: 0`; hidden `textarea#Review` empty.

## Test-authoring notes
- Workflow is split-brain: I can't reach the app; user runs tests locally and pastes back
  `dump-page` output / `error-context.md`. `apps/teamwork-survey/tests/dump-page.spec.ts` already exists.
- **Run + report routine (Windows PowerShell):**
  `npx playwright test office-head-reviews --project=teamwork-survey --workers=1 --reporter=list 2>&1 | Tee-Object run-log.txt`
  then `npm run gather-failures` and paste `test-failures.md` (totals, per-test cleanup output, the test that
  was running if the run hung, failures with page snapshots). Optional first line:
  `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` (otherwise symbols print as `Γ£ô`; the script copes).
  Don't pass a different `--reporter` than `list` when you want the log; `-g "<text>"` selects tests by title.
- The data-changing tests share one head's review, so they run in order in one worker (`fullyParallel: false`
  on the project, no `serial` mode, so one failure does not skip the rest).
- Console lines from the code: `[cleanup] <head>: N rows on screen, M to delete`, `[cleanup] deleting …` plus
  the delete's API calls, `[cleanup] Submit disabled …` (the retry fired), `[load] … ready after Ns`, and
  `Teardown could not delete reviews tagged …`.
- Test data that submits reviews mutates staging — plan cleanup (delete own submission) or use a
  dedicated review period.
- Because tabs differ by role, tests must be tagged/guarded by role (officer vs principal).
- Prefer `getByRole('tab', { name })` for the tabs; antd dropdown options render in `<body>` portals
  (global locators). Scope table/form locators to the active tab panel to avoid strict-mode violations.

## Change log
- 2026-11-04 — First fully green run of tab 1 (42 passed). Recorded: cleanup root cause (table loads
  asynchronously), server-clock dates, delete API, stage-labelled comments, verified behaviours, run routine.
  Staging confirmed as a test environment (OK to delete any current-year review of the 9 heads).
- 2026-10-30 — First live run: 3 review periods on staging, label colons, counter format; period rule relaxed.
- 2026-10-28 — Created from tab 1 screenshot + user description.
- 2026-10-28 — Added Jira-sourced tab 1 flows: officer review period, submit/confirm, duplicate
  (Yes/No), edit, delete (Yes/No), sort/filter, rating column removed, mandatory validation, loop over all
  office heads. Jira screenshots were not visible to me — message texts still unconfirmed.
- 2026-10-28 — Screenshot 9: delete toast "Review has been successfully deleted."
- 2026-10-28 — Screenshot 8: success toast "Review has been successfully submitted." (add + update).
- 2026-10-28 — Screenshot 7: delete confirm dialog (Cancel/OK) from survey tab; replaces earlier Yes/No assumption.
- 2026-10-28 — Confirmed the 2 edit routes; test plan written: `office-head-reviews.md`.
- 2026-10-28 — Screenshot 5: filled form; corrected Office Head option format to `Last, First - Office`.
- 2026-10-28 — Screenshot 4: Office filter popup (ticked state, Reset active).
- 2026-10-28 — Screenshot 3: column filter popup (search, checkboxes, Reset/OK).
- 2026-10-28 — Screenshot 2: validation messages, row format, action icons, pagination (30/page).
