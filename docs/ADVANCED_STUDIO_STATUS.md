# Advanced experiment studio — implemented scope, 2026-10-29

This increment extends the same local application. Restore point `279ce6d` had 93 passing tests. Development branch: `feature/counterfactual-mission-studio`. The engineering plant, deterministic safety kernel and offline integration contracts are preserved; no runtime dependency, cloud service or hardware interface was added.

## Capability and verification matrix

| Capability | State | Delivered boundary |
|---|---|---|
| Counterfactual experiment designer | IMPLEMENTED, VERIFIED | One unchanged reference plus up to three explicit engineering-input variants. Numeric controls and advanced JSON edits; inputs validated independently after merging. |
| Four-strategy comparison | IMPLEMENTED, VERIFIED | Existing `none`, `basic`, `enhanced` and `assured` paths. Only `assured` adds the independent proposal verifier/kernel; all retain their existing hard protection. No new AI/provider claim. |
| Paired configuration/strategy statistics | IMPLEMENTED, VERIFIED | Identical explicit seeds per case; variant-minus-reference and strategy-minus-basic (or first selected strategy) deltas. Missing values require both observations for a pair. |
| Comparable research-success evaluation | IMPLEMENTED, VERIFIED | Every primary trace is evaluated against the unchanged reference acceptance criteria. Original engine reports retain their own configuration-specific metrics; `evaluation_metrics` drives campaign summaries/exports. Loosening a variant's temperature limits cannot manufacture campaign success. |
| Statistical dashboard | IMPLEMENTED, VERIFIED | Recorded means, full Student-t intervals, Wilson intervals for the success proxy, paired tables, selectable metrics, case details and replay. No automatic winner or significance claim. |
| Durable campaign execution | IMPLEMENTED, VERIFIED | Exact-plan approval, bounded worker, per-case progress, cancellation, complete-result restore, checksums and additive SQLite migration. Existing assurance jobs still restore. |
| Saved job history | IMPLEMENTED, VERIFIED | Bounded lightweight listing for both job kinds, open/restore and correct routing between workspaces. No full reports loaded by the history query. |
| Reproducible exports | IMPLEMENTED, VERIFIED | Full JSON, CLI aggregate/paired CSV and Markdown, browser per-case CSV and research brief. Synthetic/advisory labels and evaluation criteria travel with text exports. CSV text fields guard formula prefixes; Markdown escapes user-controlled markup. |
| Advanced spacecraft inspection | IMPLEMENTED, VERIFIED | Measured battery-fill geometry, single-node thermal colors, measured power bars, exploded schematic, camera presets/reset/zoom, subsystem focus and retained 2D view. Camera/inspection controls do not alter physical telemetry. |
| Mid-mission counterfactual state cloning | PLANNED | Current variants are full reruns from initial conditions, not frozen integrator/RNG branches. |
| Worker pause/resume and live telemetry streaming | PLANNED | Per-case progress is polled; results replay after completion. Running cancellation exists, integrator resume does not. |
| Forecasting/optimization, fleet and RL | PLANNED | No new orbital propagation, payload scheduler, optimizer, fleet dynamics or trained policy. The prior seven deterministic roles remain the same. |
| Flight/model validation | BLOCKED / outside this milestone | No calibrated hardware dataset or independent spacecraft validation. Runtime guards and unit tests are not formal proof or flight certification. |

## Architecture, authority and bounds

`spacecraft_lab/campaigns.py` normalizes requests, executes existing simulation services, checks generated reports and calculates statistics. Every case retains its configuration, seed, full report and source identity. `assurance/workflow.py` stores `campaign` jobs alongside existing assurance jobs, using the same explicit approval/cancellation/results boundary. `/api/campaigns/prepare` creates a plan; existing `/api/assurance/approve`, `/cancel` and job/result endpoints run and retrieve it. `GET /api/jobs?limit=20` lists metadata; limits 1–64 are accepted. The frontend uses the same services as the CLI.

Limits: at most 8 distinct uint32 evaluation seeds (excluding calibration seed 9001), 32 primary cases, 2,000 intervals per configuration and 20,000 aggregate engine intervals. An assured case counts twice because it also runs its protected comparator. Existing 30-second cooperative deadline, four active jobs, 64 stored jobs, 32 MB result serialization and 256 MB logical store-admission guards remain. Per-case progress is persisted, not a promise of continuous live telemetry. Complete reports can be large; the verified default export is approximately 19.2 MB.

The implementation manifest now includes `campaigns.py`. Changed source requires restarting the process and preparing a new plan. Existing completed results remain historical records; changed source does not silently reinterpret them. SHA-256 provides content integrity, not authenticated user identity. This remains a single-user loopback tool.

## Scientific interpretation

The campaign compares fixed configured plants/fault schedules under paired measurement-noise seeds. Seed samples are not independent spacecraft missions or calibrated failure draws. Different closed-loop strategies can generate different telemetry histories despite matched exogenous noise. The assured comparator is retained and checked, but is not counted again as an independent statistical trial.

Mean intervals use the existing Student-t routine; one eligible sample has no estimated interval. The binary common-reference success proportion uses Wilson 95%. A zero-width interval means no observed seed variation, not certainty. Missing observations reduce a metric's sample count; detection latency conditions on detected episodes. There is no multiple-comparison correction. Success is the configured research proxy, not payload completion or spacecraft reliability.

`evaluation_criteria` records the common temperature band, final reserve, link availability and unserved-energy requirements. `run.evaluation_metrics` applies those criteria to the actual primary trace without rewriting `run.report`. This distinction matters when changing thermal limits, which can change both controller behavior and the original report's own acceptance criteria.

The 3D thermal overlay colors one isothermal node across the configured low/high range; it is not a spatial thermal field. Power bars show solar, served and unserved watts from top to bottom, scaled relative to the largest current value. Battery geometry represents the recorded percentage; missing/nonfinite channels remain unknown. Exploded subsystem positions are inspection offsets, never simulated mechanical deployment. Orbit geometry remains illustrative.

See [verification and observed results](ADVANCED_STUDIO_VERIFICATION.md) and the [implementation plan](ADVANCED_STUDIO_PLAN.md). Next priority is uncertain/delayed observation handling and targeted deadline/storage/concurrency fault tests before expanding autonomous reasoning or dynamics.
