// Pure Bash-command classifier. No filesystem access (ruling 3): a caller
// that needs a runtime fact (does mv's target exist?) gets a `conditional`
// flag and does its own stat. In scope: rm, rmdir, unlink, truncate,
// `> file` truncation, mv-over-an-existing-target, Remove-Item, del.
// Everything that could destroy indirectly (make, npm run, xargs, find
// -exec, an interpreter one-liner, a heredoc, a script-file invocation) is
// OUT_OF_SCOPE, never a silent NONE - a boolean "no destruction found" here
// is indistinguishable from "this command is safe", which is the exact
// failure class this room exists to name.

const SEGMENT_SEPARATORS = new Set([';', '&&', '||', '|', '\n']);

const DESTRUCTION_VERBS = new Set([
  'rm', 'rmdir', 'unlink', 'truncate', 'del', 'remove-item',
]);

const WRAPPER_SCRIPT_VERBS = new Set(['bash', 'sh', 'zsh', 'ksh', 'dash', 'source', '.']);
const INTERPRETER_VERBS = new Set(['node', 'python', 'python3', 'perl', 'ruby', 'pwsh', 'powershell']);
const INTERPRETER_ONE_LINER_FLAGS = new Set(['-e', '-c', '-Command', '/c']);
const PKG_MANAGERS = new Set(['npm', 'yarn', 'pnpm', 'bun']);
const SCRIPT_EXTENSION = /\.(sh|ps1|py|pl|rb)$/i;

// --- tokenizer ---------------------------------------------------------

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
      if (input[i + 1] === '>') { tokens.push({ type: 'op', value: (fd || '1') + '>>' }); i += 2; }
      else if (input[i + 1] === '|') { tokens.push({ type: 'op', value: (fd || '1') + '>|' }); i += 2; }
      else { tokens.push({ type: 'op', value: (fd || '1') + '>' }); i++; }
      continue;
    }

    if (c === '<') {
      if (input[i + 1] === '<') {
        if (input[i + 2] === '<') { tokens.push({ type: 'op', value: '<<<' }); i += 3; continue; }
        const opValue = input[i + 2] === '-' ? '<<-' : '<<';
        i += opValue.length;
        tokens.push({ type: 'op', value: opValue });
        // A heredoc body is opaque to this parser (ruling: a heredoc is
        // OUT_OF_SCOPE, never silently NONE) - swallow it whole so its
        // internal newlines/`;`/`&&` never fabricate fake top-level segments.
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

// --- segmentation --------------------------------------------------------

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

// --- redirect classification ---------------------------------------------

function classifyRedirectOp(op) {
  if (op.endsWith('>>')) return 'append';
  if (op.endsWith('>|') || op.endsWith('>')) {
    return op.startsWith('1') ? 'truncate' : 'fd-out-of-scope';
  }
  return 'other';
}

// --- mv (ruling 3: conditional on the runtime existence of its target) ---

function analyzeMv(words) {
  const args = words.slice(1);

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

// --- one segment ------------------------------------------------------

function analyzeSegment(tokens) {
  let heredoc = false;
  const words = [];
  const redirects = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if (t.type === 'op') {
      if (t.value === '<<' || t.value === '<<-' || t.value === '<<<') { heredoc = true; continue; }
      if (t.value === '<') continue;
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
  const truncating = classified.find((r) => r.kind === 'truncate');
  if (truncating) {
    return { verdict: 'DESTRUCTION', verb: truncating.op, target: truncating.target, conditional: false };
  }
  const fdOutOfScope = classified.find((r) => r.kind === 'fd-out-of-scope');

  if (words.length === 0) {
    if (fdOutOfScope) return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${fdOutOfScope.op} not judged` };
    return { verdict: 'NONE' };
  }

  const verb = words[0].value;
  const verbLower = verb.toLowerCase();

  if (DESTRUCTION_VERBS.has(verbLower)) {
    return { verdict: 'DESTRUCTION', verb: verbLower, conditional: false };
  }

  if (verbLower === 'mv') {
    return analyzeMv(words);
  }

  if (heredoc) return { verdict: 'OUT_OF_SCOPE', reason: 'heredoc present' };
  if (fdOutOfScope) return { verdict: 'OUT_OF_SCOPE', reason: `redirect ${fdOutOfScope.op} not judged` };

  if (verbLower === 'make') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'make target may run arbitrary destructive rules' };
  }
  if (verbLower === 'xargs') {
    return { verdict: 'OUT_OF_SCOPE', reason: 'xargs may invoke a destructive verb per input line' };
  }
  if (verbLower === 'find' && words.some((w) => w.value === '-exec')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'find -exec may run a destructive verb' };
  }
  if (PKG_MANAGERS.has(verbLower) && words[1]?.value === 'run') {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} run executes an arbitrary package script` };
  }
  if (INTERPRETER_VERBS.has(verbLower) && words.some((w) => INTERPRETER_ONE_LINER_FLAGS.has(w.value))) {
    return { verdict: 'OUT_OF_SCOPE', reason: `${verbLower} one-liner may run arbitrary code` };
  }
  if (verbLower === 'cmd' && words.some((w) => w.value === '/c')) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'cmd /c may run arbitrary code' };
  }
  if (WRAPPER_SCRIPT_VERBS.has(verbLower)) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'script file invocation not inspected' };
  }
  if (SCRIPT_EXTENSION.test(verb)) {
    return { verdict: 'OUT_OF_SCOPE', reason: 'script file invocation not inspected' };
  }

  return { verdict: 'NONE' };
}

// --- entry point -----------------------------------------------------

export function parseCommand(input) {
  if (typeof input !== 'string') {
    return { verdict: 'OUT_OF_SCOPE', findings: [{ reason: 'non-string input' }] };
  }

  const { tokens, errors } = tokenize(input);
  if (errors.length > 0) {
    return { verdict: 'OUT_OF_SCOPE', findings: errors.map((reason) => ({ reason })) };
  }

  const segments = splitSegments(tokens);
  const results = segments.map(analyzeSegment).filter((r) => r.verdict !== 'NONE');

  const destructions = results.filter((r) => r.verdict === 'DESTRUCTION');
  if (destructions.length > 0) return { verdict: 'DESTRUCTION', findings: destructions };

  const outOfScope = results.filter((r) => r.verdict === 'OUT_OF_SCOPE');
  if (outOfScope.length > 0) return { verdict: 'OUT_OF_SCOPE', findings: outOfScope };

  return { verdict: 'NONE', findings: [] };
}
