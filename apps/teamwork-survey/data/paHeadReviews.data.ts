// Test data + expected texts for the Teamwork Survey "Reviews" app (tab 2: Practice Head Reviews).
// Source of truth: apps/teamwork-survey/specs/app-notes.md — change a text here, not in the tests.
// Values confirmed by a live dump of staging on 2026-11-05 (teamwork-dump/pa-head.md).

import { type OfficeHead, currentReviewPeriod } from './officeHeadReviews.data';

/**
 * Same shape as tab 1's OfficeHead so the shared page object (selectPerson, cleanup, ...) works unchanged:
 * `name` is the "Last, First" shown in the PA Head column, `office` holds the PRACTICE AREA.
 */
export type PracticeHead = OfficeHead;

/**
 * The ONLY people the Practice Area Head dropdown may contain, in this exact order (the list is fixed, confirmed by
 * the user). A name is unique here, but the practice area is kept so the option text can be built and checked.
 */
export const PRACTICE_HEADS: readonly PracticeHead[] = [
  { name: 'Hatzitaskos, Kostis', office: 'Economics' },
  { name: 'Sancheti, Sachin', office: 'Economics' },
  { name: 'Colley, Liam', office: 'Antitrust and Competition' },
  { name: 'Saravia, Celeste', office: 'Antitrust and Competition' },
  { name: 'Tsai, Joanna', office: 'Antitrust and Competition' },
  { name: 'Altuglu, Vildan', office: 'CFPL' },
  { name: 'Hussain, Samid', office: 'CFPL' },
  { name: 'Kovacheva, Penka', office: 'Life Sciences' },
  { name: 'Marriott, Zoya', office: 'Life Sciences' },
  { name: 'Older Aguilar, Dina', office: 'HealthCare' },
  { name: 'Salgado, Maria', office: 'HealthCare' },
  { name: 'Aganin, Sasha', office: 'Finance' },
  { name: 'Cao, Yan', office: 'Finance' },
  { name: 'Gilley, Sara', office: 'Securities 10b-5/11' },
  { name: 'Lacerda, Filipe', office: 'Securities 10b-5/11' },
  { name: 'Pandya, Shaama', office: 'Securities 10b-5/11' },
  { name: 'Barnes, Ronnie', office: 'Valuation, M&A and Bankruptcy' },
  { name: 'Schneider, Frank', office: 'Valuation, M&A and Bankruptcy' },
  { name: 'Schwartz, Allie', office: 'Valuation, M&A and Bankruptcy' },
  { name: 'Zurek, Paul', office: 'Valuation, M&A and Bankruptcy' },
];

export function practiceHeadNamed(name: string): PracticeHead {
  const found = PRACTICE_HEADS.find((h) => h.name === name);
  if (!found) throw new Error(`Unknown practice head in test data: ${name}`);
  return found;
}

/** Dropdown option text (whitespace-normalised): `Last, First - Practice Area`. */
export const optionText = (h: PracticeHead) => `${h.name} - ${h.office}`;

/** Heads used by the single-flow tests (kept apart from the heads used for sorting/filtering). */
export const FLOW_HEAD = practiceHeadNamed('Kovacheva, Penka');
export const VALIDATION_HEAD = practiceHeadNamed('Cao, Yan');
export const SORT_FILTER_HEADS = [
  practiceHeadNamed('Zurek, Paul'),
  practiceHeadNamed('Hatzitaskos, Kostis'),
  practiceHeadNamed('Gilley, Sara'),
];

/** Typing in the dropdown narrows it: what each search text must leave, in list order. */
export const SEARCHES = [
  { typed: 'Hat', expected: [optionText(practiceHeadNamed('Hatzitaskos, Kostis'))] },
  {
    typed: 'Sch',
    expected: [optionText(practiceHeadNamed('Schneider, Frank')), optionText(practiceHeadNamed('Schwartz, Allie'))],
  },
];

export { currentReviewPeriod };

/** The three fields on the form, top to bottom. */
export const FORM_LABELS = ['Review Period', 'Practice Area Head', 'Comments'];

/** The review table's columns, left to right (tab 2 has "Review" where tab 1 has "Comments"). */
export const TABLE_HEADERS = ['PA Head', 'Practice Area', 'Review Period', 'Review', 'Date Submitted', 'Action'];
export const SORTABLE_COLUMNS = ['PA Head', 'Practice Area', 'Review Period', 'Date Submitted'];
export const FILTERABLE_COLUMNS = ['PA Head', 'Practice Area', 'Review Period'];
export const UNSORTABLE_COLUMNS = ['Review', 'Action'];

export const MESSAGES = {
  submitted: 'Review has been successfully submitted.', // same toast for add and update
  deleted: 'Review has been successfully deleted.',
  reviewPeriodRequired: 'Review Period is required.',
  practiceHeadRequired: 'Practice Area Head is required.',
  commentsRequired: 'Comments are required.',
  duplicate:
    'A review already exists for the selected practice area head and period. Do you want to edit this review?',
  deleteTitle: (h: PracticeHead) => `Delete Review for the officer: ${h.name}`,
  deleteText: 'Do you want to proceed to delete the review ?',
  commentsPlaceholder:
    "Please provide feedback regarding this individual's contributions, strength, and/or opportunities for growth.",
  defaultPageSize: '30 / page',
} as const;
