// ponytail: 911 lines at declaration (defence round 3, Set S6) - over the
// 800-line file-length signal. Splitting today is deferred to a unit of
// its own: this round measured 65% of wave 3's findings as INTRODUCED by
// our own prior fixes, and a structural split immediately before wave 4
// would add surface we cannot yet attribute to either the split or a new
// destroyer. Split after the dry-round count is measured, not before.
//
// Pure Bash-command classifier. No filesystem access (ruling 3): a caller
// that needs a runtime fact (does mv's target exist?) gets a `conditional`
// flag and does its own stat. In scope: rm, rmdir, unlink, truncate,
// `> file` truncation, mv-over-an-existing-target, Remove-Item, del.
//
// Three-valued verdict, never boolean:
//   DESTRUCTION  - one of the in-scope verbs/redirects, here is what/where
//   OUT_OF_SCOPE - something here COULD destroy (a wrapper, a named direct
//                  destroyer not on the in-scope list, a construct this
//                  parser cannot see into) and this parser deliberately
//                  does not judge it
//   NO_MATCH     - no in-scope verb/redirect recognized. NOT a safety
//                  claim: it means "this parser's closed verb list did not
//                  match", nothing more. A caller must never read NO_MATCH
//                  as "safe" - a boolean "no destruction found" here is
//                  indistinguishable from "this command is safe", which is
//                  the exact failure class this room exists to name.
//
// Known limits (grammar this parser does not model - each degrades to
// OUT_OF_SCOPE or a tokenizer error, never a silent NO_MATCH, EXCEPT where
// noted):
//   - The verb is resolved past a fixed prefix chain (VAR=value assignments,
//     sudo/env/nice/time/command, timeout <duration>), then a GENERIC
//     candidate walk (never a per-tool flag table) finds the real verb:
//     every flag-shaped token (short, long, `=`-joined, clustered - all
//     boolean by default) and every assignment is skipped; every other
//     token is a candidate, in order. The first candidate gets full
//     classification (can reach DESTRUCTION, and gets a resolved verb's
//     own precise logic - e.g. git's subcommand check). If that is
//     NO_MATCH, the walk keeps looking: every later candidate is checked
//     by NAME only and can only ever admit OUT_OF_SCOPE (never a false
//     DESTRUCTION on what may be an earlier command's own argument - see
//     `sudo -u root cat rm`, a documented trade-off, not a regression).
//     A per-tool table (sudo's own flags, short and long form), where one
//     exists, is an OPTIMIZATION that sharpens WHICH token the walk starts
//     from - full DESTRUCTION precision where it is complete, the same
//     generic backstop where it is not. The walk never returns early
//     because one token could not be classified; that is the structural
//     property this design exists for. Path-qualified verbs (basename)
//     and Windows executable extensions are stripped at every candidate.
//   - A subshell `( )`, brace group `{ }`, or command substitution `$( )`/
//     backtick form is recognized ONLY when it opens the segment (word 0);
//     the same construct appearing later in an argument is invisible.
//   - `eval` is recognized as a verb; its argument string is never parsed.
//   - Redirect input (`<`) consumes its target word (so a leading `< file
//     cmd` cannot displace `cmd` into becoming the resolved verb) but is
//     never itself treated as destructive - an input redirect only reads.
//   - fd-duplication/close (`>&N`, `>&-`) is recognized only in the `>&`
//     spelling, not `<&`.
//   - A non-file sink is verified by name against a fixed list (/dev/null,
//     /dev/zero, /dev/full, /dev/tty, /dev/stdout, /dev/stderr, /dev/random,
//     /dev/urandom, /dev/console, /dev/fd/N, /proc/self/fd/N, a numbered
//     tty (/dev/ttyN) or pseudo-terminal (/dev/pts/N), Windows NUL) - a
//     symlink or bind-mount that resolves to one of these under a
//     different name is not caught, because this parser never touches the
//     filesystem (ruling 3).

import { posix } from 'node:path';

const SEGMENT_SEPARATORS = new Set([';', '&&', '||', '|', '&', '\n']);

// Reserved words that legally precede a `[[ ... ]]` test in bash grammar -
// `[[` is a keyword recognized only in COMMAND POSITION, never as a
// quoted or bare argument to a preceding word.
const BRACKET_TEST_PRECEDERS = new Set(['if', 'while', 'until', 'do', 'then', 'else', 'elif', '!']);

// Partition of every OUT_OF_SCOPE site, set explicitly at each return - never
// re-derived from the `reason` prose (a prose grouping mis-files the next
// reason string somebody adds, silently). 'declared' = the owner's own scope
// boundary working as designed (wrappers: make/xargs/find/npm run/interpreter
// one-liners/cmd.exe/script files). 'unrouted' = a named direct destroyer
// this room knowingly does not route. 'unjudged' = the parser could not read
// the construct at all (heredoc, subshell, a redirect it cannot classify,
// an unresolved prefix chain, a tokenizer error) - the ceiling metric for
// whether this guard is degrading into a shrug. `:575`'s non-string-input
// admission carries NO kind: no shell was parsed, so it is a caller contract
// violation, not a command-construct judgment, and does not belong in this
// partition at all.
const KIND_DECLARED = 'declared';
const KIND_UNROUTED = 'unrouted';
const KIND_UNJUDGED = 'unjudged';

const DESTRUCTION_VERBS = new Set([
  'rm', 'rmdir', 'unlink', 'truncate', 'del', 'remove-item',
]);

const PREFIX_VERBS = new Set([
  'sudo', 'env', 'nice', 'time', 'command', 'nohup', 'setsid', 'stdbuf', 'doas', 'ionice', 'exec',
]);
// The set: every bash compound-command keyword that can occupy word 0 and
// take no flags/arguments of its own before the real command (a single-
// token skip, unlike PREFIX_VERBS which may consume a following duration/
// flag). `case` is deliberately NOT here - its pattern label (`a)`) sits
// between the keyword and the command, which this single-token skip
// cannot resolve; it is handled at classifyVerb instead, where it
// declares OUT_OF_SCOPE/unjudged rather than joining this set.
const SHELL_KEYWORDS = new Set(['do', 'then', 'else', 'elif', '!', 'if', 'while', 'until']);
const TIMEOUT_VERB = 'timeout';
const ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;
const DURATION_RE = /^[\d.]+[smhd]?$/;
// Genuinely raw-binary executable extensions ONLY - stripping these is a
// real precision gain (`rm.exe` really is the same program as `rm`,
// modulo PATH resolution), nothing to read. `.cmd`/`.bat` are batch
// SCRIPT FILES, not binaries - moved to SCRIPT_EXTENSION below (Set W5,
// defence round 7): the set that gets stripped and the set recognised
// as a script must stay different.
const EXECUTABLE_EXTENSION_RE = /\.(exe|com)$/i;

function stripExeExtension(value) {
  return value.replace(EXECUTABLE_EXTENSION_RE, '');
}

function basenameOf(value) {
  return /[\\/]/.test(value) ? value.split(/[\\/]/).pop() : value;
}

function isFlagShaped(w) {
  return w.length > 1 && w.startsWith('-');
}

// The first non-flag argument - a verb's own SOURCE/positional operand,
// wherever a boolean flag may sit in front of it. Deliberately narrower
// than a full option-grammar walk: it skips any flag-shaped token but
// never a flag's OWN value (a caller with a value-taking flag ahead of
// its positional needs its own table, the same boundary sudo/truncate/mv
// already state for their own grammars).
function firstPositional(args) {
  return args.find((w) => !isFlagShaped(w.value))?.value;
}

// Value-taking sudo SHORT flags: the token right after one is an argument
// (a user/group/prompt/etc.), never a command word. `-h` is NOT here - it
// is boolean (--help), not value-taking; putting it here swallowed the
// real command behind it.
const SUDO_VALUE_FLAGS = new Set(['-u', '-g', '-p', '-t', '-U', '-C', '-D', '-R', '-r', '-T', '-a']);
// The same, LONG form (`--flag value`, space-separated - `--flag=value` is
// one self-contained token and needs no table at all, see isFlagShaped).
const SUDO_LONG_VALUE_FLAGS = new Set([
  '--user', '--group', '--prompt', '--type', '--other-user',
  '--close-from', '--chdir', '--chroot', '--role', '--command-timeout', '--auth-type',
]);

// OPTIMIZATION over the generic walk below, scoped to sudo alone (never
// applied to another prefix's remainder - that misapplication was itself
// a defence-round finding). Sharpens the PRIMARY candidate to the exact
// token past sudo's own flags, reaching full DESTRUCTION precision where
// this table is complete. Where it is not (an unrecognized sudo flag), it
// degrades to boolean-skip-alone, and the generic walk's SECONDARY-
// candidate backstop still finds a listed verb one token further on - the
// table is an accelerant, never a requirement for correctness.
function skipSudoFlags(words, startIdx) {
  let i = startIdx;
  while (i < words.length) {
    const w = words[i].value;
    if (w === '--') { i += 1; break; }
    if (SUDO_VALUE_FLAGS.has(w) || SUDO_LONG_VALUE_FLAGS.has(w)) { i += 2; continue; }
    if (isFlagShaped(w)) { i += 1; continue; }
    break;
  }
  return i;
}

// The structural fix: a walk that keeps advancing until it finds a token
// in COMMAND position or runs out - it never returns early because one
// token was unclassifiable. Flag-shaped tokens (short, long, `=`-joined,
// clustered - all boolean by default) and assignments are excluded from
// candidacy; every other token is a candidate, in order. Per-tool flag
// knowledge (skipSudoFlags above), where it exists, only changes WHICH
// token becomes the walk's starting point - it is never required for the
// walk itself to find a listed verb.
function walkCandidates(words, startIdx) {
  const out = [];
  for (let i = startIdx; i < words.length; i++) {
    const w = words[i].value;
    if (ASSIGNMENT_RE.test(w)) continue;
    if (isFlagShaped(w)) continue;
    out.push(i);
  }
  return out;
}

