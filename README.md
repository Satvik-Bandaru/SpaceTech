# Spacecraft Reliability & Autonomy Lab

## Autonomous Discovery Observatory — 2026-11-04

Open **http://127.0.0.1:8014/** and choose **Discovery observatory**. Five configurable synthetic instrument agents automatically detect catalogue novelty, record numerical images and spectra, suppress duplicate captures and respect budgets. A separate local analysis agent explains spectral-template hypotheses and generates reports. Completed missions save locally and can be restored after refresh; export JSON or Markdown for review. The gallery and plots render the captured data.

The same workspace includes an **ideal three-qubit Grover search simulator**, an **aerospace engineering assistant** for ideal delta-v and eclipse storage arithmetic, and a **space economy assistant** for downside/base/upside project cash-flow scenarios. Quantum probabilities describe the simulated circuit, not material confidence. Analysis is deterministic local code; no LLM, physical cameras/telescopes, quantum hardware, live financial feeds or external services are connected. The five instruments are role proxies over a toy detector, not validated optical models or continuous observatories. Material identification and investment forecasting remain unimplemented.

```bash
python3 -m spacecraft_lab.control_center --port 8014
python3 observe.py scenarios/observatory_survey.json --out artifacts/observatory-demo.json
python3 -m unittest discover -s tests -q
```

**144 tests pass.** The reproducible seed-7 mission records **120 scans, 50 captures and 10 distinct captured targets**. The existing spacecraft models, recovery safety kernel, seven assurance roles, workspaces and offline contracts are preserved. Read [implemented capabilities and verification](docs/OBSERVATORY_VERIFICATION.md), [physical/scientific and financial assumptions](docs/OBSERVATORY_SCIENCE.md), and the [acceptance summary](examples/observatory_acceptance_summary.json). No deployment or push.

## Clearer mission UI and graphics — 2026-10-31

The interface now has larger, higher-contrast text, grouped workspace navigation, one 3D/2D switch, accessible Inspection settings, and visible camera reset/zoom controls. Selecting a subsystem reveals its detailed telemetry. Saved replays identify their actual run/seed instead of showing an unrelated disabled strategy selector. Ordinary scrolling moves the page; hold Ctrl/Command while scrolling to zoom the spacecraft.

Earth/cloud scenery, metallic surfaces, insulation and dish shading are refined locally, with no new dependency or external assets. All existing workspaces, reports, approval boundaries and simulation behavior remain. **113 tests pass**, with desktop/tablet/mobile browser checks. See [verification](docs/INTUITIVE_UI_VERIFICATION.md). Start unchanged: `python3 -m spacecraft_lab.control_center --port 8014`, then open **http://127.0.0.1:8014/**.

## Mission control redesign — 2026-10-30

The dashboard now follows the supplied mission-control references: an orbital spacecraft viewport, compact mission controls, systems/environment cards, recorded agent decisions, miniature telemetry plots, an injection timeline and a subsystem status matrix. The detailed WebGL spacecraft retains camera presets, rotation/zoom, thermal/power overlays, exploded inspection and the 2D schematic. All six existing workspaces, scenario editing, campaigns, approvals, saved history, comparisons, replay and exports remain available through the new navigation.

Start with `python3 -m spacecraft_lab.control_center --port 8014`, then open **http://127.0.0.1:8014/**. No new dependencies or external services are required. **113 tests pass**; 16 complete engineering reports exactly match the previous version. See [verification and preserved features](docs/MISSION_CONTROL_VERIFICATION.md) and [design boundaries](docs/MISSION_CONTROL_DESIGN.md).

The health ring counts four explicitly defined model checks; it is not a reliability probability. Miniature histories and agent evidence follow the replay cursor. The original full-run chart remains available with its cursor. Seven role records appear for assurance reports; standard reports show their reference controllers. Spacecraft hardware geometry and Earth scenery are illustrative. No orbit propagation, LLM connection, flight certification or new physics is claimed.

## Advanced counterfactual studio — 2026-10-29

The local app now includes **controlled what-if variants, four-strategy paired campaigns, confidence-interval plots, paired differences, saved job history, case-level replay and JSON/CSV/Markdown exports**. Spacecraft inspection adds camera presets/reset/zoom, an exploded schematic, continuous battery fill and telemetry-linked thermal/power overlays. Existing physics, safety and offline contracts are preserved.

Open **http://127.0.0.1:8014/** and select **Counterfactual studio**. The default campaign runs 24 cases across three configurations, two noise seeds and four strategies after explicit plan approval. Every case is scored against the same reference success criteria; original reports remain unchanged. All **110 tests pass**. See [verified capabilities and limits](docs/ADVANCED_STUDIO_STATUS.md), [actual results and reproduction](docs/ADVANCED_STUDIO_VERIFICATION.md), and [resume state](docs/BUILD_STATE.md).

```bash
python3 -m spacecraft_lab.control_center --port 8014
python3 assurance.py prepare-campaign examples/counterfactual_campaign.json
python3 assurance.py history --limit 20
```

Campaigns are bounded initial-condition reruns, not mid-mission state clones. Two noise seeds do not establish real-world reliability or general AI superiority. All seven deterministic roles remain; fleet dynamics, RL, external LLMs and flight qualification are not implemented.

## V4/V5 mission-assurance increment — 2026-10-29

