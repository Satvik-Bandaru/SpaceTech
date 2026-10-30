# Mission control redesign verification — 2026-10-30

Scope: apply the two user-provided dashboard references to the independent local lab while preserving its working capabilities. Baseline `fa76f97`; isolated branch `feature/mission-control-redesign`. No deployment, remote push, new runtime dependency, other-project change, model/kernel change or database migration.

## Implemented presentation

- Persistent workspace navigation and compact run/fault/replay/compare/export actions.
- Detailed native WebGL satellite with gold insulation, framed tiled arrays, dish/radiator/sensor details and transparent compositing over local vector Earth scenery. Existing telemetry mapping, overlays, explosion, camera/input API, context-loss handling and 2D fallback remain.
- Current EPS/thermal/comms/attitude checks, prescribed illumination, solar/demand telemetry, recorded link, actuator and pointing state. Unknown channels remain unknown.
- Health ring: number of the four explicit checks that are nominal, never an inferred health/reliability percentage. Threshold criteria are available in tooltips and Safety checks.
- Past-only miniature series, recorded mode transitions, known configured injection schedule, and worst observed subsystem state per bin; unobserved bins remain unknown.
- Recorded assurance-role/evidence/decision inspection. Standard reports instead show reference controller services. Verification rejection is distinguished from a safety-kernel rejection. Future execution/outcome and final role counters are hidden until their evidence interval.
- Responsive desktop, tablet and compact layouts with all workspaces accessible. Existing controls are moved/wrapped rather than duplicated.

## Preserved capability map

| Existing capability | Current access |
| --- | --- |
| Standard three-strategy experiment | Run scenario; replay strategy selector |
| Presets, seed, JSON draft, multiple injected faults | Fault laboratory; Inject fault shortcut |
| Original telemetry chart, metrics, cursor, play/pause/speed | Telemetry & analytics; fixed replay transport |
| 2D/3D, rotation, zoom, presets, reset, overlays, explosion | Digital twin; viewport inspection controls |
| Strategy metrics and explainable recovery/evidence | Policy comparison; Compare shortcut |
| Paired-seed research, intervals and study export | Reliability research |
| Offline v1/v2 JSON adapters | Existing CLI/API; Reliability research health export |
| Seven deterministic roles, prepare/approve/cancel/result | Agent operations; Full audit |
| Counterfactual variants, four strategies, paired evaluation | Counterfactual studio |
| Campaign charts/deltas/case replay and JSON/CSV/Markdown | Counterfactual studio result panels |
| Durable local restore/history and assurance export | Reports & history; Agent operations |

## Automated evidence

Baseline: 110 tests passed before implementation. Final regression: **113 tests passed** (5.156 s in the final root run). This includes Python unit/integration/randomized model tests, workflow/approval/cancellation/export tests, actual-engine JavaScript fixtures, renderer GPU-boundary checks and pure presentation-data tests.

```bash
python3 -m unittest discover -s tests -v
node --check spacecraft_lab/web/mission-control.js
node --check spacecraft_lab/web/mission-data.js
node --check spacecraft_lab/web/scene.js
git diff --check
```

New data tests run against real standard and assured 3,600-second engine reports. They cover cursor clamping, missing/nonfinite channels, bounded downsampling with peaks, timeline/health-bin histories, unknown future bins, verifier versus kernel rejection, and execution/outcome evidence visibility. Existing frontend integration now checks presentation notifications on report selection, seeking, play/pause and assured replay, plus correct verifier-rejection wording. A connected-tree DOM smoke test executes the real presentation shell and verifies that every original ID retains its original node/handler, 3D activates once, 2D selection persists, and unknown booleans remain unknown. It fails when the detached-control binding fix is reverted.

New HTTP regression verifies 200 responses, MIME types, nonempty content, CSP and `nosniff` for all four assets. The same asset test fails with four expected 404s against baseline. The renderer transparency regression was also observed failing before its implementation.

Numerical preservation: 16 complete engineering reports were hashed and compared with a temporary archive of `fa76f97`. Inputs: four 600-second configurations (nominal; heater; simultaneous solar/comms; low battery/leak), two seeds (0, 7), both baseline/assisted policies. All serialized reports exactly matched. Digest of the ordered hash list: `7b1e22bdd247448cc3b44badab20c74ff5ee75c59d982badaa51aeb3d1eb0f6b`.

## Browser evidence

Native browser checks cover restored assurance job `42908b566f7849b4aca6fad35137c218`, seven role records and interval-specific evidence; restored 24-case campaign `acdacdec56904722ab0303654192f457`; selected case replay; fault editor and comparison shortcuts; a completed two-seed study; 2D/3D switching; thermal overlay, exploded view, camera presets/reset; and replay transport. A compact-layout reload caught an initialization-order defect while binding controls in a temporarily detached panel; that defect was corrected and added to the shell regression test. Final clean-reload verification emitted no new browser console warnings/errors.

Responsive checks include 1680×1050 desktop, 768×1024 tablet and 390×844 compact; document width matched viewport width at all three sizes. Renderer tests additionally project real geometry bounds at desktop/mobile aspect ratios and verify visible wings with useful viewport occupancy. DOM verification found no duplicate IDs (181 total); all 140 original HTML IDs are preserved. Screenshots are local artifacts under `artifacts/mission-control-*.jpg`.

## Scientific and visual limits

The physical model is unchanged: power-limited, efficiency-limited storage and one lumped radiative thermal node, prescribed illumination, simplified pointing/link state and finite deterministic recovery actions. Geometry is an inspection illustration; it does not establish hardware fidelity or a propagated trajectory. Array cells and insulation detail do not add thermal nodes or electrical circuits. Scene labels are screen overlays. Local scenery has no scientific effect. No mission UTC, orbit altitude, data rate, thrust, probabilistic risk or autonomous LLM decisions are invented to match the screenshots.

Fleet dynamics, new subsystem physics, uncertain/delayed observations, provider-backed reasoning, optimization/RL and flight validation remain outside this visual increment. Saved reports restore completed evidence, not integrator/RNG continuation. Approval and safety boundaries remain intact.