// Value-taking git global SHORT flags (`--git-dir=path` is one self-
// contained joined token and needs no table, same as sudo's long flags).
const GIT_GLOBAL_VALUE_FLAGS = new Set(['-C', '-c']);

// OPTIMIZATION mirroring skipSudoFlags: sharpens which token is the git
// SUBCOMMAND when a global flag precedes it. An unrecognized flag still
// defaults to boolean-skip-alone (the same safe default sudo's table uses).
// DECLINED to merge with skipSudoFlags (rot-canary finding #7, defence
// round 3): two flag vocabularies that happen to share a walk shape;
// merging couples two grammars that will diverge. Left as two functions
// on purpose - do not re-raise.
function skipGitGlobalFlags(args) {
  let i = 0;
  while (i < args.length) {
    const w = args[i].value;
    if (GIT_GLOBAL_VALUE_FLAGS.has(w)) { i += 2; continue; }
    if (isFlagShaped(w)) { i += 1; continue; }
    break;
  }
  return i;
}

const WRAPPER_SCRIPT_VERBS = new Set(['bash', 'sh', 'zsh', 'ksh', 'dash', 'source', '.']);
const POSIX_INTERPRETER_VERBS = new Set(['node', 'python', 'python3', 'perl', 'ruby']);
const POSIX_ONE_LINER_FLAGS = new Set(['-e', '-c', '--eval']);
const WINDOWS_ONE_LINER_VERBS = new Set(['pwsh', 'powershell']);
const PKG_MANAGERS = new Set(['npm', 'yarn', 'pnpm', 'bun']);
const GIT_DESTRUCTIVE_SUBCOMMANDS = new Set(['clean', 'rm', 'checkout', 'restore']);
const NAMED_DESTROYER_VERBS = new Set(['shred', 'dd', 'eval', 'erase', 'rd']);
// `.cmd`/`.bat` added (Set W5, defence round 7): batch SCRIPT FILES, not
// binaries - previously stripped by EXECUTABLE_EXTENSION_RE above and so
// classified as the coreutil they happened to be named after (`rm.cmd`
// reaching full `rm` precision) instead of landing here, unread, like
// every other script extension.
const SCRIPT_EXTENSION = /\.(sh|ps1|py|pl|rb|cmd|bat)$/i;

const NULL_SINKS = new Set([
  '/dev/null', '/dev/zero', '/dev/full', '/dev/tty', '/dev/stdout', '/dev/stderr',
  '/dev/random', '/dev/urandom', '/dev/console',
]);
const FD_SINK_RE = /^\/(dev\/fd|proc\/self\/fd)\/\d+$/;
// A numbered tty (/dev/ttyN) or pseudo-terminal (/dev/pts/N) - a character
// device, never a file; a redirect to one truncates nothing.
const TTY_SINK_RE = /^\/dev\/(tty|pts\/)\d+$/;
const WINDOWS_UNC_NUL_PREFIX = '\\\\.\\';

function isNonFileSink(target) {
  // `target` is often the result of a positional-argument LOOKUP
  // (firstPositional, args[0]?.value, a redirect's own target word) -
  // "no argument found" is a real, reachable shape (`cp` with no
  // operand at all), and `undefined`/non-string must never reach
  // `posix.normalize`, which throws on anything but a string. Absence
  // of a target is not a null-sink - a caller with nothing to check
  // gets `false`, the same "not a sink" answer a real ordinary path
  // would get.
  if (typeof target !== 'string') return false;
  // An empty-string target is not a DEVICE sink, but shares the same
  // exemption every caller here needs: CITED, verified live on this
  // host's bash this round - `echo hi > ""` errors "No such file or
  // directory" and creates NOTHING. An empty path is rejected outright,
  // never a real file that gets truncated - the same "not a real
  // destructible target" conclusion this function's callers already act
  // on for every other non-file case.
  if (target === '') return true;
  // Lexical normalization only (pure string op, no filesystem access -
  // ruling 3 holds) - collapses a trivially different spelling of the same
  // POSIX device path (`/dev/./null`, `/dev/../dev/null`) before comparing.
  const normalized = posix.normalize(target);
  if (NULL_SINKS.has(normalized)) return true;
  if (FD_SINK_RE.test(normalized)) return true;
  if (TTY_SINK_RE.test(normalized)) return true;
  const stripped = target.startsWith(WINDOWS_UNC_NUL_PREFIX) ? target.slice(WINDOWS_UNC_NUL_PREFIX.length) : target;
  return stripped.toLowerCase() === 'nul';
}

// --- tokenizer -----------------------------------------------------------

// Is the token about to be pushed in bash COMMAND POSITION - segment start,
// or right after a keyword that can open a compound command? A `[[` here
// opens a test; a `[[` anywhere else is data (an argument, quoted or not).
// RECURSIVE, not just a spelling check: a preceder word (`do`/`then`/etc)
// only counts if IT was itself in command position when it was pushed
// (`prev.commandPos`, set at push time below) AND is not quoted - `do` as
// an ORDINARY ARGUMENT (`echo do [[ ... ]]`) is not the keyword, the same
// way a quoted `"do"` is not the keyword. Without this, the gate trusted
// the previous word's bare SPELLING regardless of where it came from.
function isCommandPosition(tokens) {
  const prev = tokens[tokens.length - 1];
  if (!prev) return true;
  if (prev.type === 'op' && SEGMENT_SEPARATORS.has(prev.value)) return true;
  return prev.type === 'word' && !prev.quoted && prev.commandPos === true && BRACKET_TEST_PRECEDERS.has(prev.value);
}

