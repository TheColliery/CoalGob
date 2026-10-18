# Changelog

All notable changes to CoalGob are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer (the canonical version lives in `.claude-plugin/plugin.json`).

## [Unreleased]

### Changed

- Test only, no shipped behaviour change: the carriage-return test for a bash that keeps the character (GNU bash) in `scripts/lib/parser.test.mjs` is renamed to what it checks and gains a positive row, `rm -rf build<CR><NL>` run against a fixture folder holding both `build` and `build<CR>`, asserting that `build<CR>` is removed, `build` stays, and the parser names both targets.
- Test and CI only, no shipped behaviour change: four files re-copied by blob from `TheColliery/.github` at `2c0ab1b`: `scripts/front-door-links.test.mjs` (`9e75ccae`), `.github/workflows/front-door-links.yml` (`d9764084`, the `front-door-links` workflow), `scripts/lib/git-env-census.mjs` (`89f4c63f`) and `scripts/lib/git-env-census.vectors.mjs` (`e1d010f7`).

## [0.1.0-beta.4] - 2026-10-17

A carriage return can no longer hide a destroyer verb

### Fixed

- A carriage return outside a heredoc body that is not at a line end, and a backslash directly before a carriage return, is now an unjudged tokenizer error (`OUT_OF_SCOPE`) instead of a silent `NO_MATCH`: a bash that deletes every carriage return (MSYS bash) joins `r<CR>m -rf build` into `rm -rf build`, while a bash that keeps it (GNU bash) does not, so no single verdict is right. This is the general rule behind the carriage-return case in the `$` run named under `0.1.0-beta.3`, which stays true as a special case. A destroyer target that ends in a carriage return before the newline (`rm -rf build<CR><NL>`) is reported twice, with and without the carriage return, so each dialect finds the path it removes; a heredoc terminator line that matches the delimiter only once a trailing carriage return is ignored is an unjudged error too.

### Changed

- `.github/workflows/front-door-links.yml` re-copied by blob `f0cc9ec0` from the `.github` canon at `7794678` (the job is renamed `front-door-links`), no shipped behaviour change.
- Tooling and CI follow the `.github` canon at `bea2b3d`, no shipped behaviour change. Re-copied by blob from the overlay: `scripts/lib/wave-run.mjs` `b60827c6`, `scripts/lib/wave-run.test.mjs` `bccbaa58`, `scripts/verify-release-shape.mjs` `270e43d1`, `scripts/verify-release-shape.test.mjs` `7c2b35c4` and `scripts/release-notes.test.mjs` `f9dde432`; `scripts/lib/machine-reading.mjs` `5f861a34`, `scripts/lib/git-env-census.mjs` `82f20dac`, `scripts/lib/git-env-census.test.mjs` `c6b301cd` and `scripts/lib/git-env-census.vectors.mjs` `6dc3ad82` already equal the canon. Action pins moved to the canon's: `actions/setup-node` `949feb2413d6458794dcd2491c4babbbce0c15c1` (v7.1.0) in `ci.yml`, `coverage.yml` and `create-release.yml`, and `github/codeql-action` `24c54180a607b1449ed407dd24f251e4e9147c8d` (v4) in `codeql.yml` and `scorecard.yml`; `NOTICE` joins `scorecard.yml`'s `paths-ignore`.
- `NOTICE` takes the canon template's wording (`CoalGob`, `Copyright 2026 HetCreep`, the TheColliery series line, "licensed under Apache-2.0"); the Origin line and the Apache-2.0 section 4(d) sentence are gone.
- The README gains a CodeRabbit pull-request reviews badge.

## [0.1.0-beta.3] - 2026-10-16

Seven classifier misses closed; front-door link check

### Fixed

