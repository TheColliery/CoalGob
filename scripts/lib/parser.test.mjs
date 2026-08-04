import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from './parser.mjs';

function verdictOf(cmd) {
  return parseCommand(cmd).verdict;
}

// --- Group 1: false positives (a quoted argument is not a command) ---
// ships-if-missing: any destructive-looking substring anywhere in a command's
// text blocks the command, even when it never runs as a command.
test('quoted destructive phrase inside an argument is NOT a destruction', () => {
  assert.equal(verdictOf('echo "rm -rf /"'), 'NONE');
});

test("single-quoted destructive phrase inside an argument is NOT a destruction", () => {
  assert.equal(verdictOf("echo 'rm -rf /'"), 'NONE');
});

// --- Group 2: >> is append, never truncation ---
// ships-if-missing: every ordinary log-append command gets blocked as a delete.
test('>> append is not treated as truncation', () => {
  assert.equal(verdictOf('echo hi >> log.txt'), 'NONE');
});

test('2>> stderr-append is not treated as truncation', () => {
  assert.equal(verdictOf('cmd 2>> err.log'), 'NONE');
});

test('&>> combined-append is not treated as truncation', () => {
  assert.equal(verdictOf('cmd &>> both.log'), 'NONE');
});

// --- Group 3: wrappers that could destroy report OUT_OF_SCOPE, never a silent NONE ---
// ships-if-missing: a wrapper that can run `rm -rf` under the hood is waved
// through as confidently safe (the exact "reports success" failure class).
test('make clean is OUT_OF_SCOPE, not NONE', () => {
  assert.equal(verdictOf('make clean'), 'OUT_OF_SCOPE');
});

test('npm run <script> is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('npm run clean'), 'OUT_OF_SCOPE');
});

test('yarn run <script> is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('yarn run clean'), 'OUT_OF_SCOPE');
});

test('xargs is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('cat files.txt | xargs rm'), 'OUT_OF_SCOPE');
});

test('find -exec is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('find . -name "*.tmp" -exec rm {} \\;'), 'OUT_OF_SCOPE');
});

test('find without -exec is NOT flagged OUT_OF_SCOPE by find alone', () => {
  assert.equal(verdictOf('find . -name "*.tmp"'), 'NONE');
});

test('node -e one-liner is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('node -e "require(\'fs\').rmSync(\'x\')"'), 'OUT_OF_SCOPE');
});

test('python -c one-liner is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('python -c "import os; os.remove(\'x\')"'), 'OUT_OF_SCOPE');
});

test('a heredoc is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('bash <<EOF\nrm -rf /\nEOF'), 'OUT_OF_SCOPE');
});

test('a bare script-file invocation is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('./deploy.sh'), 'OUT_OF_SCOPE');
});

test('bash invoking a script file is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('bash deploy.sh'), 'OUT_OF_SCOPE');
});

// --- Group 4: multi-segment commands are each parsed, not just the first ---
// ships-if-missing: `cd /tmp && rm -rf *` sails through because only the
// first command in the string is ever inspected.
test('a destructive verb after && is caught', () => {
  assert.equal(verdictOf('echo hi && rm -rf /tmp/x'), 'DESTRUCTION');
});

test('a destructive verb after ; is caught', () => {
  assert.equal(verdictOf('echo hi; rm -rf /tmp/x'), 'DESTRUCTION');
});

test('a destructive verb after a newline is caught', () => {
  assert.equal(verdictOf('echo hi\nrm -rf /tmp/x'), 'DESTRUCTION');
});

test('a destructive verb after || is caught', () => {
  assert.equal(verdictOf('false || rm -rf /tmp/x'), 'DESTRUCTION');
});

test('a destructive verb on the right side of a pipe is caught', () => {
  assert.equal(verdictOf('cat file.txt | rm -rf /tmp/x'), 'DESTRUCTION');
});

test('a safe first segment does not mask a destructive later segment', () => {
  const result = parseCommand('ls -la; rm -rf /tmp/x');
  assert.equal(result.verdict, 'DESTRUCTION');
});

// --- Group 5: end-of-options handling doesn't defeat detection ---
// ships-if-missing: rm commands whose filenames start with '-' after `--`
// either crash the parser or get silently missed, undermining the coverage
// guarantee for exactly the filenames an attacker would pick to dodge it.
test('rm -- -weirdname is still a destruction', () => {
  assert.equal(verdictOf('rm -- -weirdname'), 'DESTRUCTION');
});

test('rm -rf -- --also-weird is still a destruction', () => {
  assert.equal(verdictOf('rm -rf -- --also-weird'), 'DESTRUCTION');
});