// ponytail: 206 lines at declaration (defence round 3) - over the 50-line
// function-length signal. The bracket/paren/redirect branches could split
// into helpers, but see the file-header declaration: extraction is
// deferred to the same future unit, not done piecemeal mid-round.
function tokenize(input) {
  const tokens = [];
  const errors = [];
  const n = input.length;
  let i = 0;
  // Depth of an open `[[ ... ]]` test - inside it, `<`/`>` are string
  // comparison, never a redirect. Keys on `[[` specifically; single `[ ]`
  // is unaffected.
  let bracketDepth = 0;
  // Depth of an open `(( ... ))`/`$(( ... ))` arithmetic context - inside
  // it, `>`/`<` are numeric comparison, never a redirect. Keys on the
  // exact two-char sequences `((`/`))` only - a general nested-parenthesis
  // balance is not attempted (matching the existing word-0-only treatment
  // of a bare subshell).
  let parenDepth = 0;

  // A SEGMENT_SEPARATORS op resets both depths - an unbalanced `[[`/`((`
  // in one segment must never leak into a later, unrelated segment.
  function pushSeparator(value) {
    tokens.push({ type: 'op', value });
    bracketDepth = 0;
    parenDepth = 0;
  }

  function fdPrefixAdjacent() {
    const last = tokens[tokens.length - 1];
    return last && last.type === 'word' && !last.quoted && /^[0-9]+$/.test(last.value) && last.end === i
      ? tokens.pop().value
      : '';
  }

  while (i < n) {
    const c = input[i];

    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\n') { pushSeparator('\n'); i++; continue; }
    if (c === ';') {
      // Inside an open arithmetic context, `;` is the C-style for-loop's
      // own clause separator (`for (( expr1 ; expr2 ; expr3 ))`, bash's
      // compound-command grammar) - not a command separator. Every other
      // separator (&&, ||, |, &, \n) still force-closes parenDepth
      // unconditionally, bounding an unbalanced `((` the same way.
      if (parenDepth > 0) { i++; continue; }
      pushSeparator(';');
      i++; continue;
    }

    // A backslash-newline line-continuation, occurring BETWEEN tokens (not
    // mid-word - that spelling is handled inside the word-scan loop below).
    // Bash deletes the pair entirely, no token, no glued newline.
    if (c === '\\' && input[i + 1] === '\n') { i += 2; continue; }

    // A `#` reaching this point is at word-boundary position (a mid-word
    // `#` never gets here - it is absorbed into the word-scanning branch
    // below, matching real bash). Comment runs to end of line; the
    // newline itself is left for normal segment-separator handling.
    if (c === '#') {
      while (i < n && input[i] !== '\n') i++;
      continue;
    }

    if (c === '|') {
      if (input[i + 1] === '|') {
        // `||` inside an open `[[ ]]` test or `(( ))`/`$(( ))` arithmetic
        // context is the CONSTRUCT'S OWN logical-or - never a command
        // separator (CITED, verified live on this host's bash:
        // `[[ -f a || $b ]]` runs as one test). Emitted as an inert word,
        // matching how `>`/`<` already stay inert in the same contexts -
        // NEVER resets depth, never splits the segment.
        if (bracketDepth > 0 || parenDepth > 0) { tokens.push({ type: 'word', value: '||', end: i + 2 }); i += 2; continue; }
        pushSeparator('||'); i += 2;
      } else if (parenDepth > 0) {
        // A single `|` inside an open `(( ))`/`$(( ))` arithmetic
        // context is bitwise OR (Set W7, defence round 7, closing the
        // boundary V3 named but did not close) - CITED, verified live
        // on this host's bash this round: `echo $(( 5 | 2 ))` -> `7`.
        // Scoped to `parenDepth` ONLY, never `bracketDepth`: a single
        // `|` inside `[[ ]]` is a bash SYNTAX ERROR ("conditional
        // binary operator expected"), not a valid operator there at
        // all - `[[ ]]` and `(( ))` are NOT the same exemption here,
        // unlike `&&`/`||` which both contexts genuinely accept.
        tokens.push({ type: 'word', value: '|', end: i + 1 }); i++;
      } else { pushSeparator('|'); i++; }
      continue;
    }

    if (c === '&') {
      if (input[i + 1] === '&') {
        // Same construct, `&&` - CITED, verified live:
        // `[[ $x -eq 1 && $x -lt 5 ]]` and `(( x > 0 && y > 1 ))` both
        // run as one test/expression, never split at the `&&`.
        if (bracketDepth > 0 || parenDepth > 0) { tokens.push({ type: 'word', value: '&&', end: i + 2 }); i += 2; continue; }
        pushSeparator('&&'); i += 2; continue;
      }
      if (input[i + 1] === '>') {
        if (input[i + 2] === '>') { tokens.push({ type: 'op', value: '&>>' }); i += 3; }
        else { tokens.push({ type: 'op', value: '&>' }); i += 2; }
        continue;
      }
      if (parenDepth > 0) {
        // A single `&` inside an open `(( ))`/`$(( ))` arithmetic
        // context is bitwise AND (Set W7, defence round 7) - CITED,
        // verified live on this host's bash this round:
        // `echo $(( 5 & 3 ))` -> `1`. `bracketDepth` is deliberately
        // NOT checked here - CITED, verified live: `[[ -f a & ]]` is a
        // bash SYNTAX ERROR ("unexpected token `&'"), not a valid
        // operator inside `[[ ]]` at all - same as single `|` above,
        // `[[ ]]` and `(( ))` are not the same exemption here.
        tokens.push({ type: 'word', value: '&', end: i + 1 }); i++; continue;
      }
      pushSeparator('&'); i++; continue;
    }

    if (c === '>') {
      // Process substitution `>(...)` is not a redirect to a file - no
      // target is ever consumed, the whole construct becomes inert word
      // tokens. Same for `>` inside an open `[[ ]]` test (string compare)
      // or an open `(( ))`/`$(( ))` arithmetic context (numeric compare).
      if (input[i + 1] === '(' || bracketDepth > 0 || parenDepth > 0) {
        tokens.push({ type: 'word', value: '>', end: i + 1 }); i++; continue;
      }
      const fd = fdPrefixAdjacent();
      if (input[i + 1] === '&') {
        // fd-duplication (`2>&1`) or fd-close (`>&-`) - a descriptor
        // operation, never a filename target.
        i += 2;
        // The operand tolerates whitespace before it (POSIX table,
        // cross-checked live against this host's bash: `2>& 1` still
        // fd-duplicates and creates no file named `1`) - the same way
        // `2 > file` already tolerates a space around the operator itself.
        while (i < n && (input[i] === ' ' || input[i] === '\t')) i++;
        let operand = '';
        if (input[i] === '-') { operand = '-'; i++; }
        else { while (i < n && /[0-9]/.test(input[i])) { operand += input[i]; i++; } }
        if (operand === '') {
          if (fd === '') {
            // >&word (fd OMITTED, word is not -/digits) is bash's
            // accepted synonym for &>word - a truncating redirect to a
            // real file, never a descriptor operation (which requires
            // an explicit -/digit operand). Same op shape &>'s own
            // branch already emits, so the normal redirect-target
            // consumption picks up the word that follows and
            // classifyRedirectOp already routes it to truncate.
            tokens.push({ type: 'op', value: '&>' });
          } else {
            // n>&word (fd EXPLICIT, e.g. `2>&file`) is NOT the &>word
            // synonym - CITED, verified live on this host's bash this
            // round: `ls 2>&file` errors "ambiguous redirect" and
            // creates NOTHING. The synonym is documented as conditional
            // on fd being OMITTED; an explicit fd before `>&word` is a
            // fd-duplication attempt with an invalid (non-digit, non
            // `-`) operand - a hard error, never a truncating redirect.
            // Emitted as a non-redirect op so its target word is still
            // consumed (never leaks into the verb walk) but
            // classifyRedirectOp's `other` fallthrough means it never
            // truncates and never counts as fd-out-of-scope.
            tokens.push({ type: 'op', value: 'ambiguous-redirect' });
          }
          continue;
        }
        tokens.push({ type: 'op', value: `${fd || '1'}>&${operand}`, fdDup: true });
        continue;
      }
      if (input[i + 1] === '>') { tokens.push({ type: 'op', value: `${fd || '1'}>>` }); i += 2; }
      else if (input[i + 1] === '|') { tokens.push({ type: 'op', value: `${fd || '1'}>|` }); i += 2; }
      else { tokens.push({ type: 'op', value: `${fd || '1'}>` }); i++; }
      continue;
    }

    if (c === '<') {
      // Process substitution `<(...)`, `<` inside an open `[[ ]]` test, or
      // `<` inside an open arithmetic context - same as `>` above.
      if (input[i + 1] === '(' || bracketDepth > 0 || parenDepth > 0) {
        tokens.push({ type: 'word', value: '<', end: i + 1 }); i++; continue;
      }
      if (input[i + 1] === '>') {
        // `<>` opens the target for read-write (POSIX redirection table,
        // cross-checked live against this host's bash: a pre-existing
        // file's content survives it byte-for-byte) - never truncates.
        fdPrefixAdjacent();
        tokens.push({ type: 'op', value: '<>' });
        i += 2;
        continue;
      }
      if (input[i + 1] === '<') {
        if (input[i + 2] === '<') { tokens.push({ type: 'op', value: '<<<' }); i += 3; continue; }
        const opValue = input[i + 2] === '-' ? '<<-' : '<<';
        i += opValue.length;
        tokens.push({ type: 'op', value: opValue });
        // A heredoc body is opaque to this parser (a heredoc is
        // OUT_OF_SCOPE, never silently NO_MATCH) - swallow it whole so its
        // internal newlines/`;`/`&&` never fabricate fake top-level
        // segments, then force a segment break at its own boundary so the
        // command that follows is never folded into the heredoc's segment.
        while (i < n && (input[i] === ' ' || input[i] === '\t')) i++;
        let delim = '';
        let quoteChar = null;
        while (i < n) {
          const ch = input[i];
          if (quoteChar) {
            if (ch === quoteChar) { quoteChar = null; i++; continue; }
            delim += ch; i++; continue;
          }
          if (ch === '"' || ch === "'") { quoteChar = ch; i++; continue; }
          if (ch === ' ' || ch === '\t' || ch === '\n') break;
          delim += ch; i++;
        }
        tokens.push({ type: 'word', value: delim, end: i });
        while (i < n && input[i] !== '\n') i++;
        if (i < n) i++;
        let terminated = false;
        while (i < n) {
          const lineEndIdx = input.indexOf('\n', i);
          const lineEnd = lineEndIdx === -1 ? n : lineEndIdx;
          const line = input.slice(i, lineEnd);
          const compareLine = opValue === '<<-' ? line.replace(/^\t+/, '') : line;
          i = lineEndIdx === -1 ? n : lineEndIdx + 1;
          if (compareLine === delim) { terminated = true; break; }
        }
        if (!terminated) errors.push('unterminated heredoc');
        pushSeparator('\n');
      } else {
        fdPrefixAdjacent();
        tokens.push({ type: 'op', value: '<' }); i++;
      }
      continue;
    }

    // word: unquoted chars, quoted runs (quotes stripped, spaces inside kept
    // literal so a quoted phrase never splits into separate tokens), and
    // backslash escapes.
    let value = '';
    const startI = i;
    let brokeOnError = false;
    let sawQuote = false;
    while (i < n) {
      const ch = input[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ';|&><'.includes(ch)) break;
      // ANSI-C quoting (`$'...'`) - CITED, verified live on this host's
      // bash this round: `$'\x72\x6d'` and `$'\162\155'` both decode to
      // the word `rm` and run it. Decodes the well-known escape set
      // (backslash/quote/question-mark literals, the named control
      // chars, octal `\nnn`, hex `\xHH`, control-char `\cX`). Boundary,
      // stated: `\uHHHH`/`\UHHHHHHHH` unicode escapes are NOT decoded -
      // this parser's verb tables are ASCII strings by construction, so
      // a unicode-escaped spelling could never match one regardless.
      if (ch === '$' && input[i + 1] === "'") {
        sawQuote = true;
        i += 2;
        let closed = false;
        while (i < n) {
          const dc = input[i];
          if (dc === "'") { i++; closed = true; break; }
          if (dc === '\\' && i + 1 < n) {
            const esc = input[i + 1];
            const simple = {
              a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n',
              r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?',
            };
            if (esc in simple) { value += simple[esc]; i += 2; continue; }
            if (esc === 'x') {
              const hex = /^[0-9a-fA-F]{1,2}/.exec(input.slice(i + 2, i + 4));
              if (hex) { value += String.fromCharCode(parseInt(hex[0], 16)); i += 2 + hex[0].length; continue; }
            }
            if (/[0-7]/.test(esc)) {
              const oct = /^[0-7]{1,3}/.exec(input.slice(i + 1, i + 4));
              if (oct) { value += String.fromCharCode(parseInt(oct[0], 8) & 0xff); i += 1 + oct[0].length; continue; }
            }
            if (esc === 'c' && i + 2 < n) {
              value += String.fromCharCode(input[i + 2].toUpperCase().charCodeAt(0) ^ 0x40);
              i += 3; continue;
            }
            value += esc; i += 2; continue;
          }
          value += dc; i++;
        }
        if (!closed) { errors.push('unterminated ANSI-C quote'); i = n; brokeOnError = true; break; }
        continue;
      }
      // Locale-translation quoting (`$"..."`) - with no translation
      // catalog bash yields the literal string, so the introducing `$`
      // is consumed without joining the value and the plain double-
      // quote branch below takes over unchanged (its own escaping rules
      // already apply - this is NOT ANSI-C quoting).
      if (ch === '$' && input[i + 1] === '"') { i++; continue; }
      if (ch === '\\') {
        if (input[i + 1] === '\n') { i += 2; continue; }
        if (i + 1 >= n) { errors.push('trailing backslash at end of command'); i = n; brokeOnError = true; break; }
        // Escaping a character is quoting it (POSIX shell grammar) - a
        // backslash-escaped keyword (`\[\[`) loses its keyword-hood the
        // same way a quoted one does, so this sets the same `sawQuote`
        // flag `[[`'s command-position gate and fdPrefixAdjacent's
        // digit check already rely on.
        sawQuote = true;
        value += input[i + 1]; i += 2; continue;
      }
      if (ch === "'") {
        sawQuote = true;
        const end = input.indexOf("'", i + 1);
        if (end === -1) { errors.push('unterminated single quote'); i = n; brokeOnError = true; break; }
        value += input.slice(i + 1, end); i = end + 1; continue;
      }
      if (ch === '"') {
        sawQuote = true;
        let j = i + 1; let closed = false;
        while (j < n) {
          if (input[j] === '"') { closed = true; j++; break; }
          if (input[j] === '\\' && j + 1 < n && '"\\$`'.includes(input[j + 1])) { value += input[j + 1]; j += 2; continue; }
          value += input[j]; j++;
        }
        if (!closed) { errors.push('unterminated double quote'); i = n; brokeOnError = true; break; }
        i = j; continue;
      }
      // An arithmetic context `((`/`))` - reached only for genuinely
      // UNQUOTED characters (the quote branches above consume their own
      // content directly, never falling through to here), so a literal
      // "((" in an argument can never open one. Unlike `[[`, arithmetic
      // is not restricted to command position - it is a legal expansion
      // anywhere (`$((a>b))`, `x=$((...))`), so no position gate is needed.
      if (ch === '(' && input[i + 1] === '(') { parenDepth++; value += '(('; i += 2; continue; }
      if (ch === ')' && input[i + 1] === ')' && parenDepth > 0) { parenDepth--; value += '))'; i += 2; continue; }
      value += ch; i++;
    }
    if (brokeOnError && value === '' && i === startI + 1) continue;
    if (i > startI || value !== '') {
      // `[[`/`]]` are keywords only as a BARE, unquoted, unescaped word -
      // quoting or escaping either bracket strips its keyword-hood (same
      // rule bash applies to any reserved word), so a quoted/escaped
      // occurrence is inert data and must never open or close the test.
      // Computed once, BEFORE this token is pushed (it reads only the
      // already-pushed tokens) - reused both for the opensTest decision
      // right below and stored on the token itself, so a LATER word
      // checking "was the preceder before me a real keyword" has the
      // answer without re-walking the tokens array.
      const commandPos = isCommandPosition(tokens);
      const opensTest = value === '[[' && !sawQuote && commandPos;
      tokens.push({ type: 'word', value, end: i, quoted: sawQuote, commandPos });
      if (opensTest) bracketDepth++;
      else if (value === ']]' && !sawQuote && bracketDepth > 0) bracketDepth--;
    }
  }

  return { tokens, errors };
}

