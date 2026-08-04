import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from './parser.mjs';

function verdictOf(cmd) {
  return parseCommand(cmd).verdict;
}

function kindOf(cmd) {
  return parseCommand(cmd).findings[0]?.kind;
}

// --- Group 1: false positives (a quoted argument is not a command) ---
// ships-if-missing: any destructive-looking substring anywhere in a command's
// text blocks the command, even when it never runs as a command.
test('quoted destructive phrase inside an argument is NOT a destruction', () => {
  assert.equal(verdictOf('echo "rm -rf /"'), 'NO_MATCH');
});

test("single-quoted destructive phrase inside an argument is NOT a destruction", () => {
  assert.equal(verdictOf("echo 'rm -rf /'"), 'NO_MATCH');
});

// --- Group 2: >> is append, never truncation ---
// ships-if-missing: every ordinary log-append command gets blocked as a delete.
test('>> append is not treated as truncation', () => {
  assert.equal(verdictOf('echo hi >> log.txt'), 'NO_MATCH');
});

test('2>> stderr-append is not treated as truncation', () => {
  assert.equal(verdictOf('cmd 2>> err.log'), 'NO_MATCH');
});

test('&>> combined-append is not treated as truncation', () => {
  assert.equal(verdictOf('cmd &>> both.log'), 'NO_MATCH');
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
  assert.equal(verdictOf('find . -name "*.tmp"'), 'NO_MATCH');
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

test('&> combined-redirect truncates its target exactly like > (M2 fix corrected this pin)', () => {
  // &> is bash shorthand for `>file 2>&1` - it genuinely truncates the
  // target file. The pre-fix classifier's `startsWith('1')` prefix-match
  // accidentally routed it to fd-out-of-scope (no digit prefix at all);
  // the M2 exact-match fix makes this a real DESTRUCTION, correctly.
  assert.equal(verdictOf('cmd &> important-file'), 'DESTRUCTION');
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
  assert.equal(verdictOf('ls -la'), 'NO_MATCH');
});

test('cat is NONE', () => {
  assert.equal(verdictOf('cat file.txt'), 'NO_MATCH');
});

test('git status is NONE', () => {
  assert.equal(verdictOf('git status'), 'NO_MATCH');
});

test('cp is NONE (copy is not in scope)', () => {
  assert.equal(verdictOf('cp a b'), 'NO_MATCH');
});

// --- Group 12: quoting/segmentation robustness ---
// ships-if-missing: a filename containing a shell metacharacter (';', '&&')
// is misparsed as two separate commands, producing a wrong verdict.
test('a semicolon inside a quoted filename does not create a fake segment', () => {
  assert.equal(verdictOf('touch "a;b"'), 'NO_MATCH');
});

test('an && inside a quoted argument does not create a fake segment', () => {
  assert.equal(verdictOf('echo "a && b"'), 'NO_MATCH');
});

// --- Group 13 (C1) - `&` is a statement separator, not a redirect ---
// ships-if-missing: a listed destruction verb after `&` is erased from the
// token stream entirely and the whole command reports NO_MATCH/NONE - the
// worst outcome the parser can produce, on its own primary verb list.
test('a destructive verb after a background & is caught', () => {
  assert.equal(verdictOf('echo hi & rm -rf /tmp/x'), 'DESTRUCTION');
});

test('a destructive verb after & with no other segment is caught', () => {
  assert.equal(verdictOf('true & rm x'), 'DESTRUCTION');
});

test('a destructive verb between two & separators is caught', () => {
  assert.equal(verdictOf('a & rm x & b'), 'DESTRUCTION');
});

test('an OUT_OF_SCOPE wrapper after & is caught, not erased', () => {
  assert.equal(verdictOf('ls & make clean'), 'OUT_OF_SCOPE');
});

// --- Group 14 (H1) - a redirect to a non-file sink is not a destruction ---
// ships-if-missing: `> /dev/null`, one of the most common shell idioms,
// blocks as if it deleted a real file - and the design's own block-with-
// remedy rail would hand back a "recoverable form" for a destruction that
// never happened.
test('> /dev/null is not a destruction', () => {
  assert.equal(verdictOf('ls > /dev/null'), 'NO_MATCH');
});

test('> NUL (Windows null device, any case) is not a destruction', () => {
  assert.equal(verdictOf('echo hi > NUL'), 'NO_MATCH');
  assert.equal(verdictOf('echo hi > nul'), 'NO_MATCH');
});

test('> /dev/fd/N and > /proc/self/fd/N are not a destruction', () => {
  assert.equal(verdictOf('ls > /dev/fd/1'), 'NO_MATCH');
  assert.equal(verdictOf('ls > /proc/self/fd/2'), 'NO_MATCH');
});

test('redirecting to a real file is still a destruction (control)', () => {
  assert.equal(verdictOf('ls > important.log'), 'DESTRUCTION');
});

// --- Group 15 (H2) - NO_MATCH is a closed-list miss, never a safety claim ---
// ships-if-missing: the fall-through value reads as "judged safe" when it
// only means "position 0 didn't match this parser's lookup tables" - eval,
// every subshell/substitution form, and named direct destroyers all land
// here and the parser has no way to say it never looked.
test('git clean is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('git clean -fdx'), 'OUT_OF_SCOPE');
});

test('git rm is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('git rm file'), 'OUT_OF_SCOPE');
});

test('git checkout -- <file> is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('git checkout -- file'), 'OUT_OF_SCOPE');
});

test('git status (not a destructive subcommand) stays NO_MATCH', () => {
  assert.equal(verdictOf('git status'), 'NO_MATCH');
});

test('npm ci is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('npm ci'), 'OUT_OF_SCOPE');
});

test('shred is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('shred -u f'), 'OUT_OF_SCOPE');
});

test('dd is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('dd if=/dev/zero of=f'), 'OUT_OF_SCOPE');
});

test('eval is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('eval "rm -rf /"'), 'OUT_OF_SCOPE');
});

test('a subshell is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('(rm -rf /tmp/x)'), 'OUT_OF_SCOPE');
});

test('a brace group is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('{ rm -rf /tmp/x; }'), 'OUT_OF_SCOPE');
});

test('$(...) command substitution as the whole command is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('$(rm -rf /tmp/x)'), 'OUT_OF_SCOPE');
});

test('backtick command substitution as the whole command is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('`rm -rf /tmp/x`'), 'OUT_OF_SCOPE');
});

test('npx rimraf is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('npx rimraf x'), 'OUT_OF_SCOPE');
});

test('npm exec rimraf is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('npm exec rimraf x'), 'OUT_OF_SCOPE');
});

test('find . -delete is OUT_OF_SCOPE (deletes with no helper verb)', () => {
  assert.equal(verdictOf('find . -delete'), 'OUT_OF_SCOPE');
});

test('find . -execdir is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('find . -execdir rm {} \\;'), 'OUT_OF_SCOPE');
});

test('a genuinely unlisted, non-destructive verb stays NO_MATCH (no over-widening)', () => {
  assert.equal(verdictOf('ls -la'), 'NO_MATCH');
  assert.equal(verdictOf('cat file.txt'), 'NO_MATCH');
});

// --- Group 16 (H4) - the verb can be prefixed; recognition must see through it ---
// ships-if-missing: `sudo rm -rf /` - the single most recognisable
// destructive command line there is - reports NO_MATCH because the parser
// only ever looks at word 0.
test('sudo rm is a destruction', () => {
  assert.equal(verdictOf('sudo rm -rf /tmp/x'), 'DESTRUCTION');
});

test('env-prefixed rm is a destruction', () => {
  assert.equal(verdictOf('env rm x'), 'DESTRUCTION');
});

test('nice-prefixed rm is a destruction', () => {
  assert.equal(verdictOf('nice rm x'), 'DESTRUCTION');
});

test('time-prefixed rm is a destruction', () => {
  assert.equal(verdictOf('time rm x'), 'DESTRUCTION');
});

test('command-prefixed rm is a destruction', () => {
  assert.equal(verdictOf('command rm x'), 'DESTRUCTION');
});

