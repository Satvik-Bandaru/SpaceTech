# Codex repository instructions — Spacecraft Reliability Lab

## Current user scope override (2026-10-28)

Update 2026-10-29: the direct V2 request authorizes an optional local JSON health adapter and research/UI extensions inside this existing project. Preserve v1.0. No live connection or mutation of any other project is authorized or implemented. See docs/V2_STATUS.md for actual versus planned capability.

The user's direct request keeps this lab independent of Lunar Ops, ChainMind and the Virtual Space Robotics + AI
Swarm Lab. Preserve the existing offline adapter for compatibility; the integration roadmap below is historical
context, not permission for live synchronization or edits to other repositories. Develop engineering models and FDIR
locally, with no deployment. The isolated workspace copy preserves the supplied Downloads folder and ZIP unchanged.

This is a **separate Codex-maintained component that must sync with Lunar Ops**, not a competing or disconnected space startup. The architectural source of truth for lunar mission planning is **Lunar Ops in Claude Code**, which also integrates the **Virtual Space Robotics Lab**. A separate **AI Swarm Lab** uses **Swarms.ai** for multi-agent task coordination; Swarms itself does not simulate physics or provide a robotics scene.

## Required boundaries
- Codex owns satellite/orbital relay fault injection, subsystem health, safe-mode simulation and telemetry reports **in this repository**.
- Claude Code owns Lunar Ops mission state, resource and surface planning, and Virtual Space Robotics Lab coordination/simulation in its repository.
- The Swarms.ai layer only *proposes* plans. A deterministic shared constraint checker, then the appropriate simulators, decide feasibility.
- Respect `integrations/contracts/README.md` version 1.0 and add schema and compatibility tests with any changes. No breaking change without version bump and migration notes.
- Keep independent databases, versions, tests and runtime boundaries. Exchange JSON through adapters. No direct shared datastore assumptions.
- Future live sync requires authentication/authorization, TLS, tenant or mission scoping, idempotent requests, timeouts, retries, tracing and replay tests. No hard-coded secrets.

## Safety and engineering quality
- Start with an audit and test baseline. Do not overwrite Lunar Ops, Virtual Space Robotics Lab, or AI Swarm Lab code.
- Every output must remain `SYNTHETIC`, simplified and *not flight-qualified* unless independently verified.
- Never connect to real spacecraft command links, hardware, production mission databases or paid services without explicit approval.
- No background auto-deploy or autonomous data mutation. A simulation result is advisory only.
- Maintain deterministic seeds, stable mission IDs, explicit units, versioned contracts, failure/replay test coverage, and human-readable errors.
- All new changes must have tests and a documented reproducible example. No mock results portrayed as real sensor observations.

## Starter commands
```bash
python -m unittest discover -s tests -v
python sync_lunar_ops.py integrations/examples/lunar_ops_satellite_request.json --out artifacts/lunar_ops_satellite_result.json
```

## Definition of done
A fully tested mission request produces a deterministic spacecraft report Lunar Ops can import, clearly labeled as synthetic; invalid or forged requests fail closed; no live operational side effects occur. For automatic HTTP sync, BOTH repositories must pass authenticated compatibility tests before claiming integration complete.
