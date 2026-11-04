/**
 * Collects every failure Playwright recorded under test-results/ (one error-context.md per failed test)
 * into a single file, so it can be pasted in one go instead of opening each folder.
 *
 *   npm run gather-failures                  → test-failures.md (errors + page snapshots, call logs trimmed)
 *   npm run gather-failures -- --no-snapshot → leave the page snapshots out (shorter file)
 *   npm run gather-failures -- --full        → do not trim long call logs
 *
 * If run-log.txt exists (the terminal output of the run, saved with
 *   npx playwright test ... --reporter=list 2>&1 | Tee-Object run-log.txt
 * ) it is summarised at the top: totals, one line per test, each test's [cleanup] / teardown output, the test
 * still running when the log ended (a hang), and the last lines of the log.
 *
 * Read-only on test-results/ and run-log.txt; only writes its own output file. Node 24 runs this .mts directly.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const RESULTS_DIR = join(ROOT, 'test-results');
const RUN_LOG = join(ROOT, 'run-log.txt');
const OUTPUT = join(ROOT, 'test-failures.md');

const args = new Set(process.argv.slice(2));
const withSnapshot = !args.has('--no-snapshot');
const full = args.has('--full');
const LOG_TAIL_LINES = 30;
const MAX_ERROR_LINES = 40; // keep the head and tail of long call logs

interface Failure {
  file: string;
  modified: number;
  name: string;
  location: string;
  error: string;
  failingLine: string;
  snapshot: string;
}

function findContextFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findContextFiles(path));
    else if (entry.name === 'error-context.md') found.push(path);
  }
  return found;
}

/** Text between `# <heading>` and the next top-level `# ` heading ('' when the heading is absent). */
function section(text: string, heading: string): string {
  const start = text.indexOf(`# ${heading}`);
  if (start === -1) return '';
  const body = text.slice(start + heading.length + 2);
  const next = body.search(/^# /m);
  return (next === -1 ? body : body.slice(0, next)).trim();
}

/** The Error details section holds one or more ``` fences; drop the fences, keep the text. */
function unfence(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('```'))
    .join('\n')
    .trim();
}

function trim(error: string): string {
  const lines = error.split('\n');
  if (full || lines.length <= MAX_ERROR_LINES) return error;
  const head = lines.slice(0, 25);
  const tail = lines.slice(-10);
  return [...head, `    … ${lines.length - 35} lines omitted (use --full to keep them) …`, ...tail].join('\n');
}

/** The line Playwright marks with `>` in the test source, plus its caret/message lines. */
function failingLine(source: string): string {
  const lines = source.split('\n');
  const at = lines.findIndex((l) => /^\s*>\s*\d+\s*\|/.test(l));
  return at === -1 ? '' : lines.slice(at, at + 2).join('\n');
}

function field(info: string, label: string): string {
  const match = info.match(new RegExp(`^- ${label}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

function parse(file: string): Failure {
  const text = readFileSync(file, 'utf8');
  const info = section(text, 'Test info');
  const error = unfence(section(text, 'Error details'));
  return {
    file,
    modified: statSync(file).mtimeMs,
    name: field(info, 'Name'),
    location: field(info, 'Location'),
    // If the layout is not what we expect, keep the whole file rather than lose it.
    error: error || text.trim(),
    failingLine: failingLine(unfence(section(text, 'Test source')).replace(/^```ts\n?/, '')),
    snapshot: unfence(section(text, 'Page snapshot')),
  };
}

// ---------------------------------------------------------------------------------------------- run log

interface LoggedTest {
  status: string;
  title: string;
  /** Lines the test printed ([cleanup] ..., teardown warnings). */
  output: string[];
}

interface RunLog {
  modified: number;
  tests: LoggedTest[];
  totals: string[];
  /** Output printed after the last finished test: the test that was running when the log ended. */
  running: string[];
  tail: string[];
}

