<div align="center">

# 🕳️ CoalGob

> *A gob is the mined-out void a colliery packs with waste rock to hold the roof up — the space you
> deliberately fill instead of leaving open.*

**Concept stage. Nothing is built or shipped yet.** This README states what CoalGob will do, not
what it does today.

![license](https://img.shields.io/badge/license-Apache_2.0-blue)
![status](https://img.shields.io/badge/status-concept-lightgrey)

**Part of [TheColliery](https://github.com/TheColliery)** — siblings: **[CoalMine](https://github.com/HetCreep/CoalMine)** (quality canaries) · **[CoalTipple](https://github.com/TheColliery/CoalTipple)** (model/effort routing) · **[CoalBoard](https://github.com/TheColliery/CoalBoard)** (consensus & debate) · **[CoalHearth](https://github.com/TheColliery/CoalHearth)** (session warm-resume) · **[CoalFace](https://github.com/TheColliery/CoalFace)** (fan-out discipline) · **[CoalWash](https://github.com/TheColliery/CoalWash)** (memory defrag) · **[CoalLedger](https://github.com/TheColliery/CoalLedger)** (docs health).

</div>

---

## What it will do

Make an agent's destruction as recoverable as a user's, by rerouting destructive filesystem commands
through the operating system's own trash mechanism instead of letting them run as written — and
failing closed where no trash mechanism exists, rather than falling back to a real delete.

An agent is not more reckless than a user with a mouse; it is structurally routed around the safety
net a user gets for free (`rm`, `unlink`, `Remove-Item`, `shutil.rmtree` all bypass the Recycle Bin /
Trash by default). CoalGob removes that asymmetry rather than adding a new protection.

## Status

No hooks, no skills, no plugin, no interception code. This repository currently holds only the
license, governance boilerplate, and this description of intent.

## License

[Apache-2.0](LICENSE), see [NOTICE](NOTICE) for attribution terms.
