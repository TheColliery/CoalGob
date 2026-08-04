import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from './parser.mjs';

function verdictOf(cmd) {
  return parseCommand(cmd).verdict;
}

function kindOf(cmd) {
  return parseCommand(cmd).findings[0]?.kind;
}

// =============================================================================
// THE AXIS LIST (defence round 7 derivation) - governs every "the whole ...
// set resolves correctly" test in this file. An enumerating test states which
// of these axes it covers; a set that closes without checking every axis a
// construct actually has is exactly how S1-V4's own history kept re-finding
// the "same defect, sibling spelling" shape. DERIVED, not assumed - the
// original four (flag spelling/verb/value-form/platform, defence round 4)
// plus wave 6's two (site/invocation-channel) collapse and expand under this
// derivation to SEVEN: two of the "six known" merge into one dimension
// (SPELLING, checked at two grammar levels), and two genuinely new axes
// emerged this round (STRUCTURAL CONTEXT, OVERRIDE ORDER) that none of the
// six named. A shorter list that is MORE GENERAL still beats a longer
// remembered one - this is that attempt, not a bigger one for its own sake.
//
// 1. SPELLING (lexical alias) - the identical semantic unit (a verb, a flag,
//    a redirect operator) has more than one exact string token that denotes
//    it, at ANY of three grammar levels: verb-alias, flag-abbreviation/
//    clustering/joined-form, operator-synonym. One dimension, checked at
//    each level separately because each lives in its own code table.
//    Source: PowerShell `Get-Alias -Definition <cmdlet>` - RAN (T3, T4).
//    GNU getopt short/long/`=`-joined/clustered convention - READ (`--help`
//    outputs: T2, S3, S4, U1, U2).
//    Miss, twice: T3 closed `ri`, missed `clc` - found by V9 (Clear-Content's
//    OWN alias), a different verb on the SAME table, one round later.
//
// 2. VALUE-FORM - a single flag/parameter's OWN VALUE is expressible in more
//    than one syntactic shape while meaning the same thing: bare presence
//    (=true), `:$true`/`:true`/`:1` / `:$false`/`:false`/`:0`, `--flag=val`,
//    `--flag val`, a joined short form.
//    Source: PowerShell parameter-binding syntax - RAN (T5, a live
//    `[switch]`-bound throwaway function).
//    Miss: T5 closed `-WhatIf`'s value-form; U5 found `-Force:$false` on
//    Move-Item - byte-for-byte the same value-form defect, unenumerated
//    for a SIBLING switch on a different verb (a SITE miss riding on top).
//
// 3. OVERRIDE ORDER - when a flag capable of conflicting with itself or a
//    sibling flag appears MORE THAN ONCE (same spelling repeated, or two
//    members of one override family), the LAST occurrence by argument order
//    wins - never a fixed priority independent of position.
//    Source: GNU getopt "last flag wins" convention - READ, cross-checked by
//    RUNNING the actual repeated-flag shapes (`truncate -s +10 -s 0`,
//    `mv -n -f`) against this room's own stated design intent.
//    Miss: wave 3's C1/C2 (`mv -n -f` not overridden - S3 closed clustering
//    but the FIRST pass had missed cross-spelling override entirely).
//    NEW axis this round - not one of the "six known".
//
// 4. PLATFORM - the identical operation is expressed under a completely
//    different switch-PREFIX CONVENTION depending on which program owns the
//    verb (`/?` cmd.exe vs `--help` GNU) - AND a single verb NAME can belong
//    to more than one platform's grammar at once (`rmdir` is both).
//    Source: `del /?`, `rmdir /?`, `truncate --help` - ALL RAN live on this
//    host.
//    Miss: U2's own fix wrongly excluded rmdir's real GNU `--help` form -
//    caught by rot-canary the SAME round it was introduced.
//
// 5. STRUCTURAL CONTEXT (recursive) - a token's ROLE, or whether a normally-
//    mandatory separator is even required before it, is determined by the
//    ENCLOSING CONSTRUCT or an adjacent MARKER - never by the token's own
//    spelling. This subsumes three shapes found independently before they
//    were recognized as one axis: (a) an operator character means something
//    different inside `[[ ]]`/`(( ))` than at top level (`>`/`<`: round 5;
//    `&&`/`||`: round 6 V3); (b) a reserved word is a keyword only when it is
//    ITSELF in a legal, recursively-verified slot, not merely spelled right
//    and unquoted (round 5's quoted-`[[` fix, round 6 V4's `do`-as-argument
//    fix - the third instance of this exact shape); (c) a separator that is
//    USUALLY mandatory before `then`/`do` becomes OPTIONAL when the clause
//    it follows closes with `))`/`]]` instead of an ordinary word (`for ((
//    ; ; )) do` with no `;`); (d) an end-of-options marker (`--`) flips
//    every LATER token's role from flag-shaped to positional, regardless of
//    that token's own spelling (U4's `lastMvOverride` gap).
//    Source: POSIX Shell Command Language, reserved-word recognition
//    (RECALLED, not fetched this round - the WEAKEST citation on this list,
//    matching T1's own honesty precedent) + GNU getopt `--` end-of-options
//    (RECALLED) + bash conditional/arithmetic grammar (RAN live, this round,
//    specifically to answer this dispatch: `if (( 1 )) then` and
//    `while (( )) do` both run with no semicolon; `while true do` and
//    `(( 1 )) echo` are both syntax errors - confirming the free pass is
//    keyed to the CLOSING TOKEN, not to the keyword or to `for` specially).
//    NEW axis this round, formed by unifying four things once thought
//    separate.
//
// 6. INVOCATION CHANNEL - a command's operand can reach it through more than
//    one BINDING MECHANISM: a positional argument, a named flag, or a
//    pipeline stage upstream of it. A check written as "does this segment
//    have a positional operand" is blind to the other channels.
//    Source: PowerShell's documented parameter-binding model ("Value from
//    Pipeline") - RECALLED, not fetched this round.
//    Miss: found by wave 6 (V9, `Get-ChildItem | Remove-Item -Force`), not
//    yet fixed anywhere in this file - the room's own `!hasPositional`
//    exemption (T2's own shape) never considered a segment reached via `|`.
//
// 7. SITE (implementation-level, NOT a grammar fact) - the SAME grammar fact
//    (any of axes 1-6, already true and already coded somewhere) is
//    re-implemented or re-checked at MORE THAN ONE place in this file, and a
//    fix at one site does not reach the other. This is a property of OUR
//    OWN CODE, not of bash/PowerShell/cmd.exe - its "citation" is therefore
//    self-referential: grep the file for the existing correct
//    implementation and confirm the broken site lacks the same call, never
//    an external spec.
//    Source: `verbAt`'s own `basenameOf`+`stripExeExtension` call - RAN
//    (grepped this file, confirmed `resolveVerb`'s prefix comparison lacked
//    the identical call before V2, and `analyzeMv`'s positional loop already
//    honoured `--` while `lastMvOverride` did not, before U4).
//    Miss, twice more: V2 (prefix word never normalized), U4/U7 (`--`
//    honoured in one function, not its sibling in the same file).
//
// 8. BEHAVIOUR EQUIVALENCE (accepted defence round 7 - the 8th-axis
//    candidate this room's own audit named and did not decide) - two
//    constructs sharing a NAME RESOLUTION do not thereby share a
//    BEHAVIOUR. Axis 1 (spelling) asks "is this the same unit?"; axis 8
//    asks "do the two units act the same?" - a question axis 1
//    structurally cannot answer, because a correct alias resolution
//    (`Get-Alias` really does say `mi` -> `Move-Item`) is orthogonal to
//    whether the TARGET's real semantics match what the ALIASED command
//    would have done.
//    Source: this room's own T4 correction - VERIFIED empirically (RAN,
//    not read) by a live PowerShell session testing Move-Item's actual
//    overwrite behaviour against mv's.
//    Miss: T4's first pass routed `mi`/`move` onto `mv`'s existing
//    conditional-destruction logic because the ALIAS resolved correctly;
//    nobody had yet checked whether `Move-Item`'s real behaviour matches
//    `mv`'s. It doesn't - `mv` overwrites by default, `Move-Item` refuses
//    without `-Force`. Its own operational form, inherited from the
//    predecessor whose fix this was: if a fix routes one verb through
//    another's EXISTING function, verify by RUNNING the aliased command
//    itself, not just its alias-table entry, that their real behaviours
//    match.
//
// Not merged with the above despite superficial similarity: the ORIGINAL
// four's "verb" and "flag spelling" collapse into axis 1's two levels; wave
// 6's "site" and "invocation channel" are kept as axes 7 and 6 unchanged
// (already precisely named, nothing to generalize). Net from the round-7
// derivation: two axes merged into one, two new axes derived (3, 5) - SEVEN
// total, not six. Axis 8 (BEHAVIOUR EQUIVALENCE) was accepted separately,
// the same dispatch, as a genuinely distinct question axis 1-7 cannot ask -
// EIGHT total as of defence round 7's fix wave.
//
// OUTPUT COVERAGE (defence round 8, the ALL-OUTPUTS re-check) - every axis
// above was derived and enumerated against the VERDICT output alone. A
// second output this parser emits, per finding - `verb`, `target`,
// `conditional`, `reason`, `kind` - was never separately asked "does this
// axis apply here too?" TARGET-CORRECTNESS (X1/X2, Set X1+X2+X3) is the
// proof: axis 1 (spelling) and axis 7 (SITE) were both already CLOSED for
// the verdict, and both still had a live defect in the TARGET a right
// verdict carried. Per-axis state, verdict column omitted (that is every
// prior group in this file):
//   1 SPELLING      - target: PARTIAL (W2's own -t/--target-directory fix
//                     IS a target fix, but X1/X2 found the same axis still
//                     open on the flagless/`--`-shadowed forms). verb/
//                     conditional/reason/kind: UNCHECKED.
//   2 VALUE-FORM     - every output: UNCHECKED (T5/U5's -WhatIf/-Force
//                     value-form fixes were verdict-only; no PowerShell
//                     switch's colon-form has ever been checked against
//                     what `target`/`conditional` report).
//   3 OVERRIDE ORDER - every output: UNCHECKED.
//   4 PLATFORM       - every output: UNCHECKED (U2/W5's del/rmdir/.cmd
//                     fixes are verdict-only; none of these verbs ever
//                     reaches a `target` field at all - see the SITE row).
//   5 STRUCTURAL CONTEXT - target: FIXED (X2, `--` before
//                     `--target-directory=`). verb/conditional/reason/
//                     kind: UNCHECKED.
//   6 INVOCATION CHANNEL - target: the pipeline-bound Remove-Item shape
//                     (W6) never reaches `target` either - see the SITE
//                     row, same root cause. conditional/reason/kind:
//                     UNCHECKED.
//   7 SITE           - target: FIXED (X1, mv's 3+-operand implicit-
//                     directory form) - AND STILL OPEN, more broadly than
//                     this round closed: `analyzeDestructionVerb`
//                     (rm/rmdir/unlink/truncate/del/remove-item - the
//                     MAJORITY of this parser's guarded verb list) never
//                     populates `target` AT ALL, for any input - its own
//                     positional-scan loop sets a boolean (`hasPositional`)
//                     and discards the token, where `analyzeMv`/
//                     `analyzeMoveItem`/the redirect-classification path
//                     all capture and report the real operand. This is the
//                     single largest EMPTY cell this re-check found, and it
//                     is left OPEN (not fixed this round) - the owner has
//                     ruled a block always hands back the recoverable form
//                     of the SAME destruction, and `target`'s current
//                     shape (one string, one file) does not obviously
//                     generalize to a verb whose real grammar is
//                     `FILE...` (one or more operands, `rm a b` deletes
//                     BOTH) - a schema decision (singular `target` vs a
//                     `targets` list), not a citation gap, and therefore a
//                     head ruling, not a coder-decided fix. verb: the
//                     redirect-truncate DESTRUCTION shape reports
//                     `verb: truncating.op` (a redirect operator string
//                     like `1>`/`&>`) where every other DESTRUCTION shape
//                     reports a real command/cmdlet name - one field name,
//                     two incompatible meanings, never enumerated, same
//                     open schema question as the `target` gap above.
//   8 BEHAVIOUR EQUIVALENCE - every output: UNCHECKED beyond verdict (no
//                     wave has hit this axis at all yet, per the round-7
//                     handover).
// conditional and reason/kind were spot-checked this round (Set X3) only
// for the two DESTRUCTION shapes already in play (mv/Move-Item vs a
// listed verb/redirect) - not crossed against any of the eight axes
// individually. Reading this table literally: MOST cells are empty, and
// that is the finding, not a gap in the finding.
// =============================================================================

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