// --- segmentation ----------------------------------------------------------

// Each segment carries whether it was reached via a `|` PIPE specifically
// (never `||`, `;`, `&&`, `&`, or a newline) - AXIS 6 (invocation
// channel, Set W6 defence round 7): PowerShell's Remove-Item binds its
// `-Path` parameter FROM the pipeline, a real binding mechanism this
// parser must be able to see past the per-segment split.
function splitSegments(tokens) {
  const segments = [];
  let current = [];
  let precededByPipe = false;
  for (const t of tokens) {
    if (t.type === 'op' && SEGMENT_SEPARATORS.has(t.value)) {
      segments.push({ tokens: current, precededByPipe });
      current = [];
      precededByPipe = t.value === '|';
    } else {
      current.push(t);
    }
  }
  segments.push({ tokens: current, precededByPipe });
  return segments.filter((seg) => seg.tokens.length > 0);
}

// --- redirect classification -----------------------------------------------

function fdDigitsOf(op) {
  const m = op.match(/^\d+/);
  return m ? m[0] : '1';
}

function classifyRedirectOp(op) {
  if (op.endsWith('>>')) return 'append';
  if (op.endsWith('>|') || op.endsWith('>')) {
    return fdDigitsOf(op) === '1' ? 'truncate' : 'fd-out-of-scope';
  }
  return 'other';
}

// --- verb resolution (ruling: the verb can be prefixed) ---------------------

// Consumes ONLY the recognized prefix chain (leading assignments, then a
// run of PREFIX_VERBS/timeout) and stops - it never tries to classify what
// comes after. What comes after (flags, more assignments, the real verb)
// is the generic walk's job in analyzeSegment, not this function's.
// ponytail: 59 lines at declaration (defence round 7, grown by W1's `for`
// forward-scan branch) - over the 50-line function-length signal. The
// `for` branch is a self-contained lookahead that belongs beside the
// other prefix-consuming branches it shares a loop with; splitting it out
// would separate one branch of one dispatch from its siblings for no
// cohesion gain. Extraction, if ever warranted, rides the same future
// unit as the file-header's own deferred split - not done piecemeal here.
function resolveVerb(words) {
  let idx = 0;
  while (idx < words.length && ASSIGNMENT_RE.test(words[idx].value)) idx++;
  let consumedPrefix = idx > 0;
  let lastPrefixVerb = null;
  while (idx < words.length) {
    // Normalized the SAME way `verbAt` already normalizes every
    // CANDIDATE verb (basenameOf + stripExeExtension) - a path-
    // qualified (`/usr/bin/time`) or `.exe`-suffixed (`sudo.exe`)
    // prefix is the ordinary way a script pins a binary, and before
    // this fix it defeated the WHOLE prefix chain, not just precision.
    const wLower = stripExeExtension(basenameOf(words[idx].value)).toLowerCase();
    if (wLower === TIMEOUT_VERB) {
      idx++;
      if (idx < words.length && DURATION_RE.test(words[idx].value)) idx++;
      lastPrefixVerb = TIMEOUT_VERB;
      consumedPrefix = true;
      continue;
    }
    if (PREFIX_VERBS.has(wLower)) {
      idx++;
      lastPrefixVerb = wLower;
      consumedPrefix = true;
      continue;
    }
    if (SHELL_KEYWORDS.has(wLower)) {
      idx++;
      consumedPrefix = true;
      continue;
    }
    if (wLower === 'for') {
      // bash's C-style for-loop may omit the `;` before `do` (AXIS 5,
      // structural context / separator-elision - CITED, verified live
      // on this host's bash this round: `for ((i=0;i<2;i++)) do echo
      // hi; done` runs; the plain-list form `while true do ... done`,
      // with no `))`/`]]` header immediately before `do`, is a syntax
      // error - the free pass is keyed to the CLOSING TOKEN, not to
      // `for` specially). `for` is not itself skippable one token at a
      // time the way if/while/until/do are - its own next tokens are a
      // loop variable or `((`, never the command - so this scans
      // FORWARD for the segment's own `do` and resumes the walk
      // immediately after it. No match: fall through unresolved, same
      // as any other unrecognized word (the `for x in a b; do ...`
      // canonical form already works via ordinary segmentation - the
      // `;` there is a real separator, so `do` starts its OWN segment
      // and never reaches this branch at all).
      const doIdx = words.findIndex((w, i) => i > idx && !w.quoted && w.value.toLowerCase() === 'do');
      if (doIdx !== -1) {
        idx = doIdx + 1;
        consumedPrefix = true;
        continue;
      }
      break;
    }
    break;
  }
  if (idx >= words.length) return null;
  return { index: idx, consumedPrefix, lastPrefixVerb };
}

// --- mv (ruling 3: conditional on the runtime existence of its target) -----

// The set: GNU mv's -f/-i/-n override grammar. -f/--force, -i/--interactive
// and -n/--no-clobber override EACH OTHER - the LAST one, by argument
// order, wins, and any of the three short forms may appear inside a
// clustered token (-vn, -nv) alongside unrelated flags. Boundary, stated:
// only -n's WINNING makes the command provably safe; -i winning does not
// exempt it (a prompt is not a guaranteed no-op in an unattended context,
// so the safe direction is to still treat it as a possible destruction).
const MV_OVERRIDE_SHORT = new Set(['f', 'i', 'n']);
const MV_OVERRIDE_LONG = { '--force': 'f', '--interactive': 'i', '--no-clobber': 'n' };

function lastMvOverride(args) {
  let last;
  for (const w of args) {
    const v = w.value;
    // `--` ends option parsing (the same rule analyzeMv's own positional
    // loop already honours) - a flag-shaped word after it is a filename,
    // never an override.
    if (v === '--') break;
    if (v in MV_OVERRIDE_LONG) { last = MV_OVERRIDE_LONG[v]; continue; }
    if (v.length > 1 && v[0] === '-' && v[1] !== '-') {
      for (const ch of v.slice(1)) {
        if (MV_OVERRIDE_SHORT.has(ch)) last = ch;
      }
    }
  }
  return last;
}

// GNU mv's OWN recoverability switch, CITED SOURCE `mv --help` RUN live:
// "--backup[=CONTROL] make a backup of each existing destination file"
// and "-b (like --backup but does not accept an argument)" - the
// existing target is RENAMED, never lost. Under this room's own founding
// ruling (recoverability is per-OPERATION), the one mv spelling that is
// PROVABLY recoverable must not be flagged - the exact inversion of the
// design otherwise. Scoped to the exact spellings cited: a clustered `-b`
// (e.g. `-vb`) is a named, uncited boundary, not attempted here.
function isMvBackupFlag(v) {
  return v === '-b' || v === '--backup' || v.startsWith('--backup=');
}

// mv's DESTINATION-selection option, CITED SOURCE `mv --help` RUN live:
// "-t, --target-directory=DIRECTORY move all SOURCE arguments into
// DIRECTORY" - short form, `=`-joined long form, and space-separated
// long form all name a DIRECTORY, never a SOURCE. AXIS 1 (spelling): the
// long form was entirely unrecognized before this fix, so its own value
// word was miscounted as a SOURCE. Returns the directory value and,
// for the space-separated forms, the array index of that value word so
// the caller can exclude it from the source list.
function mvTargetDirectory(args) {
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    // `--` ends option parsing (the same rule `analyzeMv`'s own
    // positional loop and `lastMvOverride` already honour, Set U4/W7's
    // own SITE fix) - a `--target-directory`-shaped word after it is a
    // FILENAME, never the flag (Set X2, defence round 8).
    if (v === '--') break;
    if (v === '-t' || v === '--target-directory') return { dir: args[i + 1]?.value, skipIdx: i + 1 };
    if (v.startsWith('--target-directory=')) return { dir: v.slice('--target-directory='.length), skipIdx: -1 };
  }
  return null;
}

