// Test data + expected texts for the Teamwork Survey "Reviews" app (tab: Principal Teamwork Survey).
// Source of truth: apps/teamwork-survey/specs/app-notes.md — change a text here, not in the tests.
// Texts are exactly what the page shows (live dump 2026-11-05; the user confirmed the screen is the source of truth).
// The list of principals is NOT fixed, so there is no principal list here: tests pick principals at random.

/**
 * The review period the survey needs: July 01 of the current fiscal year to June 30 of the next one. From July to
 * December that is this year -> next year; from January to June it started last year.
 */
export function currentSurveyPeriod(today = new Date()): string {
  const start = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1; // getMonth(): July = 6
  return `July 01, ${start} - June 30, ${start + 1}`;
}

/** The blue notice above the form, whitespace-normalised. Note the curly apostrophe in "individual’s". */
export const BANNER_TEXT =
  'For any Principal with whom you had significant direct interaction during this year, please rate this person, ' +
  '1 to 10 (1 is low; 10 is high) on his or her contributions to Teamwork at Cornerstone Research. Also, please ' +
  'comment on the individual’s contributions to (or hindrances with) good teamwork at Cornerstone Research, ' +
  'including office, expert and practice area interactions. To assist you in your assessment of teamwork, please ' +
  'reference this (non-exhaustive) list of behaviors that reflect teamwork. Examples of Behaviors That Reflect Teamwork.';
export const BANNER_LINK_TEXT = 'Examples of Behaviors That Reflect Teamwork.';
/** The link opens a SharePoint PDF in a new tab; only its target and the document name are checked. */
export const BANNER_LINK_HREF_PART = 'Teamwork%20Survey%20Guidance';

export const QUESTION_DEMONSTRATED =
  'What would you identify as the three most important teamwork behaviors this individual routinely demonstrates?';
export const QUESTION_IMPROVE =
  'What two to three behaviors or activities this person might do to improve his/her teamwork contribution?';

/** The fields on the form, top to bottom. */
export const FORM_LABELS = ['Review Period', 'Principal Name', 'Rating', QUESTION_DEMONSTRATED, QUESTION_IMPROVE];

/** Rating dropdown, in the order shown (highest first). */
export const RATING_OPTIONS = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'];

export const TABLE_HEADERS = [
  'Principal Name',
  'Review Period',
  'Rating',
  'Behaviors Demonstrated',
  'Behaviors to Improve',
  'Date Submitted',
  'Action',
];
export const SORTABLE_COLUMNS = ['Principal Name', 'Review Period', 'Rating', 'Date Submitted'];
export const FILTERABLE_COLUMNS = ['Principal Name', 'Review Period', 'Rating'];
export const UNSORTABLE_COLUMNS = ['Behaviors Demonstrated', 'Behaviors to Improve', 'Action'];

/** Dropdown option / table name: `Last, First`. */
export const PRINCIPAL_NAME_FORMAT = /^[^,]+, .+$/;

export const MESSAGES = {
  // ASSUMPTION until the first run prints the real wording ("[save]   toast: ..." in the run log): the tab says
  // "survey" in its delete popover, so the toasts probably do too.
  submitted: 'Survey has been successfully submitted.', // same toast for add and update
  deleted: 'Survey has been successfully deleted.',
  reviewPeriodRequired: 'Review Period is required.',
  principalRequired: 'Principal Name is required.',
  ratingRequired: 'Rating is required.',
  commentsRequired: 'Comments are required.', // shown once per editor
  // The app still says "office head" on this tab; the screen is the source of truth.
  duplicate: 'A review already exists for the selected office head and period. Do you want to edit this review?',
  deleteTitle: (name: string) => `Delete Survey for the officer: ${name}`,
  deleteText: 'Do you want to proceed to delete the survey ?',
  defaultPageSize: '30 / page',
} as const;
