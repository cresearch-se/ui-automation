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

## Conventions (fill in as the project grows)
- **Base URL / target pages:** TODO — set `use.baseURL` in `playwright.config.ts`
- **Auth:** UI flows that need login should seed auth in `tests/seed.spec.ts` or via the API
  (`request` context) — do NOT reimplement the Python framework's NTLM logic; use Playwright's
  built-in `request` fixture against the same staging API.
- **Plans live in `specs/`, tests in `tests/`** — keep that separation.

---

## Relationship to the Python framework
- Python repo: `~/QA_Automation/Code/` (git: `cresearch-se/automation`) — DB/API/Excel, pytest.
- This repo: UI only. No shared code. If you need to call an API for UI test setup, write a thin
  TS helper using Playwright's `request` context — the API contract is the shared thing, not code.
