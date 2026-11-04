# Discovery Observatory: science, engineering and economics boundaries

Prepared 2026-11-04 for the independent local Spacecraft Reliability & Autonomy Lab. These are synthetic research tools, not flight software or externally validated scientific discoveries. The existing spacecraft plant, recovery strategies and safety gates remain separate.

## Observation and material interpretation

Five simulated instrument agents scan a seeded scene and record generated image/spectral samples when their measured features meet the configured novelty criterion. Novelty is a difference from this experiment's finite reference catalog, not proof that an object is previously unknown to science. A detector can miss objects or trigger on noise. Capture budgets and deduplication affect which records are retained. The generated images are numerical synthetic measurements rendered by the UI; they are not photographs or real telescope feeds.

The local analysis agent uses deterministic comparisons against a small, invented spectral-template library. The resulting material names are hypotheses within that toy library. Similarity scores are neither calibrated composition probabilities nor abundance measurements. No real NIST/USGS spectra, chemical assays, instrument calibration, atmospheric correction, radiative transfer, spectral unmixing, or laboratory confirmation are included.

[NIST's spectroscopy overview](https://www.nist.gov/spectroscopy/what-spectroscopy) explains how spectral absorption/emission can reveal composition. Real comparison work needs measured reference spectra and controlled instrument information; the [USGS spectral-library documentation](https://pubs.usgs.gov/of/2003/ofr-03-395/ofr-03-395.html) explicitly documents sample quality and spectral-purity issues. These sources support the scientific context, not the accuracy of this lab's invented templates. Identifying a new substance is unimplemented.

## Quantum search experiment

The quantum panel is a tiny ideal state-vector simulation of Grover amplitude amplification executed on the local classical CPU. A classically evaluated score supplies the oracle's marked candidates; phase inversion and diffusion change amplitudes, and squared amplitudes give the displayed algorithmic measurement probabilities. Those probabilities describe the simulated search state, not the chance that a material hypothesis is true. Candidate ranking is already available from the classical scores.

[IBM Quantum's Grover explanation](https://quantum.cloud.ibm.com/learning/en/modules/computer-science/grovers) describes the oracle and amplification procedure. Its query-complexity result concerns an appropriate quantum search model; it does not establish an end-to-end advantage for this eight-candidate classical simulation. This lab has no quantum-hardware connection, noise model, quantum chemistry solver, molecular simulation, new-substance inference or demonstrated speedup. Adding qubits to a classical state vector is not a scalable materials-analysis method.

## Aerospace engineering assistant

`spacecraft_lab.advisory.engineering_assessment` is a bounded, explainable preliminary-design calculator. Its recommendations are fixed rules derived from supplied inputs; no language model is called.

For dry mass `m_d` (kg), propellant mass `m_p` (kg), and constant specific impulse `I_sp` (s):

```text
ideal_delta_v (m/s) = 9.80665 × I_sp × ln((m_d + m_p) / m_d)
eclipse_energy (Wh) = load (W) × eclipse_duration (min) / 60
usable_storage (Wh) = battery_nameplate_energy (Wh) × usable_fraction
energy_margin (Wh) = usable_storage − eclipse_energy
```

The rocket calculation follows [NASA Glenn's ideal rocket equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/). It assumes a single stage, constant effective specific impulse, complete propellant consumption and fixed dry mass. It excludes gravity/drag/finite-burn losses, propellant reserves, staging, propulsion transients and trajectory constraints. Delta-v is an ideal capability estimate, not a maneuver solution.

The energy calculation assumes constant load and zero solar generation throughout the supplied eclipse duration. It only checks stored energy. As described in [NASA's small-spacecraft power overview](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/), spacecraft power design also requires generation, storage and distribution considerations. The calculator omits power/current limits, efficiency losses, recharge, thermal coupling, aging and uncertainty. A positive margin does not prove a spacecraft can meet the load or complete its mission. Use the existing engineering engine for its separately documented dynamic reference models.

Admitted inputs: dry mass 0.001–1,000,000 kg; propellant 0–1,000,000 kg; specific impulse 1–10,000 s; load 0–10,000,000 W; eclipse 0–10,080 min; battery 0–1,000,000,000 Wh; usable fraction greater than zero and at most one. These are numerical admission bounds, not recommended engineering ranges.

## Space-economy and financial scenario assistant

`spacecraft_lab.advisory.economy_assessment` compares user-defined project cash flows in USD. It loads no securities, prices, space-sector market statistics, news or cost database. Defaults are hypothetical examples. Its conditional recommendations identify which supplied assumptions warrant investigation; they are not personalized investment advice or trading instructions.

```text
annual_net_cash = annual_revenue − annual_operating_cost
NPV = −initial_cost + sum(annual_net_cash / (1 + discount_rate)^year)
```

Initial capital spending occurs at time zero; equal annual nominal unlevered cash flows arrive at year end. A zero discount rate is supported. The rate is supplied by the user and must be consistent with the nominal cash-flow basis. No market rate is recommended. Present-value discounting is explained in [NIST Handbook 135, 2025 edition](https://doi.org/10.6028/NIST.HB.135e2025); that handbook's federal-facility rules and sector-specific assumptions are not adopted by this project calculator.

For selected sensitivity `f`, downside revenue is `base_revenue × (1−f)` and downside operating cost is `base_cost × (1+f)`; upside reverses those changes. Initial cost, duration and discount rate remain fixed. The three rows are deterministic sensitivities, not quantiles, likelihoods, forecasts, a Monte Carlo risk assessment or proof of an attractive investment. There is no IRR calculation. Taxes, financing, inflation escalation, launch/mission failure, schedule delays, working capital, replacement, salvage and exit value are excluded. Independent market/cost validation and a fuller risk model remain future work.

Admitted amounts are 0–1 trillion USD; discount and sensitivity fractions 0–1; integer study duration 1–30 years. These bounds cap computation and numeric magnitude; they do not validate an input's economic plausibility.

## Reproduction and evidence

```bash
python3 -m unittest discover -s tests -p test_advisory.py -v
python3 -m unittest discover -s tests -p test_observatory.py -v
```

The advisory tests independently check the rocket/energy equations, discounted cash flows, zero-discount case, sensitivity ordering, nonmutation, determinism, finite serialization, bounds and malformed-input rejection. They establish software arithmetic and admission behavior within this model, not hardware feasibility or financial accuracy. See the increment's verification report and BUILD_STATE for integrated test and browser evidence.
