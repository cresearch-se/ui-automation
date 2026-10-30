/**
 * Collects every failure Playwright recorded under test-results/ (one error-context.md per failed test)
 * into a single file, so it can be pasted in one go instead of opening each folder.
 *
 *   npm run gather-failures                 → test-failures.md (errors only, call logs trimmed)
 *   npm run gather-failures -- --snapshot   → also include each page snapshot (long)
 *   npm run gather-failures -- --full       → do not trim long call logs
 *
 * Read-only on test-results/; only writes its own output file. Node 24 runs this .mts directly.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const RESULTS_DIR = join(ROOT, 'test-results');
const OUTPUT = join(ROOT, 'test-failures.md');

const args = new Set(process.argv.slice(2));
const withSnapshot = args.has('--snapshot');
const full = args.has('--full');
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

function main() {
  if (!existsSync(RESULTS_DIR)) {
    console.error(`No test-results folder at ${RESULTS_DIR} — run the tests first.`);
    process.exit(1);
  }

  const failures = findContextFiles(RESULTS_DIR)
    .map(parse)
    .sort((a, b) => a.modified - b.modified); // order the tests ran in

  const out: string[] = [
    `# Test failures (${failures.length})`,
    `Collected ${new Date().toLocaleString()} from test-results/ · snapshots ${withSnapshot ? 'included' : 'left out (--snapshot to add)'}`,
    '',
    '## Summary',
    ...failures.map((f, i) => `${i + 1}. ${f.name || relative(ROOT, f.file)}`),
  ];

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