// ponytail: 62 lines at declaration (defence round 7, grown by W2's
// target-directory recognition + --backup exemption) - over the 50-line
// function-length signal. The target-directory branch and the backup
// exemption are both single early-return checks on the SAME `args` this
// function already owns end-to-end (override flags, positional counting,
// the final verdict) - splitting either out would hand a caller half of
// mv's own decision and the other half back, for no cohesion gain.
// Extraction, if ever warranted, rides the same future unit as the file-
// header's own deferred split - not done piecemeal here.
function analyzeMv(args) {
  // A bare invocation (no operands at all) touches nothing - the same
  // "no positional argument" exemption class analyzeDestructionVerb
  // already grants rm/truncate/del, applied here for mv's own missing-
  // operand usage error. `--help`/`--version` reuse the SAME GNU no-op
  // rule isNoOpFlag already applies to those verbs - mv is a GNU
  // coreutils tool too, not a new claim. Both previously fell through to
  // the generic "argument shape not recognized" `unjudged` admission,
  // inflating the room's own ceiling metric with commands this parser
  // reads perfectly (the Group K class again).
  if (args.length === 0 || args.some((w) => isNoOpFlag('mv', w.value))) {
    return { verdict: 'NO_MATCH' };
  }
  if (args.some((w) => isMvBackupFlag(w.value))) {
    return { verdict: 'NO_MATCH' };
  }
  if (lastMvOverride(args) === 'n') {
    // -n winning (by argument order, across every spelling and cluster)
    // guarantees mv never overwrites an existing target - the one mv
    // shape provably safe without a runtime stat, the same class of
    // exemption truncate's grow already gets.
    return { verdict: 'NO_MATCH' };
  }

  const targetDirectory = mvTargetDirectory(args);
  let endOptions = false;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    if (!endOptions && w.value === '--') { endOptions = true; continue; }
    if (targetDirectory && i === targetDirectory.skipIdx) continue;
    if (!endOptions && w.value.length > 1 && w.value.startsWith('-')) continue;
    positional.push(w.value);
  }

  if (targetDirectory) {
    if (positional.length === 0 || targetDirectory.dir === undefined) {
      return { verdict: 'OUT_OF_SCOPE', reason: 'mv argument shape not recognized', kind: KIND_UNJUDGED };
    }
    // Every SOURCE moves into DIRECTORY (pure string join, no filesystem
    // access - ruling 3 holds) - not the directory itself, which must
    // already exist for the command to run at all and so would always
    // "block" if reported. Set Y2a (defence round 8, ALL-OUTPUTS
    // re-check, SITE): W2/X1 already computed this join correctly but
    // only for the LAST source - `mv -t /tmp a b` moves BOTH a and b;
    // one finding per source now, matching every source actually at risk.
    return {
      verdict: 'DESTRUCTION',
      findings: positional.map((source) => ({
        verb: 'mv',
        target: posix.join(targetDirectory.dir, posix.basename(source)),
        conditional: true,
      })),
    };
  }

  if (positional.length >= 3) {
    // GNU mv's OWN "SOURCE... DIRECTORY" form, CITED SOURCE `mv --help`
    // RUN live: "mv [OPTION]... SOURCE... DIRECTORY" - three or more
    // operands with no -t/--target-directory means the LAST operand IS
    // the destination DIRECTORY, the same concept -t names explicitly,
    // triggered by ARITY instead of a flag (Set X1, defence round 8).
    // Set Y2a: every source before the directory is its own at-risk
    // path, not just the last.
    //
    // DECLINED to extract a shared `mvFinding(dir, source)` helper for
    // this and the -t branch above, despite the identical
    // `posix.join(dir, posix.basename(source))` shape (rot-canary QUICK
    // scan, defence round 8) - the same call this room already made for
    // `skipSudoFlags`/`skipGitGlobalFlags` (defence round 3, rot-canary
    // finding #7): two option grammars that happen to share a walk shape
    // today. -t's DIRECTORY is user-declared and its whole positional
    // list is sources; this branch's DIRECTORY is inferred from arity
    // and excludes itself from the source list - one already differs
    // from the other in what counts as `dir` vs `source`, and a shared
    // helper would couple two computations that can diverge independently
    // as either branch's own grammar grows. Left as two sites on purpose;
    // do not re-raise without a THIRD site forcing the question.
    const directory = positional[positional.length - 1];
    const sources = positional.slice(0, -1);
    return {
      verdict: 'DESTRUCTION',
      findings: sources.map((source) => ({
        verb: 'mv',
        target: posix.join(directory, posix.basename(source)),
        conditional: true,
      })),
    };
  }

  if (positional.length === 2) {
    return {
      verdict: 'DESTRUCTION',
      findings: [{ verb: 'mv', target: positional[1], conditional: true }],
    };
  }

  return { verdict: 'OUT_OF_SCOPE', reason: 'mv argument shape not recognized', kind: KIND_UNJUDGED };
}

// Move-Item's OWN semantics - NOT mv's. CITED SOURCE: VERIFIED empirically
// on this host's PowerShell 5.1 this session: bare `Move-Item a b` onto an
// existing b throws "Cannot create a file when that file already exists,"
// touching neither file - provably safe regardless of runtime state,
// unlike mv's unconditional-by-default overwrite. `Move-Item -Force a b`
// onto an existing b succeeds and overwrites it - conditional on b
// existing at runtime, the same model mv already has. `-Force`'s own
// switch-value form (`-Force:$false` turns it OFF) is resolved by
// isSwitchOn below - the same binding rule -WhatIf already gets.
//
// AXIS 8 (BEHAVIOUR EQUIVALENCE), Set Y2b (defence round 8, ALL-OUTPUTS
// re-check): Y2a's dispatch asked to give Move-Item the SAME "3+
// positionals, last is a directory" treatment mv's own -t/arity branches
// just got, on the strength of `(Get-Command Move-Item).Parameters['Path']
// .ParameterType` being `System.String[]` (array-typed - RUN live, this
// session). RAN before building it, per this room's own T4 precedent - and
// the two commands do NOT share this behaviour: `Move-Item -Force a b c`
// (space-separated, real command-line binding - RUN live, this session,
// PowerShell 5.1.26100.8972) THROWS "A positional parameter cannot be
// found that accepts argument 'dest'" and moves nothing. PowerShell's
// positional binder fills Path with exactly ONE bare token (array-typed
// does not mean array-GREEDY for positional binding), Destination with
// the next, and has no third slot - unlike mv's own SOURCE... DIRECTORY
// grammar, which is arity-greedy by design. Classified NO_MATCH, not
// DESTRUCTION: this is not an unrecognized shape, it is a CITED, RUN-
// verified no-op.
function analyzeMoveItem(args) {
  const hasForce = args.some((w) => isSwitchOn(w.value, '-force'));
  if (!hasForce) {
    return { verdict: 'NO_MATCH' };
  }
  const positional = args.filter((w) => !(w.value.length > 1 && w.value.startsWith('-'))).map((w) => w.value);
  if (positional.length === 0) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'Move-Item argument shape not recognized', kind: KIND_UNJUDGED };
  }
  if (positional.length >= 3) {
    return { verdict: 'NO_MATCH' };
  }
  return {
    verdict: 'DESTRUCTION',
    findings: [{ verb: 'move-item', target: positional[positional.length - 1], conditional: true }],
  };
}

// --- a listed destruction verb (rm/rmdir/unlink/truncate/del/Remove-Item) --

// The set: PowerShell switch-parameter value syntax. Covered - bare
// presence (means true), an unambiguous prefix abbreviation (-WhatIf
// only), and an explicit-value form (`:$true`/`:true`/`:1` = ON,
// `:$false`/`:false`/`:0` = OFF, NOT a no-op). Boundary, stated: an
// explicit value outside this recognized set (a variable reference like
// `-WhatIf:$SomeVar`) is NOT resolved - it defaults to NOT exempt, the
// safe direction when this parser cannot tell which way the switch
// actually resolves at runtime. Shared across every switch this parser
// binds (-WhatIf, -Force) - the value grammar is PowerShell's, not the
// individual switch's.
const SWITCH_TRUE_VALUES = new Set(['$true', 'true', '1']);

// CITED SOURCE: `(Get-Command Remove-Item).Parameters.Keys`, RUN live on
// this host (PowerShell 5.1.26100.8972) - only three parameters start
// with `W`: WarningAction, WarningVariable, WhatIf. `-W` is ambiguous
// (matches all three); `-Wh` is unique (the other two continue `Wa`), so
// PowerShell's own shortest-unambiguous-prefix rule sets the floor at 3
// (`-Wh`), not a hand-drawn 4 - axis: every parameter Remove-Item
// actually exposes, not just the one abbreviation this room had a name
// for.
function isWhatIfName(base) {
  return base.length >= 3 && base.startsWith('-') && '-whatif'.startsWith(base);
}

function isRemoveItemWhatIf(value) {
  const lower = value.toLowerCase();
  const colonIdx = lower.indexOf(':');
  const base = colonIdx === -1 ? lower : lower.slice(0, colonIdx);
  if (!isWhatIfName(base)) return false;
  if (colonIdx === -1) return true;
  return SWITCH_TRUE_VALUES.has(lower.slice(colonIdx + 1));
}

// Generic PowerShell switch-value binding for a switch's OWN exact
// spelling (no abbreviation - Move-Item's -Force has no reported
// abbreviation defect, and adding one would be an unreported, hand-drawn
// claim). Bare presence means true; an explicit `:value` resolves the
// same SWITCH_TRUE_VALUES grammar -WhatIf's colon-form already uses.
function isSwitchOn(value, switchNameLower) {
  const lower = value.toLowerCase();
  const colonIdx = lower.indexOf(':');
  const base = colonIdx === -1 ? lower : lower.slice(0, colonIdx);
  if (base !== switchNameLower) return false;
  if (colonIdx === -1) return true;
  return SWITCH_TRUE_VALUES.has(lower.slice(colonIdx + 1));
}