// --- Group 6: mv is conditional, never unconditional ---
// ships-if-missing: the caller (which must stat the target) has no way to
// distinguish "definitely destructive" from "destructive only if the target
// exists" - it either over-blocks harmless renames or under-blocks real ones.
test('mv a b is a conditional destruction, not unconditional', () => {
  const result = parseCommand('mv a b');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].conditional, true);
  assert.equal(result.findings[0].target, 'b');
});

test('mv -t DIR src is a conditional destruction with the -t target', () => {
  const result = parseCommand('mv -t /dest a');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].conditional, true);
  assert.equal(result.findings[0].target, '/dest');
});

test('mv with an unparseable arg shape is OUT_OF_SCOPE, not a crash and not NONE', () => {
  assert.equal(verdictOf('mv'), 'OUT_OF_SCOPE');
});

// --- Group 7: truncation with no command name to match ---
// ships-if-missing: bare redirection truncation slips through because
// verb-matching alone has nothing to match against.
test('> file with no command name is a destruction', () => {
  const result = parseCommand('> important.log');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].target, 'important.log');
});

test('a truncating redirect after another command is a destruction', () => {
  assert.equal(verdictOf('echo bad > important.log'), 'DESTRUCTION');
});

test('>| (clobber) is a destruction', () => {
  assert.equal(verdictOf('echo bad >| important.log'), 'DESTRUCTION');
});

// --- Group 8: unparseable input fails closed to OUT_OF_SCOPE, never NONE ---
// ships-if-missing: input the parser cannot safely reason about is treated
// as confidently safe - the exact "reports success" trap this room exists to
// catch, turned against the guard's own parser.
test('an unterminated double quote is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('rm -rf "foo'), 'OUT_OF_SCOPE');
});

test('an unterminated single quote is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf("rm -rf 'foo"), 'OUT_OF_SCOPE');
});

test('a trailing unescaped backslash is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('rm -rf foo\\'), 'OUT_OF_SCOPE');
});

// --- Group 9: fd-numbered redirects are named, never silently NONE ---
// ships-if-missing: `command 2> important-file` truncates important-file at
// the OS level and the parser calls the whole command safe.
test('2> stderr-truncate is OUT_OF_SCOPE, not NONE', () => {
  assert.equal(verdictOf('cmd 2> important-file'), 'OUT_OF_SCOPE');
});

test('&> combined-truncate is OUT_OF_SCOPE, not NONE', () => {
  assert.equal(verdictOf('cmd &> important-file'), 'OUT_OF_SCOPE');
});

// --- Group 10: the in-scope verb list, all eight, both cases ---
// ships-if-missing: one of the owner-listed verbs silently falls through.
test('rm is a destruction', () => {
  assert.equal(verdictOf('rm file'), 'DESTRUCTION');
});

test('rmdir is a destruction', () => {
  assert.equal(verdictOf('rmdir dir'), 'DESTRUCTION');
});

test('unlink is a destruction', () => {
  assert.equal(verdictOf('unlink file'), 'DESTRUCTION');
});

test('truncate is a destruction', () => {
  assert.equal(verdictOf('truncate -s 0 file'), 'DESTRUCTION');
});

test('del is a destruction', () => {
  assert.equal(verdictOf('del /f /s /q file'), 'DESTRUCTION');
});

test('del is a destruction case-insensitively', () => {
  assert.equal(verdictOf('DEL file'), 'DESTRUCTION');
});

test('Remove-Item is a destruction', () => {
  assert.equal(verdictOf('Remove-Item -Recurse -Force dir'), 'DESTRUCTION');
});

test('Remove-Item is a destruction case-insensitively', () => {
  assert.equal(verdictOf('remove-item file'), 'DESTRUCTION');
});

// --- Group 11: negative space - out-of-list verbs stay NONE ---
// ships-if-missing: the guard over-widens past its declared scope and starts
// blocking ordinary safe commands ("a mine is still a mine").
test('ls is NONE', () => {
  assert.equal(verdictOf('ls -la'), 'NONE');
});

test('cat is NONE', () => {
  assert.equal(verdictOf('cat file.txt'), 'NONE');
});

test('git status is NONE', () => {
  assert.equal(verdictOf('git status'), 'NONE');
});

test('cp is NONE (copy is not in scope)', () => {
  assert.equal(verdictOf('cp a b'), 'NONE');
});

// --- Group 12: quoting/segmentation robustness ---
// ships-if-missing: a filename containing a shell metacharacter (';', '&&')
// is misparsed as two separate commands, producing a wrong verdict.
test('a semicolon inside a quoted filename does not create a fake segment', () => {
  assert.equal(verdictOf('touch "a;b"'), 'NONE');
});

test('an && inside a quoted argument does not create a fake segment', () => {
  assert.equal(verdictOf('echo "a && b"'), 'NONE');
});
