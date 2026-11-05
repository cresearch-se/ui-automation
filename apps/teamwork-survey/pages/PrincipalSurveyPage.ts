import { type Locator, type Page, expect } from '@playwright/test';
import { ReviewTabPage, type Person } from './ReviewTabPage';
import { currentSurveyPeriod } from '../data/principalSurvey.data';
import { normalize } from '../utils/text';

/** Column positions of the Principal survey table (it has two comment columns and a Rating). */
export const PRINCIPAL_COLUMN = { name: 0, period: 1, rating: 2, demonstrated: 3, improve: 4, date: 5, action: 6 } as const;

/**
 * Page Object for the "Principal Teamwork Survey" tab (`/reviews/principalteamworksurvey`).
 * Same shell as the review tabs (form + "My Submissions" table, see ReviewTabPage) with three differences: an info
 * banner on top, a mandatory Rating (1-10) and TWO comment editors (behaviors demonstrated / behaviors to improve).
 * The tab is found by its NAME, never its position: its position depends on who is logged in (4th or 5th).
 * The Principal Name dropdown is searchable and its list is NOT fixed.
 *
 * Fill rules: `rating` is the value the next fill/submit uses (set it before `createReview` / `fillAndSubmit`);
 * `setComments(text)` fills the first editor and the second one gets `${text} - improve`.
 */
export class PrincipalSurveyPage extends ReviewTabPage {
  /** Rating chosen by the next fill. */
  rating = '8';

  constructor(page: Page) {
    super(page, {
      route: 'principalteamworksurvey',
      tabName: 'Principal Teamwork Survey',
      personFieldId: 'OfficerEmpNo',
      landingRoute: 'officeheadreview',
      currentPeriod: () => currentSurveyPeriod(),
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

  /** Both editors' "CHARS / WORDS" bars, first editor first. */
  get statusBars(): Locator {
    return this.form.locator('.jodit-status-bar');
  }

  /** Every validation message shown in the form, top to bottom. */
  get errors(): Locator {
    return this.form.locator('.ant-form-item-explain-error');
  }

  async readPrincipalOptions(): Promise<string[]> {
    return this.readOptions(this.principalSelect);
  }

  async readRatingOptions(): Promise<string[]> {
    return this.readOptions(this.ratingSelect);
  }

  async selectRating(value: string) {
    await this.chooseOption(this.ratingSelect, value);
  }

  /** Replace the text of one editor (Jodit contenteditable). */
  private async setEditor(editor: Locator, text: string) {
    await editor.click();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Backspace');
    if (text) await this.page.keyboard.type(text);
    // Leave the editor so the form picks the text up before anything (Submit) validates it.
    await this.page.keyboard.press('Tab');
  }

  /** First editor: behaviors demonstrated. */
  override async setComments(text: string) {
    await this.setEditor(this.demonstratedEditor, text);
  }

  /** Second editor: behaviors to improve. */
  async setImprove(text: string) {
    await this.setEditor(this.improveEditor, text);
  }

  /** What `setComments(text)` pairs with in the second editor. */
  improveFor(text: string): string {
    return `${text} - improve`;
  }

  protected override async fillForm(person: Person, comments: string, period: string) {
    await this.selectReviewPeriod(period);
    await this.selectPerson(person);
    await this.selectRating(this.rating);
    await this.setComments(comments);
    await this.setImprove(this.improveFor(comments));
  }

  /**
   * Principals that have no review in "My Submissions" right now, in random order. Other people's (or earlier manual)
   * reviews are never touched. The list is read once and cached; it is NOT fixed, so the tests work on whoever the
   * dropdown offers today. Needs the page loaded.
   */
  private static pool: string[] | undefined;

  async randomPrincipals(count: number): Promise<Person[]> {
    PrincipalSurveyPage.pool ??= await this.readPrincipalOptions();
    const reviewed = new Set(await this.columnTexts(PRINCIPAL_COLUMN.name));
    const free = PrincipalSurveyPage.pool.filter((name) => !reviewed.has(name));
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    const picked = free.slice(0, count).map((name) => ({ name }));
    console.log(`[pick] principals for this test: ${picked.map((p) => p.name).join(' | ')}`);
    return picked;
  }

  /** Text of one cell of a row, whitespace-normalised. */
  async cellText(row: Locator, column: number): Promise<string> {
    return normalize(await this.cell(row, column).innerText());
  }

  /** The rating cell must be a whole number 1-10. */
  async expectRatingCell(row: Locator, value: string) {
    await expect(this.cell(row, PRINCIPAL_COLUMN.rating)).toHaveText(value);
  }
}