test('timeout N rm is a destruction, skipping the duration arg', () => {
  assert.equal(verdictOf('timeout 5 rm x'), 'DESTRUCTION');
});

test('an absolute path to rm is a destruction (basename match)', () => {
  assert.equal(verdictOf('/bin/rm -rf /tmp/x'), 'DESTRUCTION');
  assert.equal(verdictOf('/usr/bin/rm x'), 'DESTRUCTION');
});

test('a leading VAR=value assignment does not hide the verb', () => {
  assert.equal(verdictOf('FOO=bar rm x'), 'DESTRUCTION');
});

// --- Group 17 (M1) - fd-duplication and fd-closing are not redirects to a file ---
// ships-if-missing: `2>&1`, the most-typed redirection in existence, falls
// into the undecided OUT_OF_SCOPE bucket instead of being recognised as
// what it is - a descriptor operation with no filename target at all.
test('2>&1 fd-duplication names no file', () => {
  assert.equal(verdictOf('cmd 2>&1'), 'NO_MATCH');
});

test('>&- fd-close names no file', () => {
  assert.equal(verdictOf('cmd >&-'), 'NO_MATCH');
});

test('2>&- fd-close names no file', () => {
  assert.equal(verdictOf('cmd 2>&-'), 'NO_MATCH');
});

test('a trailing background & with nothing after it is not a bad redirect', () => {
  assert.equal(verdictOf('sleep 1 &'), 'NO_MATCH');
});

// --- Group 18 (M2) - fd classification is exact-match, not prefix-match ---
// ships-if-missing: `10>`, `11>`, ... all classify as fd 1 (stdout) because
// a startsWith('1') check catches every fd number that begins with the
// digit 1, silently claiming stdout semantics for a descriptor that is not
// stdout.
test('fd 10 is not classified as stdout', () => {
  const result = parseCommand('cmd 10> log');
  assert.notEqual(result.verdict, 'DESTRUCTION');
});

test('fd 1 (bare) is still classified as stdout truncation', () => {
  assert.equal(verdictOf('cmd 1> log'), 'DESTRUCTION');
});

// --- Group 19 (M3) - a heredoc ends its own segment ---
// ships-if-missing: the command immediately after a closed heredoc is
// silently folded into the heredoc's own (always OUT_OF_SCOPE) segment, so
// a listed `rm` right after a heredoc is downgraded from DESTRUCTION.
test('a destructive command right after a closed heredoc is still caught', () => {
  assert.equal(verdictOf('cat <<EOF\nhello\nEOF\nrm -rf /tmp/x'), 'DESTRUCTION');
});

// --- Group 20 (M4) - Windows-family flags fold case; POSIX flags do not ---
// ships-if-missing: `powershell -command` (lowercase) or `pwsh -C`
// (abbreviated) is invisible to the one-liner check because PowerShell and
// cmd parameters are genuinely case-insensitive and abbreviable, while the
// check compares raw case.
test('powershell -Command is OUT_OF_SCOPE regardless of case', () => {
  assert.equal(verdictOf('powershell -Command "rm x"'), 'OUT_OF_SCOPE');
  assert.equal(verdictOf('powershell -command "rm x"'), 'OUT_OF_SCOPE');
});

test('pwsh -C (abbreviated, case-insensitive) is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('pwsh -C "rm x"'), 'OUT_OF_SCOPE');
});

test('cmd /c is OUT_OF_SCOPE regardless of case', () => {
  assert.equal(verdictOf('cmd /c "del x"'), 'OUT_OF_SCOPE');
  assert.equal(verdictOf('cmd /C "del x"'), 'OUT_OF_SCOPE');
});

// --- Group 21 (L1) - --help/--version on a destruction verb is pure output ---
// ships-if-missing: `rm --help` blocks as if it deletes something; it prints
// usage text and exits.
test('rm --help is not a destruction', () => {
  assert.equal(verdictOf('rm --help'), 'NO_MATCH');
});

test('rm --version is not a destruction', () => {
  assert.equal(verdictOf('rm --version'), 'NO_MATCH');
});

// --- Group 22 (L2) - truncate -s +N is an explicit grow, never a shrink ---
// ships-if-missing: a provably-safe grow (the + prefix guarantees the file
// cannot shrink, regardless of its current size) is blocked identically to
// an actual truncate-to-zero.
test('truncate -s +100 (explicit grow) is not a destruction', () => {
  assert.equal(verdictOf('truncate -s +100 f'), 'NO_MATCH');
});

test('truncate -s 0 (shrink to zero) is still a destruction', () => {
  assert.equal(verdictOf('truncate -s 0 f'), 'DESTRUCTION');
});

// --- Group 23 (N2) - basename strips the DIRECTORY, not the extension ---
// ships-if-missing: on this room's own dev platform, the Windows-suffixed
// form of a listed verb (rm.exe, del.exe, a path-qualified rm.exe) is
// silently NO_MATCH - half the verb list exists FOR Windows.
test('rm.exe is a destruction', () => {
  assert.equal(verdictOf('rm.exe x'), 'DESTRUCTION');
});

test('del.exe is a destruction', () => {
  assert.equal(verdictOf('del.exe x'), 'DESTRUCTION');
});

test('a path-qualified rm.exe is a destruction', () => {
  // Forward slashes, not backslashes: an UNQUOTED backslash is bash's own
  // escape character (\t outside quotes really does mean literal "t"), so
  // an unquoted 'C:\tools\rm.exe' is not the path it looks like - that is
  // real bash behavior, not a parser gap.
  assert.equal(verdictOf('C:/tools/rm.exe x'), 'DESTRUCTION');
});

test('cmd.exe /c is OUT_OF_SCOPE like cmd /c', () => {
  assert.equal(verdictOf('cmd.exe /c "del x"'), 'OUT_OF_SCOPE');
});

// --- Group 24 (N1) - the --help/--version guard respects -- end-of-options ---
// ships-if-missing: `rm -- --help` deletes a real file literally named
// --help and reports NO_MATCH because the guard sees the string "--help"
// and stops looking, exactly the bug analyzeMv already avoids.
test('rm -- --help deletes a real file named --help (still a destruction)', () => {
  assert.equal(verdictOf('rm -- --help'), 'DESTRUCTION');
});

test('rm --help (no --) is still not a destruction (control)', () => {
  assert.equal(verdictOf('rm --help'), 'NO_MATCH');
});

// --- Group 25 (head's ruling) - a prefix chain that cannot be fully
// resolved must still report an admission (OUT_OF_SCOPE) or DESTRUCTION
// where the generic walk (Group 29 below) can now reach it, never a
// silent NO_MATCH ---
// ships-if-missing: `env FOO=bar rm x` / `sudo -u root rm x` - a listed rm,
// merely wrapped in a prefix shape the resolver's declared limit does not
// walk - reports NO_MATCH, the exact outcome this whole round exists to
// remove, with the limit sitting undetected in a comment nobody reads.
// (`env FOO=bar rm x`'s own assertion moved to Group 29 - the defence-
// round walk resolves it to full DESTRUCTION, not merely OUT_OF_SCOPE.)
test('sudo -u root rm (round 5 walks the flag, reaching rm itself) is a destruction', () => {
  // Round 4's give-up remainder scan could only ADMIT a listed verb was
  // present (OUT_OF_SCOPE); round 5 properly walks sudo's own -u <value>
  // pair, so `rm` is resolved as the real verb and gets its full,
  // unconditional destruction verdict - `sudo -u root rm x` genuinely does
  // delete as root, no different from `sudo rm x`.
  assert.equal(verdictOf('sudo -u root rm x'), 'DESTRUCTION');
});

test('a gave-up prefix chain with no listed verb anywhere stays NO_MATCH', () => {
  assert.equal(verdictOf('sudo -u root ls x'), 'NO_MATCH');
});

// --- Group 26 (R1, CRITICAL regression) - a POSIX absolute path after a
// prefix verb is not a Windows-style flag; it is the next command, and the
// round-3 give-up path must not eat it ---
// ships-if-missing: `sudo /bin/rm -rf /tmp/x` - the single most ordinary
// way `sudo` is written on any Linux box - is NO_MATCH, because the same
// `stuck.startsWith('/')` guard meant for `/c`-style flags also catches
// every absolute path. This is the H4 (prefix chain) x N2 (path/suffix
// resolution) crossing neither round's tests exercised alone.
test('sudo + an absolute path to rm is still a destruction (H4 x N2 crossing)', () => {
  assert.equal(verdictOf('sudo /bin/rm -rf /tmp/x'), 'DESTRUCTION');
});

