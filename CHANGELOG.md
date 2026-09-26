# Changelog

All notable changes to CoalGob are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer (the canonical version lives in `.claude-plugin/plugin.json`).

## [Unreleased]

## [0.1.0-beta.1] - 2026-09-21

**Pre-release — the first public release.** What ships is the command-classifier engine (parser and
tokenizer) and its test suite; there is no hook, skill, command, or interception surface yet. The
canonical version is `.claude-plugin/plugin.json`. The classifier's measured ceiling is stated, as
counts only, in the README's "Known ceiling" section.

### Added

- Repo founded — org #8 of the TheColliery series, at concept stage. License, NOTICE, and plugin
  manifest only; no hooks, skills, or interception code.
- Public-repo skeleton for the beta: `.github/` (CI on Linux, Windows and macOS across Node 22 and 24,
  CodeQL, Scorecard, coverage, markdownlint, Dependabot with CI-gated auto-merge, issue templates),
  `SECURITY.md`, `PRIVACY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`. `SECURITY.md` says plainly that
  no scan has been run (there is no skill or dist to scan) and that the 90 commits before launch are
  unsigned. The README gains a status statement matching the manifest, a Compatibility section, and
  the Known ceiling section. The manifest description now states the beta scope.
- `scripts/lib/parser.mjs` — a pure Bash-command classifier for the interception design's detection
  path. Three-valued verdict, never boolean: `DESTRUCTION` / `OUT_OF_SCOPE` (something here could
  destroy — a wrapper, a named direct destroyer this parser deliberately does not route, or a
  construct it cannot see into) / `NO_MATCH` (this parser's closed verb list did not match — **not a
  safety claim**). No filesystem access — `mv` over a target it cannot itself verify returns a
  `conditional` flag for the caller to `stat`. Tests in `scripts/lib/parser.test.mjs` (96 at this unit), run via
  `scripts/test.mjs` (`node --test`, explicit file list); the suite is 354 tests at this release. No emitter, no hook wiring, no capability
  probe, no trash routing yet — this unit is the parser alone.
- **Round 2 (INSPECT-parser-2026-08-04, 1 CRITICAL + 4 HIGH + 6 of 11 MEDIUM + 3 of 4 LOW fixed):**
  the verdict formerly named `NONE` is renamed `NO_MATCH` — it was reached by 15+ shapes (`eval`,
  subshells, command substitution, `git clean`, `shred`, `dd`, `find -delete`) that are not safe, only
  unmatched, and the old name read as a safety claim. `&` is now a statement separator (was silently
  erasing the next command, including an in-scope `rm` — the CRITICAL). A redirect to a non-file sink
  (`/dev/null`, `NUL`, `/dev/fd/N`, …) is no longer a destruction. The verb is resolved past a fixed
  prefix chain (`sudo`/`env`/`nice`/`time`/`command`/`timeout <duration>`, `VAR=value`, a
  path-qualified verb) so `sudo rm -rf` is caught. Named direct destroyers (`git clean`/`rm`/
  `checkout`, `shred`, `dd`, `npx rimraf`, `npm ci`/`exec rimraf`, `find -delete`/`-execdir`) and
  opaque constructs (subshell, brace group, `$(…)`, backticks) now report `OUT_OF_SCOPE` instead of
  the old silent match-failure. `fd`-duplication/close (`2>&1`, `>&-`) is recognized and names no
  file; fd classification is exact-match, not prefix-match (`10>` no longer reads as stdout); a
  heredoc no longer swallows the segment that follows it; Windows-family flags (`-Command`, `/c`) fold
  case, matching how PowerShell/cmd actually parse them; `rm --help`/`--version` and an explicit-grow
  `truncate -s +N` are no longer destructions. Module header now states the parser's known grammar
  limits explicitly. Red proven at the assertion level this round (44 genuine expected-vs-actual
  failures against the unfixed parser, not a module-resolution error) — see `f2926c3`'s red-proof
  finding (M5), closed.
