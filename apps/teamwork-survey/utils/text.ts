/** Small, framework-free helpers shared by the Teamwork Survey page objects and tests. */

/** Collapse runs of whitespace (the app renders `Last, First   -   Office` with extra spaces). */
export const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Today as the app prints dates: MM/DD/YYYY. */
export function todayUs(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getFullYear()}`;
}

/** Parse the app's MM/DD/YYYY into a Date (for chronological comparison). */
export function parseUsDate(value: string): Date {
  const [mm, dd, yyyy] = value.split('/').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

/** A comment/tag that is unique per test run, so a test can find (and clean up) only its own rows. */
export const uniqueTag = () => `UITEST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

/**
 * A comment that starts with the test's tag and says how far the row got ("<tag> created", "<tag> edited via icon").
 * A stale row left on staging then shows at which step its test stopped; teardown still finds it by the tag.
 */
export const stamped = (tag: string, stage: string) => `${tag} ${stage}`;

export const compareText =(a: string, b: string) => a.localeCompare(b);
export const compareUsDates = (a: string, b: string) => parseUsDate(a).getTime() - parseUsDate(b).getTime();

/** True when `values` are in order (ties allowed). */
export function isSorted<T>(values: T[], direction: 'asc' | 'desc', compare: (a: T, b: T) => number): boolean {
  return values.every((v, i) => {
    if (i === 0) return true;
    const c = compare(values[i - 1], v);
    return direction === 'asc' ? c <= 0 : c >= 0;
  });
}
