# Codex repository instructions — Spacecraft Reliability Lab

## Current user scope override (2026-10-28)

Update 2026-10-29, V4/V5: the direct request authorizes an additive, optional mission-assurance mode in this same application. Keep the existing engineering/research/UI paths and offline v1/v2 contracts working. Current scope is seven bounded deterministic runtime roles, finite structured proposals, an independent pre-execution safety kernel, local SQLite approval/results workflow and same-app evidence/replay UI. The complete V5 vision names 20 specialist roles; it does not make unimplemented roles or phases complete. Read `docs/ASSURANCE_STATUS.md`, `docs/ASSURANCE_PLAN.md` and `docs/BUILD_STATE.md` before resuming.

Assurance specialists may propose only the implemented simulated action vocabulary; the finite Agent Registry cannot grant expanded tools or permissions. They cannot change source or call arbitrary tools, shell, networks or hardware. `MissionIntelligenceOrchestrator` coordinates independent pre-execution proposal-evidence checks; the separate deterministic kernel remains final recovery authorization and existing hard safe-mode protection remains active. Bind new `proposal-2.0` messages to run ID and exact original observation digest; record `verification_result`, rejected proposals and actual observed outcomes. Source/plan/result digests are content-integrity checks, not authentication. Durable restore means completed reports, not integrator/RNG continuation. Document ideal current/loss telemetry, sensed-temperature margins, static heater reconnect envelope and conservative zero solar credit. Never portray these checks as formal proof or flight validation.

No cross-project coupling, live Lunar Ops sync, deployment, external LLM service, real spacecraft command path or changes to another repository are authorized by this increment. Historical integration instructions below remain context only where they conflict with this override.

Update 2026-10-29: the direct V2 request authorizes an optional local JSON health adapter and research/UI extensions inside this existing project. Preserve v1.0. No live connection or mutation of any other project is authorized or implemented. See docs/V2_STATUS.md for actual versus planned capability.

The user's direct request keeps this lab independent of Lunar Ops, ChainMind and the Virtual Space Robotics + AI
Swarm Lab. Preserve the existing offline adapter for compatibility; the integration roadmap below is historical
context, not permission for live synchronization or edits to other repositories. Develop engineering models and FDIR
locally, with no deployment. The isolated workspace copy preserves the supplied Downloads folder and ZIP unchanged.

Historical integration intent: this was described as a **separate Codex-maintained component that must sync with Lunar Ops**. That intent does not override the current independent local scope. The earlier architecture names **Lunar Ops in Claude Code** for lunar mission planning, its **Virtual Space Robotics Lab**, and a separate **AI Swarm Lab** using **Swarms.ai** for task coordination; Swarms itself does not simulate physics or provide a robotics scene.

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