test('mv -t DIR src is a conditional destruction with the real at-risk path (defence round 7, Set W2)', () => {
  // Corrected in round 7 (W2): reporting the DIRECTORY itself was the
  // bug (a directory that must already exist for the command to run at
  // all always "blocks") - the real at-risk path is DIRECTORY joined
  // with the source's own basename. See 'the whole mv --target-
  // directory / --backup set resolves correctly'.
  const result = parseCommand('mv -t /dest a');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].conditional, true);
  assert.equal(result.findings[0].target, '/dest/a');
});

test('mv with an unparseable arg shape is OUT_OF_SCOPE, not a crash and not NONE', () => {
  // Defence round 5, Set U8: bare `mv` (no operands at all) moved to
  // NO_MATCH - it is a no-op, the same class as `mv --help` (see 'the
  // whole mv no-op set resolves correctly'), not an unparseable shape.
  // `mv a` (one operand, not enough to do anything, not a recognized
  // no-op spelling) keeps the genuine unparseable-shape coverage this
  // test exists for.
  assert.equal(verdictOf('mv a'), 'OUT_OF_SCOPE');
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
  // Defence round 5, Set U8: a BARE `mv` (no operands at all) is a
  // no-op, the same class as `mv --help` - it moved to NO_MATCH and no
  // longer belongs here (see 'the whole mv no-op set resolves
  // correctly'). `mv a` (one operand, still not enough to do anything,
  // and not a recognized no-op spelling) keeps the genuine
  // can't-resolve coverage this test exists for.
  assert.equal(kindOf('mv a'), 'unjudged');
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

// --- Group 50 (defence round 4, Set T2) - the D2 no-operand exemption,
// completed for del/truncate. CITED SOURCE: each verb's own live synopsis
// on this host - `cmd.exe /c "del /?"` -> "DEL [/P] [/F] [/S] [/Q]
// [/A[[:]attributes]] names" (names required, switches are `/`-prefixed,
// not `-`); `truncate --help` -> "Usage: truncate OPTION... FILE..."
// with "-s, --size=SIZE" as the one value-taking option (FILE is a
// SEPARATE required operand from -s's own value) ---
// ships-if-missing (del): a Windows `/switch` is not `-`-prefixed, so
// D2's flag-detection never recognized it as a flag at all - `del /q`
// (no file) reads `/q` itself as the positional file operand.
// ships-if-missing (truncate): `-s 0`'s VALUE `0` is not `-`-prefixed
// either, so with no real FILE operand present it is miscounted as one -
// `truncate -s 0` (no file) reports a destruction on nothing.
test('del /q with no file operand is not a destruction', () => {
  assert.equal(verdictOf('del /q'), 'NO_MATCH');
});

test('del /f /s with no file operand is not a destruction', () => {
  assert.equal(verdictOf('del /f /s'), 'NO_MATCH');
});

test('del /q file.txt (a real Windows switch plus a real file) is still a destruction (control)', () => {
  assert.equal(verdictOf('del /q file.txt'), 'DESTRUCTION');
});

test('truncate -s 0 with no file operand is not a destruction', () => {
  assert.equal(verdictOf('truncate -s 0'), 'NO_MATCH');
});

test('truncate --size 0 with no file operand is not a destruction', () => {
  assert.equal(verdictOf('truncate --size 0'), 'NO_MATCH');
});

test('truncate -cs 0 (clustered value-taking flag) with no file operand is not a destruction', () => {
  assert.equal(verdictOf('truncate -cs 0'), 'NO_MATCH');
});

test('truncate -s 0 file (a real file alongside the value) is still a destruction (control)', () => {
  assert.equal(verdictOf('truncate -s 0 file'), 'DESTRUCTION');
});

test('truncate -s+10 (joined, value glued to the flag) with no file operand is still not a destruction (control, grow-safe already exempts it)', () => {
  assert.equal(verdictOf('truncate -s+10'), 'NO_MATCH');
});

// --- Group 51 (defence round 4, Set T3) - PowerShell Remove-Item
// aliases. CITED SOURCE: `Get-Alias -Definition Remove-Item`, RUN live on
// this host (PowerShell 5.1.26100.8972) this session -> del, erase, rd,
// ri, rm, rmdir. All but `ri` are already covered under their own
// spelling (del/rm/rmdir as DESTRUCTION_VERBS, erase/rd as
// NAMED_DESTROYER_VERBS) - `ri` is the one gap ---
// ships-if-missing: `ri foo.txt` - the alias every PowerShell user
// actually types - reports NO_MATCH although it IS Remove-Item.
test('ri is Remove-Item - full DESTRUCTION precision, not just an admission', () => {
  assert.equal(verdictOf('ri foo.txt'), 'DESTRUCTION');
});

test('ri -Recurse -Force build is a destruction', () => {
  assert.equal(verdictOf('ri -Recurse -Force build'), 'DESTRUCTION');
});

test('ri -WhatIf is still the dry-run switch through the alias (control - full remove-item precision carries over)', () => {
  assert.equal(verdictOf('ri -WhatIf foo.txt'), 'NO_MATCH');
});

test('RI is case-insensitive, matching every other verb resolution in this parser', () => {
  assert.equal(verdictOf('RI foo.txt'), 'DESTRUCTION');
});

// --- Group 52 (defence round 4, Set T4) - Move-Item / move / mi. CITED
// SOURCE: `Get-Alias -Definition Move-Item`, RUN live on this host
// (PowerShell 5.1.26100.8972) this session -> mi, move, mv. `mv` is
// already routed (POSIX mv, the same conditional semantics apply
// identically to Move-Item); `mi` and `move` (also cmd.exe's own move
// command, the same real operation under a third name) were not ---
// ships-if-missing: `move a b` and `mi a b` - Move-Item's cmd.exe and
// PowerShell-alias spellings - report NO_MATCH although they are the
// exact operation `mv` is already guarded for.
test('move (cmd.exe / PowerShell alias for Move-Item) carries mv-over-target semantics', () => {
  const result = parseCommand('move a b');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].conditional, true);
  assert.equal(result.findings[0].target, 'b');
});

