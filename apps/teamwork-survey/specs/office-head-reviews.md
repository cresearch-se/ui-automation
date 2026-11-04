# Office Head Reviews (Tab 1) — Test Plan

App knowledge: see [app-notes.md](app-notes.md). Role: **officer**. Project: `teamwork-survey`.
Route: `officeheadreview`.

## Status (2026-11-04)
Implemented in `tests/office-head-reviews.spec.ts` (45 tests; the first 42 were green on staging, the 3 added
2026-11-04 — toast × button and auto-dismiss (3.1), Reset disabled until a value is ticked (8.2) — plus the blank
form after saving an edit (4.4) added to the Edit-icon test, still need a first run). Not covered: >30 rows (9.2).
The former `expect.soft` ASSUMPTION checks (2.5, 4.4b, 5.2) are normal assertions now. Save calls are logged as
`[save] POST ... -> 200 (N.Ns)`. Run routine and findings: `app-notes.md`.

## Conventions for all scenarios
- **Seed:** open `officeheadreview`, wait for the Review Period dropdown and My Submissions table.
- **Review period:** other tests read the option from the dropdown at runtime (don't hardcode the year);
  only scenario 1.3 asserts the dropdown includes `January 01, <current year> - December 31, <current year>`.
- **Office head option text** = `Last, First - Office`; table shows `Last, First` + Office separately
  (split option on the last ` - `).
- **Data hygiene:** staging already has rows. Never assume an empty table. Tests that create a review
  delete it at the end. Comments are `UITEST-<id> <stage>` (`created`, `edited via icon`,
  `edited via duplicate prompt`, `edit that gets cancelled`) so teardown finds the row by the tag and a stale
  row shows where its test stopped. Staging is a test environment: the start-of-test cleanup deletes ANY
  current-year review of the head under test, tagged or not.
- **Serial where data is shared:** submit → edit → duplicate → delete flows on the same head run serially.
- ❓ = message text not yet captured; assert on role/visibility until the dump supplies exact text.

## 1. Form defaults
1.1 **Initial state:** both dropdowns show `----- Select -----`; Comments empty with placeholder
    "Please provide feedback regarding this individual's contributions, strength, and/or opportunities for
    growth."; counter `CHARS: 0  WORDS: 0`; Submit visible and enabled.
1.2 **Tabs:** officer sees exactly 4 tabs (Office Head Reviews, Practice Head Reviews, Officer Teamwork
    Survey, Principal Teamwork Survey); Office Head Reviews is active by default.
1.3 **Review period value check (flags admin errors):** the Review Period dropdown **includes** the
    standard period `January 01, <current year> - December 31, <current year>` (year computed at
    runtime). Missing → test fails with a clear message ("admin must configure the period"). Other
    periods are allowed and ignored (decided 2026-10-30: staging also lists 2025 and a short
    `October 01 - October 09, 2026` period; the earlier "exactly one" rule was dropped).
1.4 **Office Head list check:** the dropdown has exactly the 9 expected entries listed in
    app-notes.md (no more, no fewer, **same order**). Extra/missing/reordered person → fail with a diff.
    (Greg Leonard appears twice — London and Brussels — same person, two locations.)
1.5 **Comments counter:** typing `sdgdfg` → `CHARS: 6  WORDS: 1`; typing two words updates WORDS to 2.

## 2. Mandatory-field validation
2.1 Submit with everything empty → inline `Review Period is required.`, `Office Head is required.`,
    `Comments are required.`; dropdowns get red border; no row added.
2.2 Only Review Period missing → only that message shown.
2.3 Only Office Head missing → only that message shown.
2.4 Only Comments missing → only `Comments are required.` shown.
2.5 Errors clear once the field is filled. ❓ (does it clear on change or on next submit?)

## 3. Submit a review (happy path)
3.1 Choose period, an office head **not yet reviewed**, enter comments → Submit.
    - New row in My Submissions: Office Head `Last, First`, Office, Review Period, Comments, Date
      Submitted = today (`MM/DD/YYYY`).
    - Form resets (dropdowns `----- Select -----`, Comments empty, counter 0/0).
    - Toast `Review has been successfully submitted.` appears (info icon, × close button) and then
      auto-dismisses; the × closes it.
3.2 Submitted office head still appears in the dropdown afterwards (can be re-reviewed).
3.3 **Cleanup:** delete the row created (see 7).

## 4. Edit via the Action ▸ Edit icon
4.1 Click edit on a row → form populates with that row's period, head and comments.
4.2 Review Period and Office Head dropdowns are **disabled**; Comments is editable.
4.3 Change comments → click **Submit** (button label unchanged in edit mode) → success toast shown
    (❓ exact update text; add-text is `Review has been successfully submitted.`); row's Comments
    updated; other columns unchanged.
4.4 After saving, form returns to its blank, submit-new state (Cancel button gone).
4.4a In edit mode a **Cancel** button is shown next to Submit; in normal mode it is not.
4.4b **Cancel discards edits (confirmed flow):** open edit on a row → change the comments → click
     **Cancel** → the table row still shows the ORIGINAL comments; Cancel button disappears; form leaves
     edit mode (❓ assumed blank with dropdowns re-enabled). Cover this for the edit-icon route and the
     duplicate → Yes route.
4.5 No Rating field/column anywhere.

## 5. Edit via re-selecting an existing combination (duplicate review)
5.1 Select a period + office head that already has a review → **inline red message** under Office Head:
    `A review already exists for the selected office head and period. Do you want to edit this review?`
    with **Yes** and **No** buttons. (Appears on selection, before Submit.)
5.2 **No** → nothing is loaded into the form (Comments stays empty/untouched); no row added/changed.
    ❓ message dismissed? dropdown selection kept or reset?
5.3 **Yes** → form loads the existing review (same as scenario 4.1/4.2: existing comments prefilled,
    period + head disabled); change comments, save → that row's comments replaced; still a single row
    for that head + period.
5.4 Selecting a combination with **no** existing review shows no such message.

## 6. Sorting
6.1 Office Head, Office, Date Submitted headers are sortable — click arrows → rows reorder
    ascending (alphabetical), then descending (compare column text against a sorted copy; dates as
    dates). Review Period is sortable too but has only one value, so only check the control exists.
6.2 Comments and Action headers have no sort control.
6.3 **No Rating column** exists; header list is exactly: Office Head, Office, Review Period, Comments,
    Date Submitted, Action. ❓ confirm against Jira header image.
(Needs ≥2 rows with differing values — create setup rows in the test.)

## 7. Delete
7.1 Click trash icon → a confirm **popover** (antd Popconfirm, not a modal) appears with warning icon,
    title `Delete Review for the officer: <Last, First>` (e.g. `Brain, Carlos`), text
    `Do you want to proceed to delete the review ?`, and **Cancel** + **OK** buttons.
7.2 **Cancel** → dialog closes, row remains.
7.3 **OK** → dialog closes, toast `Review has been successfully deleted.` appears, row removed from
    My Submissions.
7.5 Rows from a **past review period** (e.g. 2025) show **no Edit/Delete buttons** — only current-period
    rows are actionable (needs a past-period row to exist; skip if none).
7.4 After deleting, the same period + head can be submitted fresh again (no "already exists" message).

## 8. Column filters
8.1 Office Head, Office, Review Period headers have a funnel icon; Comments, Date Submitted, Action don't.
8.2 Open Office Head filter → popup (in `<body>` portal) has "Search in filters", checkbox list, Reset
    (disabled until ticked), OK.
8.3 Tick a value → OK → only matching rows remain; the other rows hidden.
8.4 Multi-select two values → rows for both shown.
8.5 Search box narrows the checkbox list.
8.6 Reset clears the filter and restores all rows.
8.7 Same for Office. Review Period popup has the same controls; options come from the rows (can be 2025 +
    2026 or just one) — don't assert a count; assert the current-year period is present, format is valid,
    and ticking it → OK → only current-period rows remain. ❓ Office option list: fixed list vs. rows (see notes).

## 9. Pagination
9.1 Page-size selector defaults to `30 / page`; with fewer than 30 rows only page 1 exists.
9.2 ❓ Behaviour with >30 rows (matters for scenario 10).

## 10. Full coverage over every office head (data-driven)
10.1 For **each** option in the Office Head dropdown: submit a review → row appears with the right head +
     office. (One generated test per option, or a loop with `test.step`.)
10.2 For each: edit via the Edit icon → change comments → verify updated.
10.3 For each: re-select the same combination → inline "already exists" → Yes → change comments →
     save → verify updated.
10.4 Cleanup: delete all rows created. Heads that already had a row before the run: record their
     original comments and restore, or skip deletion.
Note: with >30 heads, rows span pages — use the filter/search or page-size selector to find rows.

## Open questions
- All message texts are known (add/update toast, delete toast, delete confirm, duplicate, validation).
- Resolved by the green run: the prompt is dismissed after **No**; edit mode keeps the `Submit` label and
  adds **Cancel**; the logged-in user is not in the Office Head list; the full list is the 9 heads in order.
- Still open: whether the selection is kept after **No**; default sort order of My Submissions; Office /
  Review Period filter option source (fixed list vs rows); behaviour with more than 30 rows.
