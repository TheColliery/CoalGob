// The room's git-spawn census (UMB-456 (2), 09a, narrowed at 09b): every `git` child a script of this room spawns takes its environment from the canon rule in
// scripts/lib/git-env-census.mjs, adopted by blob id; this file is the room's half: the real scripts/**/*.mjs tree, the room's pin, nothing else.
// The room has no scripts/lib/git-env.mjs: none of its spawns needs one (the unpinned scan below is the measurement), so a spawn that imports
// a gitEnv from nowhere is a finding. A pin is { rel, blob, why } and matches only while the file's blob id equals `blob`, so any edit re-arms the census on that file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanGitSpawns, collectScriptsMjs, gitBlobId } from './lib/git-env-census.mjs';

const ROOM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The one carrier whose spawns the census cannot read, pinned with its reason. It is a byte-equal copy of a house source, so the room cannot fix it room-side.
// (scripts/secret-scan.test.mjs was the second carrier until 09b: the source's new file, Bankfire bd328f2 a0319dcd, builds every child environment from named keys and reads clean with no pin.)
const PINS = [
  {
    rel: 'scripts/secret-gate.mjs',
    blob: '856956a1cca6f716e5507f6c23ac90ed34cbbe5f',
    why: 'canon secret gate (.github templates/published-code): keeps GIT_INDEX_FILE and GIT_CEILING_DIRECTORIES by design, because a commit is made from the index git names in GIT_INDEX_FILE (its gitEnv() copies process.env minus every other GIT_ name); its two spawns, scripts/secret-gate.mjs:57 and :60, are the findings. REMOVE when the canon gate builds its env from named keys',
  },
];

const files = () => collectScriptsMjs(ROOM);
const filesWithout = (rel) => files().filter((f) => f.rel !== rel);

test('every git spawn under scripts/ takes a clean environment: no findings with the room pin, and the scan reads the whole tree', () => {
  const all = files();
  const r = scanGitSpawns(all, PINS);
  assert.deepEqual(r.findings, [], 'a git child with an ambient-env reached the census; route it through gitEnv() or a named-key literal');
  assert.equal(r.exempted, PINS.length, 'the pinned file was matched by blob (a pin that matches nothing is stale)');
  assert.ok(r.files >= 15 && r.calls >= 5, `the scan is not vacuous (files ${r.files}, calls ${r.calls})`);
});

test('red-first: without the pin the same tree fails, and the findings are exactly the secret gate\'s two spawns', () => {
  const r = scanGitSpawns(files(), []);
  const byFile = {};
  for (const f of r.findings) byFile[f.split(':')[0]] = (byFile[f.split(':')[0]] || 0) + 1;
  assert.deepEqual(byFile, { 'scripts/secret-gate.mjs': 2 });
});

test('the scanner test reads clean with NO pin: its git spawns are counted and every one takes a named-key environment (the pin it needed at 09a is gone)', () => {
  const rel = 'scripts/secret-scan.test.mjs';
  const f = files().find((x) => x.rel === rel);
  assert.ok(f, `${rel} exists`);
  const r = scanGitSpawns([f], []);
  assert.deepEqual(r.findings, []);
  assert.ok(r.calls >= 5, `its spawns are counted, not skipped (calls ${r.calls})`);
  assert.equal(r.safe, r.calls, 'every counted spawn is safe');
  assert.equal(r.exempted, 0);
});

test('the pin names a file that exists, matches its blob, and is spent by one edited byte', () => {
  const all = files();
  for (const pin of PINS) {
    const f = all.find((x) => x.rel === pin.rel);
    assert.ok(f, `${pin.rel} exists`);
    assert.equal(gitBlobId(f.text), pin.blob, `${pin.rel} changed: re-read the pin's reason, then update the pin`);
    assert.ok(pin.why.length > 40, `${pin.rel} carries its reason`);
    const edited = all.map((x) => (x.rel === pin.rel ? { ...x, text: x.text + '\n// edited\n' } : x));
    assert.ok(scanGitSpawns(edited, PINS).findings.length >= 1, `one edited byte re-arms the census on ${pin.rel}`);
    assert.equal(scanGitSpawns(filesWithout(pin.rel), PINS).exempted, PINS.length - 1);
  }
});
