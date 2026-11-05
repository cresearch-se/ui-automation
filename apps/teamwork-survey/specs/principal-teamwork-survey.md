# Principal Teamwork Survey — Test Plan

App knowledge: `app-notes.md` → "Principal Teamwork Survey". Tests: `tests/principal-survey.spec.ts`.
Same flows as tabs 1-2 (`office-head-reviews.md`, `practice-head-reviews.md`); only what differs is listed here.

## Status (2026-11-05)
Written from a live dump; not yet run. Toast wording is an assumption until the first run prints it.

## Conventions
- The tab is found by **name** ("Principal Teamwork Survey"), never by position (4th or 5th depending on the login).
- The principal list is NOT fixed: tests pick principals at random from the dropdown, skipping anyone with a row on screen,
  and print the choice (`[pick] ...`). Only the shape of the list is checked.
- Review period = July 01 – June 30 of the next year containing today (`currentSurveyPeriod()`).
- Each data-changing test tags its comments (`UITEST-<ts>-<id> <stage>`); the fixture deletes rows by tag.

## 1. Page basics (read-only)
| # | Check |
|---|-------|
| 1 | Reached by tab name, active, URL `/principalteamworksurvey`, the other 3 officer tabs exist |
| 2 | Blue notice: exact wording, one link (`target=_blank`, guidance document) |
| 3 | Form defaults: all three dropdowns `----- Select -----`, both editors empty with 0 chars, Submit enabled, no Cancel |
| 4 | Exactly 5 fields with the expected labels / questions |
| 5 | Review Period contains the survey period; every option has the period format |
| 6 | Rating options 10 → 1 |
| 7 | Principal Name options look like `Last, First`, each once |
| 8 | Typing narrows the Principal Name list |
| 9 | Each editor has its own CHARS/WORDS counter |
| 10 | Table headers (7); sort arrows and funnels only where expected |
| 11 | Validation: empty Submit → 5 messages; each single missing field shows only its message; errors clear when filled |

## 2. Flows that change data
Submit (toast, row values incl. rating and both answers, blank form) · ratings 1 / 5 / 10 saved · principal stays selectable ·
Edit icon (period + principal locked, rating and answers editable and saved in place) · rating-only edit · toast × and
auto-dismiss · Cancel (icon and duplicate routes) · duplicate prompt shown / absent / No / Yes · Delete Cancel keeps, OK removes
+ toast + reviewable again · past-period rows have no Edit/Delete · sort by Principal Name, Rating (numeric), Date ·
Principal Name and Rating filters (search, tick, OK, Reset), Reset disabled until ticked, two-value filter, Review Period
filter · page size `30 / page`.

## 3. Full cycle for 5 random principals
Per principal, with a different rating each step: submit → edit via icon → edit via duplicate prompt (Yes) → delete.

## Open questions
- Toast wording for add / update / delete (verified by the first run).
- Does the Rating column sort numerically (10 after 9)? The test assumes yes; a failure would show string sorting.