- **Round 3 (small residue, 1 HIGH + 1 MEDIUM + a head's ruling):** the verb's basename strip only
  removed the directory, not a Windows executable extension — `rm.exe`, `del.exe`,
  `C:/tools/rm.exe` silently reported `NO_MATCH`, on this room's own dev platform, in the half of the
  verb list that exists for Windows (N2). The `--help`/`--version` safety guard now respects `--`
  end-of-options the way `analyzeMv` already does — `rm -- --help` deletes a real file literally named
  `--help` and is a destruction again, not a false safety read (N1). Where the verb resolver gives up
  on a prefix chain it does not walk (an assignment or a flag interleaved between prefix verbs — `env
  FOO=bar rm x`, `sudo -u root rm x`), the remainder is scanned for a listed verb: found →
  `OUT_OF_SCOPE` (an admission, not a widening), none found → `NO_MATCH` — the declared-but-silent
  residual is now a verdict a caller can act on.
- **Round 4 (1 CRITICAL regression from round 3's own give-up guard + 1 MEDIUM):** the give-up trigger
  written for a Windows `/c`-style flag also caught every POSIX absolute path, so `sudo /bin/rm -rf
  /tmp/x` — the ordinary way `sudo` is written on any Linux box — silently read `NO_MATCH` (R1). A
  leading `/` is no longer part of the trigger (no verb in the prefix chain — `sudo`/`env`/`nice`/
  `time`/`command` — ever takes a `/`-prefixed flag), and the give-up remainder scan now shares the
  exact same verb resolution (basename + exe-extension stripping) as the main path — one resolver,
  used everywhere. The remainder scan also gained positional reasoning (R2): it checks only the FIRST
  token genuinely in command position, correctly skipping a value-taking `sudo` flag and its value
  (`-u git` — an ordinary username, not the `git` verb) rather than flat-scanning every word, so
  `sudo -u root cat rm` (`rm` is `cat`'s argument) is `NO_MATCH` again. (`sudo -H -u www-data git
  status`'s verdict at this round was `OUT_OF_SCOPE` via the coarse remainder scan; round 5 below
  routes it through git's own precise subcommand check instead, correcting it to `NO_MATCH`.)

- **Round 5 (the parser's own rot-canary finding, ruled bigger than the flag table):** fixing the
  WALK, not just `SUDO_VALUE_FLAGS`. `sudo`'s own flags are now consumed as part of normal verb
  resolution — value-taking ones with their value, everything else treated as boolean by default
  (the safe default: misreading a value-taking flag as boolean over-reports `OUT_OF_SCOPE`;
  misreading a boolean flag as value-taking swallows the real command and silently returns
  `NO_MATCH`, the exact failure this parser exists to remove). `-h` (`--help`, boolean) is removed
  from the value-taking set; `-t`/`-U` (genuinely value-taking) are added. Because the real verb now
  resolves through the MAIN path instead of the coarse give-up remainder scan, it also gets that
  verb's own precise logic — `sudo -H -u www-data git clean` correctly stays `OUT_OF_SCOPE` while
  `sudo -H -u www-data git status` is `NO_MATCH`, not a blanket flag on any `git` invocation reached
  through a prefix chain.

- **Defence round 1, Group A (dogfood wave 1 — a fresh out-of-frame attacker, given only the parser
  and the published scope boundary, independently rediscovered the R3 CRITICAL across six more
  spellings):** the give-up mechanism is replaced with a structural, generic candidate walk — never
  a per-tool flag table. Every flag-shaped token (short, long, `=`-joined, clustered) and every
  assignment is skipped; every other token is a candidate, in order, and the walk never returns early
  because one token could not be classified. The first candidate gets full classification (can reach
  `DESTRUCTION`, and gets a resolved verb's own precise logic — git's subcommand check included); if
  that is `NO_MATCH`, every later candidate is checked by name only and can only ever admit
  `OUT_OF_SCOPE` (never a false `DESTRUCTION` on data that might just be an earlier command's own
  argument). `sudo`'s own flag table (now covering long forms too — `--user`, `--group`, `--prompt`,
  `--chdir`, …) is kept as an OPTIMIZATION that sharpens the walk's starting point to full precision;
  it no longer leaks onto `nice`/`time`/`command`/`timeout`'s remainders, the actual R3 mechanism.
  Closes: `nice -n 10 rm`, `time -p rm`, `command -p rm`, `timeout --signal=KILL 5 rm`,
  `timeout -k 5 10 rm`, `sudo --user root rm`, `nice --adjustment 10 rm`. Two pre-existing behaviors
  are knowingly upgraded/traded as a direct result: `env FOO=bar rm x` now resolves to full
  `DESTRUCTION` (the walk correctly skips the assignment as a non-candidate); `sudo -u root cat rm`
  now admits `OUT_OF_SCOPE` rather than `NO_MATCH` (the same safe-direction trade-off R2's own ruling
  pre-approved — `rm` here is `cat`'s filename argument, but the walk cannot always tell that from a
  genuine command position without re-introducing the false-negative hole this fixes). Composition
  axis added: a non-sudo prefix × a value-taking flag × the path/suffix resolver (`time -p
  /bin/rm.exe`, `nice -n 10 /bin/rm.exe`) — the crossing no round before this one exercised.

**Commit-subject note (reconciled, not rewritten — history is not amended for this):** `b4f018b`
(round 4) and `276be0a` (round 5) carry a **byte-identical git subject line** — a copy-paste error at
authoring time, caught after `276be0a` landed. `git log` alone cannot tell them apart; this CHANGELOG
is the disambiguation. `b4f018b` = round 4's content (the give-up trigger's `/` removal, R1/R2 above).
`276be0a` = round 5's content (the sudo-flag walk fix, immediately above). Going forward, a second
batch of fixes landing in one round is titled `(round N, part 2)`, or names what part 1 missed, so
this cannot recur.

**A claim in shipped text about what a guard covers is a defect of the same class as the guard being
wrong itself (found and closed three times — `09d8a33`, `a6210a0`, `ad57e4c`):** `09d8a33` reconciled
two commits sharing one byte-identical subject line. `a6210a0` closed a `-WhatIf` comment claiming
`:$true`/`:$false` were both handled when only `:$true` was — the untested half silently permitted a
real delete. `ad57e4c` closed a module-header sink list naming six entries after a prior round had
added five more. Standing rule from here: a comment or header describing coverage is updated in the
SAME commit that changes the coverage, never after.

**Deliberately absent, each owed at a stated trigger (as of this release):**

- `hooks/`, `skills/`, `agents/`, `commands/`, interception code, `scripts/build-plugin.mjs`,
  `scripts/verify.mjs` — no hook, skill, or plugin surface exists yet; owed once the interception
  mechanism (emitter + hook wiring) is built. (`scripts/lib/parser.mjs` + `scripts/test.mjs` are no
  longer on this list — they exist as of this entry.)
- `plugin/` dist, `.claude-plugin/marketplace.json` — no source to build, and a manifest whose only
  load-bearing field (`plugins[0].source`) points at a dist that does not exist ships a lie; owed
  together, with the first build.
- `platform-configs/` — no hook reads config yet; owed with the first hook.
- `.githooks/` — `.gitattributes`' LF rule anticipates this dir (matches CoalMine's shape, not
  CoalBoard's, per `0c00c0f` — "one flock, one color" costs less than a hand-trimmed variant) but it
  is inert until the dir exists; owed at the unit that adds `scripts/verify.mjs` — the public-doc SSoT
  sync gate (blueprint §13) needs a gate script to run and a stable §1 to check against, and neither
  exists yet (this unit's own parser churned §1's identity sentence twice). The CI workflow's verify
  step skips cleanly until `scripts/verify.mjs` exists.

No longer absent: `.github/` and `SECURITY.md` / `PRIVACY.md` / `CONTRIBUTING.md` were both owed at first
push; that trigger fired with this release and they are listed under Added above.
