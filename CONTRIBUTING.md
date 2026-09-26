# Contributing to CoalGob

CoalGob is the recoverable-delete guard of the [TheColliery](https://github.com/TheColliery) series — today, its command classifier only. Issues, bug reports, and pull requests are welcome.

---

## 🤝 Proposing a Change

1. **Open an issue first** describing the problem, gap, or proposed change. For a wrong verdict, include the exact command string you passed to `parseCommand` and the verdict you expected.
2. Make your code changes and keep the verification gate green (below).
3. Add a test that fails without your change — a classification change ships with the exact command strings it fixes.

A first-time contributor: the gate command in the next section IS the getting-started step — clone, install nothing extra, run it.

---

## 💻 Developing & Testing

CoalGob is **zero-dependency** (Node.js built-ins only, Node 22+). No `npm install` is required.

Keep the verification gate green before and after making edits:

```bash
node scripts/test.mjs           # runs the zero-dependency test runner (node --test, explicit file list)
```

CoalGob has no build step, no `plugin/` distribution, and no `verify.mjs` gate yet — each is owed at the unit that builds the surface it would check.

### Development Rules

* **The identity sentence says the same thing on every surface.** `README.md` carries it in full and the `description` in `.claude-plugin/plugin.json` carries a trimmed derivative of it; change what one claims, check the other still says the same.
* **Complete the set, and cite the source.** When you add a verb, flag, or keyword to a list, cite a checkable source in a comment (a `--help` output, the shell's own documentation) and say what the source answers and where judgment still enters. Half of a set is an exposure that reads as a fix.
* **A comment that describes coverage changes in the same commit as the coverage** — never after.
* **Add unit tests:** every change to `scripts/lib/` carries a matching test in `scripts/lib/parser.test.mjs`.
* **`NO_MATCH` is never a safety claim** — do not write code, tests, or docs that read it as "safe".
* **Language & tone:** shipped source files and documentation stay in English.

---

## 🖥️ Supported Platforms

Node.js 22 or newer on Linux, Windows, and macOS — CI runs the suite on all three, on Node 22 and 24. The classifier has no platform-specific runtime dependency; it recognizes both POSIX and Windows destruction verbs (`rm`, `del`, `Remove-Item`, and the rest of its declared scope) on every platform.

---

## 🗂️ Project Layout

| Path | Purpose |
|---|---|
| `scripts/lib/parser.mjs` | The classifier: verb resolution and the three-valued verdict |
| `scripts/lib/tokenizer.mjs` | The Bash tokenizer: quoting, separators, redirects |
| `scripts/lib/parser.test.mjs` | The test suite |
| `scripts/test.mjs` | The zero-dependency test runner (explicit file list) |
| `.claude-plugin/plugin.json` | The plugin manifest — the canonical version lives here |
| `.github/` | CI, CodeQL, Scorecard, coverage, Dependabot, issue templates |

---

## 🚀 Releasing (Maintainers)

Bump version in `.claude-plugin/plugin.json` → add a CHANGELOG entry → ensure `test.mjs` passes → commit → create a signed git tag (`vX.Y.Z`) → push `--follow-tags` → create a GitHub Release (stable tags only).

---

## 📄 License & Conduct

Contributions are licensed under this repo's own outbound license — see [LICENSE](LICENSE). No separate CLA: sending a PR licenses it the way the project already ships. Please assume good faith and be respectful, per [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report security issues per [SECURITY.md](SECURITY.md).

**Response time:** best effort by a solo maintainer; no SLA is promised. When a target window is set it is stated here.
