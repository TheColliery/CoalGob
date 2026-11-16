// Runs the zero-dep test suite from an explicit file list - the directory form is unreliable; a missing listed file, or a *.test.mjs on disk that is not listed,
// must fail loud rather than silently run fewer tests (node/runtime.md 2). SKILL-REPO-PATTERN.md Layer 4.
//
// The roster runs through scripts/lib/wave-run.mjs, the canon runner (BB-87, adopted by blob id): one `node --test --test-reporter=tap` child per file, the next admitted only while
// a fresh reading of the machine says BREATHE, under the heap cap, a clock per test, a clock per FILE and the whole-run deadline below. The gate judges a run by the TAP each file
// prints, never by its exit code alone (testing.md, the TAP-names MUST): a file that calls process.exit(0) before its tests register exits 0 and prints "# pass 1", and wave-run
// reports it VACUOUS and the run RED. scripts/lib/test-runner.test.mjs holds the room's proof of that, of the heap cap reaching a test's own child, and of these numbers.
//
// THE ROOM'S OWN NUMBERS (never the canon's). Re-sized 2026-11-16 by the head on this box after a BREATHE, other rooms running: `node --test --test-timeout=150000 --test-force-exit scripts/secret-gate.test.mjs`
//   run alone = 47 tests, all pass, 132.8 s wall, the slowest single test 15.4 s. The same file had 18 tests and took 34.0 s on 2026-10-09, when these numbers were first set
//   (then the slowest file was scripts/secret-scan.test.mjs at 36.4 s and the slowest single test 4.7 s, one file at a time while another zone's wave ran beside it).
//   So: 400 s per test is three times the slowest file measured (132.8 s) and clears the slowest test by 26 times; 480 s per FILE stays above it and ends a hang before the
//   first test, which --test-timeout never reaches; 900 s for the whole run is about four times the sum of every file run one after another (about 216 s, the head's figure, not re-measured here);
//   the outer spawn adds 120 s, so the run is 17 minutes at most, under the timeout-minutes: 20 in ci.yml.
// On Node 22 --test-timeout is a per-FILE clock, not per test (nodejs/node PR #57672 landed in v24): the canon wave-run.test.mjs of c168392 outgrew 60 s as a file there (CI on 51c04ed), and the gate test now runs within 18 s of 150 s (132.8 s, above). So the per-test number is also the per-file clock there, 400 s, still under the 480 s file clock.
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
  'front-door-links.test.mjs',
];

const HEAP_MB = 2048;
const TEST_TIMEOUT_MS = 400000;
const FILE_CLOCK_MS = 480000;
const DEADLINE_MS = 900000;

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
