# Spacecraft Reliability & Autonomy Lab

## Current independent engineering milestone — 2026-10-28

This local project remains independent of Lunar Ops, ChainMind and the robotics/swarm lab, following the user's direct request. The supplied integration roadmap below is historical context. The existing offline adapter remains available; no live synchronization, network service or deployment is configured.

The additive **spacecraft-reference-v0.2** engine implements efficiency- and power-limited electrical storage, radiative thermal energy balance, overlapping subsystem faults, telemetry-based diagnostics, bounded recovery and autonomous safe-mode hysteresis. A threshold baseline is compared with experimental nearest-centroid assistance fitted to synthetic signatures. The legacy simulator and v1.0 handoff retain their numerical behavior.

Run locally with Python 3.10+ (standard library only; no GPU):

```bash
python3 -m unittest discover -s tests -v
python3 run_engineering.py scenarios/engineering_multifault.json --policy baseline --out artifacts/engineering-baseline.json
python3 run_engineering.py scenarios/engineering_multifault.json --policy assisted --out artifacts/engineering-assisted.json
python3 benchmark_engineering.py scenarios/engineering_multifault.json --seeds 0 1 2 3 4 --out artifacts/engineering-benchmark.json
```

There is currently **no browser dashboard**. Reports include replayable configuration, telemetry, events, conservation checks and synthetic provenance. See [audit and milestone](docs/ENGINEERING_MILESTONE.md), [equations, limitations and future control center](docs/ENGINEERING_ASSUMPTIONS.md), and the [saved benchmark](examples/engineering-benchmark.json). These are engineering reference simulations, never flight certification.

## Preserved original integration documentation

This is the **Codex-owned spacecraft health and fault-simulation service**. It is **not** a second Lunar Ops. It is intended to exchange mission data with **Lunar Ops**, which is developed using Claude Code and contains or directly integrates the **Virtual Space Robotics Lab**. The **AI Swarm Lab** is an agent coordination layer using the **Swarms.ai** Python framework; its proposed tasks must be verified by the Lunar Ops/robotics constraint checker.

## How the projects fit together

```text
                         Claude Code
  +---------------------------------------------------------+
  | LUNAR OPS (mission planning and lunar infrastructure)    |
  |    + Virtual Space Robotics Lab (3D rover simulation)   |
  |    + deterministic shared constraint checker             |
  +----------------------+----------------------------------+
                         | mission contracts + result imports
           +-------------+---------------------+
           |                                   |
           v                                   v
   Codex companion                       AI Swarm Lab
   SPACECRAFT RELIABILITY LAB             (Swarms.ai agents)
   orbital relay faults, FDIR              coordination proposals
   power/comms/thermal metrics             -> constraint checker
           |                                   |
           +------------- results -------------+
                         |
                   Lunar Ops UI
```

**Status:** The Codex project implements real **local JSON file handoff** with Lunar Ops-compatible example payloads. **Live HTTP synchronization and the actual Lunar Ops-side import/export are NOT implemented or verified here** because the Lunar Ops repository was not provided. The AI Swarm Lab is also not built inside this ZIP. No production systems are connected.

## Features implemented
- Deterministic, simplified small-satellite power, thermal, communications, attitude and safe-mode simulator.
- Five synthetic fault scenario fixtures, reference JSON results, and tests.
- **Integration v1.0**: strict input checks; `mission_id`, `simulation_id`, `asset_id`; stable run fingerprint; synthetic provenance; importable metrics, telemetry, event history and warning flags.
- End-to-end tested local request → simulation → result JSON handoff.
- Standard library only; no credentials, deployment, live satellite API or background network calls.

## Run (Python 3.10+)

```bash
python -m unittest discover -s tests -v
python run.py scenarios/solar_eclipse.json --out artifacts/eclipse.json
python sync_lunar_ops.py integrations/examples/lunar_ops_satellite_request.json --out artifacts/lunar_ops_satellite_result.json
```

Take the generated `artifacts/lunar_ops_satellite_result.json` to Lunar Ops. Claude Code must add the corresponding importer there; details in `integrations/contracts/README.md` and `CLAUDE_CODE_HANDOFF.md`.

## Keep the science honest
This is an **educational model, not flight software**. The Wh energy balance is first-order, thermal state is approximate, attitude and communication are Boolean approximations, and eclipse is a simulated fault rather than ephemeris propagation. It cannot certify hardware, perform flight operations or infer actual lunar colony performance. The exported result explicitly declares `SYNTHETIC` and `model_validated_for_flight=false`. Any displayed lunar mission status remains advisory.

## Next development steps
1. Claude Code: implement Lunar Ops contract exporter/importer and simulation results panel; test against the provided fixture.
2. Codex: harden validation, add signed/idempotent authenticated HTTP or event-queue transport, and verify replay/compatibility. Avoid changing the contract without versioning.
3. Swarms.ai: build the **AI Swarm Lab** as a proposals-only coordination service. Couple it to the Virtual Space Robotics Lab through a validated task schema, not through direct robot commands.
4. Validate using deterministic scenarios, failure injection, load tests and independent models before moving beyond a research prototype.

See `AGENTS.md`, `CODEX_PROMPT.md`, `CLAUDE_CODE_HANDOFF.md`, and `integrations/contracts/README.md`.
