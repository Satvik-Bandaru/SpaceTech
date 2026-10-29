# V2 research increment — implementation status

2026-10-29. Implemented in the existing project, branch `feature/v2-reliability-research`. Read the complete source/test inventory and existing architecture/contracts before changes. Baseline: 52 passing tests; original conceptual simulator and v1 integration preserved. No migration, runtime installation, new application, live integration or deployment.

| V2 request | Status | Actual scope / remaining work |
| --- | --- | --- |
| Power / thermal engineering model | Implemented reference model | Existing rate/efficiency/capacity-limited Wh storage and Kelvin radiative balance preserved. Hand reference tests and independent conservation checks retained. |
| Battery degradation / undervoltage | Partial | Low stored-energy protection exists. Voltage, electrochemistry and aging are not modeled. No voltage-derived claim. |
| Attitude / sensor / wheel dynamics | Partial | Pointing errors, noisy measurement, redundant actuator switch. Reaction-wheel momentum/saturation and sensor-failure dynamics remain planned. |
| Communications / payload | Partial | Powered link, blackouts, pointing dependency and bounded resets. Payload malfunction, downlink buffers and link budgets remain planned. |
| Interactive 3D | Implemented schematic | Local native WebGL; drag/keys to rotate, wheel/+/- to zoom. Panels, antenna, battery, sensor and thruster geometry; state colors, sun/eclipse lighting and pointing-error visualization use the replay interval. Geometry is illustrative; no thrust is animated without a thrust model. Explicit 2D fallback. |
| Earth orbit | Partial | Small Earth/orbit-phase inset follows prescribed illumination-cycle time. No propagated trajectory or ephemeris. |
| FDIR / simultaneous faults | Implemented for existing five fault types | Solar loss, heater stuck on, pointing fault, link loss, battery leak; arbitrary overlapping windows. Structured protection and actuator decisions record predecessor evidence, reasons, constraints, expected effects and observed commanded-state outcomes. |
| NORMAL/DEGRADED/SAFE_MODE/RECOVERY/FAILED | Partial | Five-state operational assessment over the existing two-mode plant supervisor; not five independently validated control laws. FAILED latches after 300 seconds of any unmet demand; RECOVERY labels 300 seconds after exiting safe mode. |
| Three strategy comparison | Implemented | none = no actuator repair but same hard supervisor + threshold detection; basic = existing rule-based recovery; enhanced = existing synthetic-trained nearest-centroid diagnosis. No claim of general AI superiority. |
| Mission reliability experiments | Implemented conditional study | Paired fixed noise seeds; success proxy, safe time, observed-episode latency, closed-loop FP/FN, immediate action-effect success, served energy and modeled radio-reset energy. This is not calibrated component-failure Monte Carlo. |
| Confidence intervals | Implemented | Student-t mean intervals; Wilson binomial interval for mission-success proxy. n=1 mean interval unavailable. Zero observed seed variance is not certainty. |
| Sensitivity / failure distributions | Planned | Manual parameter edits and repeated paired studies work; automated parameter sweeps and sampled component-lifetime distributions remain planned. |
| Seven preset scenarios | Implemented | Nominal, extended eclipse, array damage, thermal failure, link blackout, cascading faults and battery emergency. Multispacecraft coordination remains planned. |
| Mission dashboard / replay | Implemented | Existing UI extended in place: three strategies, fault form, presets, charts, journal, protection/action evidence, operational labels, confidence tables and full exports. Recorded replay rather than streaming physics. |
| Dependency diagram | Partial | Existing spacecraft/subsystem schematic plus power→link and pointing→solar/link effects. No full interactive dependency graph. |
| AI mission assistant | Partial | Deterministic telemetry briefing only, explicitly not an LLM. Has no configuration mutation path. Optional grounded LLM question-answering remains planned; core has no paid API dependency. |
| Lunar Ops v1 / v2 | Implemented offline | v1 remains unchanged. Separate v2 health/events/mode/recovery schema, identifiers, deterministic content/event hashes, replay-based validation and local reader. Other project's importer and live sync are unimplemented/unverified. |
| Verification | Implemented for this slice | Physics, old contracts, research state assessment, repeatability, API limits, JSON health, frontend timing/scene helpers and browser workflows. Hardware accuracy, flight certification and real spacecraft commanding are out of scope. |

