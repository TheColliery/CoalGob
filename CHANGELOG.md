# Changelog

All notable changes to CoalGob are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer (the canonical version lives in `.claude-plugin/plugin.json`).

## [Unreleased]

### Added

- Repo founded — org #8 of the TheColliery series, concept stage. License, NOTICE, and plugin
  manifest only; no hooks, skills, or interception code yet.
- `scripts/lib/parser.mjs` — a pure Bash-command classifier for the interception design's detection
  path. Three-valued verdict (`DESTRUCTION` / `NONE` / `OUT_OF_SCOPE`), never boolean: a wrapper that
  could destroy indirectly (`make`, `npm run`, `xargs`, `find -exec`, an interpreter one-liner, a
  heredoc) or a command the parser could not confidently tokenize reports `OUT_OF_SCOPE` rather than a
  silent `NONE`. No filesystem access — `mv` over a target it cannot itself verify returns a
  `conditional` flag for the caller to `stat`. 49 tests in `scripts/lib/parser.test.mjs`, run via
  `scripts/test.mjs` (`node --test`, explicit file list). No emitter, no hook wiring, no capability
  probe, no trash routing yet — this unit is the parser alone.

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
