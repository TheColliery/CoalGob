// The test runner's child spawn plan (CWK-199's class): `node --test` spawns one child per test file, so the heap cap
// rides NODE_OPTIONS in the ENV (every descendant that inherits the env gets it, a process a test spawns with the
// inherited env included; a spawn with an explicit env carries it only if that env names NODE_OPTIONS) and the
// files run one at a time (--test-concurrency=1) under a finite per-test clock, with --test-force-exit so a run whose
// test hung past that clock still ends. Zone rule: dispatch-transport.md, ninth amendment (corrected 2026-10-08).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testSpawnPlan, HEAP_FLAG, TEST_TIMEOUT_MS, RUN_DEADLINE_MS } from './test-spawn.mjs';

const ROOM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROBE = "console.log(require('node:v8').getHeapStatistics().heap_size_limit)";
const MB = 1024 * 1024;

// Heap limit in MB as a child node reports it; the clock on the spawn is this test file's own finite deadline.
function probeMb(env, extraArgs = []) {
  const r = spawnSync(process.execPath, [...extraArgs, '-e', PROBE], { env, encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  return Number(r.stdout.trim()) / MB;
}

test('test-spawn: the argv runs the files serially under a finite per-test clock, force-exits, and lists the files after the flags', () => {
  const { args } = testSpawnPlan(['a.test.mjs', 'b.test.mjs'], {});
  assert.deepEqual(args, ['--test', '--test-concurrency=1', `--test-timeout=${TEST_TIMEOUT_MS}`, '--test-force-exit', 'a.test.mjs', 'b.test.mjs']);
});

test('test-spawn: the per-test deadline is a named, finite value above the slowest measured file and not past two minutes', () => {
  assert.ok(Number.isInteger(TEST_TIMEOUT_MS) && TEST_TIMEOUT_MS >= 60000 && TEST_TIMEOUT_MS <= 120000, String(TEST_TIMEOUT_MS));
});

test('test-spawn: the whole-run deadline is finite and longer than one per-test clock', () => {
  assert.ok(Number.isInteger(RUN_DEADLINE_MS) && RUN_DEADLINE_MS > TEST_TIMEOUT_MS && RUN_DEADLINE_MS <= 30 * 60 * 1000, String(RUN_DEADLINE_MS));
});

test('test-spawn: the env carries the heap cap for every per-file child', () => {
  const { env } = testSpawnPlan(['a.test.mjs'], { PATH: '/bin' });
  assert.equal(env.NODE_OPTIONS, HEAP_FLAG);
  assert.equal(HEAP_FLAG, '--max-old-space-size=2048');
  assert.equal(env.PATH, '/bin', 'the rest of the env passes through');
});

test('test-spawn: a caller NODE_OPTIONS without a heap flag is kept and the cap is appended', () => {
  const { env } = testSpawnPlan(['a.test.mjs'], { NODE_OPTIONS: '--no-warnings' });
  assert.equal(env.NODE_OPTIONS, '--no-warnings ' + HEAP_FLAG);
});

test('test-spawn: a caller heap flag stays as the caller set it (their cap, never clobbered, never doubled)', () => {
  const { env } = testSpawnPlan(['a.test.mjs'], { NODE_OPTIONS: '--max-old-space-size=1024 --no-warnings' });
  assert.equal(env.NODE_OPTIONS, '--max-old-space-size=1024 --no-warnings');
});

test('test-spawn: a caller heap flag spelled with underscores is the same flag: kept as set, no second cap appended', () => {
  for (const caller of ['--max_old_space_size=1024', '--max-old_space-size=1024 --no-warnings', '--no-warnings --max_old_space_size=1024']) {
    const { env } = testSpawnPlan(['a.test.mjs'], { NODE_OPTIONS: caller });
    assert.equal(env.NODE_OPTIONS, caller);
  }
});

test('test-spawn: the base env is not mutated', () => {
  const base = { NODE_OPTIONS: '--no-warnings' };
  testSpawnPlan(['a.test.mjs'], base);
  assert.deepEqual(base, { NODE_OPTIONS: '--no-warnings' });
});

test('test-spawn: a child spawned with the plan env really runs under the 2048 MB cap (heap_size_limit), unlike 1024 MB', () => {
  const capped = probeMb(testSpawnPlan(['a.test.mjs'], { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }).env);
  const small = probeMb({ ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' });
  // V8 adds a little young-generation space to the old-space cap, so compare with a band, not equality.
  assert.ok(capped >= 2048 && capped < 2048 + 512, `capped ${capped} MB`);
  assert.ok(small >= 1024 && small < 1024 + 512, `small ${small} MB`);
  assert.ok(capped > small + 512, `${capped} MB vs ${small} MB`);
});

test('test-spawn: node --test with the plan argv and env hands the cap to the FILE child (and to a process the test itself spawns)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coalgob-testspawn-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fixture = path.join(dir, 'probe.test.mjs');
  fs.writeFileSync(fixture, [
    "import test from 'node:test';",
    "import v8 from 'node:v8';",
    "import { spawnSync } from 'node:child_process';",
    "test('probe', () => {",
    "  const own = Math.round(v8.getHeapStatistics().heap_size_limit / 1048576);",
    "  const r = spawnSync(process.execPath, ['-e', " + JSON.stringify(PROBE) + "], { encoding: 'utf8', timeout: 30000 });",
    "  const grand = Math.round(Number(r.stdout.trim()) / 1048576);",
    "  console.log('PROBE ' + own + ' ' + grand);",
    '});',
    '',
  ].join('\n'));
  const plan = testSpawnPlan([fixture], { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot });
  const r = spawnSync(process.execPath, plan.args, { env: plan.env, encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const m = /PROBE (\d+) (\d+)/.exec(r.stdout);
  assert.ok(m, r.stdout);
  for (const mb of [Number(m[1]), Number(m[2])]) assert.ok(mb >= 2048 && mb < 2048 + 512, `limit ${mb} MB in ${m[0]}`);
});

test('test-spawn: --test-force-exit ends a run whose test left a handle open after finishing, and the whole-run deadline kills a hung child', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coalgob-testspawn-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fixture = path.join(dir, 'handle.test.mjs');
  fs.writeFileSync(fixture, [
    "import test from 'node:test';",
    "test('leaves a handle', () => { setInterval(() => {}, 1000); });",
    '',
  ].join('\n'));
  const plan = testSpawnPlan([fixture], { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot });
  const t0 = Date.now();
  const r = spawnSync(process.execPath, plan.args, { env: plan.env, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, 'the run ended by itself, not by the 20 s kill: ' + (r.error ? r.error.message : r.stdout));
  assert.ok(Date.now() - t0 < 20000);
  // Without the flag the same file never ends: the deadline is the only thing that stops it.
  const bare = plan.args.filter((a) => a !== '--test-force-exit');
  const hung = spawnSync(process.execPath, bare, { env: plan.env, encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
  assert.equal(hung.signal, 'SIGKILL', 'without --test-force-exit the open handle holds the run until the deadline kills it');
});

test('test-spawn: scripts/test.mjs spawns its child with the plan argv and env under the whole-run deadline (the wiring, not just the builder)', () => {
  const src = fs.readFileSync(path.join(ROOM, 'scripts', 'test.mjs'), 'utf8');
  assert.match(src, /testSpawnPlan\(resolved, process\.env\)/);
  assert.match(src, /spawnSync\(process\.execPath, plan\.args, \{[^}]*env: plan\.env/);
  assert.match(src, /timeout: RUN_DEADLINE_MS/);
  assert.match(src, /killSignal: 'SIGKILL'/);
});