## Architecture

`engineering/` remains the plant, diagnostic and hard-supervisor layer. The only plant change is a Boolean actuator-recovery switch; defaults preserve prior behavior and reports. `reliability.py` composes the plant into three-strategy runs, operational assessment, explainable decisions and studies. It never uses evaluator fault labels to command actuators. `health_exchange.py` creates the new independent offline adapter. `control_center.py` exposes bounded local presentation routes. Browser `ui-core.js` holds testable replay/state mapping, `scene.js` draws only when telemetry/camera changes, and `app.js` coordinates the current UI.

Structured HTTP logs contain method, route, status and response byte count only; no payload, secret or arbitrary command execution. Loopback Host/Origin restrictions and CSP remain. Web studies cap at 12 seeds / 12,000 aggregate intervals; CLI studies cap at 30 seeds / 60,000 intervals. Calibration seed 9001 is excluded from evaluation. No input defines executable code.

## Metric definitions and statistical assumptions

The mission-success proxy requires final battery >=20%, communications availability >=80%, no unmet energy beyond 1e-8 Wh and all temperature samples inside configured limits, with passing invariant checks. It is not payload delivery/completion. The FAILED assessment and this proxy have separate definitions; a FAILED label does not shut off the numerical plant.

Action success means the commanded state is observed in the first resulting interval, or after the one-interval radio reset. Horizon-truncated outcomes are `not_observed`; the displayed rate counts them as non-successes. A successful relay isolation is not a permanent hardware repair. Detection latency averages detected eligible episodes only; missed episodes remain in report diagnostics. Closed-loop manifestation masks and trajectories can differ across strategies; use the preserved benchmark CLI for identical-telemetry diagnostic replay.

Recovery energy accounts only for the explicitly modeled served 5 W radio-reset load. Relay/ADCS switching energy is unmodeled. Zero modeled recovery energy does not mean recovery is physically free. Total served-load energy is also reported.

Means use x̄ ± t(0.975,n−1)·s/√n, on up to 30 noise-seed outcomes; paired differences use per-seed enhanced-minus-basic values. Success proportions use Wilson intervals. The sample SD and effective sample count are exported. Approximate distribution/iid assumptions and no multiple-comparison correction limit interpretation. Repeated noise seeds on one design cannot quantify real hardware reliability. See [NIST mean intervals](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) and [NIST proportion intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm). Physical assumptions/references remain in `ENGINEERING_ASSUMPTIONS.md`.

## Reproducible demonstration

```bash
python3 -m unittest discover -s tests -v
python3 -m spacecraft_lab.control_center --port 8014
python3 research.py scenarios/engineering_multifault.json --seeds 0 1 2 3 4 --out artifacts/reliability-study-v2.json
python3 research.py scenarios/engineering_multifault.json --strategy enhanced --mission-id portfolio-demo --out artifacts/health-v2.json
python3 read_health.py artifacts/health-v2.json
```

Open http://127.0.0.1:8014/. Run experiment explicitly applies drafts. Research uses the last successfully executed configuration, never an unapplied draft. Export supports three full reports, paired study and optional v2 health packet. A hash is content integrity, not authentication. The v2 reader semantically validates against current-model deterministic replay; future incompatible models require a versioned migration. It does not establish trustworthy real telemetry.

Saved five-seed evidence: `examples/reliability-study-v2.json`. Mean safe-mode times: none 2370 s, basic 2070 s, enhanced 2970 s. Enhanced retains 57.513% minimum charge versus basic 39.163%, but stays safe longer. Success proxy met in 0/5, 5/5 and 5/5 runs respectively; the Wilson intervals remain broad (0–0.434 and 0.566–1). This narrow synthetic result does not establish general superiority.