// The set: PowerShell's `-Name:Value` colon-binding syntax, CITED SOURCE
// PowerShell's parameter-binding syntax - VERIFIED empirically on this
// host's PowerShell 5.1 this session (a [string] parameter bound
// correctly via `-Path:foo.txt`, proving the form is not switch-
// specific). A colon-joined flag on remove-item therefore supplies a
// real operand UNLESS its name is -WhatIf (a switch, handled separately
// by isRemoveItemWhatIf - its value means dry-run on/off, not a file).
// Boundary: scoped to remove-item, the only PowerShell cmdlet among
// DESTRUCTION_VERBS.
function isColonValueFlag(verbLower, value) {
  if (verbLower !== 'remove-item' || !value.startsWith('-')) return false;
  const idx = value.indexOf(':');
  if (idx <= 0 || idx >= value.length - 1) return false;
  return !isWhatIfName(value.slice(0, idx).toLowerCase());
}

// The real operand behind a colon-bound flag (`-Path:foo.txt` ->
// `foo.txt`) - isColonValueFlag has already confirmed this shape; this
// only extracts the value half for reporting as a target (Set Y1).
function colonFlagValue(value) {
  return value.slice(value.indexOf(':') + 1);
}

// A dry-run/help flag that means "destroys nothing", scoped to the one verb
// each spelling actually belongs to - a Windows-only or PowerShell-only
// switch has no meaning for the other listed verbs. `/?` is a no-op for
// every CMD_EXE_VERBS member; `--help`/`--version` (GNU getopt
// convention) are a no-op for every verb EXCEPT a Windows-only one with
// no GNU form at all (`del` - see DUAL_PLATFORM_CMD_EXE_VERBS) - additive
// for a dual-platform verb like `rmdir`, never exclusive of its GNU form.
function isNoOpFlag(verbLower, value) {
  if (CMD_EXE_VERBS.has(verbLower) && value === '/?') return true;
  if (CMD_EXE_VERBS.has(verbLower) && !DUAL_PLATFORM_CMD_EXE_VERBS.has(verbLower)) return false;
  if (value === '--help' || value === '--version') return true;
  if (verbLower === 'remove-item' && isRemoveItemWhatIf(value)) return true;
  return false;
}

// The set: truncate's -s/--size grammar. GNU getopt semantics - when the
// option repeats, the LAST occurrence wins regardless of spelling (-s,
// --size, --size=, the joined short form -s+10, or -s clustered with
// other boolean short flags like -cs/-cs+10) - so this walks args once in
// order and keeps overwriting, never checking one spelling in priority
// order over another. Boundary, stated: only -s/--size's own value is
// inspected; -c/-o/-r never affect grow-safety, clustered or not.
const TRUNCATE_JOINED_S_RE = /^-[a-zA-Z]*s(.*)$/;

// The set: GNU truncate's SIZE modifier prefixes. CITED SOURCE:
// `truncate --help`, RUN live on this host - "SIZE may also be prefixed
// by one of the following modifying characters: '+' extend by, '-'
// reduce by, '<' at most, '>' at least, '/' round down to multiple of,
// '%' round up to multiple of." Axes, all six covered: '+' (extend),
// '>' (at least - grows only if smaller) and '%' (round UP) can never
// shrink the file - the same provable-grow class defence round 4
// exempted for '+' alone. '-' (reduce), '<' (at most - shrinks only if
// larger) and '/' (round DOWN) can shrink and stay DESTRUCTION.
const TRUNCATE_GROW_ONLY_PREFIXES = new Set(['+', '>', '%']);

function truncateGrowSize(args) {
  // AXIS 5+7 (Set W7, defence round 7): `analyzeDestructionVerb`'s own
  // main loop already honours `--` end-of-options (the SAME site-
  // consistency gap U4 closed for `lastMvOverride` vs `analyzeMv`) -
  // this sibling helper scans the SAME args array for a different
  // purpose and had no `--` awareness at all, so a FILE literally named
  // `--size=+10` after `--` would misread as the flag rather than a
  // positional operand.
  let endOptions = false;
  let size;
  for (let i = 0; i < args.length; i++) {
    const w = args[i].value;
    if (!endOptions && w === '--') { endOptions = true; continue; }
    if (endOptions) continue;
    if (w === '--size') { size = args[i + 1]?.value; continue; }
    if (w.startsWith('--size=')) { size = w.slice('--size='.length); continue; }
    const joinedShort = TRUNCATE_JOINED_S_RE.exec(w);
    if (joinedShort) { size = joinedShort[1] || args[i + 1]?.value; continue; }
  }
  return size;
}

// cmd.exe builtins sharing one grammar: `/`-prefixed switches. CITED
// SOURCE, both RUN live on this host: `del /?` -> "DEL [/P] [/F] [/S]
// [/Q] [/A[[:]attributes]] names"; `rmdir /?` -> "RMDIR [/S] [/Q]
// [drive:]path" / "RD [/S] [/Q] ...". Axes: both listed verbs sharing
// the family, not just the one queried.
const CMD_EXE_VERBS = new Set(['del', 'rmdir']);

// The axis U2 (this same round) never checked: platform membership is
// NOT uniform across CMD_EXE_VERBS. `del` has no POSIX/GNU equivalent
// anywhere - Windows-only, `/`-switches ONLY. `rmdir` is ALSO a real
// GNU coreutils tool - CITED SOURCE: `rmdir --help`, RUN live on this
// host (GNU coreutils via MSYS2) - supports `--help`/`--version` like
// any other GNU tool. So `/?` is ADDITIVE for rmdir, never exclusive of
// its GNU form; enumerated explicitly here rather than assumed uniform
// across the set above (the same one-fix-generalized-past-its-source
// mistake this constant's own sibling correction exists to name).
const DUAL_PLATFORM_CMD_EXE_VERBS = new Set(['rmdir']);

function isWindowsSwitch(verbLower, value) {
  return CMD_EXE_VERBS.has(verbLower) && /^\/[A-Za-z]/.test(value);
}

// truncate's synopsis (`truncate --help`, this host, live): "Usage:
// truncate OPTION... FILE..." with "-s, --size=SIZE" as the one value-
// taking option - FILE is a separate required operand from -s's own
// value, so a bare `-s`/`--size`/a clustered `-Xs` (value in the NEXT
// token) must skip that token too, or its value miscounts as FILE.
const TRUNCATE_BARE_S_CLUSTER_RE = /^-[a-zA-Z]*s$/;

function isValueTakingFlag(verbLower, value) {
  return verbLower === 'truncate' && (value === '--size' || TRUNCATE_BARE_S_CLUSTER_RE.test(value));
}

// ponytail: 56 lines at declaration (defence round 8, Set Y1 - the
// ALL-OUTPUTS re-check's target-collection rewrite grew this past the
// 50-line function-length signal). The collection loop, the no-op/
// grow-safe exemptions, and the final targets-to-findings map all read
// and narrow the SAME `targets` array end-to-end - splitting any one
// piece out would hand a caller half this verb's own decision and the
// rest back, the same cohesion argument `analyzeMv`'s own declaration
// makes for its own branches. Extraction, if ever warranted, rides the
// same future unit as the file-header's own deferred split - not done
// piecemeal here.
function analyzeDestructionVerb(verbLower, args, precededByPipe) {
  let endOptions = false;
  let sawNoOpFlag = false;
  // Set Y1 (defence round 8, ALL-OUTPUTS re-check, SITE): this loop used
  // to track a boolean (`hasPositional`) and discard every token it
  // examined - the single largest empty cell the re-check found, since
  // `analyzeMv`/`analyzeMoveItem`/the redirect-classification path all
  // already capture and report the real operand. Same push conditions as
  // the boolean version (nothing new is now counted as an operand that
  // was not already counted as "positional presence" before) - only the
  // VALUE is kept instead of thrown away.
  const targets = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i].value;
    if (!endOptions && w === '--') { endOptions = true; continue; }
    if (!endOptions && isNoOpFlag(verbLower, w)) { sawNoOpFlag = true; continue; }
    if (!endOptions && isWindowsSwitch(verbLower, w)) continue;
    if (!endOptions && isValueTakingFlag(verbLower, w)) { i++; continue; }
    if (!endOptions && isColonValueFlag(verbLower, w)) { targets.push(colonFlagValue(w)); continue; }
    if (!endOptions && w.length > 1 && w.startsWith('-')) continue;
    targets.push(w);
  }
  if (sawNoOpFlag) {
    return { verdict: 'NO_MATCH' };
  }
  if (verbLower === 'truncate') {
    const sizeValue = truncateGrowSize(args);
    if (sizeValue && TRUNCATE_GROW_ONLY_PREFIXES.has(sizeValue[0])) {
      // A grow-only modifier (-s/--size, joined or separated) can never
      // shrink the file, regardless of its current size - the class of
      // truncate shapes provably safe without a runtime stat.
      return { verdict: 'NO_MATCH' };
    }
  }
  if (targets.length === 0) {
    // AXIS 6 (invocation channel, Set W6 defence round 7): Remove-Item's
    // -Path parameter binds FROM THE PIPELINE, PowerShell's own
    // documented binding model - "no positional operand" is not "no
    // operand" for the one verb here that is a real PowerShell cmdlet.
    // Scoped to remove-item only: POSIX verbs (rm/rmdir/unlink/
    // truncate/del) read argv, not stdin, so a POSIX `cmd | rm` does
    // not feed rm an operand this way and this exemption must not
    // apply to them. No LEXICAL target exists here - the real path only
    // exists upstream of the pipe, outside this segment - so this finding
    // carries no `target` at all (unchanged from before Set Y1).
    if (verbLower === 'remove-item' && precededByPipe) {
      return { verdict: 'DESTRUCTION', findings: [{ verb: verbLower, conditional: true }] };
    }
    // No operand at all - nothing for this verb to destroy.
    return { verdict: 'NO_MATCH' };
  }
  return {
    verdict: 'DESTRUCTION',
    findings: targets.map((target) => ({ verb: verbLower, target, conditional: false })),
  };
}

