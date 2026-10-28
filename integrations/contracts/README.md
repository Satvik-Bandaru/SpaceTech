# Lunar Ops ↔ Spacecraft Reliability Lab contract v1.0

**Status: implemented as offline JSON file exchange ONLY.** This provides a real, testable data handoff today, not a live automatic network synchronization. The Lunar Ops application must implement its own compatible import/export to complete end-to-end integration.

## Request: `lunar_ops_satellite_request.json`
- `schema_version`: required literal `1.0`
- `mission_id`: stable ID from Lunar Ops, `[A-Za-z0-9_.:-]` up to 128 chars
- `source`: literal `lunar-ops`; `target`: literal `spacecraft-reliability-lab`
- `context`: `asset_id`, `asset_type` (`orbital_relay`, `small_satellite`, or `lunar_orbital_asset`), `simulation_id`
- `scenario`: current simulator parameters; explicit units use `_wh`, `_w`, `_c`, `_minutes`; deterministic `seed`; faults are limited to supported kinds

## Response: `lunar_ops_satellite_result.json`
- Echoes `mission_id`, `simulation_id`, `asset_id` with reverse `source`/`target` and `schema_version`
- `result_status`: `COMPLETED` on success, with stable `run_id` and `request_sha256` for deduplication/replay
- `data_provenance`: `SYNTHETIC`; `model_validated_for_flight`: `false`
- `model_version`, `metrics`, `advisory_flags`, `events`, `telemetry`, `disclaimer`
- Lunar Ops must label all these data simulated and **must not** autonomously modify mission records or command physical equipment based on them
- A rejected/invalid input results in a nonzero CLI exit code with no result artifact

## Data flow
1. Lunar Ops + Virtual Space Robotics Lab prepare/own the mission and rover scenario and, when relevant, export an *orbital relay / satellite fault simulation* request.
2. Codex's Spacecraft Reliability Lab validates and runs that request via `python sync_lunar_ops.py <request.json> --out <response.json>`.
3. Lunar Ops reads the returned result and displays simulated power, safe mode, and comms-availability warnings as an advisory overlay. It never treats simulated telemetry as operational truth.
4. AI Swarm Lab uses **Swarms.ai** to orchestrate task-planning/coordination agents for the robotics environment. Swarms is *not* a 3D/physics engine; any swarm-derived actions must pass the shared constraint checker and robotics simulator before inclusion in mission results.

## Future live API (NOT IMPLEMENTED)
- Lunar Ops initiates authenticated `POST /v1/reliability/simulations` with the request shape above. Spacecraft Lab returns a job receipt; `GET /v1/reliability/simulations/{run_id}` returns the result.
- Use separate credentials/service identities, TLS, authorization by mission/tenant, request size limits, idempotency keys, signed/auditable handoffs, timeouts and retry handling. Do not pass raw admin/service-role credentials in payloads.
- Add a versioned robotics `mission-plan` / `execution-result` schema and a Swarms agent-planning adapter separately. Keep the simulation engines deterministic; AI proposals are not authoritative.