test('env + an absolute path to rm is still a destruction (H4 x N2 crossing)', () => {
  assert.equal(verdictOf('env /bin/rm x'), 'DESTRUCTION');
});

test('timeout <duration> + an absolute path to rm is still a destruction', () => {
  assert.equal(verdictOf('timeout 5 /bin/rm x'), 'DESTRUCTION');
});

test('sudo + a Windows-exe-suffixed rm is still a destruction (H4 x N2 crossing)', () => {
  assert.equal(verdictOf('sudo rm.exe x'), 'DESTRUCTION');
});

test('/bin/rm alone (no prefix) is still a destruction (control)', () => {
  assert.equal(verdictOf('/bin/rm x'), 'DESTRUCTION');
});

test('sudo rm (no path) is still a destruction (control)', () => {
  assert.equal(verdictOf('sudo rm x'), 'DESTRUCTION');
});

// --- Group 27 (R2, MEDIUM) - the give-up remainder scan needs positional
// reasoning: a listed verb's NAME appearing as a flag's VALUE or as another
// command's ARGUMENT is not that verb being invoked ---
// ships-if-missing: `sudo -u git ...` is OUT_OF_SCOPE for every ordinary
// user named "git" (an ordinary username), and `cat rm` is OUT_OF_SCOPE
// because "rm" is cat's argument, not a command.
test('git as a -u flag VALUE (a username) is not a command - not OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('sudo -u git echo hi'), 'NO_MATCH');
});

test('git genuinely in command position resolves through its OWN precise subcommand check', () => {
  // -H is boolean (no value), -u www-data is a flag+value pair, so once
  // round 5 walks past both, `git` is resolved as the REAL verb via the
  // main path - not the coarse give-up scan - and gets git's own
  // subcommand precision: `status` isn't destructive, so this is NO_MATCH,
  // not a blanket OUT_OF_SCOPE. (`git clean`/`rm`/`checkout` in the same
  // position still correctly report OUT_OF_SCOPE - see the next test.)
  assert.equal(verdictOf('sudo -H -u www-data git status'), 'NO_MATCH');
});

test('git clean genuinely in command position is still OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('sudo -H -u www-data git clean -fdx'), 'OUT_OF_SCOPE');
});

// `sudo -u root cat rm` moved to Group 29 below: the defence-round
// structural walk knowingly trades this precision (a listed verb's name
// appearing as an earlier command's own argument can now admit
// OUT_OF_SCOPE) for closing the false-negative hole the same walk exists
// to remove. Documented trade-off, not a regression - see the assertion
// and its rationale there.

// --- Group 28 (round 5) - fix the WALK, not just the flag table: sudo's own
// flags are consumed as part of normal verb resolution (boolean flags
// alone, value-taking flags with their value), so the real command behind
// them resolves through the main path - not a coarse give-up fallback ---
// ships-if-missing: `sudo -h rm x` treats -h as value-taking (it is not -
// -h is --help, boolean) and swallows `rm` along with it; `sudo -t 5 rm x`
// and `sudo -U root rm x` use flags that DO take a value, and the walk
// still never reaches `rm` behind them. All five rows must resolve to a
// full DESTRUCTION, not merely "a listed verb might be present somewhere".
test('sudo -h rm (boolean flag, not value-taking) still reaches rm', () => {
  assert.equal(verdictOf('sudo -h rm x'), 'DESTRUCTION');
});

test('sudo -t <type> rm (value-taking) still reaches rm', () => {
  assert.equal(verdictOf('sudo -t 5 rm x'), 'DESTRUCTION');
});

test('sudo -U <user> rm (value-taking) still reaches rm', () => {
  assert.equal(verdictOf('sudo -U root rm x'), 'DESTRUCTION');
});

test('sudo -g <group> rm still reaches rm', () => {
  assert.equal(verdictOf('sudo -g wheel rm x'), 'DESTRUCTION');
});

test('sudo -p <prompt> rm still reaches rm', () => {
  assert.equal(verdictOf('sudo -p prompt rm x'), 'DESTRUCTION');
});

// Composition: the flag walk crossed with N2's path/suffix resolution -
// neither round 4's nor this round's tests alone exercised a sudo flag
// PLUS a path-qualified, extension-suffixed verb in the same command.
test('sudo -u <value> + an absolute, .exe-suffixed rm still reaches rm (flag-walk x N2 crossing)', () => {
  assert.equal(verdictOf('sudo -u root /bin/rm.exe x'), 'DESTRUCTION');
});

test('an unknown/unenumerated sudo flag defaults to boolean (the safe direction), never swallows a value', () => {
  // -Z is not a real sudo flag; the design's stated default for an
  // uncertain flag is "not value-taking" - skip it alone, so `rm` is the
  // very next word and is still reached.
  assert.equal(verdictOf('sudo -Z rm x'), 'DESTRUCTION');
});

// --- Group 29 (defence round 1, Group A) - the structural walk: a generic
// candidate scan (never a per-tool flag table) guarantees a listed verb is
// never silently missed behind an unrecognized flag, on ANY prefix verb,
// short or long form. A per-tool table (sudo's) is only ever an
// OPTIMIZATION that sharpens the PRIMARY candidate to full DESTRUCTION
// precision; its absence for a prefix (nice/time/command/timeout) degrades
// to the generic backstop's OUT_OF_SCOPE admission, never to NO_MATCH ---
// ships-if-missing: a listed verb behind an unrecognized flag on ANY
// prefix silently vanishes - this was independently rediscovered by an
// out-of-frame attacker across six different spellings.
test('nice -n 10 rm (separated-value form, no per-tool table for nice) is not silently missed', () => {
  assert.notEqual(verdictOf('nice -n 10 rm -rf build'), 'NO_MATCH');
});

test('time -p rm (no per-tool table needed - -p skipped generically, rm is immediately next)', () => {
  assert.equal(verdictOf('time -p rm x'), 'DESTRUCTION');
});

test('command -p rm (same mechanism as time -p)', () => {
  assert.equal(verdictOf('command -p rm x'), 'DESTRUCTION');
});

test('timeout --signal=KILL 5 rm (long =-joined form after timeout) is not silently missed', () => {
  assert.notEqual(verdictOf('timeout --signal=KILL 5 rm -rf build'), 'NO_MATCH');
});

test('timeout -k 5 10 rm (short value flag after timeout) is not silently missed', () => {
  assert.notEqual(verdictOf('timeout -k 5 10 rm -rf build'), 'NO_MATCH');
});

test('sudo --user root rm (sudo long form, the walk optimization reaches full DESTRUCTION)', () => {
  assert.equal(verdictOf('sudo --user root rm x'), 'DESTRUCTION');
});

test('nice --adjustment 10 rm (long form after nice) is not silently missed', () => {
  assert.notEqual(verdictOf('nice --adjustment 10 rm -rf build'), 'NO_MATCH');
});

// Composition axis this round adds: a NON-SUDO prefix x a value-taking flag
// x the path/suffix resolver (N2) - no round before this one crossed these
// three. time -p sits the walk's PRIMARY candidate directly on the
// path-qualified, suffix-stripped verb (full DESTRUCTION); nice -n 10 must
// fall to the SECONDARY-candidate admission (OUT_OF_SCOPE) since nice has
// no per-tool table, and the secondary path/suffix resolution must still
// find it.
test('time -p + a path-qualified, exe-suffixed rm reaches full DESTRUCTION (non-sudo prefix x flag x N2)', () => {
  assert.equal(verdictOf('time -p /bin/rm.exe x'), 'DESTRUCTION');
});

test('nice -n 10 + a path-qualified, exe-suffixed rm is not silently missed (non-sudo prefix x flag x N2)', () => {
  assert.notEqual(verdictOf('nice -n 10 /bin/rm.exe x'), 'NO_MATCH');
});

