# M1 — Coupled engineering reference model and telemetry-based FDIR

2026-10-28. Direct user instruction: this lab remains independent of Lunar Ops, ChainMind and the robotics/swarm lab.
The supplied documents describe future synchronization; they are project context, not authorization to connect
systems. Preserve the existing offline v1.0 adapter and legacy numerical behavior. Add no network service or deployment.

## Baseline audit

All 22 ZIP members match the supplied folder. ZIP SHA-256:
`69d20eb20dbff4591d43fd9e0702585490c1825f5def15dc02c1e67024c79cc9`.
Source folder is not a Git repository. An isolated working copy now lives in the workspace, with baseline commit
`1abe6af` and branch `feature/engineering-reference-fdir`. Original folder and ZIP remain unchanged.

Baseline `python3 -m unittest discover -s tests -v`: **16 passed**. Offline handoff reproduced:
`sim-defc7460d92b8b643e1f`. Architecture: dataclass conceptual simulator → optional strict offline integration adapter
→ two file CLIs; five fixtures, saved examples, standard library only, no UI/backend service/database.

Gaps: minute steps, clipped battery without unmet/curtailed energy or efficiencies, linear temperature relaxation,
fault-truth access in attitude protection, no fault isolation or bounded retries, no diagnostic comparison. Input parsing
also has malformed-fault TypeError paths, accepts Boolean fault times, and file CLIs have no byte limits.
The new model is additive; legacy behavior and contract v1.0 remain frozen for compatibility.

## Selected design

An additive `spacecraft_lab/engineering/` package with a distinct model version and standalone CLI. Extending the
legacy model in place would silently change saved outputs/contracts; a large external spacecraft framework is excessive
for this first milestone and adds installation cost. Keep the reference model dependency-free on Apple Silicon.

EPS: explicit Wh storage, charge/discharge efficiency and power limits, served/unserved/curtailed power and losses.
Thermal: one isothermal node, energy balance in joules, Kelvin radiation with Stefan–Boltzmann law and a configured
effective radiative sink. Deterministic synthetic illumination cycle, no claim of orbit propagation.

FDIR: threshold baseline and experimental fitted nearest-centroid diagnostic assistance operate on the same measured
residuals, never injected labels. Calibrate the latter on explicitly synthetic analytic signatures, record model parameters
and training seed, and do not call it a flight-trained model. Independent hard safety thresholds and recovery hysteresis
govern modes. Recovery includes isolating a faulty heater, bounded retry, redundant attitude control and radio reset attempts.
The latter cannot cure an externally injected radio outage. Overlapping faults are supported.

## Implementation plan

1. Write failing tests for bounded strict scenario input, exact power arithmetic, saturation/unserved energy,
   radiation/equilibrium/adiabatic thermal cases and independent conservation checks.
2. Implement config and reference equations, with documented units, ranges and validation through public entry points.
3. Write failing tests for telemetry-only diagnoses, independent synthetic training, persistence, overlapping faults,
   safe-mode hysteresis, actuator isolation, bounded recovery and deterministic replay. Implement model/controller.
4. Add paired benchmark runner, same seeds/config and sensor draws, confusion counts, latency, false alarms,
   engineering metrics and descriptive sample summaries. Keep training and evaluation seeds separate.
5. Reproduce legacy file exchange, run all tests, independent review, save engineering examples, document release gates.

## Scope boundaries

No GUI this milestone: specify a future Spacecraft Health Control Center over versioned telemetry/replay reports.
No authenticated HTTP integration, cross-project mutation, learned operational policy, multi-node thermal network,
validated battery electrochemistry, eclipse ephemeris or flight certification. All results SYNTHETIC and advisory.
