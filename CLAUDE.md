# Playwright UI Test Suite — Cornerstone Research

## What this is
End-to-end **UI test automation** for Cornerstone web pages, built with **Playwright (TypeScript)** and Playwright's agentic workflow (planner → generator → healer).

This is a **separate repo** from the main Python QA framework. The Python framework lives at
`~/QA_Automation/Code/` and handles DB / API / Excel validation (pytest). The two share **no code** —
they're different languages and different domains. They share only the **API contract** (both point at the
same staging API, `appstaging.cornerstone.com`).

- **Working directory:** `~/QA_Automation/playwright-ui-tests/` (this folder = repo root)
- **Language:** TypeScript, `@playwright/test` runner
- **Node:** v24 / npm 11
- **Browsers:** Chromium + Microsoft Edge (`channel: 'msedge'`); Chromium installed at `~/.cache/ms-playwright/`
- **Deps:** `@playwright/test ^1.60.0`, `@types/node ^25.9.3` (devDependencies only; `package.json` has no `scripts`)

---

## Current State (verified 2026-07-07)

The repo has moved well past scaffold: the **first app (Comp App) has a full plan + real tests + a Page
Object**, and the config now wires up per-app projects with auth. Branch `main`, 15 commits, clean tree
(HEAD `440af23`).

- **First app under test:** **Consulting Comp App** (`apps/comp-app/`) at
  `https://appstaging.cornerstone.com/consultingcomp/`. Built with **create-react-app + Ant Design (antd)**.
  See the [[comp-app]] memory for URL/stack/access details.
- **`apps/comp-app/specs/`** — `employees-filters.md` (real plan, written for the Employees tab filters).
- **`apps/comp-app/tests/`**:
  - `employees-filters.spec.ts` — 7 tests for the top search-bar filters (Office/Country/Group, Off-Cycle,
    Clear, empty state). Data + flow **verified live 2026-07-06** via dump-page.
  - `employees-column-filters.spec.ts` — per-column funnel filter tests.
  - `dump-page.spec.ts` — a **utility spec** (not a real test) that dumps the live DOM / filter option
    data so I can author selectors offline. Key to the split-brain workflow ([[split-brain-workflow]]).
- **`apps/comp-app/pages/EmployeesPage.ts`** — Page Object for the Employees tab. Scoped to the panel root
  `#home-tabs-tabpane-employees` (react-bootstrap keeps every tab's panel mounted, so unscoped `.ant-table`
  etc. match 8+ tables → strict-mode violations). antd dropdowns render in `<body>` portals, so option
  locators are global, not panel-scoped.
- **`apps/comp-app/auth.setup.ts`** — SSO login → saves `storageState` to `playwright/.auth/comp-app.json`.
  The SSO form steps are still a **TEMPLATE** (written without seeing the live IdP); success is asserted by
  the Employees tab becoming visible. Needs `COMP_APP_USERNAME` / `COMP_APP_PASSWORD` in the env / `.env`.
- **`playwright.config.ts`** — `fullyParallel: true`, reporter `html`. Global `use`: **`trace: 'on'`**,
  `screenshot: 'only-on-failure'`, **`serviceWorkers: 'block'`** (the CRA service worker kept the browser
  alive → ~5min force-kill hang at teardown). Projects: `chromium` (leftover default, `./tests`),
  `comp-app-setup` (Edge, runs `auth.setup.ts`), `comp-app` (Chrome, depends on setup), `comp-app-edge`
  (Edge, depends on setup). Each comp-app project sets its own `baseURL` + `storageState`.
- **Leftover scaffold** in top-level `tests/`: `example.spec.ts` + `seed.spec.ts` (safe to delete; the
  stray `chromium` project still points at `./tests`).
- **Second app (branch `feat/gcc-sharepoint-permissions`):** **GCC Compare SharePoint Permissions**
  (`apps/gcc-compare-sharepoint-permissions/`). A REST-based scraper (not UI clicks) that enumerates every
  non-hidden list/library on the SharePoint sites in `sites.ts` and dumps their permission assignments to
  `gcc-permissions.csv` (gitignored). Auth is scripted/manual M365 login (headed, MFA by hand) via
  `GCC_SHAREPOINT_USERNAME` / `GCC_SHAREPOINT_PASSWORD`. Projects: `gcc-sharepoint-setup` +
  `gcc-sharepoint` (no auto-login dependency). See the [[gcc-sharepoint-permissions]] memory.