// Existing behavior this redesign LEGITIMATELY upgrades (the generic walk
// naturally skips an interleaved assignment as a non-candidate, landing
// the primary candidate precisely on rm - full DESTRUCTION where the
// give-up mechanism could previously only admit OUT_OF_SCOPE).
test('env FOO=bar rm now resolves to full DESTRUCTION via the generic walk', () => {
  assert.equal(verdictOf('env FOO=bar rm x'), 'DESTRUCTION');
});

// Existing behavior this redesign KNOWINGLY trades: the secondary-candidate
// backstop that closes the false-negative hole can also re-admit a listed
// verb's name appearing as a later command's own argument. This is the
// SAME safe-direction trade-off R2's own ruling pre-approved ("if a case
// is genuinely undecidable, OUT_OF_SCOPE is the correct answer and it
// stays") - never re-widened back to NO_MATCH, which is what actually
// matters.
test('sudo -u root cat rm: the secondary-candidate backstop now admits OUT_OF_SCOPE (documented trade-off, not a silent NO_MATCH)', () => {
  assert.equal(verdictOf('sudo -u root cat rm'), 'OUT_OF_SCOPE');
});

// But precision the room already fought for is NOT thrown away wherever a
// per-tool table exists: sudo's own -u <value> pairing still excludes the
// value from ever becoming a candidate at all, so a username that
// coincidentally matches a verb name is still correctly excluded.
test('git as a sudo -u flag VALUE (a username) still correctly stays NO_MATCH (sudo table precision preserved)', () => {
  assert.equal(verdictOf('sudo -u git echo hi'), 'NO_MATCH');
});

test('git genuinely in command position after sudo flags still resolves via its own precise subcommand check', () => {
  assert.equal(verdictOf('sudo -H -u www-data git status'), 'NO_MATCH');
  assert.equal(verdictOf('sudo -H -u www-data git clean -fdx'), 'OUT_OF_SCOPE');
});

// --- Group 30 (work unit, kind field) - every OUT_OF_SCOPE site carries an
// explicit kind: 'declared' (the owner's own scope boundary working as
// designed), 'unrouted' (a named direct destroyer we knowingly do not
// route), or 'unjudged' (the parser could not read the construct at all -
// this is the ceiling metric for whether the guard is degrading into a
// shrug). The partition must live on the field, never be re-derived from
// the reason string - a prose grouping mis-files the next reason string
// somebody adds, silently ---
// ships-if-missing: OUT_OF_SCOPE stays one undifferentiated bucket and
// nobody can tell a deliberate scope choice from a parser blind spot.
test('a wrapper the owner declared out of scope (make) carries kind declared', () => {
  assert.equal(kindOf('make clean'), 'declared');
});

test('npm run is declared', () => {
  assert.equal(kindOf('npm run clean'), 'declared');
});

test('xargs is declared', () => {
  assert.equal(kindOf('cat files.txt | xargs rm'), 'declared');
});

test('find -exec is declared', () => {
  assert.equal(kindOf('find . -name "*.tmp" -exec rm {} \\;'), 'declared');
});

test('a POSIX interpreter one-liner is declared', () => {
  assert.equal(kindOf('node -e "1"'), 'declared');
});

test('a Windows one-liner is declared', () => {
  assert.equal(kindOf('pwsh -C "rm x"'), 'declared');
});

test('cmd /c is declared', () => {
  assert.equal(kindOf('cmd /c "del x"'), 'declared');
});

test('bash invoking a script file is declared', () => {
  assert.equal(kindOf('bash deploy.sh'), 'declared');
});

test('a bare script-file invocation is declared', () => {
  assert.equal(kindOf('./deploy.sh'), 'declared');
});

test('a named direct destroyer (shred) carries kind unrouted', () => {
  assert.equal(kindOf('shred -u f'), 'unrouted');
});

test('a destructive git subcommand is unrouted', () => {
  assert.equal(kindOf('git clean -fdx'), 'unrouted');
});

test('npx rimraf is unrouted', () => {
  assert.equal(kindOf('npx rimraf x'), 'unrouted');
});

test('npm exec rimraf is unrouted', () => {
  assert.equal(kindOf('npm exec rimraf x'), 'unrouted');
});

test('a heredoc, which the parser cannot see inside, carries kind unjudged', () => {
  assert.equal(kindOf('bash <<EOF\nrm -rf /\nEOF'), 'unjudged');
});

test('a non-stdout fd redirect after a non-destructive verb is unjudged', () => {
  assert.equal(kindOf('cat file 2> notes.txt'), 'unjudged');
});

test('a bare non-stdout fd redirect with no command words is unjudged', () => {
  assert.equal(kindOf('2> notes.txt'), 'unjudged');
});

test('a redirect with no target token is unjudged', () => {
  assert.equal(kindOf('echo >'), 'unjudged');
});

test('a subshell is unjudged', () => {
  assert.equal(kindOf('(rm -rf /tmp/x)'), 'unjudged');
});

test('the secondary-candidate admission past an unresolved prefix chain is unjudged', () => {
  assert.equal(kindOf('sudo -u root cat rm'), 'unjudged');
});

test('an mv shape the parser cannot resolve is unjudged', () => {
  assert.equal(kindOf('mv'), 'unjudged');
});

test('a tokenizer error (unterminated quote) is unjudged', () => {
  assert.equal(kindOf('rm -rf "foo'), 'unjudged');
});

test('non-string input carries no kind at all - it is a caller contract violation, never a command-construct judgment', () => {
  assert.equal(parseCommand(123).findings[0].kind, undefined);
});

// --- Group 31 (work unit, Group C) - the missing transparent prefixes:
// nohup/setsid/stdbuf/doas/ionice are the same class of wrapper this parser
// already handles (sudo/env/nice/time/command), just absent from the list ---
// ships-if-missing: `nohup rm -rf build` (and its siblings) resolve the
// verb to the PREFIX itself and never look past it, reporting NO_MATCH on
// an ordinary destructive command line.
test('nohup rm is a destruction', () => {
  assert.equal(verdictOf('nohup rm -rf build'), 'DESTRUCTION');
});

test('setsid rm is a destruction', () => {
  assert.equal(verdictOf('setsid rm -rf build'), 'DESTRUCTION');
});

test('stdbuf -o0 rm is a destruction', () => {
  assert.equal(verdictOf('stdbuf -o0 rm -rf build'), 'DESTRUCTION');
});

test('doas rm is a destruction', () => {
  assert.equal(verdictOf('doas rm -rf build'), 'DESTRUCTION');
});

test('ionice -c3 rm is a destruction', () => {
  assert.equal(verdictOf('ionice -c3 rm -rf build'), 'DESTRUCTION');
});