test('move -n (no-clobber) is exempt, same as mv -n (control - full mv precision carries over)', () => {
  assert.equal(verdictOf('move -n a b'), 'NO_MATCH');
});

test('MOVE is case-insensitive', () => {
  assert.equal(verdictOf('MOVE a b'), 'DESTRUCTION');
});

// --- Group 53 (defence round 4, Set T5) - PowerShell's `-Name:Value`
// colon-binding syntax, beyond the one switch (-WhatIf) S1 taught it for.
// CITED SOURCE: PowerShell's parameter-binding syntax, VERIFIED
// empirically on this host's PowerShell 5.1 this session - a test
// function with a [string] parameter bound correctly via `-Path:foo.txt`
// exactly like `-Path foo.txt`, proving the colon form is not switch-
// specific. Boundary, stated: only remove-item is scoped (the only
// PowerShell cmdlet among DESTRUCTION_VERBS) ---
// ships-if-missing: `Remove-Item -Path:f.txt -Force` supplies its file
// entirely through colon syntax; the old flag-detection saw a token
// starting with `-` and skipped it as a plain flag, so no operand was
// ever recognized and the no-operand exemption fired on a command that
// names a real file.
test('Remove-Item -Path:f.txt (colon-bound value) supplies a real operand', () => {
  assert.equal(verdictOf('Remove-Item -Path:f.txt -Force'), 'DESTRUCTION');
});

test('-WhatIf:$false is still excluded from the colon-value operand rule (control - it is a switch, not a value parameter)', () => {
  assert.equal(verdictOf('Remove-Item -WhatIf:$false f.txt'), 'DESTRUCTION');
});

test('-WhatIf:$true alone (no other operand) still correctly finds no positional file (control)', () => {
  assert.equal(verdictOf('Remove-Item -WhatIf:$true'), 'NO_MATCH');
});

test("Set-Content -Value:'' (colon-joined empty value) still empties its target, the same rule applied to the verb it was found on", () => {
  assert.equal(verdictOf("Set-Content -Value:'' x"), 'OUT_OF_SCOPE');
  assert.equal(kindOf("Set-Content -Value:'' x"), 'unrouted');
});