// Set-Content always overwrites (never appends); an empty -Value is the
// unambiguous "clear the file" shape - a real value is an ordinary write,
// not in scope.
function isSetContentClear(args) {
  const idx = args.findIndex((w) => w.value.toLowerCase() === '-value');
  if (idx !== -1 && args[idx + 1]?.value === '') return true;
  // The same colon-binding syntax T5 verified for remove-item applies
  // here too: `-Value:''`/`-Value:""` tokenizes as one word ending in `:`
  // (the quotes strip to nothing, leaving no content after the colon).
  return args.some((w) => w.value.toLowerCase() === '-value:');
}

// Every check that decides what a resolved verb word MEANS, extracted so
// the same precise logic (git's own subcommand check included) applies
// whether the verb was found as the walk's PRIMARY candidate or reached
// directly (no prefix chain at all).
function unjudgedConstruct(heredoc, fdOutOfScope) {
  if (heredoc) return { verdict: 'OUT_OF_SCOPE', reason: 'heredoc present', kind: KIND_UNJUDGED };
  if (fdOutOfScope) return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${fdOutOfScope.op} not judged`, kind: KIND_UNJUDGED };
  return null;
}

// ponytail: 109 lines at declaration (defence round 3) - over the 50-line
// function-length signal, grown by F/L/S2's OUT_OF_SCOPE-admission
// additions. Same deferral as the file-header declaration - a lookup-
// table extraction is future work, not this round's.
function classifyVerb(verb, verbLower, args, heredoc, fdOutOfScope, precededByPipe) {
  if (DESTRUCTION_VERBS.has(verbLower)) {
    const result = analyzeDestructionVerb(verbLower, args, precededByPipe);
    // A NO_MATCH exemption (--help, an explicit grow) must not silently
    // discard a real fd redirect sitting alongside it - fall through to the
    // same unjudged-construct check every other verb gets.
    if (result.verdict !== 'NO_MATCH') return result;
    return unjudgedConstruct(heredoc, fdOutOfScope) || result;
  }

  if (verbLower === 'mv') {
    const result = analyzeMv(args);
    if (result.verdict !== 'NO_MATCH') return result;
    return unjudgedConstruct(heredoc, fdOutOfScope) || result;
  }

  if (verbLower === 'move-item') {
    const result = analyzeMoveItem(args);
    if (result.verdict !== 'NO_MATCH') return result;
    return unjudgedConstruct(heredoc, fdOutOfScope) || result;
  }

  const unjudged = unjudgedConstruct(heredoc, fdOutOfScope);
  if (unjudged) return unjudged;

  if (verbLower === 'case') {
    // A case-statement's pattern label (`a)`) sits between the keyword and
    // the command that follows it - grammar this parser does not parse.
    // Declared unjudged rather than left as a silent NO_MATCH. Boundary:
    // this only recognizes the case-statement's OPENING (word 0 of a
    // segment) - a later `;;`-separated clause's own command sits behind
    // its own pattern label, itself unrecognized, and is invisible to
    // this check the same way a subshell later in an argument is.
    return { verdict: 'OUT_OF_SCOPE', reason: 'case pattern grammar not inspected', kind: KIND_UNJUDGED };
  }
  if (NAMED_DESTROYER_VERBS.has(verbLower)) {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} is a direct destroyer this parser does not route`, kind: KIND_UNROUTED };
  }
  if (verbLower === 'cp' && isNonFileSink(firstPositional(args))) {
    // Copying FROM a null-sink source truncates the target - an ordinary
    // `cp a b` (copy is not in scope) is unaffected. CITED SOURCE: `cp
    // --help`, RUN live - SOURCE is a positional operand in every one of
    // cp's own usage forms, so a flag in front of it (`-f`, `-v`, any
    // boolean short/long form) must not defeat this check the way
    // `args[0]` did. Boundary, stated: `-t DIRECTORY` (cp's one
    // VALUE-taking short flag before SOURCE) is not resolved here - it
    // is a separate, uncited claim this fix does not make.
    return { verdict: 'OUT_OF_SCOPE', reason: 'cp from a null-sink source truncates its target', kind: KIND_UNROUTED };
  }
  if (
    verbLower === 'tee' && args.length > 0
    && !args.some((w) => w.value === '-a' || w.value === '--append')
    && !args.some((w) => w.value === '>' || w.value === '<')
  ) {
    // tee truncates every target on open unless appending - a bare `tee`
    // (stdin to stdout, no file) and `tee -a` (append, no truncation) are
    // both provably safe. The `>`/`<` exclusion is process substitution's
    // own inert word tokens (D1) - `tee >(wc -l)` names no real file.
    return { verdict: 'OUT_OF_SCOPE', reason: 'tee truncates its target(s) on open', kind: KIND_UNROUTED };
  }
  if (verbLower === 'clear-content' && args.length > 0) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'Clear-Content empties its target', kind: KIND_UNROUTED };
  }
  if (verbLower === 'set-content' && isSetContentClear(args)) {
    return { verdict: 'OUT_OF_SCOPE', reason: "Set-Content -Value '' empties its target", kind: KIND_UNROUTED };
  }
  if (verbLower === 'make') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'make target may run arbitrary destructive rules', kind: KIND_DECLARED };
  }
  if (verbLower === 'xargs') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'xargs may invoke a destructive verb per input line', kind: KIND_DECLARED };
  }
  if (verbLower === 'find' && args.some((w) => w.value === '-exec' || w.value === '-delete' || w.value === '-execdir')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'find can delete directly or run an arbitrary destructive verb', kind: KIND_DECLARED };
  }
  if (verbLower === 'git') {
    // A global flag before the subcommand (`-C <path>`, `--git-dir=<path>`)
    // must not defeat routing - skip it the same way skipSudoFlags does for
    // sudo, so args[0] is never wrongly assumed to be the subcommand.
    const subIdx = skipGitGlobalFlags(args);
    const sub = args[subIdx]?.value;
    if (GIT_DESTRUCTIVE_SUBCOMMANDS.has(sub)) {
      return { verdict: 'OUT_OF_SCOPE', reason: `git ${sub} is a direct destroyer this parser does not route`, kind: KIND_UNROUTED };
    }
    if (sub === 'reset' && args.slice(subIdx).some((w) => w.value === '--hard')) {
      // A bare `git reset` (soft/mixed, the default) never touches the
      // working tree - only --hard overwrites tracked files, so the flag
      // gate is load-bearing, not an approximation.
      return { verdict: 'OUT_OF_SCOPE', reason: 'git reset --hard is a direct destroyer this parser does not route', kind: KIND_UNROUTED };
    }
  }
  if (verbLower === 'npx' && args[0]?.value === 'rimraf') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'npx rimraf is a direct destroyer this parser does not route', kind: KIND_UNROUTED };
  }
  if (PKG_MANAGERS.has(verbLower)) {
    const sub = args[0]?.value;
    if (sub === 'run' || sub === 'ci') {
      return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} ${sub} executes an arbitrary/destructive package script`, kind: KIND_DECLARED };
    }
    if (sub === 'exec' && args[1]?.value === 'rimraf') {
      return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} exec rimraf is a direct destroyer this parser does not route`, kind: KIND_UNROUTED };
    }
  }
  if (POSIX_INTERPRETER_VERBS.has(verbLower) && args.some((w) => POSIX_ONE_LINER_FLAGS.has(w.value))) {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} one-liner may run arbitrary code`, kind: KIND_DECLARED };
  }
  if (WINDOWS_ONE_LINER_VERBS.has(verbLower) && args.some((w) => /^-c/i.test(w.value))) {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} one-liner may run arbitrary code`, kind: KIND_DECLARED };
  }
  if (verbLower === 'cmd' && args.some((w) => w.value.toLowerCase() === '/c')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'cmd /c may run arbitrary code', kind: KIND_DECLARED };
  }
  if (WRAPPER_SCRIPT_VERBS.has(verbLower)) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'script file invocation not inspected', kind: KIND_DECLARED };
  }
  if (SCRIPT_EXTENSION.test(verb)) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'script file invocation not inspected', kind: KIND_DECLARED };
  }

  return { verdict: 'NO_MATCH' };
}

// PowerShell verb aliases this room's guarded/named verbs already cover
// under their canonical spelling. CITED SOURCE: `Get-Alias -Definition
// <cmdlet>`, RUN live on this host (PowerShell 5.1.26100.8972) - not
// recalled from memory. `sc` (Set-Content's own alias) is DELIBERATELY
// excluded: it collides with sc.exe, the Windows Service Controller, an
// unrelated and extremely common command - aliasing it would over-widen
// this parser's own declared scope onto ordinary `sc query`/`sc start`.
const POWERSHELL_VERB_ALIASES = {
  ri: 'remove-item',
  // Get-Alias -Definition Clear-Content -> clc, its only alias (Set W6,
  // defence round 7 - the audit's own T3 row: the alias MECHANISM below
  // already resolves every verb candidate universally before any name
  // check, so this is purely a missing table entry, not a missing code
  // path). Set-Content's own alias (`sc`) stays excluded, per this
  // table's own header comment above - `sc` collides with sc.exe, the
  // Windows Service Controller.
  clc: 'clear-content',
  // Get-Alias -Definition Move-Item -> mi, move, mv. `mi` resolves to
  // move-item's OWN semantics below (NOT mv's - Move-Item requires
  // -Force to overwrite, VERIFIED empirically on this host's PowerShell
  // 5.1: bare Move-Item onto an existing target throws and touches
  // neither file; -Force succeeds and overwrites). `move` (cmd.exe's own
  // move, a different program) stays aliased to mv unchanged - a live
  // probe suggested it also declines without /Y under non-interactive
  // stdin, but that is a separate, unresolved question this table does
  // not claim to answer.
  mi: 'move-item',
  move: 'mv',
};

