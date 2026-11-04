import { type Page } from '@playwright/test';
import { ReviewTabPage } from './ReviewTabPage';

/**
 * Page Object for tab 2 — "Practice Head Reviews" (`/reviews/paheadreview`).
 * Same layout as tab 1 (see ReviewTabPage); it differs in wording: the person is a Practice Area Head, the dropdown
 * option is `Last, First - Practice Area`, and the table has PA Head / Practice Area / Review columns.
 * The app opens on tab 1 after login, so this page is reached by clicking the tab, like a user would.
 */
export class PracticeHeadReviewsPage extends ReviewTabPage {
  constructor(page: Page) {
    super(page, {
      route: 'paheadreview',
      tabName: 'Practice Head Reviews',
      personFieldId: 'OfficerEmpNo',
      landingRoute: 'officeheadreview',
    });
  }

  /** The Practice Area Head dropdown (alias of the shared `personSelect`). */
  get practiceHeadSelect() {
    return this.personSelect;
  }

  async readPracticeHeadOptions(): Promise<string[]> {
    return this.readOptions(this.practiceHeadSelect);
  }
}
