// Test data + expected texts for the Teamwork Survey "Reviews" app (tab: Office Head Reviews).
// Source of truth: apps/teamwork-survey/specs/app-notes.md — change a text here, not in the tests.

export interface OfficeHead {
  /** As shown in the table's "Office Head" column: `Last, First`. */
  name: string;
  office: string;
}

/**
 * The ONLY people the Office Head dropdown may contain, in this exact order (confirmed by the user).
 * Greg Leonard is one person with two locations, so name alone is not a key — use name + office.
 */
export const OFFICE_HEADS: readonly OfficeHead[] = [
  { name: 'Bickford, Eric', office: 'New York' },
  { name: 'Brain, Carlos', office: 'Silicon Valley' },
  { name: 'Leonard, Greg', office: 'London' },
  { name: 'Leonard, Greg', office: 'Brussels' },
  { name: 'Marietta-Westberg, Jennifer', office: 'Washington D.C.' },
  { name: 'Mascari, Frank', office: 'Chicago' },
  { name: 'Pradhan, Ashish', office: 'Los Angeles' },
  { name: 'Schmirer, Gary', office: 'Boston' },
  { name: 'Zurek, Paul', office: 'San Francisco' },
];

export function headNamed(name: string, office?: string): OfficeHead {
  const found = OFFICE_HEADS.find((h) => h.name === name && (!office || h.office === office));
  if (!found) throw new Error(`Unknown office head in test data: ${name} ${office ?? ''}`);
  return found;
}

/** Dropdown option text (whitespace-normalised): `Last, First - Office`. */
export const optionText = (h: OfficeHead) => `${h.name} - ${h.office}`;

/** Heads used by the single-flow tests (kept apart from the heads used for sorting/filtering). */
export const FLOW_HEAD = headNamed('Mascari, Frank');
export const VALIDATION_HEAD = headNamed('Pradhan, Ashish');
export const SORT_FILTER_HEADS = [headNamed('Zurek, Paul'), headNamed('Bickford, Eric'), headNamed('Schmirer, Gary')];

/**
 * An admin enters the review period on another page; it must always be exactly Jan 01 – Dec 31 of the
 * CURRENT year. We assert this so a wrong admin entry is flagged by a failing test.
 */
export const currentReviewPeriod = (year = new Date().getFullYear()) =>
  `January 01, ${year} - December 31, ${year}`;

export const REVIEW_PERIOD_FORMAT = /^[A-Z][a-z]+ \d{2}, \d{4} - [A-Z][a-z]+ \d{2}, \d{4}$/;

export const NOT_SELECTED = '----- Select -----';

export const TAB_NAMES = [
  'Office Head Reviews',
  'Practice Head Reviews',
  'Officer Teamwork Survey',
  'Principal Teamwork Survey',
];

/** "Rating" was removed from the app and must NOT come back. */
export const TABLE_HEADERS = ['Office Head', 'Office', 'Review Period', 'Comments', 'Date Submitted', 'Action'];
export const SORTABLE_COLUMNS = ['Office Head', 'Office', 'Review Period', 'Date Submitted'];
export const FILTERABLE_COLUMNS = ['Office Head', 'Office', 'Review Period'];
export const UNSORTABLE_COLUMNS = ['Comments', 'Action'];

export const MESSAGES = {
  submitted: 'Review has been successfully submitted.', // same toast for add and update
  deleted: 'Review has been successfully deleted.',
  reviewPeriodRequired: 'Review Period is required.',
  officeHeadRequired: 'Office Head is required.',
  commentsRequired: 'Comments are required.',
  duplicate: 'A review already exists for the selected office head and period. Do you want to edit this review?',
  deleteTitle: (h: OfficeHead) => `Delete Review for the officer: ${h.name}`,
  deleteText: 'Do you want to proceed to delete the review ?',
  commentsPlaceholder:
    "Please provide feedback regarding this individual's contributions, strength, and/or opportunities for growth.",
  defaultPageSize: '30 / page',
} as const;
