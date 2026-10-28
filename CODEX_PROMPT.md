# Codex next milestone — Lunar Ops synced spacecraft reliability companion

You are the lead reliability/simulation engineer for the **Spacecraft Reliability & Autonomy Lab**, developed with Codex.

## Architecture (do not misunderstand)
1. **Lunar Ops (formerly Space-Ops)** is the primary mission-planning and lunar infrastructure project built with **Claude Code**.
2. **Virtual Space Robotics Lab** works together with Lunar Ops as its robotics visualization and physics/surface execution environment.
3. **AI Swarm Lab** uses the **Swarms.ai Python framework** for multi-agent task planning and coordination. It proposes plans; it is not the 3D physics engine, and cannot bypass a deterministic constraint checker.
4. **This Codex project** handles spacecraft/satellite/relay health, power, communications, fault injection, telemetry and FDIR, and **syncs its simulation results with Lunar Ops** through versioned APIs/events.

**Preserve each codebase's ownership. Do not merge them into one repository or create competing copies.**

## First action
Read README.md, AGENTS.md, integrations/contracts/README.md, CLAUDE_CODE_HANDOFF.md, and all simulation/integration tests. Run `python -m unittest discover -s tests -v` and reproduce the local contract exchange with `sync_lunar_ops.py`. Assess limitations candidly.

## Next incremental engineering tasks
1. Strengthen the already functional contract v1.0 validation, deterministic run fingerprints, units and file boundaries. Add malformed and oversized input tests.
2. Propose and implement (only with authorization for any deployment) an authenticated REST or message-queue adapter that accepts a Lunar Ops mission request and returns the same versioned result. Include identity validation, authorization, correlation IDs, timeouts, backoff, idempotency, pagination where needed, and observability.
3. Implement realistic **engineering reference models**, with documented equations and limitations, for satellite EPS, thermal, communications and attitude availability. Compare simulated metrics to independent reference calculations. Do not invent telemetry.
4. Expand FDIR fault injection: overlapping failures, delayed diagnosis, false alarms, retry-and-recovery, safe-mode hysteresis, power budgeting and comms interruptions.
5. Build an experimental digital-twin dashboard ONLY after the model and contract are robust; export truthful synthetic metrics.
6. Coordinate schema changes with Claude Code's Lunar Ops importer/exporter and keep compatibility fixtures synchronized.
7. Support optional swarm planning metadata from the Swarms.ai AI Swarm Lab only as *untrusted proposals*. Validate against deterministic constraints and never issue real vehicle/hardware commands.
8. Add multi-run/replay, cross-contract, load, fault and security tests. Maintain all existing passing tests and CI.
9. Produce a release-gate report: passed, failed, unavailable for testing, not implemented. Separate local file sync from unimplemented live automatic sync.

Do not send live commands, use operational credentials, mutate production mission data, merge other repositories or deploy without approval. Start by auditing what exists, then implement one highest-value small improvement and prove it with tests.
