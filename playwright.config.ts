import { defineConfig, devices } from '@playwright/test';

/**
 * App credentials (e.g. COMP_APP_USERNAME / COMP_APP_PASSWORD — see apps/comp-app/auth.setup.ts)
 * are read from the environment. Either export them as real env vars, or install dotenv
 * (`npm i -D dotenv`) and add `import 'dotenv/config';` here to auto-load a gitignored `.env`.
 */

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* --- Consulting Comp App (comp-app) ------------------------------------------------
       Logs in once via SSO (comp-app-setup) and saves the session, then runs the comp-app
       tests against it. Run just this app with: npx playwright test --project=comp-app    */
    {
      name: 'comp-app-setup',
      testDir: './apps/comp-app',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://appstaging.cornerstone.com/consultingcomp/',
      },
    },
    {
      name: 'comp-app',
      testDir: './apps/comp-app/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://appstaging.cornerstone.com/consultingcomp/',
        storageState: 'playwright/.auth/comp-app.json',
      },
      dependencies: ['comp-app-setup'],
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
