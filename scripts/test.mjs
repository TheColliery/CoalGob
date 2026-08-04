// Runs the zero-dep test suite via node --test with an explicit file list -
// the directory form is unreliable; a missing listed file must fail loud
// rather than silently running zero tests. SKILL-REPO-PATTERN.md Layer 4.
import { run } from 'node:test';
import { tap } from 'node:test/reporters';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));

const TEST_FILES = [
  'lib/parser.test.mjs',
];

const resolved = TEST_FILES.map((f) => path.join(here, f));
for (const file of resolved) {
  if (!fs.existsSync(file)) {
    console.error(`[test] listed test file missing: ${file}`);
    process.exitCode = 1;
  }
}
if (process.exitCode === 1) process.exit(1);

const stream = run({ files: resolved });
stream.compose(tap).pipe(process.stdout);

stream.on('test:fail', () => { process.exitCode = 1; });
