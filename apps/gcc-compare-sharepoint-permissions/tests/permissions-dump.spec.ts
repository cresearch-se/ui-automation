import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SITES } from '../sites';

/**
 * SharePoint list/library PERMISSIONS SCRAPER (not a pass/fail test).
 *
 * For every non-hidden list/library on each site in sites.ts, this reads the permission
 * assignments straight from SharePoint's REST API (no fragile hover/click menus) and writes
 * one CSV row per principal:
 *
 *   site_url, site_title, list_title, list_id, inherited, principal_name, principal_type,
 *   principal_login, permission_levels
 *
 * `inherited` = "yes" when the list inherits permissions from its parent site (i.e. it has NO
 * unique role assignments). Even when inherited, the effective assignments are still recorded.
 *
 * PREREQUISITE: a saved session. Run the setup once (see auth.setup.ts):
 *   npx playwright test --project=gcc-sharepoint-setup
 *
 * RUN THE SCRAPE:
 *   npx playwright test --project=gcc-sharepoint
 *
 * Output CSV is written to the repo root as gcc-permissions.csv. Simple progress lines are
 * printed to the console so you can watch it work across many lists/sites.
 */

const OUTPUT_CSV = path.resolve(process.cwd(), 'gcc-permissions.csv');

// "Limited Access" is SharePoint's internal plumbing role (it's Hidden in the UI's permissions
// page). When true we strip it from each principal's levels, and drop principals left with nothing
// — so the CSV mirrors what the SharePoint permissions page actually shows. Flip to false to keep it.
const SKIP_LIMITED_ACCESS = true;
const LIMITED_ACCESS = 'Limited Access';

// SharePoint PrincipalType enum -> human label (mirrors what the SharePoint UI shows).
const PRINCIPAL_TYPE: Record<number, string> = {
  1: 'User',
  2: 'Distribution List',
  4: 'Security/Domain Group',
  8: 'SharePoint Group',
};

const CSV_HEADER = [
  'site_url',
  'site_title',
  'list_title',
  'list_id',
  'inherited',
  'principal_name',
  'principal_type',
  'principal_login',
  'permission_levels',
];

function csvCell(value: string): string {
  // Quote if the value contains a comma, quote, or newline; escape embedded quotes by doubling.
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

async function getJson(request: APIRequestContext, url: string): Promise<any> {
  const res = await request.get(url, { headers: { Accept: 'application/json;odata=nominal' } });
  if (!res.ok()) {
    throw new Error(`GET ${url} -> ${res.status()} ${res.statusText()}`);
  }
  return res.json();
}

// SharePoint OData collections come back either as a bare array (minimal metadata) or wrapped in
// { results: [...] } (verbose). Normalise both, plus a top-level { value: [...] }.
function asArray(node: any): any[] {
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.results)) return node.results;
  if (node && Array.isArray(node.value)) return node.value;
  return [];
}

test('dump SharePoint list permissions to CSV', async ({ request }) => {
  test.setTimeout(10 * 60_000);

  const rows: string[] = [CSV_HEADER.join(',')];
  let totalLists = 0;
  let totalRows = 0;

  for (const site of SITES) {
    // Site title (best-effort; fall back to the URL).
    let siteTitle = site;
    try {
      const web = await getJson(request, `${site}_api/web?$select=Title`);
      siteTitle = web.Title ?? site;
    } catch (e) {
      console.log(`! ${site} — could not read site title: ${(e as Error).message.split('\n')[0]}`);
    }

    console.log(`\n=== ${siteTitle}  (${site}) ===`);

    // All non-hidden lists/libraries on this site.
    const listsUrl =
      `${site}_api/web/lists?$select=Title,Id,Hidden,HasUniqueRoleAssignments&$filter=Hidden eq false`;
    const lists = asArray(await getJson(request, listsUrl));
    console.log(`Found ${lists.length} lists/libraries.`);

    for (let i = 0; i < lists.length; i++) {
      const list = lists[i];
      const listTitle: string = list.Title ?? '(untitled)';
      const listId: string = list.Id ?? '';
      const inherited = list.HasUniqueRoleAssignments ? 'no' : 'yes';
      totalLists++;

      const prefix = `[${i + 1}/${lists.length}] ${listTitle}`;
      try {
        const raUrl =
          `${site}_api/web/lists(guid'${listId}')/roleassignments?$expand=Member,RoleDefinitionBindings`;
        const assignments = asArray(await getJson(request, raUrl));

        let wrote = 0;
        for (const ra of assignments) {
          const member = ra.Member ?? {};
          const principalName: string = member.Title ?? '(unknown)';
          const principalLogin: string = member.LoginName ?? '';
          const principalType: string =
            PRINCIPAL_TYPE[member.PrincipalType as number] ?? `Type ${member.PrincipalType}`;

          let levels = asArray(ra.RoleDefinitionBindings)
            .map((rd: any) => rd.Name as string)
            .filter(Boolean);

          if (SKIP_LIMITED_ACCESS) {
            const meaningful = levels.filter((l) => l !== LIMITED_ACCESS);
            // A principal whose ONLY role is Limited Access is SharePoint plumbing — drop it.
            if (meaningful.length === 0) continue;
            levels = meaningful;
          }

          rows.push(
            [
              site,
              siteTitle,
              listTitle,
              listId,
              inherited,
              principalName,
              principalType,
              principalLogin,
              levels.join('; '),
            ]
              .map((c) => csvCell(String(c)))
              .join(','),
          );
          wrote++;
          totalRows++;
        }

        console.log(`${prefix} — inherited=${inherited}, ${wrote} principal(s)`);
      } catch (e) {
        console.log(`${prefix} — ERROR: ${(e as Error).message.split('\n')[0]}`);
        rows.push(
          [site, siteTitle, listTitle, listId, inherited, 'ERROR', '', '', (e as Error).message.split('\n')[0]]
            .map((c) => csvCell(String(c)))
            .join(','),
        );
      }
    }
  }

  fs.writeFileSync(OUTPUT_CSV, rows.join('\n') + '\n', 'utf-8');
  console.log(`\nDone. ${totalLists} lists across ${SITES.length} site(s), ${totalRows} permission rows.`);
  console.log(`CSV written to: ${OUTPUT_CSV}`);

  // Sanity: we should always at least have the header plus some data.
  expect(rows.length).toBeGreaterThan(1);
});
