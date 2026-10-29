# Engineering reference v0.2: assumptions and evidence

## Model and units

All parameters are hypothetical research inputs, not identified spacecraft hardware. Time is seconds, power watts, battery energy watt-hours and temperature Kelvin. Defaults are listed in `spacecraft_lab/engineering/config.py`. The example runs 5,400 seconds in 10-second steps. Fault windows are half-open intervals, aligned to the step; a measurement and detection for an interval are available at its end. Recovery acts on the following step.

Electrical flow uses solar power directly first, then battery discharge, with independent rate limits. With h = dt/3600, E_next = E_previous + eta_charge * charge_input_W * h - discharge_bus_W * h / eta_discharge - leak_Wh. Capacity limits cause curtailment; unmet demand is recorded as unserved power, never supplied fictitiously. Conversion losses and leakage become internal heat. Critical/base and radio loads have priority over heaters; communications require the critical bus to be fully served. Setting radio_load_w to zero disables the modeled radio. Solar power follows a configured rectangular illumination cycle and cosine pointing loss, not propagated orbital geometry.

One isothermal node follows C * (T_next - T) = (Q_internal + Q_absorbed - Q_radiated) * dt, with Q_radiated = epsilon * sigma * area * (T^4 - T_sink^4). Integration is explicit Euler; a convergence test checks a representative case. sigma = 5.670374419e-8 W m^-2 K^-4. The effective sink combines environmental radiation into one configured temperature. Stored energy and heat conservation are recomputed independently from the exported trace.

Reference context: [NASA electrical power overview](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/), [NASA thermal control overview](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/), [NIST SI constants](https://physics.nist.gov/cuu/pdf/all_2018.pdf). These support physical concepts and the constant, not validation of this implementation or its hypothetical parameters.

## Fault management

Faults can overlap: solar array fractional loss, additional stuck-heater heat/load, external radio outage, pointing error and battery leakage. Severities add within a type; loss fractions and pointing are bounded in the plant. The heater relay can isolate the failed heater and retry at most twice, after 300 seconds and a sensed-temperature check. A redundant attitude actuator reduces pointing error to 5 degrees. Two bounded radio resets cannot cure an injected external outage.

Both diagnoses consume five observable residuals only: measured solar deficit, thermal imbalance, powered-link loss, pointing error and battery energy imbalance. Fault truth is exported for evaluation, never passed into the diagnostic classifier or safe-mode supervisor. Current measurements and plant commands are idealized; the software does not model sensor failures or independent current-sensor uncertainty. Temperature, stored energy, solar and pointing measurements have configurable independent Gaussian noise. Six random draws per interval preserve common exogenous noise across policies.

The baseline uses fixed thresholds. Assistance fits independent binary nearest-centroid channels to 256 healthy and 256 faulty synthetic samples per channel, using analytic signatures and training seed 9001. Both require 30 seconds of persistence. This small fitted classifier is the entire experimental AI assistance; there is no LLM, flight dataset, learned control policy or outside API. Its training distribution resembles the evaluation plant by construction, so held-out noise seeds do not establish generalization to other physics or hardware.

An independent deterministic supervisor enters safe mode on low battery, temperature limits, high pointing error, prolonged link loss, prior unmet demand or confirmed alarms. Recovery requires battery >=40%, temperature and pointing margins, available communications, no unmet demand and no alarms continuously for 300 seconds. The supervisor and software remain available even if modeled electrical power is exhausted; this is a deliberate abstraction of controller power/boot behavior. Pre-step bus observation uses the prior interval's power availability.

## Benchmark interpretation

The saved five-seed benchmark uses evaluation seeds 0–4, distinct from calibration seed 9001. Closed-loop runs share configuration and noise but change plant trajectories through recovery actions. A separate replay feeds both detectors the *identical baseline-controlled residual trace* for a fair diagnostic-input comparison. Reports include configuration hashes, calibration parameters and engine source hashes. Repeated runs on the same Python/platform are deterministic; cross-platform bitwise floating-point identity is not promised.

Confusion counts are fault-channel samples. Truth excludes manifestations masked by isolation, darkness, depleted storage or unavailable critical power. Missed injected episodes can therefore include faults with no observable opportunity; inspect injected and manifesting labels together. Zero-severity injections are excluded. Episode latency uses the first diagnosed, manifesting interval whose start belongs to the fault window, measured at interval end; same-type overlapping injections cannot be individually attributed. Descriptive means, sample standard deviations and ranges are supplied. Seeds vary noise on one design and fault schedule, not independent missions; no significance test or general superiority claim is warranted.

## Reliability limits and future work

No multi-node conduction, battery voltage/aging/electrochemistry, orbital propagator, eclipse ephemeris, RF link budget, rigid-body attitude dynamics, radiation damage, processor reboot, bus topology, hardware-in-the-loop, real telemetry or independent spacecraft-model validation. Actuator isolation is idealized. There is no uncertainty calibration against measurements, authenticated service, operational command link, real-time guarantee or flight qualification.

The local Spacecraft Health Control Center consumes versioned reports through a separate browser rendering layer: subsystem selection, telemetry plots, fault timeline, deterministic pause/replay, policy comparison and editable scenarios. Every changing spacecraft state comes from recorded telemetry, with units, synthetic labels, seed/model identity and visible invariant failures. V2 adds an interactive WebGL inspection schematic and prescribed orbit-phase inset, plus the research workspace described in `V2_STATUS.md`. Multi-spacecraft selection, live physics stepping and persisted experiments remain unimplemented; the interface does not issue hardware commands.

## Release gates

- Passed: original 16 tests; 30 new physics, FDIR, bounded-input, CLI, replay and seeded invariant tests (46 total).
- Passed: hand-calculated electrical and radiation cases, equilibrium, adiabatic heating, time-step convergence, trace corruption detection and randomized noise/fault combinations.
- Passed: overlapping-fault demonstration and paired five-seed comparison with zero reported conservation violations.
- Passed: byte-identical legacy offline result versus supplied baseline and unchanged original source/ZIP contents.
- Implemented input hardening: 256,000-byte JSON limit, duplicate-key/nonfinite rejection, strict bounded new-engine configuration. No network attack surface added. Legacy direct-call malformed-fault parsing remains technical debt; only its CLI file boundary was hardened.
- Passed locally on arm64 with Python 3.12.8; standard-library Python has no GPU requirement.
- Unavailable: empirical spacecraft hardware validation and independent high-fidelity model comparison.
- Added local dashboard verification: HTTP integration tests, real paired-engine results, deterministic replay, invalid input and local-origin restrictions. The original M1 test count above is historical; see the control-center verification report for the expanded suite.
- Not implemented: live synchronization, authenticated transport and flight certification. No deployment performed.
