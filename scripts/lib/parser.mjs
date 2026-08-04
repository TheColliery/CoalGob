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
//     sudo/env/nice/time/command, timeout <duration>, and a path-qualified
//     verb via basename) - a prefix combination outside that chain (e.g.
//     `env FOO=bar timeout 5 sudo rm x`, interleaved) is not walked and
//     degrades to NO_MATCH on whatever token ends up at the front.
//   - A subshell `( )`, brace group `{ }`, or command substitution `$( )`/
//     backtick form is recognized ONLY when it opens the segment (word 0);
//     the same construct appearing later in an argument is invisible.
//   - `eval` is recognized as a verb; its argument string is never parsed.
//   - Redirect input (`<`) does not consume its target as a non-argument
//     word, so `cmd < file` leaves `file` in the argument list.
//   - fd-duplication/close (`>&N`, `>&-`) is recognized only in the `>&`
//     spelling, not `<&`.
//   - A non-file sink is verified by name against a fixed list
//     (/dev/null, /dev/zero, /dev/full, /dev/tty, /dev/stdout, /dev/stderr,
//     /dev/fd/N, /proc/self/fd/N, Windows NUL) - a symlink or bind-mount
//     that resolves to one of these under a different name is not caught,
//     because this parser never touches the filesystem (ruling 3).

const SEGMENT_SEPARATORS = new Set([';', '&&', '||', '|', '&', '\n']);

const DESTRUCTION_VERBS = new Set([
  'rm', 'rmdir', 'unlink', 'truncate', 'del', 'remove-item',
]);

const PREFIX_VERBS = new Set(['sudo', 'env', 'nice', 'time', 'command']);
const TIMEOUT_VERB = 'timeout';
const ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;
const DURATION_RE = /^[\d.]+[smhd]?$/;

const WRAPPER_SCRIPT_VERBS = new Set(['bash', 'sh', 'zsh', 'ksh', 'dash', 'source', '.']);
const POSIX_INTERPRETER_VERBS = new Set(['node', 'python', 'python3', 'perl', 'ruby']);
const POSIX_ONE_LINER_FLAGS = new Set(['-e', '-c']);
const WINDOWS_ONE_LINER_VERBS = new Set(['pwsh', 'powershell']);
const PKG_MANAGERS = new Set(['npm', 'yarn', 'pnpm', 'bun']);
const GIT_DESTRUCTIVE_SUBCOMMANDS = new Set(['clean', 'rm', 'checkout']);
const NAMED_DESTROYER_VERBS = new Set(['shred', 'dd', 'eval']);
const SCRIPT_EXTENSION = /\.(sh|ps1|py|pl|rb)$/i;

const NULL_SINKS = new Set([
  '/dev/null', '/dev/zero', '/dev/full', '/dev/tty', '/dev/stdout', '/dev/stderr',
]);
const FD_SINK_RE = /^\/(dev\/fd|proc\/self\/fd)\/\d+$/;
const WINDOWS_UNC_NUL_PREFIX = '\\\\.\\';

function isNonFileSink(target) {
  if (NULL_SINKS.has(target)) return true;
  if (FD_SINK_RE.test(target)) return true;
  const stripped = target.startsWith(WINDOWS_UNC_NUL_PREFIX) ? target.slice(WINDOWS_UNC_NUL_PREFIX.length) : target;
  return stripped.toLowerCase() === 'nul';
}

// --- tokenizer -----------------------------------------------------------

