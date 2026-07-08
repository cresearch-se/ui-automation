/**
 * Sites to scan for list/library permissions.
 *
 * Each entry is a SharePoint **web** URL with a trailing slash. The scraper
 * (tests/permissions-dump.spec.ts) walks every non-hidden list/library on each
 * of these sites and records its permission assignments to a CSV.
 *
 * All sites under the same tenant (cresearch1.sharepoint.com) share one login,
 * so adding more sites here needs NO new auth — the saved storageState covers
 * the whole tenant. Just add the web URL and re-run.
 */
export const SITES: string[] = [
  'https://cresearch1.sharepoint.com/corp/facilities/',
  // Add more sites to compare, e.g.:
  // 'https://cresearch1.sharepoint.com/corp/hr/',
  // 'https://cresearch1.sharepoint.com/sites/somesite/',
];
