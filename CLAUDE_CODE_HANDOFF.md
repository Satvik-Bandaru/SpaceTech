# Claude Code prompt — Lunar Ops + Virtual Space Robotics Lab companion integration

Use this prompt **inside your existing Lunar Ops repository** (not in the Codex repo):

> Lunar Ops is the primary mission planning and lunar infrastructure platform. Virtual Space Robotics Lab belongs with / integrates closely with Lunar Ops. The AI Swarm Lab uses Swarms.ai for task-planning agents; Swarms is not the 3D physics engine.
>
> A separate Codex-maintained repo, Spacecraft Reliability & Autonomy Lab, now provides a versioned **v1.0 offline JSON exchange** for satellite/orbital relay health and fault simulation. Please read the contract file `integrations/contracts/README.md` and fixture `integrations/examples/lunar_ops_satellite_request.json` from the provided Codex ZIP.
>
> **Task:** Inspect Lunar Ops first, then implement a narrow integration adapter that exports v1.0 satellite/relay mission requests and imports v1.0 synthetic reliability results. Retain mission ID, simulation ID, asset ID, run fingerprint, model version, synthetic provenance and replay history. Display safe-mode/comms warnings as simulated advisory information, never as observed telemetry. Do not mutate live mission state or execute physical actions based on simulations. Keep the entire workflow deterministic and test it against the supplied request/response fixture.
>
> Integrate rover missions with Virtual Space Robotics Lab through its own schema. Swarms.ai agents can propose assignments, but every proposal must go through a shared deterministic battery/cargo/path/schedule constraint checker before the robotics simulation runs. No direct autonomous command execution. Keep spacecraft fault simulation distinct from surface robotics physics even though they exchange mission context.
>
> Do not change the Codex repo, assume a live API already exists, or deploy automatically. Begin with a repository audit, adapter plan and tests; implement in an isolated branch. A later milestone may enable authenticated local/network syncing after the file-based protocol passes end-to-end in both repositories.

## v1.0 validation steps
1. Export a request matching `integrations/examples/lunar_ops_satellite_request.json`.
2. Codex repo runs `python sync_lunar_ops.py <request> --out <result>`.
3. Lunar Ops imports result; verifies version, IDs, direction, checksum/deduplication, synthetic provenance and metric units.
4. Bad version, duplicate results, cross-mission IDs, missing metadata and manipulated source/target must fail closed; never overwrite trusted telemetry.
5. Re-run with same input and prove the resulting fingerprints and metrics are stable.
