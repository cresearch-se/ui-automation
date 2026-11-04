import { type Page } from '@playwright/test';
import { ReviewTabPage } from './ReviewTabPage';

/**
 * Page Object for tab 1 — "Office Head Reviews" (`/reviews/officeheadreview`).
 * Everything generic (form, table, toasts, popovers, filters) lives in ReviewTabPage; this class only
 * says which tab/dropdown it is, and adds Office-Head wording for readability in the tests.
 */
export class OfficeHeadReviewsPage extends ReviewTabPage {
  constructor(page: Page) {
    super(page, {
      route: 'officeheadreview',
      tabName: 'Office Head Reviews',
      personFieldId: 'OfficerEmpNo',
    });
  }

  /** The Office Head dropdown (alias of the shared `personSelect`). */
  get officeHeadSelect() {
    return this.personSelect;
  }

  async readOfficeHeadOptions(): Promise<string[]> {
    return this.readOptions(this.officeHeadSelect);
  }
}
