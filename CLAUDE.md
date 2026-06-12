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
- **Browser:** Chromium (installed at `~/.cache/ms-playwright/`)
- **Deps:** `@playwright/test ^1.60.0`, `@types/node ^25.9.3` (devDependencies only; `package.json` has no `scripts`)

---

## Current State (verified 2026-06-12)

The repo is still at the **bare scaffold stage** — the planner → generator → healer loop has not yet
produced any real plans or tests.

- **Git:** single commit `c3ceee8 "Initial commit: Playwright UI test suite scaffold"`, branch `main`, clean tree.
- **`specs/`** — only `README.md` (placeholder). No test plans written yet.
- **`tests/`** — only scaffold files:
  - `example.spec.ts` — Playwright's default demo (hits `https://playwright.dev/`; safe to delete).
  - `seed.spec.ts` — empty `Test group` > `seed` test with a `// generate code here.` stub. This is the
    seed the agents start from; it does **not** set up auth or navigation yet.
- **`playwright.config.ts`** — `testDir: ./tests`, `fullyParallel: true`, reporter `html`,
  `trace: 'on-first-retry'`, one project **chromium only** (firefox/webkit/mobile/branded all commented out).
  **`baseURL` is commented out / not set** — tests must use full URLs until it's configured.
- **`.claude/settings.local.json`** — allows a set of git/gh/ssh Bash permissions (auth, config, add, commit, push, remote).
- **Agents** (`.claude/agents/*.md`) — all three run on **`model: sonnet`**; planner=green, generator=blue, healer=red.

---

## Project Structure

```
playwright-ui-tests/
├── .claude/agents/                       — the 3 Playwright agents (used via the Agent tool)
│   ├── playwright-test-planner.md        — explores a page, writes a test PLAN
│   ├── playwright-test-generator.md      — turns a plan into .spec.ts test code
│   └── playwright-test-healer.md         — re-runs failing tests and fixes them
├── .mcp.json                             — MCP config: registers the "playwright-test" server
├── specs/                                — human-readable test PLANS (markdown), written by planner
│   └── README.md
├── tests/                                — Playwright test files (.spec.ts)
│   ├── example.spec.ts                   — scaffold example (can delete)
│   └── seed.spec.ts                      — seed/environment setup the agents use as a starting point
├── playwright.config.ts                  — Playwright configuration
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
npx playwright test                      # run all tests
npx playwright test --ui                 # interactive UI mode
npx playwright test --project=chromium   # chromium only
npx playwright test example              # run a specific file
npx playwright show-report               # open last HTML report
npx playwright codegen <url>             # manual record-and-generate (non-agent)
```

Re-init / update agents (if Playwright is upgraded):
```bash
npx playwright init-agents --loop=claude
```

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
- Start on **Chromium** only. Microsoft Edge is available via a project with `channel: 'msedge'`
  (currently commented out in the config) — enable per app/project when cross-browser is wanted.

---

## Relationship to the Python framework
- Python repo: `~/QA_Automation/Code/` (git: `cresearch-se/automation`) — DB/API/Excel, pytest.
- This repo: UI only. No shared code. If you need to call an API for UI test setup, write a thin
  TS helper using Playwright's `request` context — the API contract is the shared thing, not code.
