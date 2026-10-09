// Runs the zero-dep test suite from an explicit file list - the directory form is unreliable; a missing listed file, or a *.test.mjs on disk that is not listed,
// must fail loud rather than silently run fewer tests (node/runtime.md 2). SKILL-REPO-PATTERN.md Layer 4.
//
// The roster runs through scripts/lib/wave-run.mjs, the canon runner (BB-87, adopted by blob id): one `node --test --test-reporter=tap` child per file, the next admitted only while
// a fresh reading of the machine says BREATHE, under the heap cap, a clock per test, a clock per FILE and the whole-run deadline below. The gate judges a run by the TAP each file
// prints, never by its exit code alone (testing.md, the TAP-names MUST): a file that calls process.exit(0) before its tests register exits 0 and prints "# pass 1", and wave-run
// reports it VACUOUS and the run RED. scripts/lib/test-runner.test.mjs holds the room's proof of that, of the heap cap reaching a test's own child, and of these numbers.
//
// THE ROOM'S OWN NUMBERS (never the canon's; measured 2026-10-09 on this box, one file at a time with the machine breathing, while another zone's wave ran beside it):
//   the slowest file is scripts/secret-scan.test.mjs at 36.4 s wall (19.7 s on a quiet box, 08b), the next scripts/secret-gate.test.mjs at 34.0 s and scripts/lib/wave-run.test.mjs
//   at 33.3 s; the slowest single TEST is 4.7 s (08b). So: 60 s per test is 12 times the slowest test; 180 s per FILE is five times the slowest file and ends a hang before the
//   first test, which --test-timeout never reaches; 600 s for the whole run is more than four times the sum of every file when run one after another (about 125 s: 117 s for the files timed above plus the few seconds of this runner test).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

// wave-run.test.mjs runs here like every other file: the canon test passes under the runner since the canon's K3 fix (its recorder child strips NODE_OPTIONS itself).
const TEST_FILES = [
  'lib/parser.test.mjs',
  'lib/test-runner.test.mjs',
  'lib/wave-run.test.mjs',
  'secret-scan.test.mjs',
  'secret-gate.test.mjs',
  'release-notes.test.mjs',
  'verify-release-shape.test.mjs',
  'lib/release-shape.test.mjs',
  'lib/git-env-census.test.mjs',
  'git-spawn-census.test.mjs',
];

const HEAP_MB = 2048;
const TEST_TIMEOUT_MS = 60000;
const FILE_CLOCK_MS = 180000;
const DEADLINE_MS = 600000;

const resolved = TEST_FILES.map((f) => path.join(here, f));
for (const file of resolved) {
  if (!fs.existsSync(file)) {
    console.error(`[test] listed test file missing: ${file}`);
    process.exitCode = 1;
  }
}
const listed = new Set(resolved.map((f) => path.resolve(f)));
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.test.mjs') && !listed.has(path.resolve(p))) {
      console.error(`[test] test file on disk but not listed: ${p}`);
      process.exitCode = 1;
    }
  }
})(here);

// A bad roster stops here: the exit code is set, and the messages above are flushed by the process ending on its own (node/runtime.md 7: never process.exit()).
if (process.exitCode !== 1) {
  const args = [
    path.join(here, 'lib', 'wave-run.mjs'),
    '--heap-mb', String(HEAP_MB), '--file-timeout-ms', String(TEST_TIMEOUT_MS), '--file-clock-ms', String(FILE_CLOCK_MS), '--deadline-ms', String(DEADLINE_MS),
    '--', ...TEST_FILES.map((f) => path.posix.join('scripts', f)),
  ];
  // The outer clock is the runner's deadline plus the time it needs to kill a tree and print; wave-run ends itself before this.
  const r = spawnSync(process.execPath, args, { cwd: repo, stdio: 'inherit', timeout: DEADLINE_MS + 120000, killSignal: 'SIGKILL' });
  if (r.error) console.error(`[test] the run did not finish: ${r.error.message}`);
  process.exitCode = r.status ?? 1;
}