// --- Group 32 (work unit, Group F) - named-destroyer additions, all onto
// the OUT_OF_SCOPE admission list, never DESTRUCTION_VERBS (the owner's
// closed guarded list) ---
// ships-if-missing: `erase` (cmd.exe's exact synonym for `del`, which IS
// guarded), `git restore` (the modern replacement for `git checkout --`,
// already OUT_OF_SCOPE), and `git reset --hard` (overwrites tracked files)
// all report NO_MATCH - a listed-verb-equivalent going unrecognized purely
// by spelling.
test('erase is OUT_OF_SCOPE, not NONE (cmd.exe synonym for del)', () => {
  assert.equal(verdictOf('erase important.txt'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('erase important.txt'), 'unrouted');
});

test('git restore is OUT_OF_SCOPE (modern replacement for git checkout --)', () => {
  assert.equal(verdictOf('git restore .'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('git restore .'), 'unrouted');
});

test('git reset --hard is OUT_OF_SCOPE (overwrites the working tree)', () => {
  assert.equal(verdictOf('git reset --hard'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('git reset --hard'), 'unrouted');
});

test('bare git reset (no --hard) stays NO_MATCH - soft/mixed do not touch the working tree', () => {
  assert.equal(verdictOf('git reset'), 'NO_MATCH');
});

test('git reset --soft stays NO_MATCH (control)', () => {
  assert.equal(verdictOf('git reset --soft HEAD~1'), 'NO_MATCH');
});

// --- Group 33 (work unit, Group B) - a leading input redirect must not
// displace the verb - `<` is skipped without consuming its own target
// word, so the target becomes word 0 and the real verb becomes an
// argument ---
// ships-if-missing: `< /dev/null rm -rf build`, ordinary legal bash, resolves
// its verb to `/dev/null` and never looks at `rm` - the single most
// dangerous kind of miss this parser can produce.
test('a leading input redirect does not displace the verb (/dev/null target)', () => {
  assert.equal(verdictOf('< /dev/null rm -rf build'), 'DESTRUCTION');
});

test('a leading input redirect does not displace the verb (ordinary file target)', () => {
  assert.equal(verdictOf('< input.txt rm x'), 'DESTRUCTION');
});

test('an input redirect after the verb still does not add a spurious argument', () => {
  assert.equal(verdictOf('rm < input.txt x'), 'DESTRUCTION');
});

test('an input redirect is never itself reported as a destructive target', () => {
  const result = parseCommand('< /dev/null rm -rf build');
  assert.equal(result.findings.some((f) => f.target === '/dev/null'), false);
});

// --- Group 34 (work unit, Group E) - the --help/grow-safe NO_MATCH
// exemptions must not skip the fd-out-of-scope check that sits right below
// them in classifyVerb - a NO_MATCH from analyzeDestructionVerb returned
// early instead of falling through to it ---
// ships-if-missing: `rm --help 2> notes.txt` reports NO_MATCH even though
// bash creates/truncates notes.txt before rm even runs, whatever rm then
// does with --help - the fd-2 redirect is silently discarded because the
// --help exemption already returned.
test('rm --help still leaves a real fd-2 redirect judged, not discarded', () => {
  assert.equal(verdictOf('rm --help 2> notes.txt'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('rm --help 2> notes.txt'), 'unjudged');
});

test('truncate -s +10 (grow-safe) still leaves a real fd-2 redirect judged', () => {
  assert.equal(verdictOf('truncate -s +10 f 2> notes.txt'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('truncate -s +10 f 2> notes.txt'), 'unjudged');
});

test('rm --help with no redirect is still plain NO_MATCH (control)', () => {
  assert.equal(verdictOf('rm --help'), 'NO_MATCH');
});

test('truncate -s +10 with no redirect is still plain NO_MATCH (control)', () => {
  assert.equal(verdictOf('truncate -s +10 f'), 'NO_MATCH');
});

// --- Group 35 (work unit, Group D1 - tokenizer trio, bundled per the
// head's own ruling since all three touch the same operator-dispatch
// if-chain in tokenize()) ---

// D1a - `#` starts a comment at word-boundary position only; mid-word it
// stays a literal character (real bash behavior).
// ships-if-missing: a redirect written inside a trailing comment is read as
// a live redirect and truncates a file that was never going to be touched.
test('a redirect inside a trailing # comment is not a live redirect', () => {
  assert.equal(verdictOf('ls # write results > notes.txt'), 'NO_MATCH');
});

test('an ordinary annotated command line is not blocked by its own comment', () => {
  assert.equal(verdictOf('npm test # old output > notes.txt'), 'NO_MATCH');
});

test('a mid-word # is not a comment start (control)', () => {
  assert.equal(verdictOf('rm foo#bar.txt'), 'DESTRUCTION');
});

// D1b - `[[ ]]` string comparison: `>`/`<` inside a double-bracket test are
// not redirects. Single `[ ]` is unaffected (bracketDepth keys on `[[`
// specifically).
// ships-if-missing: the version-compare idiom `[[ $a > $b ]]` is blocked as
// a truncating redirect - bash creates no file at all.
test('> inside [[ ]] is a string comparison, not a redirect', () => {
  assert.equal(verdictOf('[[ $a > $b ]]'), 'NO_MATCH');
});

test('the realistic if [[ ... ]] spelling of the same idiom', () => {
  assert.equal(verdictOf('if [[ $a > $b ]]; then echo hi; fi'), 'NO_MATCH');
});

test('single-bracket [ 1 > 2 ] is still a real redirect (control)', () => {
  assert.equal(verdictOf('[ 1 > 2 ]'), 'DESTRUCTION');
});

// D1c - process substitution `>(...)`/`<(...)` is not a redirect to a file.
// ships-if-missing: `tee >(wc -l)`, an ordinary process-substitution
// pipeline, is blocked as if it truncated a file literally named `(wc`.
test('>( process substitution is not a truncating redirect', () => {
  assert.equal(verdictOf('tee >(wc -l)'), 'NO_MATCH');
});

test('<( process substitution is not an input-redirect target either', () => {
  assert.equal(verdictOf('diff <(sort a) <(sort b)'), 'NO_MATCH');
});

// --- Group 36 (work unit, Group D2) - the remaining five false positives ---

// D2a - truncate's grow-is-safe check only inspected -s; --size=+N and
// --size +N grow identically and were missed.
test('truncate --size=+10 (joined long form, explicit grow) is not a destruction', () => {
  assert.equal(verdictOf('truncate --size=+10 growing.log'), 'NO_MATCH');
});

test('truncate --size +10 (separated long form, explicit grow) is not a destruction', () => {
  assert.equal(verdictOf('truncate --size +10 growing.log'), 'NO_MATCH');
});

test('truncate --size=0 (joined long form, real shrink) is still a destruction (control)', () => {
  assert.equal(verdictOf('truncate --size=0 growing.log'), 'DESTRUCTION');
});

test('truncate --size 0 (separated long form, real shrink) is still a destruction (control)', () => {
  assert.equal(verdictOf('truncate --size 0 growing.log'), 'DESTRUCTION');
});

// D2b - Remove-Item -WhatIf is PowerShell's dry-run switch; it deletes
// nothing.
test('Remove-Item -WhatIf is not a destruction (dry-run switch)', () => {
  assert.equal(verdictOf('Remove-Item -WhatIf important.txt'), 'NO_MATCH');
});

test('remove-item -whatif is not a destruction, case-insensitively', () => {
  assert.equal(verdictOf('remove-item -whatif file'), 'NO_MATCH');
});

test('Remove-Item with no -WhatIf is still a destruction (control)', () => {
  assert.equal(verdictOf('Remove-Item important.txt'), 'DESTRUCTION');
});

// D2c - a listed verb with no positional operand destroys nothing.
test('bare rm (no operand) is not a destruction', () => {
  assert.equal(verdictOf('rm'), 'NO_MATCH');
});

test('rm -f (no operand) is not a destruction', () => {
  assert.equal(verdictOf('rm -f'), 'NO_MATCH');
});

test('rm -rf (no operand) is not a destruction', () => {
  assert.equal(verdictOf('rm -rf'), 'NO_MATCH');
});

test('bare rmdir (no operand) is not a destruction (the check is verb-general)', () => {
  assert.equal(verdictOf('rmdir'), 'NO_MATCH');
});

test('rm -rf /tmp/x (a real operand) is still a destruction (control)', () => {
  assert.equal(verdictOf('rm -rf /tmp/x'), 'DESTRUCTION');
});

// D2d - `/?` is cmd.exe's help switch, the Windows spelling of the
// existing POSIX --help/--version exemption.
test('del /? is not a destruction (cmd.exe help switch)', () => {
  assert.equal(verdictOf('del /?'), 'NO_MATCH');
});

test('del with a real file is still a destruction (control)', () => {
  assert.equal(verdictOf('del file'), 'DESTRUCTION');
});

// D2e - a lexically-different spelling of the same non-file sink is still
// recognized (normalization only, no filesystem access - ruling 3 holds).
test('a lexically-normalized /dev/./null is recognized as the null sink', () => {
  assert.equal(verdictOf('cat a > /dev/./null'), 'NO_MATCH');
});

test('a lexically-normalized /dev/../dev/null is recognized as the null sink', () => {
  assert.equal(verdictOf('cat a > /dev/../dev/null'), 'NO_MATCH');
});

test('a genuinely different target that merely resembles the sink spelling is still a destruction (control)', () => {
  assert.equal(verdictOf('cat a > /dev/./nullfile'), 'DESTRUCTION');
});

// --- Group 37 (defence round 2, Group H) - bracketDepth poisoning: `[[`
// only opens a test in real bash COMMAND POSITION (segment start, or right
// after if/while/until/do/then/else/elif/!) - never as a quoted or bare
// ARGUMENT to a preceding word. The old check fired on any token whose
// VALUE was exactly `[[`, after quote-stripping and with no regard to
// position, so a quoted or argument `[[` opened a test that never closed -
// every `>` after it then read as an inert word instead of a redirect ---
// ships-if-missing: this is the D1 fix's own blast radius - the false-
// positive fix for `[[ $a > $b ]]` opened a false-negative hole that makes
// an ordinary truncating redirect invisible whenever a `[[` appears
// anywhere earlier in the same command line, quoted or not.
test('a quoted [[ as an argument does not poison bracketDepth (real redirect stays live)', () => {
  assert.equal(verdictOf('echo "[[" > out.txt'), 'DESTRUCTION');
});

test('a bare [[ as an argument (not word 0) does not poison bracketDepth either', () => {
  assert.equal(verdictOf('echo [[ > out.txt'), 'DESTRUCTION');
});

test('a quoted [[ inside a grep pattern does not poison bracketDepth (realistic shape)', () => {
  assert.equal(verdictOf('grep "[[" f > out.txt'), 'DESTRUCTION');
});

test('a genuine [[ ]] test at segment start still gates > as a comparison (control, D1 regression guard)', () => {
  assert.equal(verdictOf('[[ $a > $b ]]'), 'NO_MATCH');
});

test('a genuine [[ ]] test after the if keyword still gates > as a comparison (control, D1 regression guard)', () => {
  assert.equal(verdictOf('if [[ $a > $b ]]; then echo hi; fi'), 'NO_MATCH');
});

// --- Group 38 (defence round 2, Group K) - the null-sink check must run
// for ANY fd, not just fd 1. classifyRedirectOp routed every non-fd-1
// redirect straight to fd-out-of-scope before isNonFileSink was ever
// consulted, so the single most common redirect an agent writes
// (`2>/dev/null`) was reported unjudged and fired the remedy - inflating
// the unjudged ceiling metric with a construct the parser can in fact
// read perfectly ---
// ships-if-missing: `ls 2>/dev/null`, an everyday idiom, is flagged as a
// construct the parser could not read, when it can read it exactly as
// well as `ls > /dev/null` already reads on fd 1.
test('2>/dev/null is not unjudged - the null sink is recognized on a non-stdout fd', () => {
  assert.equal(verdictOf('ls 2>/dev/null'), 'NO_MATCH');
});

test('3>/dev/null (an arbitrary fd) is also recognized as a null sink', () => {
  assert.equal(verdictOf('cmd 3>/dev/null'), 'NO_MATCH');
});

test('2> to a real file is still unjudged (control, M1 ruling unaffected)', () => {
  assert.equal(verdictOf('cmd 2> important-file'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('cmd 2> important-file'), 'unjudged');
});

// --- Group 39 (defence round 2, Group G) - shell grammar occupying word 0
// is not a wrapper, it is bash SYNTAX - do/then/else/elif/! sit in front
// of the real command the same way a prefix verb does. `exec` genuinely IS
// a transparent prefix (it replaces the shell with the named command) and
// belongs in PREFIX_VERBS exactly like nohup/setsid ---
// ships-if-missing: `for f in *.log; do rm "$f"; done` - the single most
// common bash loop shape - reports NO_MATCH because `do` occupies word 0
// of its own segment and the listed verb `rm` is never classified. Same
// class as `sudo rm` (the predecessor's own precedent): a token in word 0
// that is not the command.
test('do in word 0 (a for-loop body) does not hide the verb', () => {
  assert.equal(verdictOf('for f in *.log; do rm "$f"; done'), 'DESTRUCTION');
});

test('then in word 0 (an if body) does not hide the verb', () => {
  assert.equal(verdictOf('if [ -f a ]; then rm a; fi'), 'DESTRUCTION');
});

test('do in word 0 (a while-loop body) does not hide the verb', () => {
  assert.equal(verdictOf('while read f; do rm $f; done'), 'DESTRUCTION');
});

test('else in word 0 does not hide the verb', () => {
  assert.equal(verdictOf('if a; then b; else rm x; fi'), 'DESTRUCTION');
});

test('elif in word 0 does not hide the verb', () => {
  assert.equal(verdictOf('if a; then b; elif rm x; fi'), 'DESTRUCTION');
});

test('! (pipeline negation) in word 0 does not hide the verb', () => {
  assert.equal(verdictOf('! rm -rf build'), 'DESTRUCTION');
});

test('exec is a transparent prefix, same class as nohup/setsid', () => {
  assert.equal(verdictOf('exec rm -rf build'), 'DESTRUCTION');
});

test('do as an ordinary argument (not word 0) is untouched (control)', () => {
  assert.equal(verdictOf('echo do rm x'), 'NO_MATCH');
});

// --- Group 40 (defence round 2, Group I) - option-parsing fidelity ---

// I1 - truncate: the LAST -s/--size wins (GNU getopt semantics), not the
// first; and the joined short form -s+10 is a legal grow spelling.
test('truncate -s +10 -s 0 (repeated -s, last wins) is a real shrink, a destruction', () => {
  assert.equal(verdictOf('truncate -s +10 -s 0 file'), 'DESTRUCTION');
});

test('truncate -s+10 (joined short form, explicit grow) is not a destruction', () => {
  assert.equal(verdictOf('truncate -s+10 file'), 'NO_MATCH');
});

test('truncate --size=+10 (joined long form) still exempts (regression control)', () => {
  assert.equal(verdictOf('truncate --size=+10 growing.log'), 'NO_MATCH');
});

test('truncate -s 0 (plain shrink, no repeat) is still a destruction (control)', () => {
  assert.equal(verdictOf('truncate -s 0 file'), 'DESTRUCTION');
});

// I2 - git: a global flag before the subcommand must not defeat the
// parser's own routing for that subcommand.
test('git -C <path> clean still routes through the subcommand check', () => {
  assert.equal(verdictOf('git -C /repo clean -fdx'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('git -C /repo clean -fdx'), 'unrouted');
});

test('git --git-dir=<path> reset --hard still routes through the subcommand check', () => {
  assert.equal(verdictOf('git --git-dir=.git reset --hard'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('git --git-dir=.git reset --hard'), 'unrouted');
});

test('bare git reset (no --hard, no global flag) still stays NO_MATCH (control)', () => {
  assert.equal(verdictOf('git reset'), 'NO_MATCH');
});

test('bare git clean (no global flag) still routes (control)', () => {
  assert.equal(verdictOf('git clean -fdx'), 'OUT_OF_SCOPE');
});

// I3 - Remove-Item -WhatIf: the explicit-value switch form and unambiguous
// abbreviations are the same dry-run switch.
test('Remove-Item -WhatIf:$true is still the dry-run switch', () => {
  assert.equal(verdictOf('Remove-Item -WhatIf:$true x'), 'NO_MATCH');
});

test('Remove-Item -Wha (unambiguous abbreviation) is still the dry-run switch', () => {
  assert.equal(verdictOf('Remove-Item -Wha x'), 'NO_MATCH');
});

test('Remove-Item -Whati (unambiguous abbreviation) is still the dry-run switch', () => {
  assert.equal(verdictOf('Remove-Item -Whati x'), 'NO_MATCH');
});

test('Remove-Item -W alone (too ambiguous to resolve) is not exempted (control)', () => {
  assert.equal(verdictOf('Remove-Item -W x'), 'DESTRUCTION');
});

// --- Group 41 (defence round 2, Group J) - provable safety without a
// stat, the same class of exemption truncate's grow already gets ---

// J1 - mv -n/--no-clobber guarantees mv never overwrites an existing
// target - the one mv shape provably safe with no filesystem access.
test('mv -n (no-clobber, short form) is not a destruction', () => {
  assert.equal(verdictOf('mv -n a b'), 'NO_MATCH');
});

test('mv --no-clobber (long form) is not a destruction', () => {
  assert.equal(verdictOf('mv --no-clobber a b'), 'NO_MATCH');
});

test('mv a b with no -n is still a destruction (control)', () => {
  assert.equal(verdictOf('mv a b'), 'DESTRUCTION');
});

// J2 - NULL_SINKS generalized to every non-file character device, not
// just the original 6-entry list - a redirect to any of these truncates
// nothing, lexically, no stat.
test('> /dev/urandom is not a destruction (character device)', () => {
  assert.equal(verdictOf('echo hi > /dev/urandom'), 'NO_MATCH');
});

test('> /dev/random is not a destruction (character device)', () => {
  assert.equal(verdictOf('echo hi > /dev/random'), 'NO_MATCH');
});

test('> /dev/console is not a destruction (character device)', () => {
  assert.equal(verdictOf('echo hi > /dev/console'), 'NO_MATCH');
});

test('> /dev/ttyN (a numbered tty) is not a destruction', () => {
  assert.equal(verdictOf('echo hi > /dev/tty5'), 'NO_MATCH');
});

test('> /dev/pts/N (a pseudo-terminal) is not a destruction', () => {
  assert.equal(verdictOf('echo hi > /dev/pts/3'), 'NO_MATCH');
});

test('> a genuinely different /dev path is still a destruction (control)', () => {
  assert.equal(verdictOf('echo hi > /dev/mydata'), 'DESTRUCTION');
});

// --- Group 42 (defence round 2, Group L) - unrouted-list gaps: direct
// destroyers, not wrappers. Grows the OUT_OF_SCOPE named list only, never
// the guarded DESTRUCTION_VERBS list - same precedent as shred/dd/erase ---

// L1 - rd is cmd.exe's other spelling of rmdir and a PowerShell
// Remove-Item alias.
test('rd is OUT_OF_SCOPE, not NONE (cmd.exe/PowerShell alias for rmdir)', () => {
  assert.equal(verdictOf('rd /s /q build'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('rd /s /q build'), 'unrouted');
});

test('RD is OUT_OF_SCOPE case-insensitively', () => {
  assert.equal(verdictOf('RD /s /q build'), 'OUT_OF_SCOPE');
});

// L2 - cp from a null-sink source truncates its target.
test('cp /dev/null <target> is OUT_OF_SCOPE (truncates the target)', () => {
  assert.equal(verdictOf('cp /dev/null bigfile.log'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('cp /dev/null bigfile.log'), 'unrouted');
});

test('cp /dev/zero <target> is OUT_OF_SCOPE too (another null-sink source)', () => {
  assert.equal(verdictOf('cp /dev/zero bigfile.log'), 'OUT_OF_SCOPE');
});

test('cp a b (an ordinary copy) is still NONE (control, copy stays out of scope)', () => {
  assert.equal(verdictOf('cp a b'), 'NO_MATCH');
});

// L3 - tee truncates its target(s) on open unless appending.
test('tee out.txt is OUT_OF_SCOPE (truncates on open)', () => {
  assert.equal(verdictOf('tee out.txt'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('tee out.txt'), 'unrouted');
});

test('tee -a out.txt (append mode) is not flagged (provably safe, no truncation)', () => {
  assert.equal(verdictOf('tee -a out.txt'), 'NO_MATCH');
});

test('bare tee (stdin to stdout, no file) is not flagged (control)', () => {
  assert.equal(verdictOf('tee'), 'NO_MATCH');
});

// L4 - PowerShell Clear-Content / Set-Content -Value ''.
test('Clear-Content is OUT_OF_SCOPE', () => {
  assert.equal(verdictOf('Clear-Content x'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('Clear-Content x'), 'unrouted');
});

test("Set-Content -Value '' is OUT_OF_SCOPE (empties the target)", () => {
  assert.equal(verdictOf("Set-Content -Value '' x"), 'OUT_OF_SCOPE');
  assert.equal(kindOf("Set-Content -Value '' x"), 'unrouted');
});

test('Set-Content with a real value is not flagged (control)', () => {
  assert.equal(verdictOf("Set-Content -Value 'hello' x"), 'NO_MATCH');
});

// L5 - node --eval is the same construct as node -e; only one was routed.
test('node --eval is OUT_OF_SCOPE, matching node -e (declared edge consistency)', () => {
  assert.equal(verdictOf('node --eval "1"'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('node --eval "1"'), 'declared');
});

// --- Group 43 (defence round 3, Set S1) - the WHOLE PowerShell -WhatIf
// switch-value set, enumerated in one test: bare, explicit :$true/:$false,
// :1/:0, and the legal abbreviations. Boundary: an explicit value NOT in
// this recognized set (a variable reference, e.g. -WhatIf:$SomeVar)
// defaults to NOT exempt - the safe direction when uncertain ---
// ships-if-missing: -WhatIf:$false explicitly turns the dry run OFF and
// the delete really happens; treating it as a no-op is not a missed edge,
// it is telling the caller a real destruction is safe.
test('the whole -WhatIf switch-value set resolves correctly', () => {
  const cases = [
    ['-WhatIf', 'NO_MATCH'],
    ['-WhatIf:$true', 'NO_MATCH'],
    ['-WhatIf:$false', 'DESTRUCTION'],
    ['-WhatIf:1', 'NO_MATCH'],
    ['-WhatIf:0', 'DESTRUCTION'],
    ['-WhatIf:true', 'NO_MATCH'],
    ['-WhatIf:false', 'DESTRUCTION'],
    ['-Wha', 'NO_MATCH'],
    ['-Whati', 'NO_MATCH'],
    ['-Wha:$false', 'DESTRUCTION'],
    ['-WhatIf:$SomeVar', 'DESTRUCTION'],
  ];
  for (const [flag, expected] of cases) {
    assert.equal(verdictOf(`Remove-Item ${flag} victim.txt`), expected, flag);
  }
});

// --- Group 44 (defence round 3, Set S2) - the WHOLE bash compound-command
// keyword set that can occupy word 0: do/then/else/elif/! (already
// implemented) plus if/while/until/case (the half that was missing).
// Boundary, stated: `case` resolves to OUT_OF_SCOPE/unjudged, not
// DESTRUCTION - the pattern label (`a)`) sits between the keyword and the
// command, and this parser does not parse case-pattern grammar. That is a
// declared limit, not a silent NO_MATCH ---
// ships-if-missing: `if rm -f "$pid"; then ...` - an ordinary guard an
// agent might type with no [[ ]] test at all - is invisible; word 0 is
// classified as the verb `if`, which matches nothing, and because no
// prefix was consumed not even the OUT_OF_SCOPE backstop fires.
test('the whole shell-keyword-in-word-0 set resolves correctly', () => {
  const cases = [
    ['do rm x', 'DESTRUCTION'],
    ['then rm x', 'DESTRUCTION'],
    ['else rm x', 'DESTRUCTION'],
    ['elif rm x', 'DESTRUCTION'],
    ['! rm x', 'DESTRUCTION'],
    ['if rm -rf build', 'DESTRUCTION'],
    ['while rm -f lock', 'DESTRUCTION'],
    ['until rm -f lock', 'DESTRUCTION'],
  ];
  for (const [segment, expected] of cases) {
    assert.equal(verdictOf(segment), expected, segment);
  }
});

test('if rm -rf build; then echo gone; fi (realistic multi-segment shape) is a destruction', () => {
  assert.equal(verdictOf('if rm -rf build; then echo gone; fi'), 'DESTRUCTION');
});

test('while rm -f lock; do sleep 1; done is a destruction', () => {
  assert.equal(verdictOf('while rm -f lock; do sleep 1; done'), 'DESTRUCTION');
});

test('until rm -f lock; do sleep 1; done is a destruction', () => {
  assert.equal(verdictOf('until rm -f lock; do sleep 1; done'), 'DESTRUCTION');
});

test('if truncate -s 0 log; then :; fi is a destruction (not rm-specific)', () => {
  assert.equal(verdictOf('if truncate -s 0 log; then :; fi'), 'DESTRUCTION');
});

test('while mv a b; do :; done is a conditional destruction', () => {
  assert.equal(verdictOf('while mv a b; do :; done'), 'DESTRUCTION');
});

test('case declares its stated boundary: unjudged, never a silent NO_MATCH', () => {
  assert.equal(verdictOf('case $x in a) rm y;; esac'), 'OUT_OF_SCOPE');
  assert.equal(kindOf('case $x in a) rm y;; esac'), 'unjudged');
});

// --- Group 45 (defence round 3, Set S3) - the WHOLE mv -f/-i/-n option
// grammar: GNU getopt override semantics (repeats and mixed spellings -
// LAST one wins, in argument order) and short-option clustering (-vn,
// -nv). Boundary, stated: -i (interactive) never exempts on its own - a
// prompt is not a guaranteed no-op in an unattended/agent context, so the
// safe direction is to still treat it as a possible destruction ---
// ships-if-missing: `mv -n -f a b` reports NO_MATCH (mv -n's own
// exemption fired) although -f, coming LAST, restores overwriting and the
// command really does overwrite b.
test('the whole mv override-flag set resolves correctly', () => {
  const cases = [
    ['mv -n a b', 'NO_MATCH'],
    ['mv --no-clobber a b', 'NO_MATCH'],
    ['mv -n -f a b', 'DESTRUCTION'],
    ['mv --no-clobber --force a b', 'DESTRUCTION'],
    ['mv -f -n a b', 'NO_MATCH'],
    ['mv -vn a b', 'NO_MATCH'],
    ['mv -nv a b', 'NO_MATCH'],
    ['mv -nf a b', 'DESTRUCTION'],
    ['mv -i a b', 'DESTRUCTION'],
    ['mv a b', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 46 (defence round 3, Set S4) - the WHOLE truncate -c/-o/-r/-s
// option grammar: repeated/mixed-spelling -s resolves LAST-wins (already
// true since Set I), and the value-taking -s is now visible inside a
// short-option CLUSTER (-cs, -cs+10), the same clustering gap S3 just
// closed for mv. Boundary, stated: only -s's own value decides grow-safety
// - -c/-o/-r never affect it, clustered alongside -s or not ---
// ships-if-missing: `truncate -cs +10 f` is a provable GROW (an explicit
// +N size can never shrink the file) but is flagged as a destruction,
// because the joined-short regex could not see the `s` sitting inside a
// cluster with `-c`.
test('the whole truncate -s option-grammar set resolves correctly', () => {
  const cases = [
    ['truncate -s +10 f', 'NO_MATCH'],
    ['truncate -s 0 f', 'DESTRUCTION'],
    ['truncate -s+10 f', 'NO_MATCH'],
    ['truncate -cs +10 f', 'NO_MATCH'],
    ['truncate -cs+10 f', 'NO_MATCH'],
    ['truncate -c -s +10 f', 'NO_MATCH'],
    ['truncate --size=+10 f', 'NO_MATCH'],
    ['truncate --size +10 f', 'NO_MATCH'],
    ['truncate -s +10 -s 0 f', 'DESTRUCTION'],
    ['truncate -c f', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 47 (defence round 3, Set S5) - word/operator scanning: the
// WHOLE backslash-newline line-continuation shape (end-of-line, with
// leading indentation on the continued line, and mid-word), plus >&word
// as bash's truncating synonym for &>word. Boundary, stated: a backslash
// followed by anything OTHER than a newline is unaffected - this only
// removes the exact \<newline> pair, never any other escape ---
// ships-if-missing (continuation): bash deletes \<newline> entirely: this
// parser glued a literal embedded newline onto the next word instead, so
// `rm` behind a continuation matched nothing.
// ships-if-missing (>&word): `>&word` truncates a NAMED FILE - the
// parser's own core in-scope case - and it vanished into an fdDup op that
// gets skipped wholesale with no target ever consumed.
test('the whole backslash-continuation + >&word set resolves correctly', () => {
  const cases = [
    ['cd build && \\\nrm -rf node_modules', 'DESTRUCTION'],
    ['mkdir -p a && \\\n  rm -rf a/old', 'DESTRUCTION'],
    ['r\\\nm victim.txt', 'DESTRUCTION'],
    ['echo hi >& out.txt', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

test('a genuine trailing backslash at end of input (no newline after) is still OUT_OF_SCOPE (control)', () => {
  assert.equal(verdictOf('rm -rf foo\\'), 'OUT_OF_SCOPE');
});

test('>&- (fd-close) is still NO_MATCH, unaffected by the >&word fix (control)', () => {
  assert.equal(verdictOf('cmd >&-'), 'NO_MATCH');
});

test('2>&1 (fd-dup) is still NO_MATCH, unaffected by the >&word fix (control)', () => {
  assert.equal(verdictOf('cmd 2>&1'), 'NO_MATCH');
});

// --- Group 48 (defence round 3, Set S6) - the bracket/paren CONTEXT set:
// [[ ]] got positional gating in round 2 (Set H); arithmetic (( ))/$(( ))
// never did, bracketDepth was never reset at a segment boundary, and a
// QUOTED digit was still accepted as an fd-prefix. Boundary, stated: only
// the exact two-char sequences `((`/`))` are tracked (a general nested-
// parenthesis balance is not attempted, matching the existing word-0-only
// treatment of a bare subshell) ---
// ships-if-missing (arithmetic): `if (( count > 10 )); then ...` - an
// ordinary numeric guard - reports DESTRUCTION on target `10`, because
// the tokenizer has no arithmetic-context equivalent of bracketDepth.
// ships-if-missing (segment reset): an unbalanced `[[` earlier in a
// command line demotes a genuine truncating redirect in a LATER, wholly
// unrelated segment - the worst class of miss, a real destruction hidden
// behind unrelated syntax.
// ships-if-missing (quoted fd): `echo "2">victim.txt` - a real stdout
// truncation - is misfiled as unjudged, inflating the ceiling metric with
// traffic the parser can in fact read (the Group K class again).
test('the whole bracket/paren context set resolves correctly', () => {
  const cases = [
    ['if (( count > 10 )); then echo big; fi', 'NO_MATCH'],
    ['while (( i > 0 )); do echo hi; done', 'NO_MATCH'],
    ['echo $((a > b))', 'NO_MATCH'],
    ['x=$(( a > b ))', 'NO_MATCH'],
    ['echo hi > file', 'DESTRUCTION'],
    ['[[ -f a ; echo hi > file', 'DESTRUCTION'],
    ['echo "2">victim.txt', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

test('a genuine destructive verb still reachable right after an arithmetic guard (control)', () => {
  assert.equal(verdictOf('if (( count > 10 )); then rm x; fi'), 'DESTRUCTION');
});

test('echo "2">victim.txt is DESTRUCTION with the correct target, not just any verdict', () => {
  const result = parseCommand('echo "2">victim.txt');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].target, 'victim.txt');
});

// --- Group 49 (defence round 4, Set T1) - the S6 completion: `for (( ; ;
// ))`, bash's C-style for-loop header. CITED SOURCE: bash's own
// compound-command grammar - `for (( expr1 ; expr2 ; expr3 )); do list;
// done`, the ONLY paren form using `;` as an internal clause separator
// rather than a command separator ---
// ships-if-missing: the `;` characters inside the header are read as real
// segment separators, which also force-resets parenDepth mid-header (the
// same cross-segment-leak class S6 already fixed for `[[`), so the `>` in
// `i>0` misparses as a live truncating redirect to a file literally named
// `0`.
test('for (( ; ; )) does not misparse its own clause separators as command separators', () => {
  assert.equal(verdictOf('for ((i=10;i>0;i--)); do echo hi; done'), 'NO_MATCH');
});

test('for (( ; ; )) with spaces around each clause is unaffected', () => {
  assert.equal(verdictOf('for (( i=10; i>0; i-- )); do echo hi; done'), 'NO_MATCH');
});

test('a genuine destructive verb inside the for-loop BODY is still caught (control)', () => {
  assert.equal(verdictOf('for ((i=0;i<3;i++)); do rm -rf x; done'), 'DESTRUCTION');
});

test('a real ; still separates segments once the arithmetic header has genuinely closed (control)', () => {
  assert.equal(verdictOf('echo hi; rm -rf x'), 'DESTRUCTION');
});