function tokenize(input) {
  const tokens = [];
  const errors = [];
  const n = input.length;
  let i = 0;

  function fdPrefixAdjacent() {
    const last = tokens[tokens.length - 1];
    return last && last.type === 'word' && /^[0-9]+$/.test(last.value) && last.end === i
      ? tokens.pop().value
      : '';
  }

  while (i < n) {
    const c = input[i];

    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\n') { tokens.push({ type: 'op', value: '\n' }); i++; continue; }
    if (c === ';') { tokens.push({ type: 'op', value: ';' }); i++; continue; }

    if (c === '|') {
      if (input[i + 1] === '|') { tokens.push({ type: 'op', value: '||' }); i += 2; }
      else { tokens.push({ type: 'op', value: '|' }); i++; }
      continue;
    }

    if (c === '&') {
      if (input[i + 1] === '&') { tokens.push({ type: 'op', value: '&&' }); i += 2; continue; }
      if (input[i + 1] === '>') {
        if (input[i + 2] === '>') { tokens.push({ type: 'op', value: '&>>' }); i += 3; }
        else { tokens.push({ type: 'op', value: '&>' }); i += 2; }
        continue;
      }
      tokens.push({ type: 'op', value: '&' }); i++; continue;
    }

    if (c === '>') {
      const fd = fdPrefixAdjacent();
      if (input[i + 1] === '&') {
        // fd-duplication (`2>&1`) or fd-close (`>&-`) - a descriptor
        // operation, never a filename target.
        i += 2;
        let operand = '';
        if (input[i] === '-') { operand = '-'; i++; }
        else { while (i < n && /[0-9]/.test(input[i])) { operand += input[i]; i++; } }
        tokens.push({ type: 'op', value: `${fd || '1'}>&${operand}`, fdDup: true });
        continue;
      }
      if (input[i + 1] === '>') { tokens.push({ type: 'op', value: `${fd || '1'}>>` }); i += 2; }
      else if (input[i + 1] === '|') { tokens.push({ type: 'op', value: `${fd || '1'}>|` }); i += 2; }
      else { tokens.push({ type: 'op', value: `${fd || '1'}>` }); i++; }
      continue;
    }

    if (c === '<') {
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
        tokens.push({ type: 'op', value: '\n' });
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
    while (i < n) {
      const ch = input[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ';|&><'.includes(ch)) break;
      if (ch === '\\') {
        if (i + 1 >= n) { errors.push('trailing backslash at end of command'); i = n; brokeOnError = true; break; }
        value += input[i + 1]; i += 2; continue;
      }
      if (ch === "'") {
        const end = input.indexOf("'", i + 1);
        if (end === -1) { errors.push('unterminated single quote'); i = n; brokeOnError = true; break; }
        value += input.slice(i + 1, end); i = end + 1; continue;
      }
      if (ch === '"') {
        let j = i + 1; let closed = false;
        while (j < n) {
          if (input[j] === '"') { closed = true; j++; break; }
          if (input[j] === '\\' && j + 1 < n && '"\\$`'.includes(input[j + 1])) { value += input[j + 1]; j += 2; continue; }
          value += input[j]; j++;
        }
        if (!closed) { errors.push('unterminated double quote'); i = n; brokeOnError = true; break; }
        i = j; continue;
      }
      value += ch; i++;
    }
    if (brokeOnError && value === '' && i === startI + 1) continue;
    if (i > startI || value !== '') tokens.push({ type: 'word', value, end: i });
  }

  return { tokens, errors };
}

// --- segmentation ----------------------------------------------------------

function splitSegments(tokens) {
  const segments = [];
  let current = [];
  for (const t of tokens) {
    if (t.type === 'op' && SEGMENT_SEPARATORS.has(t.value)) {
      segments.push(current);
      current = [];
    } else {
      current.push(t);
    }
  }
  segments.push(current);
  return segments.filter((seg) => seg.length > 0);
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

function resolveVerb(words) {
  let idx = 0;
  while (idx < words.length && ASSIGNMENT_RE.test(words[idx].value)) idx++;
  while (idx < words.length) {
    const wLower = words[idx].value.toLowerCase();
    if (wLower === TIMEOUT_VERB) {
      idx++;
      if (idx < words.length && DURATION_RE.test(words[idx].value)) idx++;
      continue;
    }
    if (PREFIX_VERBS.has(wLower)) { idx++; continue; }
    break;
  }
  if (idx >= words.length) return null;
  const raw = words[idx].value;
  const base = /[\\/]/.test(raw) ? raw.split(/[\\/]/).pop() : raw;
  return { base, baseLower: base.toLowerCase(), index: idx };
}

// --- mv (ruling 3: conditional on the runtime existence of its target) -----

function analyzeMv(args) {
  const tIdx = args.findIndex((w) => w.value === '-t');
  if (tIdx !== -1 && args[tIdx + 1]) {
    return { verdict: 'DESTRUCTION', verb: 'mv', target: args[tIdx + 1].value, conditional: true };
  }

  let endOptions = false;
  const positional = [];
  for (const w of args) {
    if (!endOptions && w.value === '--') { endOptions = true; continue; }
    if (!endOptions && w.value.length > 1 && w.value.startsWith('-')) continue;
    positional.push(w.value);
  }

  if (positional.length >= 2) {
    return {
      verdict: 'DESTRUCTION',
      verb: 'mv',
      target: positional[positional.length - 1],
      conditional: true,
    };
  }

  return { verdict: 'OUT_OF_SCOPE', reason: 'mv argument shape not recognized' };
}

// --- a listed destruction verb (rm/rmdir/unlink/truncate/del/Remove-Item) --

function analyzeDestructionVerb(verbLower, args) {
  if (args.some((w) => w.value === '--help' || w.value === '--version')) {
    return { verdict: 'NO_MATCH' };
  }
  if (verbLower === 'truncate') {
    const sIdx = args.findIndex((w) => w.value === '-s');
    const sizeArg = sIdx !== -1 ? args[sIdx + 1] : undefined;
    if (sizeArg && sizeArg.value.startsWith('+')) {
      // An explicit grow can never shrink the file, regardless of its
      // current size - the one truncate shape provably safe without a
      // runtime stat.
      return { verdict: 'NO_MATCH' };
    }
  }
  return { verdict: 'DESTRUCTION', verb: verbLower, conditional: false };
}

// --- one segment -------------------------------------------------------

function analyzeSegment(tokens) {
  let heredoc = false;
  const words = [];
  const redirects = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if (t.type === 'op') {
      if (t.value === '<<' || t.value === '<<-' || t.value === '<<<') { heredoc = true; continue; }
      if (t.value === '<' || t.fdDup) continue;
      const target = tokens[idx + 1];
      if (!target || target.type !== 'word') {
        return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${t.value} has no target` };
      }
      redirects.push({ op: t.value, target: target.value });
      idx++;
      continue;
    }
    words.push(t);
  }

  const classified = redirects.map((r) => ({ ...r, kind: classifyRedirectOp(r.op) }));
  const truncating = classified.find((r) => r.kind === 'truncate' && !isNonFileSink(r.target));
  if (truncating) {
    return { verdict: 'DESTRUCTION', verb: truncating.op, target: truncating.target, conditional: false };
  }
  const fdOutOfScope = classified.find((r) => r.kind === 'fd-out-of-scope');

  if (words.length === 0) {
    if (fdOutOfScope) return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${fdOutOfScope.op} not judged` };
    return { verdict: 'NO_MATCH' };
  }

  const first = words[0].value;
  if (first === '{' || first.startsWith('(') || first.startsWith('$(') || first.startsWith('`')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'subshell/group/command-substitution not inspected' };
  }

  const resolved = resolveVerb(words);
  if (!resolved) return { verdict: 'NO_MATCH' };
  const verb = resolved.base;
  const verbLower = resolved.baseLower;
  const args = words.slice(resolved.index + 1);

  if (DESTRUCTION_VERBS.has(verbLower)) {
    return analyzeDestructionVerb(verbLower, args);
  }

  if (verbLower === 'mv') {
    return analyzeMv(args);
  }

  if (heredoc) return { verdict: 'OUT_OF_SCOPE', reason: 'heredoc present' };
  if (fdOutOfScope) return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${fdOutOfScope.op} not judged` };

  if (NAMED_DESTROYER_VERBS.has(verbLower)) {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} is a direct destroyer this parser does not route` };
  }
  if (verbLower === 'make') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'make target may run arbitrary destructive rules' };
  }
  if (verbLower === 'xargs') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'xargs may invoke a destructive verb per input line' };
  }
  if (verbLower === 'find' && args.some((w) => w.value === '-exec' || w.value === '-delete' || w.value === '-execdir')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'find can delete directly or run an arbitrary destructive verb' };
  }
  if (verbLower === 'git' && GIT_DESTRUCTIVE_SUBCOMMANDS.has(args[0]?.value)) {
    return { verdict: 'OUT_OF_SCOPE', reason: `git ${args[0].value} is a direct destroyer this parser does not route` };
  }
  if (verbLower === 'npx' && args[0]?.value === 'rimraf') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'npx rimraf is a direct destroyer this parser does not route' };
  }
  if (PKG_MANAGERS.has(verbLower)) {
    const sub = args[0]?.value;
    if (sub === 'run' || sub === 'ci') {
      return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} ${sub} executes an arbitrary/destructive package script` };
    }
    if (sub === 'exec' && args[1]?.value === 'rimraf') {
      return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} exec rimraf is a direct destroyer this parser does not route` };
    }
  }
  if (POSIX_INTERPRETER_VERBS.has(verbLower) && args.some((w) => POSIX_ONE_LINER_FLAGS.has(w.value))) {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} one-liner may run arbitrary code` };
  }
  if (WINDOWS_ONE_LINER_VERBS.has(verbLower) && args.some((w) => /^-c/i.test(w.value))) {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} one-liner may run arbitrary code` };
  }
  if (verbLower === 'cmd' && args.some((w) => w.value.toLowerCase() === '/c')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'cmd /c may run arbitrary code' };
  }
  if (WRAPPER_SCRIPT_VERBS.has(verbLower)) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'script file invocation not inspected' };
  }
  if (SCRIPT_EXTENSION.test(verb)) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'script file invocation not inspected' };
  }

  return { verdict: 'NO_MATCH' };
}

// --- entry point -----------------------------------------------------------

export function parseCommand(input) {
  if (typeof input !== 'string') {
    return { verdict: 'OUT_OF_SCOPE', findings: [{ reason: 'non-string input' }] };
  }

  const { tokens, errors } = tokenize(input);
  if (errors.length > 0) {
    return { verdict: 'OUT_OF_SCOPE', findings: errors.map((reason) => ({ reason })) };
  }

  const segments = splitSegments(tokens);
  const results = segments.map(analyzeSegment).filter((r) => r.verdict !== 'NO_MATCH');

  const destructions = results.filter((r) => r.verdict === 'DESTRUCTION');
  if (destructions.length > 0) return { verdict: 'DESTRUCTION', findings: destructions };

  const outOfScope = results.filter((r) => r.verdict === 'OUT_OF_SCOPE');
  if (outOfScope.length > 0) return { verdict: 'OUT_OF_SCOPE', findings: outOfScope };

  return { verdict: 'NO_MATCH', findings: [] };
}
