// Bash tokenizer, split out of parser.mjs (defence round 10, git mv +
// trim - a pure structural move, no logic changed; every line below
// this header is byte-identical to its prior home in parser.mjs).
// The FULL scope/limits contract (verdict semantics, known grammar
// limits, the ruling-3 no-filesystem-access boundary) lives in ONE
// place only: the top-of-file comment in parser.mjs. It does not fork
// here - this header states only what is local to tokenization.

export const SEGMENT_SEPARATORS = new Set([';', '&&', '||', '|', '&', '\n']);

// Reserved words that legally precede a `[[ ... ]]` test in bash grammar -
// `[[` is a keyword recognized only in COMMAND POSITION, never as a
// quoted or bare argument to a preceding word.
const BRACKET_TEST_PRECEDERS = new Set(['if', 'while', 'until', 'do', 'then', 'else', 'elif', '!']);


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
export function tokenize(input) {
  const tokens = [];
  const errors = [];
  const n = input.length;
  let i = 0;
  // CITED SOURCE: RUN live on this host's bash (board #28 residue,
  // defence round 10) - `if [[ true ]]; then ...` and
  // `if (( 1 < 2 )); then ...` both execute correctly, confirming both
  // grammars are real bash constructs whose `<`/`>` bind as
  // comparison, never redirection, inside their own delimiters.
  //
  // Depth of an open `[[ ... ]]` test - inside it, `<`/`>` are string
  // comparison, never a redirect. Keys on `[[` specifically; single `[ ]`
  // is unaffected.
  let bracketDepth = 0;
  // Depth of an open `(( ... ))`/`$(( ... ))` arithmetic context - inside
  // it, `>`/`<` are numeric comparison, never a redirect. Keys on the
  // exact two-char sequences `((`/`))` only - a general nested-parenthesis
  // balance is not attempted (matching the existing word-0-only treatment
  // of a bare subshell). Judgment, not derivable from the source alone:
  // RUN live also confirmed a genuinely NESTED paren inside `(( ))`
  // (`echo $(( (1+2) * 3 ))`) executes fine in real bash - this
  // tokenizer does not track that inner nesting at all, by the same
  // word-0-only-subshell tradeoff already stated above, not because the
  // source shows it doesn't exist.
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
    // Set Z7 (wave 8, defence round 9): a word starting `<letter>:\` is
    // an unambiguous Windows drive-letter path - CITED, well-established
    // Windows path syntax, RUN live (a file-based probe this round,
    // never a shell-quoted argument - this room's own probe trap,
    // already paid for twice: a shell-quoted `node -e` mangles the very
    // backslashes under test before the parser ever sees them). Neither
    // real consumer of this spelling escapes with backslash - cmd.exe
    // has no backslash escape at all, and PowerShell's own escape
    // character is the backtick - so bash's own backslash-escape rule
    // below must not consume this word's path separators. `del
    // C:\temp\a.txt` was reporting target `C:tempa.txt`: a right
    // verdict computed from a path that does not exist. Scoped to
    // EXACTLY this signature; a bare relative backslash path with no
    // drive letter is not distinguishable from an ordinary (if unusual)
    // bash escape sequence and is NOT covered.
    //
    // MUTABLE, not word-start-only (axis-7 census row 6, defence round
    // 10): the ORIGINAL fix only peeked at the word's own first 3
    // characters, so the identical signature sitting AFTER a colon-bound
    // flag prefix (`-Path:C:\temp\a.txt`) was invisible - the drive
    // letter is real, just not at index 0. Re-checked at every
    // backslash instead of once at word start: the moment the 2
    // characters immediately before ANY backslash in this word are
    // `<letter>:`, the flag goes sticky for the REST of the word - a
    // real path, once started, does not stop being one mid-token.
    let isWindowsDrivePath = /^[A-Za-z]:\\/.test(input.slice(i, i + 3));
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
      if (ch === '\\' && !isWindowsDrivePath && /^[A-Za-z]:$/.test(input.slice(i - 2, i))) {
        isWindowsDrivePath = true;
      }
      if (ch === '\\' && !isWindowsDrivePath) {
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

