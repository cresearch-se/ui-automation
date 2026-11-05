# Practice Head Reviews (Tab 2) — Test Plan

App knowledge: `app-notes.md` → "Tab 2 — Practice Head Reviews". Tests: `tests/pa-head-reviews.spec.ts`.
Same flows as tab 1 (`office-head-reviews.md`); only what differs is listed here.

## Status (2026-11-05)
Written from a live dump of staging; not yet run green. Toast texts for add/update/delete are assumed identical to tab 1.

## Conventions
- Login lands on tab 1; the fixture opens the app and **clicks the "Practice Head Reviews" tab**.
- Every data-changing test uses its own tagged comment (`UITEST-<ts>-<id> <stage>`); the fixture deletes rows by tag.
- Before creating a review the test deletes any current-year review of that practice head (staging is a test env).
- In the shared page object `person.office` holds the practice area.

## 1. Page basics (read-only)
| # | Check |
|---|-------|
| 1 | Second tab is active, URL ends `/paheadreview`, 4 tabs shown |
| 2 | Form defaults: `----- Select -----` twice, placeholder, CHARS/WORDS 0, Submit enabled, Cancel hidden, Rating hidden |
| 3 | Exactly three fields: Review Period, Practice Area Head, Comments |
| 4 | Review Period contains the Jan 01 – Dec 31 current-year period; all options match the period format |
| 5 | Practice Area Head dropdown = the 20 expected people, in order (`Last, First - Practice Area`) |
| 6 | Typing narrows the dropdown: "Hat" → Hatzitaskos; "Sch" → Schneider, Schwartz |
| 7 | Comments counter updates (6 chars/1 word; "hello world" = 10 chars/2 words) |
| 8 | Table headers: PA Head, Practice Area, Review Period, Review, Date Submitted, Action |
| 9 | Sort arrows on PA Head / Practice Area / Review Period / Date Submitted only; funnels on the first three only |
| 10 | Validation: empty Submit shows 3 errors; each single missing field shows only its error; error clears on fill |

## 2. Flows that change data
Submit (toast, row values, blank form) · head stays selectable · Edit icon (locked fields, saves in place, toast) ·
toast × and auto-dismiss · Cancel (icon route and duplicate route) · duplicate prompt shown / not shown / No / Yes ·
Delete Cancel keeps the row, OK removes it + toast + head reviewable again · past-period rows have no Edit/Delete ·
sorting by PA Head, Practice Area, Date Submitted · PA Head and Practice Area filters (search, tick, OK, Reset) ·
Reset disabled until a value is ticked · two-value filter · Review Period filter · page size `30 / page`.

## 3. Full cycle for all 20 practice heads
Per head: submit → edit via Edit icon → edit via duplicate prompt (Yes) → delete OK.

## Open questions
- Tab 2 success/delete toast wording (assumed same as tab 1) — verified by the first run.
- Past-period rows may not exist, so that test can skip.
