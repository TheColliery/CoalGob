// Runs the zero-dep test suite via node --test with an explicit file list -
// the directory form is unreliable; a missing listed file must fail loud
// rather than silently running zero tests. SKILL-REPO-PATTERN.md Layer 4.
// The children get a heap cap in their ENV, run one file at a time, and live under a finite per-test
// clock plus a whole-run deadline (CWK-199's class): the plan is scripts/lib/test-spawn.mjs, so a test can read it.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));

const TEST_FILES = [
  'lib/parser.test.mjs',
  'lib/test-spawn.test.mjs',
  'secret-scan.test.mjs',
  'secret-gate.test.mjs',
  'release-notes.test.mjs',
  'verify-release-shape.test.mjs',
  'lib/release-shape.test.mjs',
  'lib/git-env-census.test.mjs',
  'git-spawn-census.test.mjs',
];

const resolved = TEST_FILES.map((f) => path.join(here, f));
for (const file of resolved) {
  if (!fs.existsSync(file)) {
    console.error(`[test] listed test file missing: ${file}`);
    process.exitCode = 1;
  }
}
if (process.exitCode === 1) process.exit(1);

const { testSpawnPlan, RUN_DEADLINE_MS } = await import(pathToFileURL(path.join(here, 'lib', 'test-spawn.mjs')).href);
const plan = testSpawnPlan(resolved, process.env);
const r = spawnSync(process.execPath, plan.args, { stdio: 'inherit', env: plan.env, timeout: RUN_DEADLINE_MS, killSignal: 'SIGKILL' });
if (r.error) console.error(`[test] the run did not finish: ${r.error.message}`);
process.exit(r.status ?? 1);
