# V2 research vertical slice — 2026-10-29

User explicitly requests immediate implementation in this project, prioritizing complete tested increments. Preserve legacy v1.0 and existing engineering CLI/API paths. The local control center remains the same application.

Audit: Python standard library, no installed runtime dependencies, frozen conceptual simulator + v1 offline adapter, separate engineering EPS/thermal model, five residual channels, two diagnostic policies, bounded loopback HTTP server and dependency-free SVG dashboard. Existing baseline: 52 tests. Physical limitations: one thermal node, prescribed illumination, no battery voltage/aging, wheel momentum, payload or data queue. Existing benchmark varies measurement noise only and has descriptive summaries without confidence intervals. No persisted database, external AI, 3D renderer or live Lunar Ops integration.

Plan:

1. Add failing research tests, then implement an explicit actuator-recovery switch without changing default engineering outputs. Wrap existing reports with three named strategies, structured evidence/action outcomes, an operational assessment state machine, mission-success criteria and bounded paired studies. Use Wilson intervals for binary success and Student-t mean intervals for paired metrics. Label these intervals conditional on the selected noise experiment.
2. Add optional offline v2 exchange with deterministic event IDs and strict validated identities, leaving v1 intact. A telemetry-grounded deterministic briefing has no mutation capability; do not call it an LLM.
3. Extend existing API with bounded research routes and structured logs. Add fault controls, research workspace, confidence intervals, action explanations and exports to the existing dashboard.
4. Add a local dependency-free WebGL spacecraft inspection module with rotate/zoom controls and 2D fallback. Colors and illumination come from the selected recorded interval. The scene is a schematic, not propagated orbital geometry.
5. Run regression and research tests, HTTP tests and frontend behavior tests, inspect the browser, reproduce a saved study, and document a feature-status matrix. No deployment or edits to any other project.

Security/limits: loopback only; current Host/Origin and CSP protections retained. Research runs capped at 30 seeds and 60,000 aggregate engine intervals (web 12 seeds / 12,000 intervals). Strict scenarios; no executable input. No API key required. No assistant changes configuration; Run experiment is the user's explicit apply action.

Deferred model expansion is explicit: voltage/electrochemistry/aging, reaction wheels, sensor failures, payload buffers, multispacecraft and hardware validation. Statistical assistance remains the previously implemented synthetic classifier, not an asserted superior AI strategy. A five-state operational assessment does not add new plant actuators or replace the existing safety supervisor.
