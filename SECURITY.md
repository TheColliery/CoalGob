# Verifying CoalGob

CoalGob is verified under the same framework as its TheColliery siblings — reproducible from source, zero dependencies, and event-driven independent scans. Today CoalGob is a pure, offline command-string classifier: it receives a string, returns a verdict, and never executes the command, reads a file, opens a connection, or spawns a process. Its threat model is therefore narrow — a hostile input string handed to a pure function — and it ships no hook yet, so the Phoenix-13 hook commandments do not apply until the interception hook is built.

## Reporting a Vulnerability

Report a security issue in this repo through GitHub's private vulnerability reporting — [Security → Report a vulnerability](https://github.com/TheColliery/CoalGob/security/advisories/new) — never a public issue. In scope: a crash, hang, or unbounded resource use in `scripts/lib/parser.mjs` or `scripts/lib/tokenizer.mjs` on any input string; and any code path in the shipped source that reads or writes the filesystem, opens a network connection, or runs a process (there is none today, by design). A wrong verdict on an ordinary command — the parser classifying a command inside its declared scope differently than you expect — is a correctness bug: open a public issue with the exact command string and the verdict returned. This is a one-person-maintained project: expect the report to be read and acknowledged, triaged against the scope above, and disclosed once a fix ships, with no fixed response-time SLA. A public GitHub issue remains the right channel for an ordinary, non-security bug.

## Commit & Tag Signatures

Release tags and maintainer commits made from the public launch onward are SSH-signed (`gpg.format=ssh`); GitHub shows the Verified badge on them. The 90 commits that predate the public repository are unsigned. Automated Dependabot / CI commits are unsigned by design (they carry no maintainer key), so verify a signed release tag — the artifact a release consumer trusts. No release tag exists yet; once the first one is cut:

```bash
echo "* ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEtqTWGKhX1Dk9nZP8ns13Wl5zsO1Cz3VlTS6m1p2fP9" > coalgob_signers
git config gpg.ssh.allowedSignersFile ./coalgob_signers
git tag -v "$(git describe --tags --abbrev=0)"
```

## Source Integrity

CoalGob has no generated `plugin/` distribution and no `verify.mjs` gate yet — the shipped surface is source you can read: `scripts/lib/parser.mjs`, `scripts/lib/tokenizer.mjs`, and their tests. `node scripts/test.mjs` runs the zero-dependency suite with an explicit file list (a missing listed file fails loud). Zero dependencies — no lockfile, nothing to `npm audit`.

<!-- version-transition: SkillSpector scan — re-scan is event-driven (a new SkillSpector version or a genuinely new attack surface, maintainer-commanded), NOT per release; record the version/score/date/commit here only after a real scan. -->
## Independent Scanning — NVIDIA SkillSpector

No [NVIDIA SkillSpector](https://github.com/NVIDIA/skillspector) scan has been run against CoalGob: it ships no skill and no `plugin/` dist for the scanner to read. This section will pin the last scan actually verified once a scannable surface exists.

## Structural Safety

- **Pure classifier.** `scripts/lib/parser.mjs` exports a single function, `parseCommand(input)`; the parser and tokenizer sources import only `node:path` (posix) and each other — no `fs`, no network module, no `child_process`, no `process` access, no `eval`.
- **Never runs what it reads.** The command string is tokenized and matched against closed lists; it is not executed, expanded, or resolved against the filesystem.
- **A verdict is three-valued, never a boolean.** `DESTRUCTION`, `OUT_OF_SCOPE`, or `NO_MATCH`. `NO_MATCH` means only that the parser's closed verb list did not match — it is not a safety claim, and no caller should read it as one. A non-string input is reported as `OUT_OF_SCOPE`.
- **Zero dependencies.** Node.js built-ins only, no install step.
- **Offline, no telemetry.** See [PRIVACY.md](PRIVACY.md).

Honest scope: these are properties of a classifier only. CoalGob does not yet block, reroute, or recover anything — the reversibility backstop that would catch what the parser misses is not built, and a parser verdict alone is not a safety guarantee. No formal verification, no crypto-at-rest, no "military-grade" claim.