/** Windows PowerShell 5 writes Tee-Object files as UTF-16; PowerShell 7 and cmd write UTF-8. Handle both. */
function readRunLog(): RunLog | null {
  if (!existsSync(RUN_LOG)) return null;
  const buffer = readFileSync(RUN_LOG);
  const utf16 = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const text = (utf16 ? buffer.toString('utf16le') : buffer.toString('utf8'))
    .replace(/^﻿/, '')
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '') // colour codes
    .replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  // The list reporter prints a test's own output BEFORE its result line, so output belongs to the next result.
  const RESULT = /^\s*([✓✔✘✗×±-])\s+\d+\s+(.*)$/u;
  const OUTPUT_LINE = /^\s*(\[cleanup\]|Teardown could not delete)/;
  const STATUS: Record<string, string> = { '✓': 'passed', '✔': 'passed', '✘': 'FAILED', '✗': 'FAILED', '×': 'FAILED', '±': 'flaky', '-': 'skipped' };

  const tests: LoggedTest[] = [];
  let pending: string[] = [];
  let afterTeardown = false;
  for (const line of lines) {
    const result = line.match(RESULT);
    if (result) {
      tests.push({ status: STATUS[result[1]] ?? result[1], title: result[2].trim(), output: pending });
      pending = [];
      afterTeardown = false;
    } else if (OUTPUT_LINE.test(line)) {
      pending.push(line.trim());
      afterTeardown = line.includes('Teardown could not delete');
    } else if (afterTeardown && line.trim()) {
      pending.push(line.trim()); // the error text on the line after the teardown warning
      afterTeardown = false;
    }
  }

  const totals = lines.filter((l) => /^\s{0,4}\d+ (failed|passed|skipped|did not run|flaky|interrupted)\b/.test(l)).map((l) => l.trim());
  return { modified: statSync(RUN_LOG).mtimeMs, tests, totals, running: pending, tail: lines.filter((l) => l.trim()).slice(-LOG_TAIL_LINES) };
}

function runLogSection(log: RunLog, newestResult: number): string[] {
  const out: string[] = ['', '## Run log (run-log.txt)'];
  out.push(`Saved ${new Date(log.modified).toLocaleString()}`);
  if (newestResult > log.modified + 60_000) {
    out.push('**Warning: test-results/ is newer than run-log.txt — this log may be from an older run.**');
  }
  out.push('', `Totals: ${log.totals.length ? log.totals.join(' · ') : 'none found (the run did not finish, or the log is empty)'}`);
  out.push('', `### Tests finished (${log.tests.length})`);
  log.tests.forEach((t, i) => out.push(`${i + 1}. [${t.status}] ${t.title}`));

  const withOutput = log.tests.filter((t) => t.output.length);
  if (withOutput.length) {
    out.push('', '### Cleanup output per test', '```');
    for (const t of withOutput) out.push(`# ${t.title}`, ...t.output.map((l) => `  ${l}`));
    out.push('```');
  }

  if (log.running.length) {
    out.push('', '### Output after the last finished test (the test running when the log ended)', '```', ...log.running, '```');
  }
  out.push('', `### Last ${LOG_TAIL_LINES} lines of the log`, '```', ...log.tail, '```');
  return out;
}

function main() {
  const log = readRunLog();
  if (!existsSync(RESULTS_DIR) && !log) {
    console.error(`No test-results folder at ${RESULTS_DIR} and no run-log.txt — run the tests first.`);
    process.exit(1);
  }

  const failures = (existsSync(RESULTS_DIR) ? findContextFiles(RESULTS_DIR) : [])
    .map(parse)
    .sort((a, b) => a.modified - b.modified); // order the tests ran in

  const out: string[] = [
    `# Test failures (${failures.length})`,
    `Collected ${new Date().toLocaleString()} from test-results/ · snapshots ${withSnapshot ? 'included' : 'left out'} · run log ${log ? 'included' : 'not found (save one with Tee-Object run-log.txt)'}`,
    '',
    '## Summary',
    ...failures.map((f, i) => `${i + 1}. ${f.name || relative(ROOT, f.file)}`),
  ];
  if (log) out.push(...runLogSection(log, Math.max(0, ...failures.map((f) => f.modified))));

  failures.forEach((f, i) => {
    out.push('', '---', '', `## ${i + 1}. ${f.name || '(name not found)'}`);
    if (f.location) out.push(`- Location: ${f.location}`);
    out.push(`- File: ${relative(ROOT, f.file)}`, '', '### Error', '```', trim(f.error), '```');
    if (f.failingLine) out.push('', '### Failing line', '```ts', f.failingLine, '```');
    if (withSnapshot && f.snapshot) out.push('', '### Page snapshot', '```yaml', f.snapshot, '```');
  });

  writeFileSync(OUTPUT, out.join('\n') + '\n', 'utf8');
  console.log(`${failures.length} failure(s) written to ${OUTPUT}`);
  if (failures.length === 0) console.log('Nothing failed in the last run, or no error-context.md files were written.');
}

main();
