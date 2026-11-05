import { test as base } from '@playwright/test';
import { PrincipalSurveyPage } from '../pages/PrincipalSurveyPage';
import { uniqueTag } from '../utils/text';

/**
 * `reviews` — the Principal Teamwork Survey page, already opened (login lands on the first tab, then this tab is
 *             clicked BY NAME) and loaded.
 * `tag`     — a per-test unique string; put it in the comments you create so teardown can find them.
 *
 * Teardown deletes every row carrying `tag`, even when the test failed half way, so staging is left as found. If
 * cleanup itself fails, the tag is printed so the rows can be removed by hand.
 * Same behaviour as the other tabs' fixtures (fixtures/officeHeadReviews.fixture.ts).
 */
export const test = base.extend<{ reviews: PrincipalSurveyPage; tag: string }>({
  // eslint-disable-next-line no-empty-pattern
  tag: async ({}, use) => {
    await use(uniqueTag());
  },

  reviews: async ({ page, tag }, use, testInfo) => {
    const reviews = new PrincipalSurveyPage(page);
    await reviews.goto();

    await use(reviews);

    try {
      await reviews.deleteRowsWithTag(tag, { reload: testInfo.status !== testInfo.expectedStatus });
    } catch (error) {
      console.warn(`Teardown could not delete surveys tagged "${tag}" — remove them manually.\n${error}`);
    }
  },
});

export { expect } from '@playwright/test';