function verbAt(words, idx) {
  const raw = words[idx].value;
  const base = basenameOf(raw);
  const stripped = stripExeExtension(base).toLowerCase();
  return { base, baseLower: POWERSHELL_VERB_ALIASES[stripped] || stripped };
}

// Name-only check for a SECONDARY candidate (any candidate past the
// first). Deliberately narrower than classifyVerb: it never re-runs
// analyzeDestructionVerb/analyzeMv/git's subcommand logic on data that
// might just be an earlier command's own argument (`cat rm` - `rm` is a
// filename, not a command), so a secondary candidate can only ever admit
// OUT_OF_SCOPE, never a false DESTRUCTION on nothing.
function isSecondaryCandidateNamedVerb(words, idx) {
  const { baseLower } = verbAt(words, idx);
  return DESTRUCTION_VERBS.has(baseLower) || baseLower === 'mv' || baseLower === 'move-item' || NAMED_DESTROYER_VERBS.has(baseLower) || baseLower === 'git';
}

// --- one segment -------------------------------------------------------

// ponytail: 92 lines at declaration (defence round 3) - over the 50-line
// function-length signal. Same deferral as the file-header declaration.
function analyzeSegment(tokens, precededByPipe) {
  let heredoc = false;
  const words = [];
  const redirects = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if (t.type === 'op') {
      if (t.value === '<<' || t.value === '<<-' || t.value === '<<<') { heredoc = true; continue; }
      if (t.value === '<' || t.value === '<>') {
        // Consume the target the same way an output redirect does, so it
        // never becomes word 0 and displaces the real verb - but never push
        // it into `redirects`: an input redirect only reads, and `<>`
        // (POSIX table) opens for read-write without truncating either.
        const target = tokens[idx + 1];
        if (target && target.type === 'word') idx++;
        continue;
      }
      if (t.fdDup) continue;
      const target = tokens[idx + 1];
      if (!target || target.type !== 'word') {
        return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${t.value} has no target`, kind: KIND_UNJUDGED };
      }
      redirects.push({ op: t.value, target: target.value });
      idx++;
      continue;
    }
    words.push(t);
  }

  const classified = redirects.map((r) => ({ ...r, kind: classifyRedirectOp(r.op) }));
  // Set Y2c (defence round 8, ALL-OUTPUTS re-check, SITE): a segment can
  // open more than one real truncating redirect (`echo hi > a > b`,
  // CITED SOURCE RUN live this round - BOTH a and b are opened and
  // truncated; only the LAST one wins the write). `.find()` reported the
  // first only, silently dropping every sibling target this parser had
  // already classified correctly.
  const truncatingRedirects = classified.filter((r) => r.kind === 'truncate' && !isNonFileSink(r.target));
  if (truncatingRedirects.length > 0) {
    // Schema ruling (defence round 8): a redirect has an OPERATOR
    // (`1>`/`>|`/`&>`, ...), never a command/cmdlet name - reporting it
    // under `verb` (every command-based finding's field) put two
    // incompatible types behind one name with no way to recover the type
    // from the shape. `operator` is exclusive with `verb` on every
    // finding this parser emits - see the return-shape doc above
    // parseCommand.
    return {
      verdict: 'DESTRUCTION',
      findings: truncatingRedirects.map((r) => ({ operator: r.op, target: r.target, conditional: false })),
    };
  }
  // A non-stdout fd redirect to a non-file sink (`2>/dev/null`) truncates
  // nothing - the null-sink check applies to any fd, not only fd 1, so it
  // must run here too rather than only inside the fd-1 truncating branch
  // above. Otherwise the single most common redirect an agent writes is
  // reported unjudged, inflating the ceiling metric with a construct this
  // parser can in fact read.
  const fdOutOfScope = classified.find((r) => r.kind === 'fd-out-of-scope' && !isNonFileSink(r.target));

  if (words.length === 0) {
    if (fdOutOfScope) return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${fdOutOfScope.op} not judged`, kind: KIND_UNJUDGED };
    return { verdict: 'NO_MATCH' };
  }

  const first = words[0].value;
  if (first === '{' || first.startsWith('(') || first.startsWith('$(') || first.startsWith('`')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'subshell/group/command-substitution not inspected', kind: KIND_UNJUDGED };
  }

  const resolved = resolveVerb(words);
  if (!resolved) {
    // The prefix chain consumed every word (`exec` with nothing after
    // it) - a PENDING unjudged admission (heredoc/fd-redirect) must
    // still surface here, the same way it does everywhere else in this
    // function. Falling straight to NO_MATCH silently dropped a
    // construct the parser had already decided it could not judge.
    return unjudgedConstruct(heredoc, fdOutOfScope) || { verdict: 'NO_MATCH' };
  }

  if (!resolved.consumedPrefix) {
    // word 0 is already the candidate - no ambiguity, no walk needed.
    const { base, baseLower } = verbAt(words, resolved.index);
    const args = words.slice(resolved.index + 1);
    return classifyVerb(base, baseLower, args, heredoc, fdOutOfScope, precededByPipe);
  }

  // A prefix chain was consumed. Per-tool flag knowledge, where it exists
  // (sudo's), is an OPTIMIZATION that sharpens the walk's starting point;
  // it is never required for correctness - the generic walk below finds a
  // listed verb regardless of whether one exists for this prefix.
  const candidateStart = resolved.lastPrefixVerb === 'sudo'
    ? skipSudoFlags(words, resolved.index)
    : resolved.index;
  const candidates = walkCandidates(words, candidateStart);
  if (candidates.length === 0) return { verdict: 'NO_MATCH' };

  const [primaryIdx, ...secondaryIdx] = candidates;
  const { base: primaryVerb, baseLower: primaryVerbLower } = verbAt(words, primaryIdx);
  const primaryArgs = words.slice(primaryIdx + 1);
  const primaryResult = classifyVerb(primaryVerb, primaryVerbLower, primaryArgs, heredoc, fdOutOfScope, precededByPipe);
  if (primaryResult.verdict !== 'NO_MATCH') return primaryResult;

  // The walk keeps looking rather than returning: a mis-identified
  // PRIMARY candidate (usually a flag's value we could not confirm takes
  // one) must not silently end the search. Every later candidate is
  // checked by NAME only (never re-run through classifyVerb - a name at
  // this position may just as easily be an EARLIER command's own
  // argument, `cat rm`, and a full re-classification there risks a false
  // DESTRUCTION on nothing) and can only ever admit OUT_OF_SCOPE.
  for (const idx of secondaryIdx) {
    if (isSecondaryCandidateNamedVerb(words, idx)) {
      return { verdict: 'OUT_OF_SCOPE', reason: 'a listed verb may be present past an unresolved prefix chain', kind: KIND_UNJUDGED };
    }
  }
  return { verdict: 'NO_MATCH' };
}

// --- entry point -----------------------------------------------------------

// RETURN SHAPE (schema ruling, defence round 8, ALL-OUTPUTS re-check):
//   { verdict: 'DESTRUCTION' | 'OUT_OF_SCOPE' | 'NO_MATCH', findings: [...] }
// A DESTRUCTION finding is one of two SHAPES, never a blend:
//   - a command-based destruction: { verdict, verb, target?, conditional }
//     - `verb` is a real command/cmdlet name (`rm`, `mv`, `move-item`, ...).
//     - `target` is absent ONLY for the pipeline-bound Remove-Item shape
//       (axis 6, invocation channel) - no lexical path exists to report.
//   - a redirect-based destruction: { verdict, operator, target, conditional }
//     - `operator` is a shell redirect operator string (`1>`, `>|`, `&>`,
//       ...), never a command name.
// INVARIANT: exactly one of `verb` / `operator` is present on any finding
// this parser emits - never both, never neither. `verb` and `operator` are
// NOT interchangeable and a consumer MUST branch on which key is present
// before dispatching a remedy strategy, never assume `verb` covers both
// (the defect this ruling closed: a redirect's operator string was
// previously reported AS `verb`, indistinguishable by field name alone
// from a real command). An OUT_OF_SCOPE/NO_MATCH finding carries neither
// key - `reason`/`kind` instead (see the `kind` partition comment near
// KIND_DECLARED above).

export function parseCommand(input) {
  if (typeof input !== 'string') {
    return { verdict: 'OUT_OF_SCOPE', findings: [{ reason: 'non-string input' }] };
  }

  const { tokens, errors } = tokenize(input);
  if (errors.length > 0) {
    return { verdict: 'OUT_OF_SCOPE', findings: errors.map((reason) => ({ reason, kind: KIND_UNJUDGED })) };
  }

  const segments = splitSegments(tokens);
  const results = segments
    .map((seg) => analyzeSegment(seg.tokens, seg.precededByPipe))
    .filter((r) => r.verdict !== 'NO_MATCH');

  // Set Y1/Y2 (defence round 8, ALL-OUTPUTS re-check): a DESTRUCTION
  // result now carries its own `findings` array (one entry per real
  // at-risk path - a segment can destroy more than one) instead of a
  // single flat verb/target/conditional. Flattened here, once, so every
  // upstream producer (analyzeDestructionVerb/analyzeMv/analyzeMoveItem/
  // the redirect-truncate branch) only ever builds the internal shape,
  // never the public one.
  const destructions = results
    .filter((r) => r.verdict === 'DESTRUCTION')
    .flatMap((r) => r.findings.map((f) => ({ verdict: 'DESTRUCTION', ...f })));
  if (destructions.length > 0) return { verdict: 'DESTRUCTION', findings: destructions };

  const outOfScope = results.filter((r) => r.verdict === 'OUT_OF_SCOPE');
  if (outOfScope.length > 0) return { verdict: 'OUT_OF_SCOPE', findings: outOfScope };

  return { verdict: 'NO_MATCH', findings: [] };
}
