import { type Locator, type Page } from '@playwright/test';
import { ReviewTabPage } from './ReviewTabPage';

/**
 * Page Object for the "Principal Teamwork Survey" tab (`/reviews/principalteamworksurvey`).
 * Same shell as the review tabs (form + "My Submissions" table, see ReviewTabPage) with three differences: an info
 * banner on top, a mandatory Rating (1-10) and TWO comment editors (behaviors demonstrated / behaviors to improve).
 * The tab is found by its NAME, never its position: its position depends on who is logged in (4th or 5th).
 * The Principal Name dropdown is searchable and its list is NOT fixed.
 */
export class PrincipalSurveyPage extends ReviewTabPage {
  constructor(page: Page) {
    super(page, {
      route: 'principalteamworksurvey',
      tabName: 'Principal Teamwork Survey',
      personFieldId: 'OfficerEmpNo',
      landingRoute: 'officeheadreview',
    });
  }

  /** The Principal Name dropdown (alias of the shared `personSelect`). */
  get principalSelect() {
    return this.personSelect;
  }

  /** The blue notice above the form. */
  get banner(): Locator {
    return this.page.locator('.ant-alert-info');
  }

  /** The Rating dropdown (1-10). */
  get ratingSelect(): Locator {
    return this.form.locator('#ReviewRating .ant-select');
  }

  /** "What would you identify as the three most important teamwork behaviors ...?" editor. */
  get demonstratedEditor(): Locator {
    return this.form.locator('.jodit-wysiwyg').nth(0);
  }

  /** "What two to three behaviors or activities this person might do to improve ...?" editor. */
  get improveEditor(): Locator {
    return this.form.locator('.jodit-wysiwyg').nth(1);
  }

  async readPrincipalOptions(): Promise<string[]> {
    return this.readOptions(this.principalSelect);
  }

  async readRatingOptions(): Promise<string[]> {
    return this.readOptions(this.ratingSelect);
  }
}