The existing local app now has an optional **mission-assurance workspace**: a finite validated registry defines seven bounded deterministic roles, a Mission Intelligence Orchestrator coordinates finite simulated recovery proposals, an independent verifier checks current run/state evidence, and a separate safety kernel authorizes actions **before actuation**. The plant records actual modeled outcomes. Experiments use a durable SQLite prepare → exact-plan approval → run workflow, with cancellation, completed-result restore, export and replay. The comparator retains hard safe-mode protection with actuator recovery disabled. No LLM, API key or new dependency is required.

```bash
python3 -m spacecraft_lab.control_center --port 8014
python3 -m unittest discover -s tests -v
python3 assurance.py prepare scenarios/assurance_solar_thermal.json --probe-unsafe
```

Open **http://127.0.0.1:8014/** and select the assurance workspace. Prepare the built-in solar/thermal demonstration, inspect its plan, then approve that exact plan. Preparation alone does not run it. The interface shows rejected and executed actions, evidence, seven role records and the protected comparison; completed reports can be replayed in the existing telemetry/3D view. An explicit unsafe probe is a research input, with no hardcoded approval or outcome.

The CLI prints a `job_id` and `plan_sha256`; use those actual values below:

```bash
python3 assurance.py approve JOB_ID --digest PLAN_SHA256
python3 assurance.py status JOB_ID
python3 assurance.py export JOB_ID --out artifacts/mission-assurance.json
python3 assurance.py cancel JOB_ID
```

CLI approval runs synchronously. The default store is `artifacts/assurance.sqlite`; choose another with `python3 assurance.py --store PATH ...`. Restore retrieves complete reports; cancellation checkpoints cannot resume the integrator/RNG. SHA-256 binds content and implementation, not user identity. The local workflow has bounded jobs, time and report admission; it is not a production service.

The verified increment passes **93 tests**. The connected seed-7 example records 34 rejected proposals, heater isolation at 130 s, approved normal recovery at 2,770 s and zero unserved energy. See [actual verification and reproduction commands](docs/ASSURANCE_VERIFICATION.md), the precise [capability matrix, assumptions, FMEA and requirements-to-tests crosswalk](docs/ASSURANCE_STATUS.md), [selected implementation plan](docs/ASSURANCE_PLAN.md), and [resume checkpoint](docs/BUILD_STATE.md). This is a bounded vertical slice of the complete 20-role V5 vision. Orbital dynamics, fleet agents, optimization, RL, online LLM/RAG and formal safety proofs remain future work. Current thermal/resource checks are conservative model guards; simulated outcomes are never flight reliability evidence.

## V2 research increment — 2026-10-29

The existing local app now includes **three recovery strategies**, a fault-injection form, seven presets, telemetry-driven **3D inspection with 2D fallback**, explainable protection/recovery records, a paired-seed research workspace with confidence intervals, and an optional offline v2 health exchange. No other app or repository is modified or contacted.

See the [implemented / partial / planned feature table](docs/V2_STATUS.md) for precise scope, statistical definitions and remaining spacecraft-model limitations. This is a complete research increment, not implementation of every item in the V2 roadmap. Battery voltage/aging, wheel dynamics, payload/data buffers, multispacecraft and an optional grounded LLM remain future work.

```bash
python3 -m spacecraft_lab.control_center --port 8014
python3 research.py scenarios/engineering_multifault.json --seeds 0 1 2 3 4 --out artifacts/reliability-study-v2.json
python3 research.py scenarios/engineering_multifault.json --strategy enhanced --mission-id portfolio-demo --out artifacts/health-v2.json
python3 read_health.py artifacts/health-v2.json
```

Open **http://127.0.0.1:8014/**. No dependency installation, API key or GPU is needed. Node is used only by the optional frontend helper tests. Drag the 3D view to rotate; wheel or +/− to zoom. Its geometry and orbit inset are illustrative, with state and illumination taken from recorded intervals. Core numerical tests and old commands below remain supported.

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

## Local Spacecraft Health Control Center

```bash
python3 -m spacecraft_lab.control_center --port 8014
```

Open **http://127.0.0.1:8014/**. Keep the terminal running; Ctrl+C stops the server. If the port is occupied, choose another with `--port`. No installation or frontend build is needed.

The interface runs three research strategies over the existing engineering policies, displays telemetry-driven subsystem states, plots and decision history, and supports play/pause, seek, replay speed, editable JSON scenarios and export. Seed edits and scenario changes take effect on **Run experiment**. Failed edits retain the previous report with an explicit error. Replay shows recorded intervals, not a live hardware connection. Larger studies and identical-telemetry diagnostic replay remain available through the benchmark CLI.

The server binds only to loopback, checks Host/Origin, serves explicit asset routes and caps JSON bodies and compute samples. It is a personal local tool without authentication or production availability guarantees. The optional assurance workflow persists plans, status, audit and complete reports in local SQLite; ordinary replay remains report-based. Socket access must be allowed to run its HTTP tests. SVG and WebGL views are inspection schematics, not a physically validated 3D spacecraft model.

Reports include replayable configuration, telemetry, events, conservation checks and synthetic provenance. See [audit and milestone](docs/ENGINEERING_MILESTONE.md), [equations and limitations](docs/ENGINEERING_ASSUMPTIONS.md), and the [saved benchmark](examples/engineering-benchmark.json). These are engineering reference simulations, never flight certification.

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
