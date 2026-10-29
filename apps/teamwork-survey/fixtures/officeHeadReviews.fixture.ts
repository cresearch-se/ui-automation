import { test as base } from '@playwright/test';
import { OfficeHeadReviewsPage } from '../pages/OfficeHeadReviewsPage';
import { uniqueTag } from '../utils/text';

/**
 * `reviews` — an Office Head Reviews page, already opened and loaded.
 * `tag`     — a per-test unique string; put it in the comments you create so teardown can find them.
 *
 * Teardown deletes every row carrying `tag`, even when the test failed half way, so staging is left
 * as found. If cleanup itself fails, the tag is printed so the rows can be removed by hand.
 */
export const test = base.extend<{ reviews: OfficeHeadReviewsPage; tag: string }>({
  // eslint-disable-next-line no-empty-pattern
  tag: async ({}, use) => {
    await use(uniqueTag());
  },

  reviews: async ({ page, tag }, use) => {
    const reviews = new OfficeHeadReviewsPage(page);
    await reviews.goto();

    await use(reviews);

    try {
      await reviews.deleteRowsWithTag(tag);
    } catch (error) {
      console.warn(`Teardown could not delete reviews tagged "${tag}" — remove them manually.\n${error}`);
    }
  },
});

export { expect } from '@playwright/test';
