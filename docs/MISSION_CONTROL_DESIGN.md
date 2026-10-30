# Reference-inspired mission control redesign — 2026-10-30

User request: match the two supplied spacecraft dashboard references while keeping every existing feature. Restore point `fa76f97`; branch `feature/mission-control-redesign`.

Use the references' hierarchy: persistent left navigation, compact mission/action header, large cinematic spacecraft viewport, adjacent environment/system cards, right-side agent/decision rail, and compact telemetry/history panels below. Use dark glass surfaces, fine cyan/blue borders, restrained mint/amber status colors and readable engineering typography. At smaller widths the same panels stack; functionality must not disappear.

Preserve all six current workspaces, their element IDs/event handlers, experiments, scenario/fault editing, paired studies, counterfactuals, assurance approvals/cancel/history, replay, exports and 2D fallback. The new shell wraps/moves existing controls rather than duplicating IDs or replacing their logic. No engine, kernel, contract, model or database changes are needed.

New presentation modules: `mission-data.js` derives replay-safe measured snapshots, subsystem checks, histories, timelines and audit records; `mission-control.js` arranges and renders the console; `mission-control.css` supplies the new layout/theme; `orbital-backdrop.svg` provides illustrative scenery. The existing native WebGL renderer gains more detailed geometry/materials while preserving its inspection/camera API and actual telemetry mapping.

The screenshots are visual references, not authoritative telemetry or new scientific requirements. Do not copy fictional mission names, epochs, orbit altitudes, downlink rates, propulsion/health percentages, L4 autonomy or risk predictions. Show configured illumination, measured pointing, actual link availability and seven deterministic audit roles where available. No invented live-agent messages. Future audit outcomes stay hidden until the replay cursor reaches them. Cosmic scenery and detailed spacecraft geometry are illustrative; the physics remain the same single-node reference model.

Implementation/verification:

- [x] Run the baseline suite and preserve the restore point.
- [x] Add and test pure replay-safe presentation derivations using actual engine reports.
- [x] Build the cinematic renderer and preserve camera, overlays, exploded view, unknown channels and 2D behavior.
- [x] Integrate responsive console layout, top action shortcuts and real-data widgets; preserve every current workspace/control.
- [x] Run full regression/static/JS checks, inspect desktop/tablet/compact browser layouts and actual interactions, save screenshots.
- [x] Independent preservation/replay review, document visual assumptions/results, commit locally without deployment.
