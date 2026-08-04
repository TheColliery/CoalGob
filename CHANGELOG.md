# Changelog

All notable changes to CoalGob are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer (the canonical version lives in `.claude-plugin/plugin.json`).

## [Unreleased]

### Added

- Repo founded — org #8 of the TheColliery series, concept stage. License, NOTICE, and plugin
  manifest only; no hooks, skills, or interception code yet.
- `scripts/lib/parser.mjs` — a pure Bash-command classifier for the interception design's detection
  path. Three-valued verdict, never boolean: `DESTRUCTION` / `OUT_OF_SCOPE` (something here could
  destroy — a wrapper, a named direct destroyer this parser deliberately does not route, or a
  construct it cannot see into) / `NO_MATCH` (this parser's closed verb list did not match — **not a
  safety claim**). No filesystem access — `mv` over a target it cannot itself verify returns a
  `conditional` flag for the caller to `stat`. 96 tests in `scripts/lib/parser.test.mjs`, run via
  `scripts/test.mjs` (`node --test`, explicit file list). No emitter, no hook wiring, no capability
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

**Deliberately absent, each owed at a stated trigger:**

- `hooks/`, `skills/`, `agents/`, `commands/`, interception code, `scripts/build-plugin.mjs`,
  `scripts/verify.mjs` — no hook, skill, or plugin surface exists yet; owed once the interception
  mechanism (emitter + hook wiring) is built. (`scripts/lib/parser.mjs` + `scripts/test.mjs` are no
  longer on this list — they exist as of this entry.)
- `plugin/` dist, `.claude-plugin/marketplace.json` — no source to build, and a manifest whose only
  load-bearing field (`plugins[0].source`) points at a dist that does not exist ships a lie; owed
  together, with the first build.
- `platform-configs/` — no hook reads config yet; owed with the first hook.
- `.github/` (CI, CodeQL, Scorecard, dependabot, issue templates) — no remote; these produce no
  signal against zero code; owed at first push.
- `SECURITY.md`, `PRIVACY.md`, `CONTRIBUTING.md` — would describe a product that does not exist yet;
  owed at first push.
- `.githooks/` — `.gitattributes`' LF rule anticipates this dir (kept byte-identical to the sibling
  repos on purpose — "one flock, one color" costs less than a hand-trimmed variant) but it is inert
  until the dir exists; owed at the first build, since it is the only place the public-doc SSoT sync
  gate (blueprint §13) can run — a CI job cannot see a gitignored `COALGOB_BLUEPRINT.md`.
