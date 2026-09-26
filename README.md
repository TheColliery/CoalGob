<div align="center">

# 🕳️ CoalGob

> *A gob is the mined-out void a colliery packs with waste rock to hold the roof up — the space you
> deliberately fill instead of leaving open.*

**Beta. The command-classifier engine ships; the delete guard does not — yet.** CoalGob's parser and
tokenizer, with their test suite, are here and working. There is no hook, skill, command, or
interception surface, so nothing installs, blocks, or reroutes anything today.

![license](https://img.shields.io/badge/license-Apache_2.0-blue)
![status](https://img.shields.io/badge/status-beta-orange)

**Part of [TheColliery](https://github.com/TheColliery)** — siblings: **[CoalMine](https://github.com/TheColliery/CoalMine)** (quality canaries) · **[CoalTipple](https://github.com/TheColliery/CoalTipple)** (model/effort routing) · **[CoalBoard](https://github.com/TheColliery/CoalBoard)** (consensus & debate) · **[CoalHearth](https://github.com/TheColliery/CoalHearth)** (session warm-resume) · **[CoalFace](https://github.com/TheColliery/CoalFace)** (fan-out discipline) · **[CoalWash](https://github.com/TheColliery/CoalWash)** (memory defrag) · **[CoalLedger](https://github.com/TheColliery/CoalLedger)** (docs health).

</div>

---

## Design goal

What follows is the design the engine is built for, not behaviour that ships today (see
[Status](#status)).

> CoalGob checks every destructive command an agent runs, per operation, for whether it already
> lands somewhere recoverable — the OS's own trash, or a destroyer that already snapshotted it — and
> only blocks it when it would not, handing back the recoverable form of the same destruction rather
> than leaving the agent to retry blind or reach for an unmonitored verb.

CoalGob adds no new protection. It is designed to remove the routing that lets an agent's delete skip
the net every OS already ships for a user — and where no net can be constructed at all, to say so
instead of quietly landing the agent below the user's own baseline.

An agent is not more reckless than a user with a mouse; it is structurally routed around the safety
net a user gets for free (`rm`, `unlink`, `Remove-Item`, `shutil.rmtree` all bypass the Recycle Bin /
Trash by default).

CoalGob's scope is direct destruction verbs — `rm`, `rmdir`, `unlink`, `truncate`, `> file`, `mv`
over an existing target, `Remove-Item`, `del` — not everything that could destroy indirectly. A
wrapper that might run one of those verbs underneath (`make`, `npm run`, `xargs`, `find -exec`, an
interpreter one-liner, a script file) is out of scope by design: recognizing what every wrapper might
do would turn CoalGob into a general command classifier instead of a destruction guard.

## Status

**Pre-release `0.1.0-beta.1`.** The shipped surface is the classifier engine and nothing else:

- **Ships:** `scripts/lib/tokenizer.mjs` and `scripts/lib/parser.mjs` — a pure function that takes a
  Bash-style command string and returns a three-valued verdict — and the test suite that pins it
  (`node scripts/test.mjs`). It never executes the command, reads a file, or opens a connection.
- **Does not exist yet:** a hook, a skill, a command, an agent, any interception or emitter code,
  trash routing, a capability probe, and a `plugin/` distribution. You cannot install CoalGob to guard
  anything today. Each absence and the trigger it is owed at is recorded in
  [CHANGELOG.md](CHANGELOG.md).

The verdicts, so a reader can judge what the engine claims:

| Verdict | Meaning |
|---|---|
| `DESTRUCTION` | The command destroys at least one named target (`rm -rf build`). |
| `OUT_OF_SCOPE` | Something here could destroy, but the engine deliberately does not route it — a wrapper such as `make`, or a construct it cannot see into. |
| `NO_MATCH` | The engine's closed verb list did not match. **Not a safety claim.** |

```js
import { parseCommand } from './scripts/lib/parser.mjs';

parseCommand('rm -rf build'); // { verdict: 'DESTRUCTION', findings: [{ verb: 'rm', target: 'build', … }] }
parseCommand('make clean');   // { verdict: 'OUT_OF_SCOPE', findings: [{ kind: 'declared', … }] }
```

## Compatibility

Node.js 22 or newer, no dependencies (Node built-ins only — nothing to `npm install`). CI runs the suite
on Linux, Windows, and macOS, each on Node 22 and 24. The classifier has no platform-specific runtime
dependency and recognizes both POSIX and Windows destruction verbs (`rm`, `del`, `Remove-Item`, and the
rest of its declared scope) on every platform.

## Known ceiling

CoalGob does not claim its classifier is complete, and it measures how far from complete it is. These
are counts only; the detail is withheld on purpose, because a guard's own list of where it misses is a
map for whoever wants to get past it.

- **A predicate-site audit** (2026-08-05) covered **23 predicates** — rules the parser applies at more
  than one place — across **61 call sites**, and found **18 sites** where a rule was applied correctly
  at one place and not at its sibling. **17 of the 18 are closed; 1 remains open.** The audit is a
  lower bound: a second pass from a different starting angle could find more.
- **Blind attack rounds** — fresh attackers given only the parser and its published scope — have
  found further root causes. **At least 9 are known and open** (7 from one round, at least 2 from a
  later one; one of the 7 is the open site above).

**The detail publishes when the open root causes close.** Until then, treat a `NO_MATCH` as "this
engine's list did not match", never as "safe". This is a published ceiling on a guard that does not
claim completeness — it is not a vulnerability advisory, and it does not concern any enforcement,
because none ships yet.

## License

[Apache-2.0](LICENSE), see [NOTICE](NOTICE) for attribution terms.