// --- Group 54 (defence round 4, Set T6) - the WHOLE POSIX/bash
// redirection-operator table, enumerated against a source rather than
// patched two rows. CITED SOURCE: POSIX Open Group shell redirection
// table (fetched this session), cross-checked empirically against real
// bash on this host: a pre-existing rw.txt's content survived `<>` byte-
// for-byte, and `2>& 1` created no file named `1` (fd-duplication, per
// the standard, tolerates the same optional whitespace `2 > file`
// already does). Cross-checked against this file's OWN existing handling
// - < consumes-no-truncate, > truncates (fd1)/fd-out-of-scope (other),
// >> append-no-truncate, >| forced-truncate, <& / >& descriptor ops,
// << / <<- / <<< heredocs - all already correct; only <> and >&'s
// whitespace-tolerant operand were the gaps ---
// ships-if-missing (<>): `ls <> rw.txt` opens the target for READ-WRITE
// (POSIX: does not truncate) but the tokenizer read `<` then `>` as two
// SEPARATE operators, and the second one is an ordinary truncating `>`.
// ships-if-missing (>&, spaced): `2>& 1` is fd-duplication with
// whitespace before its digit operand (bash tolerates this the same way
// `2 > file` tolerates a space around any redirect operator); the digit
// search started immediately after `>&` with no whitespace-skip, so the
// space made the operand read empty and S5's own >&word synonym fired,
// truncating a file literally named `1`.
test('the whole redirection-operator table resolves correctly', () => {
  const cases = [
    ['ls <> rw.txt', 'NO_MATCH'],
    ['echo hi 2>& 1', 'NO_MATCH'],
    ['echo hi 2>&1', 'NO_MATCH'],
    ['echo hi >& out.txt', 'DESTRUCTION'],
    ['echo hi > out.txt', 'DESTRUCTION'],
    ['echo hi >> out.txt', 'NO_MATCH'],
    ['echo hi >| out.txt', 'DESTRUCTION'],
    ['cmd >&-', 'NO_MATCH'],
    ['cat <<EOF\nx\nEOF', 'OUT_OF_SCOPE'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

test('a real 2 fd-dup with a space still names no file (control, exact target check)', () => {
  const result = parseCommand('echo hi 2>& 1');
  assert.equal(result.findings.some((f) => f.target === '1'), false);
});

// --- Group 55 (defence round 4, T4 correction) - Move-Item's OWN
// semantics, not mv's. T4 aliased mi/move onto `mv` wholesale, but
// Move-Item never reaches mv's conditional analysis at all (`move-item`,
// the canonical cmdlet name, was not in the alias table), and even where
// `mi` did alias to `mv`, mv's unconditional-by-default overwrite model
// is WRONG for Move-Item. CITED SOURCE: empirically VERIFIED on this
// host's PowerShell 5.1 this session - bare `Move-Item a b` onto an
// existing b throws "Cannot create a file when that file already
// exists," touching neither file (provably safe regardless of runtime
// state); `Move-Item -Force a b` onto an existing b succeeds and
// overwrites it (conditional on b existing at runtime - the same model
// mv already has). cmd.exe's own `move` is DELIBERATELY left aliased to
// `mv` unchanged - a live probe suggested it also declines without /Y
// under non-interactive stdin, but that is a separate, murkier question
// this fix was not asked to resolve ---
// ships-if-missing: `Move-Item -Force a.txt b.txt` - a real, unconditional
// overwrite per the cmdlet's own documented behavior - reports NO_MATCH.
test('bare Move-Item (no -Force) is not a destruction - provably refuses to overwrite', () => {
  assert.equal(verdictOf('Move-Item a.txt b.txt'), 'NO_MATCH');
});

test('Move-Item -Force is a conditional destruction - the cmdlet documented overwrite path', () => {
  const result = parseCommand('Move-Item -Force a.txt b.txt');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].conditional, true);
  assert.equal(result.findings[0].target, 'b.txt');
});

test('mi -Force (the alias) carries the same Move-Item-specific semantics', () => {
  assert.equal(verdictOf('mi -Force a.txt b.txt'), 'DESTRUCTION');
});

test('bare mi (no -Force) is not a destruction, unlike plain mv (control - the alias no longer borrows mv semantics)', () => {
  assert.equal(verdictOf('mi a.txt b.txt'), 'NO_MATCH');
});

test('move /Y (cmd.exe, unaffected by this fix) is still a destruction (control)', () => {
  assert.equal(verdictOf('move /Y a.txt b.txt'), 'DESTRUCTION');
});

test('plain mv (POSIX, unaffected by this fix) still overwrites unconditionally by its own model (control)', () => {
  assert.equal(verdictOf('mv a.txt b.txt'), 'DESTRUCTION');
});

// --- Group 55 (defence round 5, Set U1) - the WHOLE truncate SIZE
// modifier grammar. CITED SOURCE: `truncate --help`, RUN live on this
// host - "SIZE may also be prefixed by one of the following modifying
// characters: '+' extend by, '-' reduce by, '<' at most, '>' at least,
// '/' round down to multiple of, '%' round up to multiple of." Axes:
// all six modifiers, short/long/joined spellings. '+' (extend) and '>'
// (at least - only grows if smaller) and '%' (round UP) can never
// shrink the file - the same provable-grow class the code already
// exempted for '+' alone. '-' (reduce), '<' (at most - only shrinks if
// larger) and '/' (round DOWN) can shrink and stay DESTRUCTION ---
// ships-if-missing: `truncate -s '>100' f` is a provable "extend if
// smaller, never shrink" but was flagged as a destruction because only
// the '+' prefix was recognized as grow-safe.
test('the whole truncate SIZE-modifier set resolves correctly', () => {
  const cases = [
    ["truncate -s '+10' f", 'NO_MATCH'],
    ["truncate -s '>100' f", 'NO_MATCH'],
    ["truncate -s '%2' f", 'NO_MATCH'],
    ["truncate --size='>100' f", 'NO_MATCH'],
    ["truncate -s '-10' f", 'DESTRUCTION'],
    ["truncate -s '<100' f", 'DESTRUCTION'],
    ["truncate -s '/2' f", 'DESTRUCTION'],
    ['truncate -s 0 f', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 56 (defence round 5, Set U2) - the no-op flag table must
// match each verb's OWN switch grammar, not a borrowed GNU one. CITED
// SOURCE: `del /?` and `rmdir /?`, both RUN live on this host - neither
// cmd.exe builtin has a `--`-prefixed switch at all (del: "[/P] [/F]
// [/S] [/Q] [/A[[:]attributes]]"; rmdir: "[/S] [/Q]"), so `--help`/
// `--version` are ordinary filename patterns for them, not no-ops.
// isWindowsSwitch was del-only although rmdir/rd share the exact same
// `/`-prefixed grammar ---
// ships-if-missing: `del --version important.txt` deletes the file
// while being reported NO_MATCH as if it were a help invocation; and
// `rmdir /?` (a genuine help call) is reported as a destruction.
test('the whole cmd.exe no-op-flag set resolves correctly', () => {
  const cases = [
    ['del --version important.txt', 'DESTRUCTION'],
    ['del --help important.txt', 'DESTRUCTION'],
    ['del /? important.txt', 'NO_MATCH'],
    ['rmdir /?', 'NO_MATCH'],
    ['rmdir /s /q build', 'DESTRUCTION'],
    ['rm --help', 'NO_MATCH'],
    ['rm --version', 'NO_MATCH'],
    ['truncate --help', 'NO_MATCH'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 56 correction (rot-canary, same round) - U2's own fix
// generalized `del`'s "no `--` switches" fact across the whole
// CMD_EXE_VERBS family without checking whether each member is
// DUAL-PLATFORM. `rmdir` is not Windows-only the way `del` is - it is
// also a real GNU coreutils tool. CITED SOURCE: `rmdir --help`, RUN
// live on this host (GNU coreutils, MSYS2 rmdir) - supports
// `--help`/`--version`/`--ignore-fail-on-non-empty`/`-p, --parents`
// like any other GNU tool. Axis U2 never checked: platform membership
// is not uniform across CMD_EXE_VERBS - `/?` is additive for rmdir,
// never exclusive of its GNU form ---
// ships-if-missing: `rmdir --help somedir` / `rmdir --version somedir`
// misclassify as DESTRUCTION although a real GNU rmdir just prints
// help/version and touches nothing - a live regression introduced by
// U2 in this same round, caught by rot-canary before it shipped.
test('rmdir is dual-platform: its GNU --help/--version survive alongside cmd.exe /? (correction)', () => {
  const cases = [
    ['rmdir --help somedir', 'NO_MATCH'],
    ['rmdir --version somedir', 'NO_MATCH'],
    ['rmdir --help', 'NO_MATCH'],
    ['rmdir /? somedir', 'NO_MATCH'],
    ['rmdir /s /q build', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

test('del stays Windows-only: --help/--version are NOT a no-op for it (control, unaffected by the correction)', () => {
  assert.equal(verdictOf('del --help important.txt'), 'DESTRUCTION');
  assert.equal(verdictOf('del --version important.txt'), 'DESTRUCTION');
});

// --- Group 65 (defence round 6, Set V1, CRITICAL) - parseCommand must
// never THROW. `classifyVerb`'s cp branch called
// `isNonFileSink(firstPositional(args))`; with no positional argument
// at all, `firstPositional` returns `undefined` and `isNonFileSink`
// handed it straight to `posix.normalize()`, which throws a TypeError.
// This is neither a false positive nor a false negative - it is NO
// VERDICT AT ALL, and in the PreToolUse hook this parser exists for, a
// thrown exception is a crashed guard that blocks nothing (Phoenix #4).
// Reachable behind any prefix (`sudo cp`). Fixed at the root:
// `isNonFileSink` now type-checks its own argument, so every current
// AND future call site is protected, not just the one that crashed ---
// ships-if-missing: `cp` and `cp -r` throw instead of returning a
// verdict.
test('cp with no positional operand does not throw and reports NO_MATCH', () => {
  assert.doesNotThrow(() => parseCommand('cp'));
  assert.doesNotThrow(() => parseCommand('cp -r'));
  assert.equal(verdictOf('cp'), 'NO_MATCH');
  assert.equal(verdictOf('cp -r'), 'NO_MATCH');
});

test('cp with no positional operand does not throw even behind a prefix (control)', () => {
  assert.doesNotThrow(() => parseCommand('sudo cp'));
  assert.equal(verdictOf('sudo cp'), 'NO_MATCH');
});

test('isNonFileSink itself never throws on a non-string argument', () => {
  assert.doesNotThrow(() => parseCommand('cp')); // exercises isNonFileSink(undefined)
});

// The broad sweep the dispatch asked for: every verb this parser's own
// classifyVerb recognizes by name, invoked bare and with flags only (no
// positional operand at all) - the exact shape that crashed cp. Every
// one of these must return a verdict object, never throw. Verb lists
// copied from parser.mjs's own sets (DESTRUCTION_VERBS, mv/move-item,
// cp, tee/clear-content/set-content, WRAPPER_SCRIPT_VERBS,
// POSIX_INTERPRETER_VERBS, WINDOWS_ONE_LINER_VERBS, PKG_MANAGERS,
// NAMED_DESTROYER_VERBS, git, npx, cmd) so a future verb addition to
// any of those sets is exercised here too once copied over.
const EVERY_LISTED_VERB = [
  'rm', 'rmdir', 'unlink', 'truncate', 'del', 'remove-item',
  'mv', 'move-item', 'cp', 'tee', 'clear-content', 'set-content',
  'bash', 'sh', 'zsh', 'ksh', 'dash', 'source', '.',
  'node', 'python', 'python3', 'perl', 'ruby',
  'pwsh', 'powershell',
  'npm', 'yarn', 'pnpm', 'bun',
  'shred', 'dd', 'eval', 'erase', 'rd',
  'git', 'npx', 'cmd',
];

// --- Group 66 (defence round 6, Set V2) - AXIS: sibling spelling
// (path-qualified / .exe-suffixed), applied to the PREFIX word instead
// of the candidate verb. `verbAt` already normalizes every CANDIDATE
// verb with `basenameOf` + `stripExeExtension` before matching; the
// prefix-chain walk in `resolveVerb` compared the RAW token instead -
// one rule, applied at one site and not the other ---
// ships-if-missing: `/usr/bin/time rm -rf build` really runs `rm -rf
// build` (unqualified `time rm -rf build` is correctly DESTRUCTION),
// but the path-qualified prefix defeats the whole chain and is
// silently NO_MATCH.
test('the whole path-qualified / .exe-suffixed prefix set resolves correctly', () => {
  const cases = [
    ['/usr/bin/time rm -rf build', 'DESTRUCTION'],
    ['/usr/bin/sudo rm -rf build', 'DESTRUCTION'],
    ['sudo.exe rm -rf build', 'DESTRUCTION'],
    ['/bin/nice -n 10 rm -rf build', 'OUT_OF_SCOPE'],
    ['time rm -rf build', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 67 (defence round 6, Set V3) - AXIS: sibling operator-
// context (a NEW axis - not sibling flag/verb/value-form/platform).
// `pushSeparator()` resets `bracketDepth`/`parenDepth` on EVERY
// SEGMENT_SEPARATORS op including `&&`/`||`, but bash's `[[ ... ]]`
// test and `(( ... ))` arithmetic context take their OWN `&&`/`||`
// internally (CITED, verified live on this host's bash:
// `[[ -f a || $b ]] > /dev/null` and `[[ $x -eq 1 && $x -lt 5 ]]` both
// run as ONE test, never split at the `&&`/`||`). Scoped to exactly
// `&&`/`||` (what was cited and tested) - a bare `&`/`|` inside
// `(( ))`'s own bitwise operators is a NAMED, NOT-YET-COVERED boundary
// (uncited here) ---
// ships-if-missing: `[[ -f a && $b > c ]]` truncates nothing (a pure
// string comparison) but is reported as a truncating redirect to `c`,
// because bracketDepth/parenDepth reset at the `&&` and every later
// `>` becomes a real redirect.
test('the whole &&/|| inside [[ ]] and (( )) context set resolves correctly', () => {
  const cases = [
    ['[[ -f a && $b > c ]]', 'NO_MATCH'],
    ['[[ $x == a || $y > b ]]', 'NO_MATCH'],
    ['[[ $a > $b && $c > $d ]]', 'NO_MATCH'],
    ['if (( x > 0 && y > 1 )); then echo hi; fi', 'NO_MATCH'],
    ['[[ "$a" > "$b" ]]', 'NO_MATCH'],
    ['[[ -f a && -f b ]]', 'NO_MATCH'],
    ['if (( $# > 0 )); then echo hi; fi', 'NO_MATCH'],
    ['echo hi && rm -rf x', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 68 (defence round 6, Set V4) - AXIS: sibling value-form,
// generalized to a RECURSIVE property (the third time this gate has
// produced a finding). `isCommandPosition` opened a `[[` test whenever
// the PREVIOUS word's SPELLING matched a preceder, regardless of
// whether that word was itself quoted OR itself in command position -
// `do`/`then`/etc as an ORDINARY ARGUMENT (`echo do [[ ... ]]`) is not
// the keyword, the same way a quoted `[[` is not the keyword (V3
// round 5's fix, same mechanism one token further left). Fixed by
// giving every word token a `commandPos` flag computed at push time
// (was I in a keyword-legal slot when I was pushed?), then requiring
// BOTH `!quoted` AND `prev.commandPos` before a preceder can open a
// test ---
// ships-if-missing: `echo do [[ a > out.txt ]]` truncates `out.txt` for
// real (`do` is just echo's plain argument, `[[` never opens a test)
// but is reported NO_MATCH, because the phantom test swallows the
// genuine `>` redirect. The DANGEROUS direction: a real destruction
// goes silent, not a false alarm.
test('the whole isCommandPosition quoting/position set resolves correctly', () => {
  const cases = [
    ['echo "do" [[ a > out.txt ]]', 'DESTRUCTION'],
    ['echo do [[ a > out.txt ]]', 'DESTRUCTION'],
    ['echo then [[ x > y ]]', 'DESTRUCTION'],
    ['echo hi [[ x > y ]]', 'DESTRUCTION'],
    ['if [[ -f a ]]; then rm b; fi', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 69 (defence round 7, Part 3) - parseCommand must return one
// of the three verdicts for EVERY input, never throw. Walked every
// built-in that can raise on bad input reachable from parseCommand
// (path.normalize - the V1 site, already type-guarded; RegExp .test/
// .exec - coerce via ToString, never throw on non-string; String
// methods on a token .value - always a string, tokens are built from
// slices of the input string itself; array indexing after a `.length`
// or `!== -1` guard at every site). Fuzzed live (not just read) with
// type-abuse, empty/whitespace/operator-only input, unterminated
// quotes/heredocs/backslash, 1M-char tokens, lone UTF-16 surrogates,
// 5000-deep nesting, and edge option shapes (bare `--`, `-t` with
// nothing after it, a trailing colon with no value) - zero throws ---
// ships-if-missing: any one of these inputs raises instead of
// returning a verdict, and a PreToolUse hook built on this parser
// crashes instead of blocking.
test('parseCommand never throws - pathological and adversarial inputs', () => {
  const cases = [
    '', '   ', '\t\n', ';;;;;', '&&&&', '||||', '>>>>>', '<<<<<',
    '((((((', '[[[[[[', ']]]]]]', '"', "'", '\\',
    'a'.repeat(1_000_000),
    '\uD800', '\uDC00', '𐀀rm',
    '$', '$(', '$((', '<<EOF', '2>&', '>&',
    null, undefined, 123, {}, [], true, Symbol('x'),
    'cp --', 'mv --', 'mv -t', 'mv -t ',
    'truncate -s', 'truncate --size', 'truncate --size=',
    'Remove-Item -WhatIf:', 'Remove-Item -Path:',
    '('.repeat(5000), '['.repeat(5000),
    'echo >', 'echo <',
    'a'.repeat(50) + '>' + 'b'.repeat(50000),
    ' ', 'rm -rf',
    '2>&' + '9'.repeat(5000),
    'mv -- --', 'cp -t',
  ];
  for (const c of cases) {
    let result;
    assert.doesNotThrow(() => { result = parseCommand(c); }, String(c));
    assert.ok(
      result && ['DESTRUCTION', 'OUT_OF_SCOPE', 'NO_MATCH'].includes(result.verdict),
      `${String(c)} -> ${JSON.stringify(result)}`,
    );
  }
});

// --- Group 70 (defence round 7, Set W1) - AXIS 5 (structural context,
// separator-elision sub-case). `for (( ; ; ))` may omit the `;` before
// `do` (CITED, verified live on this host's bash this dispatch:
// `for ((i=0;i<2;i++)) do echo hi; done` runs; `while true do ...`
// with NO `((`/`]]` header is a syntax error - the free pass is keyed
// to the closing token, not to `for` specially). `while`/`until`/`if`
// already degrade SAFELY to OUT_OF_SCOPE/unjudged in this shape
// (they're already SHELL_KEYWORDS members, so the generic
// secondary-candidate walk still finds a listed verb by name) - `for`
// is not a SHELL_KEYWORDS member at all, so it took the DIRECT path
// with no walk and produced a silent NO_MATCH, the worst of the three
// outcomes. Fixed by giving `for` its OWN resolveVerb handling: scan
// forward for the segment's own `do` and resume the walk immediately
// after it, rather than a single-token skip (for's own next tokens
// are a loop variable or `((`, never the command) ---
// ships-if-missing: `for ((i=0;i<2;i++)) do rm x; done` deletes `x`
// for real (a legal, working, destructive loop) while this parser
// reports NO_MATCH - the loop body is never looked at.
test('the whole for-loop separator-elision set resolves correctly', () => {
  const cases = [
    ['for ((i=0;i<2;i++)) do rm x; done', 'DESTRUCTION'],
    ['for ((i=0;i<2;i++)); do rm x; done', 'DESTRUCTION'],
    ['for ((i=0;i<2;i++)) do echo hi; done', 'NO_MATCH'],
    ['for f in a b; do rm $f; done', 'DESTRUCTION'],
    ['while (( i++ < 3 )) do rm x; done', 'OUT_OF_SCOPE'],
    ['until (( i++ > 3 )) do rm x; done', 'OUT_OF_SCOPE'],
    ['if (( 1 )) then rm x; fi', 'OUT_OF_SCOPE'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 71 (defence round 7, Set W2) - AXES 1 (spelling - the long
// `--target-directory` form of `-t` was entirely unrecognized) and 3
// (override order does not apply here, but the SAME "one option, more
// than one code-checked spelling" completeness failure the axis
// derivation groups under axis 1's option-table sense). CITED SOURCE:
// `mv --help`, RUN live on this host - "-t, --target-directory=
// DIRECTORY move all SOURCE arguments into DIRECTORY" and
// "--backup[=CONTROL] ... -b (like --backup but does not accept an
// argument)". Three defects, one table:
//   (a) `--target-directory`/`--target-directory=DIR` were not
//       recognized at all, so a real DIRECTORY word was miscounted as
//       a SOURCE and the WRONG file reported as the target;
//   (b) even the already-recognized `-t DIR` reported the DIRECTORY
//       itself as the conditional target - a directory that must
//       already exist for the command to run at all, so `mv -t` ALWAYS
//       blocked regardless of whether anything was overwritten. Fixed:
//       the target is now the real at-risk path, DIRECTORY joined with
//       the last SOURCE's basename (pure string join, no filesystem
//       access - ruling 3 holds);
//   (c) `--backup`/`-b` is GNU mv's OWN recoverability switch - the
//       existing target is renamed, never lost. Under this room's own
//       founding ruling (recoverability, per operation), the one mv
//       spelling that is PROVABLY recoverable was being flagged anyway
//       - the exact inversion of the design ---
// ships-if-missing (a,b): `mv -t /tmp a b` reports `/tmp` as the
// conditional target - a directory that always exists - so every
// `mv -t` invocation blocks unconditionally. ships-if-missing (c):
// `mv --backup=numbered a b` is flagged as an unrecoverable
// destruction although GNU mv itself just renamed the old `b` aside.
// Targets updated (defence round 8, Set Y2a): every SOURCE is now its
// own finding, not just the last - see 'mv reports every source under a
// target directory, not just the last (Set Y2a)' for the dedicated test.
test('the whole mv --target-directory / --backup set resolves correctly', () => {
  const cases = [
    ['mv -t /tmp a b', 'DESTRUCTION', ['/tmp/a', '/tmp/b']],
    ['mv --target-directory=/tmp a b', 'DESTRUCTION', ['/tmp/a', '/tmp/b']],
    ['mv --target-directory /tmp a b', 'DESTRUCTION', ['/tmp/a', '/tmp/b']],
    ['mv -t /tmp src1 src2 src3', 'DESTRUCTION', ['/tmp/src1', '/tmp/src2', '/tmp/src3']],
    ['mv --backup=numbered a b', 'NO_MATCH', undefined],
    ['mv --backup a b', 'NO_MATCH', undefined],
    ['mv -b a b', 'NO_MATCH', undefined],
    ['mv a b', 'DESTRUCTION', ['b']],
  ];
  for (const [cmd, expected, targets] of cases) {
    const result = parseCommand(cmd);
    assert.equal(result.verdict, expected, cmd);
    if (targets !== undefined) {
      assert.deepEqual(result.findings.map((f) => f.target), targets, cmd);
    }
  }
});

// --- Group 72 (defence round 7, Set W3) - AXIS 5 (structural context -
// an explicit fd changes what a following `&word` means; an empty
// target is not a valid file target at all, regardless of device-list
// membership). CITED SOURCE: bash's own redirection grammar, RUN live
// on this host this round - `ls 2>&file` errors "ambiguous redirect"
// and creates NOTHING (the `>&word` == `&>word` synonym is documented
// as conditional on fd being OMITTED - an EXPLICIT fd before `>&word`
// is a fd-duplication attempt with an invalid operand, a hard error,
// never a truncating redirect to a named file); `echo hi > ""` errors
// "No such file or directory" and creates NOTHING (an empty-string
// path is rejected outright, not a device this parser already knows
// about but still not a real file) ---
// ships-if-missing (fd-discard): `ls 2>&file` is reported as DESTRUCTION
// truncating `file`, although bash's own grammar makes this construct
// an error that touches nothing.
// ships-if-missing (empty target): `echo hi > ""` is reported as a
// destruction with an EMPTY target field, a downstream hazard for any
// remedy computed from it.
test('the whole [n]>&word fd-discard and empty-target set resolves correctly', () => {
  const cases = [
    ['ls 2>&file', 'NO_MATCH'],
    ['ls >& out.txt', 'DESTRUCTION'],
    ['ls 2>& 1', 'NO_MATCH'],
    ['echo hi > ""', 'NO_MATCH'],
    ["echo hi > ''", 'NO_MATCH'],
    ['echo hi > f', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 73 (defence round 7, Set W4) - AXIS 1 (spelling - a THIRD
// spelling of the verb `rm`, escape-DECODED rather than a bare quoted
// literal). Round 5's U6 closed the quoting FORM of `$'...'` (the `$`
// consumed, content taken literally) but explicitly named escape
// decoding as an unclosed boundary - this closes it. CITED, verified
// live on this host's bash this round: `$'\x72\x6d'` and
// `$'\162\155'` both decode to the word `rm` and run it ---
// ships-if-missing: `$'\x72\x6d' -rf x` deletes `x` for real (bash
// decodes the hex escape to `rm` and runs it) while this parser
// reports NO_MATCH, because the escape sequence was taken as ten
// literal characters instead of being decoded.
test('the whole ANSI-C escape-decoding set resolves correctly', () => {
  const cases = [
    ["$'\\x72\\x6d' -rf x", 'DESTRUCTION'],
    ["$'\\162\\155' -rf x", 'DESTRUCTION'],
    ["$'rm' f", 'DESTRUCTION'],
    ["$'r\\x6d' f", 'DESTRUCTION'],
    ["echo hi > $'\\x66'", 'DESTRUCTION'],
    ["$'echo' hi", 'NO_MATCH'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 74 (defence round 7, Set W5) - AXES 4 (platform - a `.cmd`/
// `.bat` file is a SCRIPT, not the coreutil it happens to be named
// after) and 1 (spelling - the two extension sets were drifting toward
// treating one spelling as a synonym of another they are not). CITED:
// this room's own two tables directly contradicting each other -
// `EXECUTABLE_EXTENSION_RE` stripped `.exe|.cmd|.bat|.com` before verb
// lookup (treating all four as "the same program under a decoration"),
// while `SCRIPT_EXTENSION` separately declared `.sh|.ps1|.py|.pl|.rb`
// out of scope as unread script files. `.exe`/`.com` are genuinely
// raw-binary executables - stripping them is a real precision gain,
// nothing to read. `.cmd`/`.bat` are batch SCRIPT FILES - arbitrary
// user-authored content, exactly the class `SCRIPT_EXTENSION` already
// exists to decline judging. Moved `.cmd`/`.bat` from the stripped set
// to the recognized-script set - the set that gets STRIPPED and the
// set recognised as a SCRIPT must stay different, and now do ---
// ships-if-missing: `./rm.cmd x` classifies as `DESTRUCTION` with `rm`'s
// own precise argument grammar applied to a script file nobody read -
// any repo shipping a wrapper named `rm.cmd`/`del.bat`/`mv.cmd` gets it
// blocked as if it were the coreutil itself.
test('the whole .cmd/.bat script-vs-executable set resolves correctly', () => {
  const cases = [
    ['./rm.cmd x', 'OUT_OF_SCOPE'],
    ['./del.bat x', 'OUT_OF_SCOPE'],
    ['./mv.cmd a b', 'OUT_OF_SCOPE'],
    ['./truncate.bat f', 'OUT_OF_SCOPE'],
    ['./rm.sh x', 'OUT_OF_SCOPE'],
    ['rm.exe x', 'DESTRUCTION'],
    ['del.exe x', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 75 (defence round 7, Set W6, part 1) - AXIS 6 (invocation
// channel - PowerShell's OWN documented binding model: a parameter can
// bind "ValueFromPipeline", not only positionally or by name). The
// `!hasPositional -> NO_MATCH` exemption is sound for POSIX verbs (a
// bare `rm -rf` really is a usage error touching nothing) and unsound
// for `Remove-Item`, whose `-Path` parameter binds from a pipeline
// stage - the single most common way an agent deletes a file set in
// PowerShell. Scoped to `remove-item` only (the one verb with real
// pipeline-binding cited/tested here) - POSIX verbs read argv, not
// stdin, so a POSIX `cmd | rm` genuinely does not feed rm an operand
// this way, and this fix does not touch them ---
// ships-if-missing: `Get-ChildItem *.log | Remove-Item -Force` deletes
// every matched file for real (the pipeline supplies -Path) while this
// parser reports NO_MATCH, because every token in the `Remove-Item`
// segment is flag-shaped and the exemption sees "no operand".
test('the whole Remove-Item pipeline-binding set resolves correctly', () => {
  const cases = [
    ['Get-ChildItem *.log | Remove-Item -Force', 'DESTRUCTION'],
    ['Get-ChildItem | Remove-Item -Recurse -Force', 'DESTRUCTION'],
    ['Remove-Item -Force', 'NO_MATCH'],
    ['ls | echo', 'NO_MATCH'],
    ['rm -rf build', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 76 (defence round 7, Set W6, part 2) - AXES 1 (spelling)
// and 7 (site - the audit's own T3 row: the alias mechanism was never
// applied to name-routed verbs). CITED SOURCE: `Get-Alias -Definition
// Clear-Content` and `Get-Alias -Definition Set-Content`, BOTH RUN
// live on this host this round (not just the one reported alias) -
// `clc -> Clear-Content` is Clear-Content's only alias; `sc ->
// Set-Content` is Set-Content's only alias and stays EXCLUDED, already
// documented (collides with sc.exe, the Windows Service Controller).
// `verbAt`'s own alias-resolution already runs universally for every
// verb candidate before any name check - the gap was purely a missing
// TABLE ENTRY, not a missing code path, confirmed by adding exactly
// one line and nothing else ---
// ships-if-missing: `clc notes.txt` empties `notes.txt` for real
// (Clear-Content's own alias) while this parser reports NO_MATCH.
test('clc (Clear-Content alias) resolves through the same alias mechanism as ri/mi', () => {
  assert.equal(verdictOf('clc notes.txt'), 'OUT_OF_SCOPE');
  assert.equal(verdictOf('Clear-Content notes.txt'), 'OUT_OF_SCOPE');
});

// --- Group 77 (defence round 7, Set W7, part 1) - AXIS 5 (structural
// context - a NEW manifestation: single `&`/`|` are `(( ))`'s own
// bitwise operators, the boundary V3 (round 6) named as not-yet-
// covered when it closed `&&`/`||`). CITED, verified live on this
// host's bash this round: `echo $(( 5 & 3 ))` -> `1`,
// `echo $(( 5 | 2 ))` -> `7` - neither ends the arithmetic expression.
// Scoped to `parenDepth` ONLY, never `bracketDepth`: CITED, verified
// live - a bare `&` or `|` inside `[[ ]]` is a bash SYNTAX ERROR
// ("conditional binary operator expected" / "unexpected token"), not a
// valid operator there at all - `[[ ]]` and `(( ))` are NOT the same
// exemption for these two, unlike `&&`/`||` which both contexts
// genuinely accept ---
// ships-if-missing: `echo $(( 5 & 3 )) > f` or a genuine destructive
// verb after a bitwise-AND/OR arithmetic expression misreads the `&`/
// `|` as ending the expression early.
test('the whole single &/| bitwise-in-(( )) set resolves correctly', () => {
  const cases = [
    ['echo $(( 5 & 3 ))', 'NO_MATCH'],
    ['echo $(( 5 | 2 ))', 'NO_MATCH'],
    ['if (( 5 & 1 )); then rm x; fi', 'DESTRUCTION'],
    ['if (( 5 | 2 )); then rm x; fi', 'DESTRUCTION'],
    ['echo hi & rm -rf x', 'DESTRUCTION'],
    ['echo hi | rm -rf x', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 78 (defence round 7, Set W7, part 2) - AXES 5+7 (site -
// `analyzeDestructionVerb`'s own main loop already honours `--` end-
// of-options, the same site-consistency gap U4 closed for
// `lastMvOverride` vs `analyzeMv`'s positional loop; `truncateGrowSize`
// is a SIBLING helper scanning the SAME args array for a different
// purpose and had no `--` awareness at all). `cp`'s own null-sink
// check (`firstPositional`) was AUDITED, not found broken: it already
// treats `--` as flag-shaped (correctly skipped, never mistaken for
// the source) via the existing generic `isFlagShaped` walk - the
// residual imprecision (a source literally named `-foo` immediately
// after `--`) does not create a destructive-vs-safe miscall and is a
// named, not-fixed boundary, not a defect this round closes ---
// ships-if-missing: `truncate -- --size=+10 f` misreads the LITERAL
// FILENAME `--size=+10` as a grow-safe size flag (option parsing ended
// at `--`, so it is not a flag at all) and exempts a real destruction.
test('the whole truncate -- end-of-options set resolves correctly', () => {
  const cases = [
    ['truncate -- --size=+10 f', 'DESTRUCTION'],
    ['truncate --size=+10 f', 'NO_MATCH'],
    ['truncate -- -s f', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

test('no listed verb throws when invoked bare or with flags only', () => {
  for (const verb of EVERY_LISTED_VERB) {
    for (const cmd of [verb, `${verb} -f`, `${verb} --flag`]) {
      let result;
      assert.doesNotThrow(() => { result = parseCommand(cmd); }, cmd);
      assert.ok(
        result && ['DESTRUCTION', 'OUT_OF_SCOPE', 'NO_MATCH'].includes(result.verdict),
        `${cmd} -> ${JSON.stringify(result)}`,
      );
    }
  }
});

// --- Group 57 (defence round 5, Set U3) - a `[[` only opens a bracket
// test when it is a BARE, unquoted, unescaped keyword. `opensTest`
// gated on command position but never on `quoted` - a quoted or
// backslash-escaped `[[` is an ordinary word (bash strips its
// keyword-hood the same way quoting/escaping strips any keyword's),
// so the redirect after it is real. Fixed at the source: the tokenizer
// now also marks a backslash-escaped word as `quoted` (matching what
// quoting already means for `fdPrefixAdjacent`'s digit check) ---
// ships-if-missing: `'[[' > f` truncates `f` (bash creates/empties it
// before "command not found" prints) while this parser reports
// NO_MATCH, because the quoted word still opened `bracketDepth` and
// every later `>` in the segment was demoted to an inert word.
test('the whole quoted/escaped [[ set resolves correctly', () => {
  const cases = [
    ["'[[' > f", 'DESTRUCTION'],
    ['"[[" > f', 'DESTRUCTION'],
    ['\\[\\[ > f', 'DESTRUCTION'],
    ['! "[[" > f', 'DESTRUCTION'],
    ['if "[[" > f; then :; fi', 'DESTRUCTION'],
    ['[[ -f a ]] > f', 'DESTRUCTION'],
    ['if [[ -f a ]]; then rm b; fi', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 58 (defence round 5, Set U4) - `lastMvOverride` must honour
// `--` (end of options) the same way `analyzeMv`'s own positional loop
// already does. After `--`, `-n` is the SOURCE FILENAME, not
// `--no-clobber` - two option-grammar models in one function,
// disagreeing, was the defect ---
// ships-if-missing: `mv -- -n b` overwrites `b` for real (the mv
// really runs, `-n` is just a file named `-n`) but this parser exempts
// it as if `-n` had won the no-clobber override.
test('the whole mv -- (end of options) set resolves correctly', () => {
  const cases = [
    ['mv -- -n b', 'DESTRUCTION'],
    ['mv -n -- a b', 'NO_MATCH'],
    ['mv -n a b', 'NO_MATCH'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 59 (defence round 5, Set U5, part 1) - Move-Item's -Force
// switch-value binding, byte-for-byte the -WhatIf:$false defect one
// verb over. `-Force:$false` means the switch is OFF, so Move-Item
// keeps its throw-on-existing-target behaviour and overwrites nothing -
// analyzeMoveItem accepted any `-force:` prefix as force-on regardless
// of the value ---
// ships-if-missing: `Move-Item -Force:$false a b` reports DESTRUCTION
// although the switch is explicitly off and nothing is overwritten.
test('the whole Move-Item -Force switch-value set resolves correctly', () => {
  const cases = [
    ['Move-Item -Force a b', 'DESTRUCTION'],
    ['Move-Item -Force:$true a b', 'DESTRUCTION'],
    ['Move-Item -Force:true a b', 'DESTRUCTION'],
    ['Move-Item -Force:1 a b', 'DESTRUCTION'],
    ['Move-Item -Force:$false a b', 'NO_MATCH'],
    ['Move-Item -Force:false a b', 'NO_MATCH'],
    ['Move-Item -Force:0 a b', 'NO_MATCH'],
    ['Move-Item a b', 'NO_MATCH'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 60 (defence round 5, Set U5, part 2) - Remove-Item's
// -WhatIf prefix floor. CITED SOURCE: `(Get-Command Remove-Item).
// Parameters.Keys`, RUN live on this host (PowerShell 5.1.26100.8972) -
// only THREE parameters start with `W`: WarningAction, WarningVariable,
// WhatIf. `-W` is ambiguous (matches three); `-Wh` is unique (the other
// two continue `Wa`), so PowerShell's own shortest-unambiguous-prefix
// rule sets the real floor at 3, not the 4 this room had hand-drawn
// inside a set it otherwise ran correctly ---
// ships-if-missing: `Remove-Item -wh f` is a genuine dry run (PowerShell
// binds -wh to -WhatIf) but was reported DESTRUCTION because the floor
// was one character too high.
test('the whole Remove-Item -WhatIf prefix-floor set resolves correctly', () => {
  const cases = [
    ['Remove-Item -wh f', 'NO_MATCH'],
    ['Remove-Item -what f', 'NO_MATCH'],
    ['Remove-Item -whatif f', 'NO_MATCH'],
    ['Remove-Item -w f', 'DESTRUCTION'],
    ['Remove-Item f', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 61 (defence round 5, Set U6) - ANSI-C (`$'...'`) and
// locale-translation (`$"..."`) quoting. Bash expands `$'rm'` to the
// word `rm` and runs it (backslash escapes inside are ANSI-C decoded -
// out of scope here, the boundary this fix accepts: content is taken
// literally like a plain quoted string, only the introducing `$` is
// stripped). `$"..."` with no translation catalog loaded yields the
// literal string the same way. The tokenizer treated `$` as an ordinary
// word character, so the verb read as `$rm`, matching nothing ---
// ships-if-missing: `$'rm' f` and `$"rm" f` both delete `f` for real
// while this parser reports NO_MATCH.
test('the whole ANSI-C / locale quoting set resolves correctly', () => {
  const cases = [
    ["$'rm' f", 'DESTRUCTION'],
    ['$"rm" f', 'DESTRUCTION'],
    ["echo hi > $'f'", 'DESTRUCTION'],
    ["echo 'rm -rf /'", 'NO_MATCH'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 62 (defence round 5, Set U7) - the `cp` null-sink SOURCE
// check must find the source positionally, not assume it is args[0].
// The room already NAMES `cp` from a null-sink as a destroyer it
// declines to route - the check itself was positional-only, so any
// flag in front of the source defeated it ---
// ships-if-missing: `cp -f /dev/null f` truncates `f` exactly as the
// routed spelling does, but reports NO_MATCH because `/dev/null` was
// not args[0].
test('the whole cp null-sink-source set resolves correctly', () => {
  const cases = [
    ['cp /dev/null f', 'OUT_OF_SCOPE'],
    ['cp -f /dev/null f', 'OUT_OF_SCOPE'],
    ['cp -v -f /dev/null f', 'OUT_OF_SCOPE'],
    ['cp a b', 'NO_MATCH'],
    ['cp -f a b', 'NO_MATCH'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 63 (defence round 5, Set U8, part 1) - a prefix chain that
// consumes every word (`exec` with nothing after it) must not drop a
// PENDING unjudged redirect admission. `analyzeSegment` computes
// `fdOutOfScope` before verb resolution; `resolveVerb` returning null
// (the prefix consumed everything) fell straight to a silent NO_MATCH,
// discarding a construct the parser had already decided it could not
// judge. Compare `01> f`, which correctly reports OUT_OF_SCOPE - this
// is the same admission, just reached through a prefix instead of
// directly ---
// ships-if-missing: `exec 3> f` truncates `f` for real (a non-stdout
// fd, `exec` alone with a redirect applies it to the whole shell) while
// this parser reports NO_MATCH - a real in-scope truncation reported as
// silence.
test('a prefix chain consuming every word still reports its pending unjudged redirect', () => {
  assert.equal(verdictOf('exec 3> f'), 'OUT_OF_SCOPE');
});

test('01> f is still OUT_OF_SCOPE, unaffected by the exec fix (control)', () => {
  assert.equal(verdictOf('01> f'), 'OUT_OF_SCOPE');
});

test('exec rm -rf build is still a destruction, unaffected by the exec fix (control)', () => {
  assert.equal(verdictOf('exec rm -rf build'), 'DESTRUCTION');
});

// --- Group 64 (defence round 5, Set U8, part 2) - `mv`'s own no-op
// exemptions never reached `analyzeMv` - the GNU `--help`/`--version`
// no-op rule `isNoOpFlag` already applies to rm/truncate/del (mv is a
// GNU coreutils tool too, not a new claim), and a bare invocation (no
// operands at all) touches nothing, the same "no positional argument"
// exemption class `analyzeDestructionVerb` already grants. Both fell
// through to the generic "argument shape not recognized" `unjudged`
// admission instead - inflating the room's own ceiling metric with
// commands the parser reads perfectly (the Group K class again) ---
// ships-if-missing: `mv --help` destroys nothing yet fires the remedy
// and counts against `unjudged`.
test('the whole mv no-op set resolves correctly', () => {
  const cases = [
    ['mv --help', 'NO_MATCH'],
    ['mv --version', 'NO_MATCH'],
    ['mv', 'NO_MATCH'],
    ['mv a b', 'DESTRUCTION'],
  ];
  for (const [cmd, expected] of cases) {
    assert.equal(verdictOf(cmd), expected, cmd);
  }
});

// --- Group 79 (defence round 8, Set X1) - the ALL-OUTPUTS re-check's own
// finding: the axis-8 derivation (round 7) enumerated every axis against
// the VERDICT output only; nobody re-checked axis 1/SITE against the
// TARGET output. CITED SOURCE: `mv --help`, RUN live on this host -
// "mv [OPTION]... SOURCE... DIRECTORY" - three or more operands with no
// -t/--target-directory means the LAST operand IS the destination
// DIRECTORY (the same concept -t names explicitly, triggered by ARITY
// instead of a flag). The -t branch (Set W2, defence round 7) already
// computes the real at-risk path this way for the flagged form; this
// flagless 3+-operand form fell through to the 2-operand "literal
// rename" branch instead, reporting the DIRECTORY itself as though it
// were a FILE about to be overwritten - same SITE gap shape as W2's own
// finding, one branch fixed and its sibling not.
// ships-if-missing: `mv a b c` reports `c` (a directory that must
// already exist for the command to run at all, so this always "blocks")
// instead of `c/b`, the real at-risk path. Targets updated (defence
// round 8, Set Y2a): every source before the directory is its own
// finding now, not just the last - see 'mv reports every source under a
// target directory, not just the last (Set Y2a)' for the dedicated test.
test('mv with 3+ operands and no -t treats the last as an implicit target directory', () => {
  const cases = [
    ['mv a b', 'DESTRUCTION', ['b']],
    ['mv a b c', 'DESTRUCTION', ['c/a', 'c/b']],
    ['mv a b c d', 'DESTRUCTION', ['d/a', 'd/b', 'd/c']],
  ];
  for (const [cmd, expected, targets] of cases) {
    const result = parseCommand(cmd);
    assert.equal(result.verdict, expected, cmd);
    assert.deepEqual(result.findings.map((f) => f.target), targets, cmd);
  }
});

// --- Group 80 (defence round 8, Set X2) - AXIS 5 (structural context) +
// AXIS 7 (SITE): `--` end-of-options is already honoured by `analyzeMv`'s
// own positional loop and by `lastMvOverride`/`truncateGrowSize` (Set
// U4/W7's own fix) - `mvTargetDirectory` scans the SAME `args` array for
// a different purpose and had no `--` awareness at all, so a literal
// FILE spelled `--target-directory=foo` after `--` was mistaken for the
// flag itself.
// ships-if-missing: `mv -- --target-directory=foo bar` (a 2-source
// literal rename, `--target-directory=foo` being an ordinary filename)
// reports a fabricated `foo/bar` target instead of the real `bar`.
test('mvTargetDirectory honours -- end-of-options (Set X2)', () => {
  const result = parseCommand('mv -- --target-directory=foo bar');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.equal(result.findings[0].target, 'bar');
});

// --- Group 81 (defence round 8, Set X3) - the ALL-OUTPUTS re-check's
// `conditional` cell: asserted `true` for mv/Move-Item's own DESTRUCTION
// shape in four prior tests, never asserted for the OTHER DESTRUCTION
// shape (a listed verb via `analyzeDestructionVerb`, or a truncating
// redirect) - both already correct by construction, neither locked by a
// test, so a future edit could flip either silently. Enumerating, not a
// behaviour change.
test('conditional is false for an unconditional destruction, true for a runtime-dependent one', () => {
  const cases = [
    ['rm -rf build', false],
    ['> important.log', false],
    ['mv a b', true],
    ['Move-Item -Force a b', true],
  ];
  for (const [cmd, expected] of cases) {
    const result = parseCommand(cmd);
    assert.equal(result.verdict, 'DESTRUCTION', cmd);
    assert.equal(result.findings[0].conditional, expected, cmd);
  }
});

// --- Group 82 (defence round 8, Set Y1) - the ALL-OUTPUTS re-check's own
// rank-1 empty cell: `analyzeDestructionVerb` (rm/rmdir/unlink/truncate/
// del/remove-item - the MAJORITY of this parser's guarded verb list)
// tracked a boolean (`hasPositional`) and discarded the token, so every
// DESTRUCTION finding from this path carried NO `target` at all, for any
// input. A remedy computed from the at-risk path cannot be built with
// nothing to name. Multiple operands (`rm a b c`) now report one finding
// PER path - the same "a segment carries N findings" model multi-segment
// commands already use, extended one level down.
// ships-if-missing: `rm -rf build` is DESTRUCTION with no target field;
// `rm a b c` reports only ONE of the three files actually deleted.
test('rm/rmdir/unlink/truncate/del/remove-item report every operand, one finding each (Set Y1)', () => {
  const single = parseCommand('rm -rf build');
  assert.equal(single.verdict, 'DESTRUCTION');
  assert.equal(single.findings.length, 1);
  assert.equal(single.findings[0].target, 'build');
  assert.equal(single.findings[0].verb, 'rm');
  assert.equal(single.findings[0].conditional, false);

  const multi = parseCommand('rm a b c');
  assert.equal(multi.verdict, 'DESTRUCTION');
  assert.deepEqual(multi.findings.map((f) => f.target), ['a', 'b', 'c']);
  assert.ok(multi.findings.every((f) => f.verb === 'rm' && f.conditional === false));

  const truncateCase = parseCommand('truncate -s 0 file');
  assert.equal(truncateCase.findings.length, 1);
  assert.equal(truncateCase.findings[0].target, 'file');

  // AXIS 6 (invocation channel) sibling check: the pipeline-bound
  // Remove-Item shape (Set W6) has no LEXICAL target at all - this stays
  // a single finding with no `target` field, not a regression, not a
  // crash on an absent operand list.
  const pipeBound = parseCommand('Get-ChildItem *.log | Remove-Item -Force');
  assert.equal(pipeBound.verdict, 'DESTRUCTION');
  assert.equal(pipeBound.findings.length, 1);
  assert.equal(pipeBound.findings[0].target, undefined);
  assert.equal(pipeBound.findings[0].conditional, true);
});

// --- Group 83 (defence round 8, Set Y2a) - AXIS 7 (SITE): the -t/
// implicit-directory branches (Set W2/X1) already compute the real
// at-risk path per source but only ever reported the LAST one - `mv -t
// /tmp a b` moves BOTH a and b into /tmp; only /tmp/b was findable.
// ships-if-missing: `mv -t /tmp a b` (or `mv a b c`) silently leaves one
// of two real at-risk paths unreported; a remedy built from the finding
// set rewrites one file and leaves the other genuinely destroyed.
test('mv reports every source under a target directory, not just the last (Set Y2a)', () => {
  const viaFlag = parseCommand('mv -t /tmp a b');
  assert.equal(viaFlag.verdict, 'DESTRUCTION');
  assert.deepEqual(viaFlag.findings.map((f) => f.target), ['/tmp/a', '/tmp/b']);

  const viaArity = parseCommand('mv a b c');
  assert.equal(viaArity.verdict, 'DESTRUCTION');
  assert.deepEqual(viaArity.findings.map((f) => f.target), ['c/a', 'c/b']);

  // The 2-operand form stays a single finding - still genuinely ambiguous
  // (rename vs move-into-existing-directory) without a runtime stat
  // (ruling 3), unaffected by this fix.
  const twoOperand = parseCommand('mv a b');
  assert.deepEqual(twoOperand.findings.map((f) => f.target), ['b']);
});

// --- Group 83b (defence round 8, Set Y2b) - AXIS 8 (BEHAVIOUR
// EQUIVALENCE): the dispatch that ordered Group 83 asked to give
// Move-Item the SAME "3+ positionals, last is a directory" treatment mv's
// own arity branch just got, on the strength of Move-Item's `-Path`
// parameter being array-typed. RAN before building it (this room's own
// T4 precedent): `Move-Item -Force a b c` (space-separated, a real
// command-line invocation, RUN live this session, PowerShell
// 5.1.26100.8972) THROWS "A positional parameter cannot be found that
// accepts argument 'dest'" and moves NOTHING - PowerShell's positional
// binder fills Path with exactly one bare token, Destination with the
// next, and has no third slot; array-typed does not mean array-greedy
// for positional binding. mv's own grammar is arity-greedy; Move-Item's
// is not - two constructs sharing a superficial shape do not thereby
// share a behaviour, the exact question axis 8 exists to ask.
// ships-if-missing: `Move-Item -Force a b c` is classified DESTRUCTION
// with a fabricated target, for a command that touches no file at all.
test('Move-Item with 3+ bare positionals is NO_MATCH - it throws and moves nothing (Set Y2b)', () => {
  assert.equal(verdictOf('Move-Item -Force a b c'), 'NO_MATCH');
  // The RAN-verified 2-operand form is unaffected (control).
  assert.equal(verdictOf('Move-Item -Force a b'), 'DESTRUCTION');
});

// --- Group 84 (defence round 8, Set Y2c) - same "several paths at risk,
// one reported" defect, a different SITE: `analyzeSegment`'s redirect
// classification used `.find()` (first match only) over every truncating
// redirect in a segment. CITED SOURCE: RAN live on this host's bash this
// round - `echo hi > a > b` truncates BOTH a (emptied) and b (receives
// "hi") - only the LAST redirect wins the write, but every earlier one
// in the chain still opens (and truncates) its own target file.
// ships-if-missing: `echo hi > a > b` reports only `a`; `b` is genuinely
// truncated and invisible to any remedy built from the finding set.
test('a segment with multiple real truncating redirects reports every one (Set Y2c)', () => {
  const result = parseCommand('echo hi > a > b');
  assert.equal(result.verdict, 'DESTRUCTION');
  assert.deepEqual(result.findings.map((f) => f.target), ['a', 'b']);
  assert.ok(result.findings.every((f) => f.conditional === false));
  // Single-redirect segments are unaffected (control).
  assert.deepEqual(parseCommand('> important.log').findings.map((f) => f.target), ['important.log']);
});
