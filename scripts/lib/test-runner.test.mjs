// The room's proof of its own test runner (09a): scripts/test.mjs sends its roster through the canon scripts/lib/wave-run.mjs. wave-run.test.mjs proves wave-run; this file proves
// what is the ROOM'S: the numbers it passes, that the heap cap reaches a test file AND the process that file starts, that a file which exits 0 before its tests registered turns the
// run RED (testing.md, the TAP-names MUST: the old runner counted `# pass 1` and exit 0 as a pass), and that a *.test.mjs on disk that no one listed fails loud.
// Every fixture lives in a temp folder outside the tree and is removed after its test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(HERE, '..');
const WAVE_RUN = path.join(HERE, 'wave-run.mjs');
const TEST_MJS = path.join(SCRIPTS, 'test.mjs');
const SRC = fs.readFileSync(TEST_MJS, 'utf8');

function tmp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coalgob-runner-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// The same runner the room uses, serial so the fixture does not depend on the machine reading, with no heap flag of ours in the environment: the cap can only come from wave-run.
function waveRun(dir, files, extra = []) {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [WAVE_RUN, '--heap-mb', '2048', '--file-timeout-ms', '60000', '--deadline-ms', '120000', '--serial', ...extra, '--', ...files], { cwd: dir, encoding: 'utf8', timeout: 150000, killSignal: 'SIGKILL', env });
}

const num = (name) => Number(new RegExp(`const ${name} = (\\d+);`).exec(SRC)[1]);

test('test.mjs: the room\'s numbers are finite and ordered, and they reach wave-run as its flags', () => {
  const [heap, perTest, perFile, whole] = ['HEAP_MB', 'TEST_TIMEOUT_MS', 'FILE_CLOCK_MS', 'DEADLINE_MS'].map(num);
  assert.equal(heap, 2048);
  assert.ok(perTest >= 60000 && perTest < perFile && perFile < whole && whole <= 30 * 60 * 1000, `${perTest} < ${perFile} < ${whole}`);
  assert.match(SRC, /scripts\/lib\/wave-run\.mjs|'lib', 'wave-run\.mjs'/);
  for (const flag of ["'--heap-mb', String(HEAP_MB)", "'--file-timeout-ms', String(TEST_TIMEOUT_MS)", "'--file-clock-ms', String(FILE_CLOCK_MS)", "'--deadline-ms', String(DEADLINE_MS)"]) assert.ok(SRC.includes(flag), flag);
  assert.match(SRC, /timeout: DEADLINE_MS \+ \d+, killSignal: 'SIGKILL'/, 'the outer spawn carries a clock of its own');
});

test('the heap cap reaches a test file and the process that file starts (about 2048 MB, never the box default)', (t) => {
  const dir = tmp(t);
  fs.writeFileSync(path.join(dir, 'probe.test.mjs'), [
    "import test from 'node:test';",
    "import v8 from 'node:v8';",
    "import assert from 'node:assert/strict';",
    "import { spawnSync } from 'node:child_process';",
    "test('the cap is on the file and on its child', () => {",
    '  const mb = (n) => Math.round(n / 1048576);',
    '  const own = mb(v8.getHeapStatistics().heap_size_limit);',
    "  const r = spawnSync(process.execPath, ['-e', \"console.log(require('node:v8').getHeapStatistics().heap_size_limit)\"], { encoding: 'utf8', timeout: 30000 });",
    '  const child = mb(Number(r.stdout.trim()));',
    '  for (const v of [own, child]) assert.ok(v >= 2048 && v < 2560, `limit ${v} MB`);',
    '});',
    '',
  ].join('\n'));
  const r = waveRun(dir, ['probe.test.mjs']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /pass 1 .* GREEN/);
});

test('a file that calls process.exit(0) before its tests register makes the run RED and VACUOUS, while the same run with the exit removed is GREEN (the TAP-names MUST)', (t) => {
  const dir = tmp(t);
  const body = (exit) => ["import test from 'node:test';", ...(exit ? ['process.exit(0);'] : []), "test('a real check', () => {});", ''].join('\n');
  fs.writeFileSync(path.join(dir, 'real.test.mjs'), body(false));
  fs.writeFileSync(path.join(dir, 'quits.test.mjs'), body(true));
  // The control, and the reason for the rule: the exit code and the pass count alone call this file a pass.
  const bare = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(dir, 'quits.test.mjs')], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
  assert.equal(bare.status, 0, bare.stdout + bare.stderr);
  assert.match(bare.stdout, /# pass 1\b/);
  const green = waveRun(dir, ['real.test.mjs']);
  assert.equal(green.status, 0, green.stdout + green.stderr);
  const red = waveRun(dir, ['quits.test.mjs']);
  assert.equal(red.status, 1, 'a file that exited 0 without running a test must not pass: ' + red.stdout);
  assert.match(red.stdout, /VACUOUS quits\.test\.mjs/);
  assert.match(red.stdout, /vacuous 1 .* RED/);
});

test('test.mjs: a *.test.mjs on disk that the roster does not list fails loud and names the file', (t) => {
  const dir = tmp(t);
  const scripts = path.join(dir, 'scripts');
  fs.mkdirSync(path.join(scripts, 'lib'), { recursive: true });
  fs.copyFileSync(TEST_MJS, path.join(scripts, 'test.mjs'));
  const listed = /const TEST_FILES = \[([^\]]*)\]/.exec(SRC)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.ok(listed.includes('lib/wave-run.test.mjs'), 'the canon wave-run test runs in the ordinary roster, no second phase');
  const code = SRC.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /SEPARATE|second phase|process\.exit\(/, 'one phase in the code, and the runner ends with process.exitCode');
  assert.ok(listed.length >= 9);
  for (const f of listed) fs.writeFileSync(path.join(scripts, f), '');
  fs.writeFileSync(path.join(scripts, 'stray.test.mjs'), '');
  // A stub runner that announces itself and exits 0: if test.mjs reaches wave-run despite the stray file, the marker is printed and the status is 0, so the exit code the roster check owns cannot come from a missing module.
  const REACHED = 'WAVE-RUN-REACHED';
  fs.writeFileSync(path.join(scripts, 'lib', 'wave-run.mjs'), `console.log('${REACHED}');\n`);
  const r = spawnSync(process.execPath, [path.join(scripts, 'test.mjs')], { cwd: dir, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout, new RegExp(REACHED), 'the run stopped at the roster check and never reached wave-run');
  assert.match(r.stderr, /on disk but not listed: .*stray\.test\.mjs/);
  assert.doesNotMatch(r.stderr, /listed test file missing/);
});

test('test.mjs: a listed test file that does not exist fails loud and names the file', (t) => {
  const dir = tmp(t);
  const scripts = path.join(dir, 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(TEST_MJS, path.join(scripts, 'test.mjs'));
  const r = spawnSync(process.execPath, [path.join(scripts, 'test.mjs')], { cwd: dir, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /listed test file missing: .*parser\.test\.mjs/);
});
