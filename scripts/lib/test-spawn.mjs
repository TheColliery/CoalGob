// The child spawn plan of scripts/test.mjs (CWK-199's class). `node --test` spawns one child per test
// file; the heap cap rides NODE_OPTIONS in the ENV and the files run one at a time. Zone rule: CoalWorks
// dispatch-transport.md, ninth amendment (corrected 2026-10-08). Shape follows the sibling exemplar,
// CoalTipple scripts/lib/test-spawn.mjs (4156aae). A caller's own heap flag is kept as set (their cap
// wins, never doubled), in any spelling Node accepts (dash or underscore per word; measured on Node 24:
// --max_old_space_size=1024 and --max-old_space-size=1024 both give the 1024 MB cap; the space form
// `--max-old-space-size 1024` is refused by Node, so it is not matched); any other NODE_OPTIONS value is
// kept and the cap appended.
//
// NAMED DIVERGENCES from the exemplar, each with its reason:
// 1. The reason for the ENV form. The exemplar says a heap flag on the argv "would cap the runner and none
//    of the files it runs"; the ninth amendment's 2026-10-08 correction measured that false on Node 24.19:
//    the runner passes its own flag to the file processes. The ENV form is still the rule because it also
//    caps the processes a TEST ITSELF spawns when they inherit its env (measured there: 2240 MB in the env
//    against 4288 MB on the argv). NODE_OPTIONS reaches every descendant that inherits its env; a test that
//    spawns with an explicit env carries the cap only if that env names NODE_OPTIONS.
// 2. `--test-force-exit` and a whole-run deadline (RUN_DEADLINE_MS, applied by scripts/test.mjs as the
//    spawn's `timeout` with SIGKILL). A test that hangs past --test-timeout is reported failed, but the run
//    never ends without them (CoalMine 6165316); the exemplar has neither.
// 3. TEST_TIMEOUT_MS is sized from THIS room's measurement, not copied. Basis, measured 2026-10-08 on this
//    box, one file at a time: the slowest file (scripts/secret-scan.test.mjs) took 19.7 s wall and the
//    slowest single test (a tag chain longer than the bound, same file) 4.7 s; 60 s is three times the
//    slowest file. It is a per-test deadline on Node 24 and a per-file one on Node 22 (nodejs/node PR
//    #57672 landed in v24), and a synchronous block (a spawnSync that hangs) is cut by that call's own
//    `timeout`, not by this flag.
//
// RUN_DEADLINE_MS is the finite clock of the whole run: 10 minutes. Measured 2026-10-08 on this box, the
// full run of scripts/test.mjs took 47 s (the pre-commit hook's run on 2026-10-05 took 55.5 s, the first
// suite re-run that week 106 s on a busier box), so the deadline is at least five times the slowest of
// those and about thirteen times the quiet-box run.
export const TEST_TIMEOUT_MS = 60000;
export const RUN_DEADLINE_MS = 600000;
export const HEAP_FLAG = '--max-old-space-size=2048';

export function testSpawnPlan(tests, baseEnv) {
  const caller = baseEnv.NODE_OPTIONS || '';
  const nodeOptions = /(^|\s)--max[-_]old[-_]space[-_]size=/.test(caller) ? caller : `${caller} ${HEAP_FLAG}`.trim();
  return {
    args: ['--test', '--test-concurrency=1', `--test-timeout=${TEST_TIMEOUT_MS}`, '--test-force-exit', ...tests],
    env: { ...baseEnv, NODE_OPTIONS: nodeOptions },
  };
}