- The command classifier no longer misses five forms (all five tests are pinned in `scripts/lib/parser.test.mjs`): `env -S` / `--split-string` in every spelling is now reported `OUT_OF_SCOPE` (kind `declared`, like `sh -c`) instead of `NO_MATCH`; `mv --backup=none` (and `off` and their unambiguous prefixes) is now `DESTRUCTION`, because no backup is made; `truncate` with a reference file (`-r` / `--reference`) is now `DESTRUCTION` for a relative size, because the grow-only exemption no longer applies; a heredoc on the operator line is read the way bash reads it (each delimiter queued, the rest of the line parsed as ordinary shell, bodies read in order, and the delimiter itself read with bash quote removal: `$'...'`, `$"..."`, and backslash escapes inside double quotes), so a command on the same line is classified and a delimiter is no longer reported as a path; and a backslash before `'`, `"` or `$'` inside a drive-letter path is now an unjudged tokenizer error instead of a silent `NO_MATCH`. A bare `mv -b a b` stays exempt, because the real `VERSION_CONTROL` environment is invisible to the classifier.
- Two more forms are closed the same way: an even run of `$` before a quote (the shell's PID parameter `$$`) is no longer read as an ANSI-C quote opener, so a command after it is classified instead of silently missed, including when a backslash-newline (a line continuation) is joined into the run first; a heredoc delimiter follows the same rule. A carriage return inside that `$` run, which MSYS bash (it deletes every CR) and GNU bash (it keeps the CR as an ordinary character) read differently, is now an unjudged tokenizer error, never a verdict.

### Changed

- A front-door link check, taken from the `.github` canon at `bea2b3d`: `.github/workflows/front-door-links.yml` `7c582bd7`, `scripts/front-door-links.mjs` `3793a056`, `scripts/lib/front-door-links.mjs` `7df59db6` and its test `scripts/front-door-links.test.mjs` `3cff2b30`, listed in the `scripts/test.mjs` roster. It fetches every http(s) link of the front-door documents; no shipped behaviour change.
- Release tooling and a test follow the `.github` canon at `b4cf4ab` (the release scripts and their tests, the release workflow, and the secret-gate test). No shipped behaviour change.
- Tooling and tests re-synced by blob id, no shipped behaviour change: the secret scanner (`scripts/lib/secret-scan.mjs`, `270a21a2`) and its test (`scripts/secret-scan.test.mjs`, `a0319dcd`) from the house source (Bankfire `bd328f2`); from the `.github` canon, the secret gate (`856956a1`), its test (`71452210`) and `scripts/release-notes.test.mjs` (`7e779ef8`) at `d31a091`, the release overlay (`scripts/release-notes.mjs` `f8d998d8`, `scripts/lib/release-shape.mjs` `bfb29332` and its test `771a7e60`) and the git hooks at `690c2de`. This releases the hold on `scripts/release-notes.test.mjs`, now the canon's `7e779ef8`. The hooks keep the one named divergence listed under "Deliberately absent" below (the guarded `scripts/verify.mjs` line).
- Tooling and tests follow the `.github` canon at `aea4db7`, no shipped behaviour change. Overlay re-copied by blob id: `scripts/verify-release-shape.test.mjs` `fa8a730d`, `.github/workflows/create-release.yml` `d0859f1d` (a comment-only change), `scripts/secret-gate.test.mjs` `2f066650`, and the hooks `.githooks/pre-commit` and `.githooks/pre-push` `170996cb` (canon `1979bcaf` plus the one named hunk, the `scripts/verify.mjs` guard). The git-spawn census is adopted: `scripts/lib/git-env-census.mjs` `13f8d95c`, `scripts/lib/git-env-census.test.mjs` `972d9ca8`, `scripts/lib/git-env-census.vectors.mjs` `8147dd7a`, with the room test `scripts/git-spawn-census.test.mjs` pinning `scripts/secret-gate.mjs` `856956a1` (the scanner test needs no pin: it reads clean). `scripts/test.mjs` runs the suite through `scripts/lib/wave-run.mjs` `3119cb7d` (with `scripts/lib/stdout-sync.mjs` `27bd81af` and `scripts/lib/machine-reading.mjs` `1c550b66`), passing `--heap-mb 2048`, `--file-timeout-ms 60000`, `--file-clock-ms 180000` and `--deadline-ms 600000`, and judges each file by its TAP: a vacuous file is red. `scripts/lib/wave-run.test.mjs` `fd578cfd` is one more file of the enumerated roster. The room test is `scripts/lib/test-runner.test.mjs`; `scripts/lib/test-spawn.mjs` and its test are removed.
- A comment in `scripts/lib/tokenizer.mjs` now says what the code does with `parenDepth` and the separators; no behaviour change.
- Files re-copied from the `.github` canon at `fd40327` (it holds `machine-reading.mjs`, `wave-run.test.mjs` and `git-env-census.mjs` identically to `9456288`), no shipped behaviour change: `scripts/lib/machine-reading.mjs` `5f861a34`, `scripts/lib/wave-run.test.mjs` `2a686319`, `scripts/lib/git-env-census.mjs` `82f20dac`, `scripts/lib/git-env-census.test.mjs` `c6b301cd`, `scripts/lib/git-env-census.vectors.mjs` `6dc3ad82` and `scripts/secret-gate.test.mjs` `b2801af6`, replacing the ids the `aea4db7` entry above names. Workflows follow the same canon: `.github/workflows/dependabot-auto-merge.yml` `50c6f8bc` by blob (auto-merge is a patch-or-minor allowlist, the PR URL rides an env variable, job clock); `.github/workflows/codeql.yml` and `.github/workflows/coverage.yml` hunk by hunk (job clocks, `persist-credentials: false`, coverage's reworded gate comment). They stay different from the canon in two ways: `codeql.yml` keeps its named no-`paths-ignore` divergence, and the `github/codeql-action` and `actions/upload-code-coverage` pins stay at the room's Dependabot-moved versions, newer than the canon's (a whole-blob copy would revert two Dependabot bumps).

## [0.1.0-beta.2] - 2026-10-02

The commit and push gate now scans for secrets, releases are posted by one workflow, and two silent misses in the command classifier are fixed in the forms the suite pins.

**Pre-release.** The shipped surface is unchanged in kind: the command-classifier engine (parser and tokenizer) and its test suite, with no hook, skill, command, or interception surface yet. The canonical version is `.claude-plugin/plugin.json`. A beta tag gets no Release of its own; the repository's one pre-release Release is the launch-form Release of `0.1.0-beta.1`.

### Added

- A local git gate for the contributor's machine: `.githooks/pre-commit` and `.githooks/pre-push` (identical bytes) run the house secret scan (`scripts/secret-gate.mjs` over `scripts/lib/secret-scan.mjs`, with their tests), then the suite. Pre-commit scans the staged tree; pre-push also scans every commit message, tag message and added line in the pushed range. It is enabled once per clone with `git config core.hooksPath .githooks`. `f3f3f90`
- The release workflow `.github/workflows/create-release.yml` is the sole creator of GitHub Releases, with `scripts/release-notes.mjs`, `scripts/verify-release-shape.mjs`, `scripts/lib/release-shape.mjs` and their tests. It derives the Release title and body from this file, and a pre-release tag push posts nothing. `cf39793`
- `.gitbook.yaml` and `SUMMARY.md` for the docs site, publishing `README.md` and `CHANGELOG.md` only.

### Changed

- The suite grows from 354 to 445 tests (the secret scan, the release scripts, and the classifier tests below).
- The README's "Known ceiling" counts are re-derived from the internal census; the detail still publishes when the open root causes close.
- `CONTRIBUTING.md` and `SECURITY.md` describe the gate and the scan.

### Fixed

- Two silent misses in the command classifier, found by reading a peer guard's fixes class by class: a command word preceded by an append-style or subscripted assignment now classifies, and a PowerShell `foreach` statement's body is now reached in the forms the suite pins (reported `OUT_OF_SCOPE`). Pins are added for classes that already held. `df6a581`

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

**Deliberately absent, each owed at a stated trigger (as of 0.1.0-beta.4):**

- `hooks/`, `skills/`, `agents/`, `commands/`, interception code, `scripts/build-plugin.mjs` — no hook, skill, or plugin surface exists yet; owed once the interception
  mechanism (emitter + hook wiring) is built. (`scripts/lib/parser.mjs` + `scripts/test.mjs` are no
  longer on this list — they exist as of this entry.)
- `plugin/` dist, `.claude-plugin/marketplace.json` — no source to build, and a manifest whose only
  load-bearing field (`plugins[0].source`) points at a dist that does not exist ships a lie; owed
  together, with the first build.
- `platform-configs/` — no hook reads config yet; owed with the first hook.
- `scripts/verify.mjs` and the public-doc SSoT sync gate (blueprint §13) — the `.githooks/` pair now exists
  (it runs the secret gate and the suite), but its verify line is guarded: it runs `scripts/verify.mjs` only
  when that file exists, a named divergence from the canon hook, which runs it unconditionally. Owed back to the
  canon line at the unit that adds `scripts/verify.mjs`; the sync gate needs a gate script to run and a stable
  §1 to check against, and neither exists yet. The CI workflow's verify step skips cleanly until then.
- `.github/workflows/codeql.yml` carries no `paths-ignore` (a named divergence from the canon, kept so a docs-only PR does not leave the required `analyze` check pending), and `codeql-action` and `upload-code-coverage` stay at the Dependabot-moved pins, newer than the canon's; each is owed back to the canon line when the canon refreshes its pins or drops its own `paths-ignore`.

No longer absent: `.github/` and `SECURITY.md` / `PRIVACY.md` / `CONTRIBUTING.md` were both owed at first
push; that trigger fired with 0.1.0-beta.1 and they are listed under its Added above. `.githooks/` was owed
at the unit that adds `scripts/verify.mjs`; it landed earlier, with the secret gate, in 0.1.0-beta.2.
