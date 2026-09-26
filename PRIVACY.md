# CoalGob Privacy Policy

**CoalGob collects nothing and phones nowhere.**

- **No telemetry.** No usage data, analytics, or identifiers are collected, stored, or transmitted.
- **No network calls.** The parser is a pure function; its source imports no network, filesystem, or process module.
- **It runs where you run it** — CoalGob operates no servers and no service. The code executes on your own machine, under your own account, only when you invoke it.
- **A verdict is not a safety claim.** `NO_MATCH` means only that the parser's closed verb list did not match the command; it never says the command is safe.
- **Bug reports are manual.** Nothing is ever submitted automatically; you open an issue yourself and see everything you send.
- **Local files only** — this tool reads and writes nothing. `parseCommand` opens no files; the test runner (`scripts/test.mjs`) reads its own test file under `scripts/lib/` and writes nothing.

Questions: open an issue at <https://github.com/TheColliery/CoalGob/issues>.