- **Agents** (`.claude/agents/*.md`) — all three run on **`model: sonnet`**; planner=green, generator=blue, healer=red.

> **Reminder — split-brain workflow:** I run on remote Linux and **cannot reach the app**; tests only run
> on the user's local **Windows**. I write/fix code; the user runs it and pastes back snapshots
> (`test-results/**/error-context.md`, `dump-page` output, or `codegen`) so I can fix locators. That's why
> `trace: 'on'` + failure screenshots are forced on. See [[split-brain-workflow]].

---

## Project Structure

```
playwright-ui-tests/
├── .claude/agents/                       — the 3 Playwright agents (used via the Agent tool)
│   ├── playwright-test-planner.md        — explores a page, writes a test PLAN
│   ├── playwright-test-generator.md      — turns a plan into .spec.ts test code
│   └── playwright-test-healer.md         — re-runs failing tests and fixes them
├── .mcp.json                             — MCP config: registers the "playwright-test" server
├── apps/
│   └── comp-app/                         — Consulting Comp App (first app under test)
│       ├── auth.setup.ts                 — SSO login → saves playwright/.auth/comp-app.json
│       ├── specs/employees-filters.md    — test PLAN for the Employees filters
│       ├── pages/EmployeesPage.ts        — Page Object for the Employees tab
│       └── tests/
│           ├── employees-filters.spec.ts        — top search-bar filter tests (7)
│           ├── employees-column-filters.spec.ts — per-column funnel filter tests
│           └── dump-page.spec.ts                 — util: dumps live DOM/data for offline authoring
│   └── gcc-compare-sharepoint-permissions/ — SharePoint list-permissions scraper (REST)
│       ├── auth.setup.ts                 — M365 login (scripted from env or manual) → storageState
│       ├── sites.ts                      — SharePoint site web URLs to scan
│       └── tests/permissions-dump.spec.ts — enumerates lists → permissions → gcc-permissions.csv
├── specs/README.md                       — placeholder (real plans live under apps/<app>/specs/)
├── tests/                                — leftover scaffold (example.spec.ts, seed.spec.ts — deletable)
├── playwright/.auth/                     — saved storageState per app (gitignored)
├── playwright.config.ts                  — Playwright configuration (per-app projects)
├── .env.example                          — template for COMP_APP_USERNAME / COMP_APP_PASSWORD
└── package.json
```

---

## The Agent Workflow (the whole point of this repo)

Three agents, each available through Claude Code's **Agent tool** (they're defined in `.claude/agents/`):

1. **planner** (`playwright-test-planner`) — Point it at a URL. It opens the page via the MCP browser,
   explores the live DOM (accessibility snapshot, not screenshots), and writes a structured **test plan**
   into `specs/`. Output is human-readable scenarios, not code.

2. **generator** (`playwright-test-generator`) — Takes a plan from `specs/` and writes real
   **`.spec.ts`** tests into `tests/`, verifying selectors against the live page as it goes.

3. **healer** (`playwright-test-healer`) — When a test fails, it re-runs it, inspects what actually
   happened in the browser, and **fixes the test** (updated selectors, waits, assertions).

Typical loop: **planner** → review the plan → **generator** → run tests → **healer** on failures.

---

## MCP Server

`.mcp.json` registers one server:

```json
{ "mcpServers": { "playwright-test": { "command": "npx", "args": ["playwright", "run-test-mcp-server"] } } }
```

This is Playwright's **built-in test MCP server** (ships with Playwright 1.60+) — NOT the separate
`@playwright/mcp` package. It gives the agents `browser_*` tools (navigate, click, type, snapshot,
network inspection) plus test-running tools. Claude Code auto-loads it when a session starts in this folder.
The agents reference these tools as `mcp__playwright-test__browser_*`.

> If MCP tools don't appear: confirm the session was launched from this directory, and approve the
> `playwright-test` server when Claude Code prompts on first use.

---

## Common Commands

