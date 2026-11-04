# Discovery Observatory — verification, 2026-11-04

Baseline `713b32a`; isolated branch `feature/autonomous-discovery-observatory`. The original **113 tests passed before changes**. Final integrated run: **144 tests passed in 6.985 seconds**, Python 3.12.8, Apple Silicon arm64. Node is used by frontend tests; the runtime still needs only Python and a browser.

## Capability inventory

| Requested capability | Implemented scope | Remaining work |
| --- | --- | --- |
| Five autonomous systems | Widefield, telescope, infrared, spectral and repeated-scan camera roles; seeded finite scan/detect/capture loops | Real instrument drivers, scheduling, optics/radiometry and continuous acquisition |
| Automatic recording on novelty | Measured centroid/peak/mean-spectrum distance to a two-entry starting catalogue; adaptive catalogue, per-agent dedup and budgets; actual generated 16×16 maps and eight spectral bins retained | Calibrated detection thresholds, real sky catalogues, transient differencing, discovery confirmation |
| Analysis/reporting agent | Deterministic nearest-template explanations for every capture, reproducible Markdown/JSON | Trained reasoning model, calibrated uncertainty, real spectral-library ingestion |
| Quantum material research | Actual ideal three-qubit phase-oracle/diffusion state-vector calculation over eight invented templates; classical scores shown alongside sampling weights for the named last chronological capture | Hardware execution, quantum chemistry, unknown-substance identification, any demonstrated advantage |
| Aerospace assistant | Ideal single-stage rocket equation, constant-load eclipse Wh and usable-storage margin with conditional checks | Trajectory, optics, structural/aerodynamic design, qualification, full design verification |
| Space economy/finance assistant | User-defined USD cash flows, downside/base/upside NPV and conditional project appraisal | Market feeds, economic forecasts, audited industry costs, securities recommendations, trading |
| Recorded evidence | Automatic local completed-report storage, refresh/restore, JSON/Markdown download, gallery/plots | Streaming capture, mid-mission restart, hardware archives, observatory/plant coupling |

The five instrument roles use the same bounded feature-novelty detector with independent seeded measurements. Their names do not imply five physically validated instrument models. The sixth analysis role is separate from the existing seven-role spacecraft assurance registry; it gains no recovery, tool, shell or network authority. All prior plant safety rules remain authoritative in their own workflows.

## Runnable evidence

```bash
python3 -m unittest discover -s tests -q
python3 observe.py scenarios/observatory_survey.json --out artifacts/observatory-demo.json
python3 -m compileall -q spacecraft_lab observe.py
node --check spacecraft_lab/web/observatory.js
node --check spacecraft_lab/web/mission-control.js
git diff --check
```

New tests cover deterministic capture, measured novelty, budgets/dedup, disabled agents and zero captures, input bounds/nonfinite/unknown tools, independent agent random streams, ten varied-seed invariant scenarios, analytical one/two/zero/all-mark Grover probabilities, exact engineering/NPV reference calculations, saved-record integrity/capacity/symbolic-link handling and immutable run identity, HTTP trust/routes, CLI reproducibility and actual UI script behavior against generated engine reports. Existing tests retain all engineering, assurance, campaigns, research, contracts and scene checks. There are 31 additional tests; none of the original tests were removed or weakened.

`examples/observatory_acceptance_summary.json` is evidence **OBS-ACCEPTANCE-2026-11-04**. It records the normalized configuration, full run ID, observed metrics, circuit probabilities, default advisory results, source hashes and measured timings. The seed-7 default has **120 scans, 50 captures, 10 distinct captured targets and zero budget skips**; each instrument stores ten frames. Five complete repeats were exactly equal, taking **0.0412–0.0445 s** in-process (mean 0.0422 s). This excludes HTTP, persistence, rendering and any real acquisition. A 120-step/five-instrument case performs 600 scans, stores 50 deduplicated captures and serializes to 311,467 bytes. These measurements establish bounded software behavior, not scientific accuracy or AI/quantum superiority.

Default engineering: ideal delta-v 332.574388 m/s, eclipse demand 70 Wh, usable energy margin 90 Wh. Default economy: downside NPV −1,383,997.15 USD; base −294,145.95 USD; upside 795,705.24 USD. These are hypothetical arithmetic outputs, not estimates of an actual venture.

## Local API and storage

- `POST /api/observatory/run` accepts exactly `{"config": {...}}`; seed 0–2³¹−1, 4–120 scan steps, novelty threshold 0.02–2, per-instrument capture budget 0–120, and unique known enabled IDs. All five roles can be disabled explicitly. An entire finite batch completes before response; it does not run in the background.
- `GET /api/observatory/history` lists completed runs; `GET /api/observatory/reports/<64hex>` restores a complete report. Observation IDs and the spectrum used by the quantum demonstration remain explicit. JSON exports retain all images/spectra/events; the UI shows the first 200 events.
- Completed runs live in `artifacts/observatory/`, separately from assurance SQLite. Default capacity: 20 distinct reports, 8 MB per report, 64 MB aggregate. A full store refuses a new mission; it never deletes old records. Identical reruns deduplicate; an existing ID cannot replace different evidence. Export/archive deliberately before changing stored files. Corrupt records are identified in history; symbolic record/store links are rejected.
- SHA-256 detects content damage, not user identity or a malicious local writer. The serial server is single-user loopback tooling, not a concurrent authenticated archive. Atomic completed-file replacement is not crash-proof streaming persistence. No real sensor frames are acquired.
- `POST /api/advisory/engineering` and `/api/advisory/economy` accept only documented bounded numeric fields. Every output carries its inputs, assumptions, limitations and sources. Calculators do not alter the plant or submit financial actions.

## Native browser acceptance

Verified in the existing localhost:8014 tab: run five agents; inspect recorded metadata, pixel frame, spectral graph and findings; advance capture selection; view classical/Grover comparison; calculate both assistants; run zero-budget case (zero frames and no fabricated quantum bars); refresh and restore the saved seed-7 mission; return to the original mission overview and play/pause its independent replay. Downloaded JSON was parsed from Downloads and **exactly equals the reproducible CLI report**, including all 50 images/spectra/findings.

Responsive checks at 1680, 390 and 320 pixels showed equal document/client widths (no horizontal page overflow). Tables scroll within their containers. Plant header context, controls and replay hide only while the Observatory is active to avoid confusing two independent experiments. Original controls/nodes remain present and return in the original workspaces. Final screenshots are saved under `artifacts/observatory-*.jpg`.

Independent review identified a run-ID/API-envelope mismatch, symbolic-link storage failures, unrelated replay context and overstated transient wording. These were corrected and regression/browser checks repeated. Python compilation, JavaScript syntax and whitespace checks pass. Source comparison against `713b32a` confirms no change to `engineering/`, `assurance/`, reliability strategies, campaigns, legacy simulator or integration contracts.

Primary physical/algorithm/economic sources and full assumptions are in [OBSERVATORY_SCIENCE.md](OBSERVATORY_SCIENCE.md). Reproducibility assumes the recorded source/model version and runtime; there is no cross-platform bit-for-bit scientific validation claim. No new dependencies, provider credentials, paid services, hardware control, other-project changes, flight certification, deployment or push.
