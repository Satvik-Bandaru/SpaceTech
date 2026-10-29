# Counterfactual mission studio — design and implementation plan

Goal: extend the existing local lab with reusable experiment design, measured strategy comparisons, durable experiment history and better spacecraft inspection. Preserve the working plant, safety kernel, original workspaces and frozen offline contracts. Restore point: `279ce6d`, 93 tests passed; branch `feature/counterfactual-mission-studio`.

The user has already supplied the V5 roadmap and requested implementation. This increment selects its bounded counterfactual/research and inspection capabilities. It uses the existing standard-library Python, SQLite, browser JavaScript and native WebGL. A framework migration adds no required capability here; arbitrary LLM tools, fleet dynamics and operational commanding remain out of scope.

## Boundaries and interfaces

- `campaigns.py`: validate/freeze a reference scenario plus up to three modified configurations, run paired seeds through existing none/basic/enhanced/assured strategies, record full reports and summarize measured outcomes. These are full reruns from initial conditions, not frozen mid-integrator branches.
- `assurance/workflow.py`: reuse exact-plan approval, cooperative cancellation, deadlines, result checksums and limits. Add campaign job kind, per-case progress and lightweight bounded job history. Existing SQLite files migrate additively.
- `control_center.py`: add campaign preparation and local history routes. Reuse approved-job status/result routes and existing security boundaries.
- `web/campaign.js`, `campaign.css`: same-app experiment builder, workload estimate, explicit approval, progress, uncertainty plots, paired differences, run inspection/replay, JSON/CSV/Markdown exports and saved jobs.
- `web/scene.js`, `ui-core.js`: recorded-state battery fill and thermal/power overlays, exploded schematic, camera presets/reset/zoom. Inspection transformations do not mutate physical state; keep 2D fallback.

Campaign requests contain `name`, `scenario`, `variants: [{name, changes}]`, `seeds`, `strategies`, `assurance_options`. Reference is automatic. Each variant is independently validated after merging allowed engineering settings. No variant can alter a paired seed silently. At most eight distinct held-out seeds, 32 primary runs, 2,000 intervals per configuration and 20,000 aggregate engine intervals (assured counts twice). Existing workflow limits still apply: 30 seconds cooperatively, four active jobs, 64 stored jobs, 32 MB result and 256 MB logical admission.

Every case retains its scenario, seed, strategy, source identity and full recorded report. Summaries use existing Student-t mean intervals and Wilson intervals for the mission-success proxy. Differences use paired per-seed observations, both variant versus reference and strategy versus basic. No automatic winner or general AI-superiority statement. Seed samples vary measurement noise under fixed configurations; no hardware-failure probability claim.

## Implementation and checks

- [x] Campaign engine: fail-first tests for reproducibility, input immutability, unknown/nonfinite values, aggregate bounds, seed matching, hand-calculated paired deltas, cancellation and honest exports.
- [x] Durable workflow/API: prepared job does not execute; exact digest required; progress and results restore; shared history lists metadata without loading full reports; invalid history limits and campaign payloads fail closed. Preserve old jobs.
- [x] Interface: prepare/approve/poll/cancel and restore actual results; selecting a case replays its own data; uncertainty display handles missing/n=1 intervals; changing jobs clears stale results; text is not interpreted as markup.
- [x] Inspection: test continuous measured-state mapping and bounds; browser-test camera controls/overlays/explosion and retained 2D rendering against the same telemetry row.
- [x] Verification: run all old/new tests, JS checks, exact default-engine comparison, bounded example campaign and deterministic replay. Inspect browser and save screenshots. Independent review before local commit.
- [x] Publish actual capability/limitations, scientific/performance observations and resume checkpoint. No deployment or push.

Review focus: cross-job polling races; mismatched paired seeds or missing metrics; oversized campaigns and serialization; old SQLite schema migration; confusion between inspection geometry and physical changes. Tests and browser checks target these boundaries.

Review corrections verified before completion: shared reference success criteria, correct job-kind restore routing, export provenance/escaping, actual evidence keys and fallback strategy labeling. See ADVANCED_STUDIO_VERIFICATION.md for executed evidence and remaining test gaps.
