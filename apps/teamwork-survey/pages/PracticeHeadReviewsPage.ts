import { type Locator, type Page, expect } from '@playwright/test';
import { ReviewTabPage } from './ReviewTabPage';

/**
 * Page Object for tab 2 — "Practice Head Reviews" (`/reviews/paheadreview`).
 * Same layout as tab 1 (see ReviewTabPage); it differs in wording: the person is a Practice Area Head, the dropdown
 * option is `Last, First - Practice Area`, and the table has PA Head / Practice Area / Review columns.
 * The app opens on tab 1 after login, so this page is reached by clicking the tab, like a user would.
 * In the shared helpers, `person.office` is the practice area (see data/paHeadReviews.data.ts).
 */
export class PracticeHeadReviewsPage extends ReviewTabPage {
  constructor(page: Page) {
    super(page, {
      route: 'paheadreview',
      tabName: 'Practice Head Reviews',
      personFieldId: 'OfficerEmpNo',
      landingRoute: 'officeheadreview',
      duplicateText: 'A review already exists for the selected practice area head and period',
    });
  }

  /** The Practice Area Head dropdown (alias of the shared `personSelect`). */
  get practiceHeadSelect() {
    return this.personSelect;
  }

  async readPracticeHeadOptions(): Promise<string[]> {
    return this.readOptions(this.practiceHeadSelect);
  }

  /** The options of the open dropdown that are currently rendered (after typing, only the matches). */
  get openDropdownOptions(): Locator {
    return this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  }

  /** Open the Practice Area Head dropdown and type into it (this dropdown is searchable, unlike tab 1's). */
  async typeInPracticeHeadSearch(text: string) {
    await this.practiceHeadSelect.click();
    await this.page.keyboard.type(text);
  }

  /** Close the open dropdown without choosing anything. */
  async closeDropdown() {
    await this.page.keyboard.press('Escape');
    await expect(this.openDropdownOptions).toHaveCount(0);
  }
}
