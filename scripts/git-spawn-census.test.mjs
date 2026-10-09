// The room's git-spawn census (UMB-456 (2), 09a): every `git` child a script of this room spawns takes its environment from the canon rule in
// scripts/lib/git-env-census.mjs, adopted by blob id; this file is the room's half: the real scripts/**/*.mjs tree, the room's pins, nothing else.
// The room has no scripts/lib/git-env.mjs: none of its spawns needs one (the unpinned scan below is the measurement, 09a), so a spawn that imports
// a gitEnv from nowhere is a finding. A pin is { rel, blob, why } and matches only while the file's blob id equals `blob`, so any edit re-arms the census on that file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanGitSpawns, collectScriptsMjs, gitBlobId } from './lib/git-env-census.mjs';

const ROOM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The two carriers whose spawns the census cannot read, each pinned with its reason. Both are byte-equal copies of a house source, so the room cannot fix them room-side.
const PINS = [
  {
    rel: 'scripts/secret-gate.mjs',
    blob: '856956a1cca6f716e5507f6c23ac90ed34cbbe5f',
    why: 'canon secret gate (.github templates/published-code): keeps GIT_INDEX_FILE and GIT_CEILING_DIRECTORIES by design, because a commit is made from the index git names in GIT_INDEX_FILE (its gitEnv() copies process.env minus every other GIT_ name); its two spawns, scripts/secret-gate.mjs:57 and :60, are the findings. REMOVE when the canon gate builds its env from named keys',
  },
  {
    rel: 'scripts/secret-scan.test.mjs',
    blob: 'd0db994df855ccd647f3ded878a6867bb198e196',
    why: 'Bankfire source test (D1, 09e): its gitEnv() is (envSeen = { named keys with GIT_CONFIG_NOSYSTEM }), a witness variable the census does not read, so its five git spawns (:547 :548 :715 :820 :825) are findings although the literal itself is named keys; REMOVE when the source returns the literal alone and the room re-copies the new blob',
  },
];

const files = () => collectScriptsMjs(ROOM);
const filesWithout = (rel) => files().filter((f) => f.rel !== rel);

test('every git spawn under scripts/ takes a clean environment: no findings with the room pins, and the scan reads the whole tree', () => {
  const all = files();
  const r = scanGitSpawns(all, PINS);
  assert.deepEqual(r.findings, [], 'a git child with an ambient-env reached the census; route it through gitEnv() or a named-key literal');
  assert.equal(r.exempted, PINS.length, 'both pinned files were matched by blob (a pin that matches nothing is stale)');
  assert.ok(r.files >= 15 && r.calls >= 5, `the scan is not vacuous (files ${r.files}, calls ${r.calls})`);
});

test('red-first: without the pins the same tree fails, and the findings are exactly the two carriers\' spawns (2 + 5)', () => {
  const r = scanGitSpawns(files(), []);
  const byFile = {};
  for (const f of r.findings) byFile[f.split(':')[0]] = (byFile[f.split(':')[0]] || 0) + 1;
  assert.deepEqual(byFile, { 'scripts/secret-gate.mjs': 2, 'scripts/secret-scan.test.mjs': 5 });
});

test('each pin names a file that exists, matches its blob, and is spent by one edited byte', () => {
  const all = files();
  for (const pin of PINS) {
    const f = all.find((x) => x.rel === pin.rel);
    assert.ok(f, `${pin.rel} exists`);
    assert.equal(gitBlobId(f.text), pin.blob, `${pin.rel} changed: re-read the pin's reason, then update the pin`);
    assert.ok(pin.why.length > 40, `${pin.rel} carries its reason`);
    const edited = all.map((x) => (x.rel === pin.rel ? { ...x, text: x.text + '\n// edited\n' } : x));
    assert.ok(scanGitSpawns(edited, PINS).findings.length >= 1, `one edited byte re-arms the census on ${pin.rel}`);
    assert.ok(scanGitSpawns(filesWithout(pin.rel), PINS).exempted === PINS.length - 1);
  }
});