```bash
npx playwright test                          # run all tests
npx playwright test --project=comp-app       # Comp App on Chrome (runs auth.setup first)
npx playwright test --project=comp-app-edge  # Comp App on Edge
npx playwright test employees-filters        # run a specific file by name
npx playwright test --ui                     # interactive UI mode (best for learning/debugging)
npx playwright test --headed                 # watch the real browser
npx playwright test --debug                  # step through with the inspector
npx playwright show-report                   # open last HTML report
npx playwright codegen <url>                 # manual record-and-generate (non-agent)
```

Re-init / update agents (if Playwright is upgraded):
```bash
npx playwright init-agents --loop=claude
```

---

## How a test run starts (lifecycle)

What actually happens on `npx playwright test --project=comp-app` (useful when coming from Selenium —
Playwright's runner owns the browser lifecycle; you never create/quit a driver):

1. **Read config** — `playwright.config.ts` resolves the `comp-app` project. It has
   `dependencies: ['comp-app-setup']`, so the dependency runs first.
2. **Auth setup runs once** — `comp-app-setup` executes `auth.setup.ts`: logs in via SSO, waits for the
   Employees tab, and saves the whole session to `playwright/.auth/comp-app.json`.
3. **Tests run authenticated** — every `comp-app` test loads `storageState` from that file, so the browser
   **boots already logged in**. No login code inside tests.
4. **Per test** — the runner spins up a fresh isolated browser context (no state bleed), injects the `page`
   fixture, runs `beforeEach` then the test body, and records a trace + failure screenshot.
5. **Report** — results land in the `html` report (`npx playwright show-report`).

Selenium → Playwright quick map: `WebDriverWait`/`ExpectedConditions` → **auto-waiting** (every action and
`expect()` retries automatically; there are no manual waits in this repo — async data uses `expect.poll`).
`driver.findElement(...)` (queries now) → **`page.locator(...)`** (lazy — queries only when acted on).
Prefer `getByRole(...)`/`getByText(...)` over CSS/XPath; fall back to antd classes (`.ant-table`,
`.ant-select`) only when there's no good role.

---

## Conventions

### Repo layout — APP-FIRST (decided 2026-06-12)
This repo tests **multiple separate web applications**. Everything for one app is co-located under
`apps/<app-name>/`. Adding a new app = copy the folder shape and add one project to the config.

```
apps/
  <app-name>/
    specs/            — test PLANS (markdown), written by the planner agent
    tests/            — .spec.ts files for this app
    pages/            — Page Objects for this app (added once duplication appears)
    auth.setup.ts     — logs into this app, saves session to playwright/.auth/<app>.json
shared/               — cross-app helpers (api request helpers, data builders, BasePage)
playwright/.auth/     — saved storageState per app (gitignored)
```

- **One Playwright project per app** in `playwright.config.ts`, each with its own `baseURL` and
  `storageState`, plus a `<app>-setup` dependency project pointing at that app's `auth.setup.ts`.
  Run a single app with `npx playwright test --project=<app-name>`.
- **Plans → `apps/<app>/specs/`, tests → `apps/<app>/tests/`** — keep that separation per app.
- Build incrementally: let the generator write flat self-contained specs first; refactor selectors
  into `pages/` only after ~3–5 tests reveal the real duplication. Don't pre-build Page Objects.

### Auth
- Log in **once per app** via `apps/<app>/auth.setup.ts` → save `storageState` → every test in that
  app's project starts authenticated. Do NOT log in inside each test.
- For data setup, use Playwright's `request` fixture against the staging API. Do NOT reimplement the
  Python framework's NTLM logic.

### Browsers
- Comp App runs on **Chrome** (`comp-app`) and **Edge** (`comp-app-edge`, `channel: 'msedge'`); the
  `comp-app-setup` auth project runs on Edge. Add more browsers per app/project as cross-browser need grows.
- Note: `auth.setup.ts` (Edge) and the `comp-app` tests (Chrome) run on different channels but share the
  same saved `storageState` — fine for cookie/token reuse. Keep this in mind if an auth quirk is
  browser-specific.

---

## Relationship to the Python framework
- Python repo: `~/QA_Automation/Code/` (git: `cresearch-se/automation`) — DB/API/Excel, pytest.
- This repo: UI only. No shared code. If you need to call an API for UI test setup, write a thin
  TS helper using Playwright's `request` context — the API contract is the shared thing, not code.
