# Mission assurance capability and evidence — 2026-10-29

This records the earlier assurance increment. The later [advanced studio status](ADVANCED_STUDIO_STATUS.md) supersedes its counterfactual/history/inspection gaps and extends the implementation manifest to `campaigns.py`; original kernel/physics assumptions remain applicable.

The V4/V5 increment is an **optional, same-application deterministic recovery vertical slice**. It adds an independent pre-execution safety gate, seven bounded runtime roles, durable approved experiments and an assurance workspace to the existing engineering simulator. It does not implement the whole V5 platform or all 20 requested specialist agents. All telemetry and comparisons remain `SYNTHETIC`; `model_validated_for_flight=false`.

Baseline: commit `f2d1a2c`, 64 tests passed before this increment, on branch `feature/mission-assurance-kernel`. See [BUILD_STATE.md](BUILD_STATE.md) for the current verification checkpoint, [ASSURANCE_PLAN.md](ASSURANCE_PLAN.md) for the selected scope, and [V2_STATUS.md](V2_STATUS.md) for preserved research features. Earlier milestone documents describe their own historical increments.

## Status definitions and capability matrix

**IMPLEMENTED** means executable in the stated bounded scope. **PARTIAL** means only the stated subset exists. **PLANNED** means absent from this implementation. **BLOCKED** identifies an unmet prerequisite, rather than disguising an unimplemented feature as working. Test references below identify executable evidence; they do not establish spacecraft model credibility or general reliability.

| Capability | Status | Actual boundary / verification source |
|---|---|---|
| Existing simulator, research workspace, WebGL/2D inspection and offline v1/v2 contracts | IMPLEMENTED, preserved | Existing entry points remain; regression suites include engineering, reliability, integration and frontend tests. No live cross-project connection. |
| Central mission intelligence orchestration | PARTIAL | `MissionIntelligenceOrchestrator` (`MissionCommander` compatibility alias) executes a fixed synchronous dependency graph with conditional finite proposals. Shared interval state and audit exist; no dynamic task allocation, parallel analyst runtime or recursive discussion. |
| Seven deterministic runtime roles | IMPLEMENTED | `power`, `thermal`, `diagnostic`, `recovery`, `commander`, `safety`, `validation` expose bounded state, permissions, counters and evidence. These are rules and checks, not seven LLMs. |
| Finite validated Agent Registry | IMPLEMENTED | Exactly seven compiled roles; versioned metadata, domain, schemas, tools/permissions, budgets, deadline, error/approval policy, deterministic model settings and evaluation fields. `discover()`/`get()` return detached definitions. No executable entrypoints, self-granted capabilities or dynamic role registration. |
| Full extensible 20-role registry | PLANNED | Only the seven current roles are accepted. See role matrix below; the finite registry is intentionally not a general plugin loader. |
| Structured proposals and current evidence binding | IMPLEMENTED | `proposal-2.0`: six-action vocabulary, strict fields, run ID, original mission-state SHA-256, content fingerprint, source permissions and exact `telemetry:<time>` reference; safety contract tests. |
| Independent pre-execution evidence verification | IMPLEMENTED | `ProposalVerifier` checks contract, run/state binding, role permissions and matching confirmed alarm for alarm-driven actions. Every decision records `verification_result`; rejected evidence bypasses kernel execution. Passing verification still requires separate SafetyKernel authorization. |
| Independent deterministic pre-actuation gate | IMPLEMENTED | `SafetyKernel` authorizes optional recovery before plant mutations; rejects stale/invalid evidence, missing alarms, unavailable actuators and modeled resource violations. Existing hard safe-mode supervisor stays active. |
| Combined action resource checks | IMPLEMENTED | Sequential batch projections account for earlier accepted mode/load/actuator effects; heater retry and normal recovery share one budget. Conservative one-interval checks, not trajectory optimization. |
| Recorded execution and observed outcome | IMPLEMENTED | Approved, rejected, executed, not executed and observed/not observed states are recorded separately. `validation` independently checks finite proposal evidence before execution and compares modeled output fields afterward; no general reasoning verifier. |
| Prepared-plan approval, cancellation and completed-run restore | IMPLEMENTED | SQLite workflow, exact digest approval, bounded worker, status/audit/checkpoint/result export; workflow and HTTP tests. No mid-integrator/RNG resume. |
| Mission and experiment memory | PARTIAL | Current commander state plus durable plans/results/checkpoints. No engineering knowledge retrieval, editable lessons-learned memory or vector store. |
| Interactive Agent Operations Center | PARTIAL | Same-app assurance workspace shows seven roles, fixed dependencies, evidence, decisions, approval/cancel/restore/export and telemetry replay. No dynamic hierarchy editor, workflow pause/resume or fleet workspace. |
| Full emergency demonstration | PARTIAL | Solar degradation, low reserve, rejected premature normal-mode probe, permitted heater isolation, modeled outcomes, protected comparator and later approved normal recovery are connected. No energy forecasting, optimization agent or candidate counterfactual search. |
| Controlled scientific research | PARTIAL | Existing paired-seed studies and uncertainty summaries remain. Assurance compares one gated strategy with protected no-actuator recovery under matching scenario/seed; no natural-language hypothesis generator or automated scientific conclusion. |
| Physics / digital twin | PARTIAL | Existing bounded EPS and lumped radiative thermal reference equations; simplified pointing/link/eclipses. No orbit propagation, reaction wheels, sensor fusion, fuel or payload-buffer dynamics. |
| FMEA / reliability engineering | PARTIAL | Five-fault qualitative crosswalk below; deterministic fault episodes and simulated performance. No calibrated rates, fault-tree probabilities, hardware lifetime estimates or flight reliability claim. |
| LLM provider, RAG, autonomous research questions | PLANNED | No provider is connected or required. No external model tools, shell, repository mutation, arbitrary filesystem or hardware access is available to simulation roles. |
| Optimization, learning, 2–5 spacecraft fleet and advanced adapters | PLANNED | No constrained optimizer, counterfactual candidate selector, RL sandbox, fleet coordination, Basilisk/SPICE/F Prime/cFS adapter or associated results. |
| Formal verification / operational spacecraft commanding | BLOCKED / outside current scope | No formal plant specification or independently validated high-fidelity model; no hardware adapter or operational authorization. Local tests and conservative guards cannot provide flight certification. |

## Architecture and action authority

The modular monolith reuses `spacecraft_lab/engineering/model.py`, diagnostics and the hard `SafeManager`; optional `assurance_options` adds `MissionIntelligenceOrchestrator`, with `MissionCommander` preserved as an alias. `registry.py` validates the finite role definitions; `contracts.py` defines validated messages/permissions; `agents.py` gathers telemetry facts and generates proposals. `verification.py` independently checks current evidence and permissions before `safety.py` independently authorizes modeled constraints without importing the orchestrator or an LLM. The plant applies only allowed recovery actions, then sends actual interval results to `observe()`. `runner.py` runs the gated strategy and a protected `none` comparator, preserving configured inputs and paired noise draws. `workflow.py` owns local approval and persistence; `control_center.py` and `web/assurance.js` expose that same path through the existing app.

The fixed sequence is observation → specialist facts → recovery candidates → commander → independent proposal-evidence verification → deterministic kernel → simulated plant → observed-field validation. The independent kernel is the action authority. An analyst cannot grant permissions or create a new tool. Automatic entry to safe mode is still a plant protection; return from safe to normal in assurance mode requires prior kernel approval as well as the existing supervisor's conditions. An approved proposal can remain unexecuted if plant conditions do not permit it. The registry's input/output contracts describe these finite roles; they are not arbitrary user-provided schema executors. Per-role budgets are metadata ceilings; operational bounds are enforced by the finite graph, interval/decision counts and workflow deadline, not a separate sandbox for each role.

The action vocabulary is `REQUEST_SAFE_MODE`, `ISOLATE_HEATER`, `SWITCH_REDUNDANT_ADCS`, `RESET_RADIO_ATTEMPT`, `RETRY_HEATER`, `REQUEST_NORMAL_MODE`. Each `proposal-2.0` binds the originating engine run ID and original observation digest, so a same-time proposal cannot be reused against a different battery state or run. The safety kernel independently repeats this binding check. Batch verification uses that priority order and projects accepted effects into subsequent resource checks while preserving the original observation binding. Heater isolation removes its connected load; radio reset adds a 5 W trial load; heater retry adds the reconnect envelope; normal-mode return uses the configured normal base load. Rejected actions do not alter the projection or plant. The recorded `verification_result`, `evidence_state`, `safety_projection`, reason codes and state digest make the decision basis inspectable.

Radio recovery and heater reconnection check discharge power and the next interval's stored energy with discharge efficiency and storage loss. They preserve a modeled 25% end-of-interval reserve; radio entry also needs at least 25% state of charge and thermal margin. Heater retry needs at least 40%, 300 seconds of isolation, fewer than two attempts, cleared heater alarm and temperature below the heater-on threshold within the recovery band. Normal recovery needs at least 40%, healthy temperature/pointing/link, no alarms or unmet prior load, healthy dwell and a feasible normal-load budget. ADCS switching needs a confirmed alarm, unused redundancy and at least 10% reserve. These action-specific rules are not a guarantee that every arbitrary scenario avoids future unmet load or thermal excursion.

## Observation and model assumptions

- The plant integrates true battery and temperature state; diagnostics use noisy sensor residuals and prior confirmed alarms. Safety receives sensed temperature but **reference battery energy**. Current pointing, link and unmet-load evidence includes the preceding interval. This is not a complete state estimator or a guarantee against stale physical conditions.
- Additional heater/reset demand and battery leakage are exposed as **ideal instantaneous current/loss reference telemetry** computed by the simulator. The specialist does not receive active injected-fault labels. Real instrumentation uncertainty, sampling delay and failure of these measurements are not modeled at this gate.
- Reconnecting a disconnected heater uses a **static configured fault envelope**: nominal commanded heater load plus 80 W times the summed configured `heater_stuck_on` severities. It does not reveal which disconnected fault is currently active; it can be deliberately conservative for nonoverlapping faults. This envelope is a simulator assumption, not a calibrated hardware bound.
- The kernel credits **zero solar generation** in its one-interval recovery energy budget. It includes current full-load demand, discharge efficiency and measured storage loss. It does not forecast orbital/eclipse energy, solve a reachability problem or prove safety over the whole remaining mission.
- Temperature checks are current sensed margins, with a 3 K recovery band. They are not a forward thermal prediction or a formal proof. Ideal power observations do not remove temperature noise or the existing single-node thermal model's limitations.
- Observed `ACHIEVED` means the expected modeled field was seen. It does not establish a lasting repair, causation, statistical significance or general multi-agent superiority. Radio reset cannot repair an imposed external blackout; redundancy is a simplified 5° pointing substitution.

## Workflow, trust boundary and resource limits

The local state machine is `PREPARED → QUEUED → RUNNING → COMPLETE`, with `CANCELLED`/`FAILED` terminal alternatives and `CANCEL_REQUESTED` while running. Preparation validates and persists the scenario/options without executing them. Approval must match the exact plan SHA-256, including the implementation manifest. The manifest covers Python engineering/assurance modules and `reliability.py`; it is not a hash of every repository file. A changed loaded implementation requires a process restart; changed source after preparation requires a new plan. Stored plans and returned results are checked for content integrity.

**SHA-256 is content integrity, not authentication, authorization or a signature.** A local writer capable of replacing both content and digests is outside this defense. The loopback server checks Host/Origin and JSON routes, but has no user identity or multi-tenant security boundary. SQLite persistence is local to `artifacts/assurance.sqlite` by default; the file is restricted to owner read/write on supported systems. No network integration is introduced.

Local schema migration: new executions require `proposal-2.0` with run/state binding. Previously saved complete assurance reports remain readable as historical results; they are not reinterpreted as new proposals. Old prepared plans contain an older source manifest and must be prepared again before approval. Frozen Lunar Ops v1/v2 offline contracts are unaffected.

| Bound | Implemented value / scope |
|---|---|
| Active jobs | At most 4 queued/running/cancel-requested jobs per database; each store has one worker. |
| Stored jobs | At most 64, including terminal jobs; archive the local store explicitly before preparing more. No automatic retention service. |
| Workflow deadline | 30 seconds, checked cooperatively at interval boundaries in gated and baseline phases and before completion; not a hard OS process limit. |
| Result/store capacity | Report serialization capped at 32,000,000 bytes; projected SQLite allocation plus report capped at 256,000,000 bytes. Logical admission guard, not a total disk/RAM quota. |
| Simulation / decisions | Engineering configuration allows ≤10,000 intervals per strategy; HTTP assurance allows ≤2,000. Decisions default to 128, configurable 1–256. Attempts, dwell and proposal cooldowns are bounded. |
| HTTP input | Explicit routes and strict fields; JSON body ≤256,000 bytes; finite/unique-key validation and five-second accepted-connection/read timeout. |

Completed runs restore the full saved report and audit without recomputing it. Cancellation records an interval-boundary checkpoint; it does **not** serialize complete integrator/RNG state for resumption. An abandoned queued/running job from a dead process becomes `FAILED`; a new run must be explicitly prepared. A second store observing a live owner does not interrupt it. The simulation has no LLM, arbitrary-tool, shell, deployment, real-spacecraft or hardware interface.

The existing loopback server exposes these assurance routes. POST bodies must contain exactly the listed fields; options accept `max_decisions`, `probe_unsafe` and `unavailable_actuators`, with defaults when omitted inside the options object. Responses are JSON.

| Method / route | Request / response |
|---|---|
| `POST /api/assurance/prepare` | `{ "scenario": { ... }, "options": { ... } }` → prepared job with normalized plan, `job_id`, `plan_sha256`, status, audit and checkpoint. No execution. |
| `POST /api/assurance/approve` | `{ "job_id": "...", "plan_sha256": "..." }` → job status after submitting the bounded background work. |
| `POST /api/assurance/cancel` | `{ "job_id": "..." }` → current cancellation/terminal status. |
| `GET /api/assurance/jobs/JOB_ID` | Current job record; use the persisted 32-character hexadecimal ID to inspect/restore after reopening the app. |
| `GET /api/assurance/jobs/JOB_ID/result` | Complete report only; HTTP 409 until a complete result exists. |

Invalid fields, job identifiers or approval digests fail closed; unavailable local SQLite access returns a service error. There is no arbitrary task, database query or filesystem path endpoint.

## Latest V5 20-role vision versus current runtime

The complete supplied V5 prompt names 20 specialist roles. This supersedes the earlier incomplete-text/16-role roadmap wording. The seven current runtime roles are a smaller implementation: `safety` is a separate deterministic authority beyond the requested specialist registry, and `validation` implements finite pre-execution evidence checks plus post-execution observed-effect checks.

| V5 role | Status | Current evidence / missing capability |
|---|---|---|
| 01 Mission Commander | PARTIAL | `commander`: fixed candidate coordination, not general objectives, delegation or strategy search. |
| 02 Flight Dynamics Engineer | PLANNED | No orbital state propagation or maneuver analyst. |
| 03 Guidance, Navigation and Control Engineer | PLANNED | Existing pointing alarm/redundancy model is not a dedicated dynamics or estimation agent. |
| 04 Power Systems Engineer | PARTIAL | `power`: current reserve facts and safe-mode recommendation; no forecasting or schedule search. |
| 05 Thermal Systems Engineer | PARTIAL | `thermal`: sensed temperature/isolation evidence; recovery handles actions, no thermal trajectory analysis. |
| 06 Communications Engineer | PLANNED | Existing link diagnostic/reset is not a windows/bandwidth/latency planning agent. |
| 07 Propulsion Engineer | PLANNED | No fuel, delta-v or propulsion model. |
| 08 Spacecraft Health Analyst | PARTIAL | Existing operational assessment and `diagnostic` facts; no dedicated longitudinal agent. |
| 09 Fault Investigation Agent | PARTIAL | `diagnostic`: confirmed residual alarms; no competing-hypothesis ranking or requested investigations. |
| 10 Autonomous Recovery Planner | PARTIAL | `recovery`: conditional finite candidates; no alternative procedure search or counterfactual simulation. |
| 11 Mission Optimization Agent | PLANNED | No optimization engine or task scheduling agent. |
| 12 Reliability Engineering Agent | PLANNED | Existing research metrics and this qualitative FMEA are not an autonomous fault-tree/reliability agent. |
| 13 Spacecraft Fleet Coordinator | PLANNED | Single spacecraft only. |
| 14 Scientific Experiment Designer | PLANNED | Users supply scenarios and seeds; no hypothesis-generation agent. |
| 15 Statistical Analysis Agent | PLANNED | Existing deterministic uncertainty routines are not a specialist agent. |
| 16 Machine Learning Researcher | PLANNED | Existing synthetic nearest-centroid assistance is not an autonomous training/evaluation agent. |
| 17 Cybersecurity and Resilience Analyst | PLANNED | Input/permission defenses exist; no security analyst or LLM prompt-injection evaluation suite. |
| 18 Systems Engineering Agent | PLANNED | This manual traceability matrix is not an executing requirements agent. |
| 19 Mission Knowledge Agent | PLANNED | No retrieval, knowledge store or provenance-aware search agent. |
| 20 Independent Verification Agent | PARTIAL | `validation` checks proposal contracts, current run/state evidence, permissions and required alarm support before execution, then observed field effects afterward. No broad conclusion/evidence reasoning. Separate `safety` kernel remains final action authority. |

## Five-fault qualitative FMEA

These are the actual `EngineeringConfig` fault names. Severity is a configured synthetic magnitude, not a failure probability. No occurrence rates, reliability distributions or numerical risk-priority scores are invented.

| Fault | Modeled effect and detection | Recovery / gate / remaining limitation | Test evidence |
|---|---|---|---|
| `solar_array_loss` | Fractional generation loss; solar residual only when expected illumination is observable. Can deplete reserve and trigger safe mode. | No solar repair action. Low-reserve safe mode and normal-return energy gate; no future-eclipse predictor. | `test_connected_solar_fault_rejection_recovery_replay_export`; `test_resource_and_heat_balances_across_seeded_faults`. |
| `heater_stuck_on` | Additional 80 W × active severity when connected, subject to served power; persistent thermal residual. | Alarm-gated isolation; bounded retry after dwell with sensed temperature, reserve, power and static reconnect-envelope checks. Isolation suppresses manifestation, not the configured fault episode. | `test_actual_plant_is_gated_reproducible_and_has_observed_outcomes`; `test_heater_reconnect_and_normal_recovery_share_one_feasible_budget`. |
| `comms_loss` | Externally imposed channel outage; diagnosed only when powered and sufficiently pointed, excluding reset downtime. | Up to two reset trials, ≥120 s apart, actuator/resource/thermal gates. Reset does not cure the imposed outage. | `test_unsafe_requests_rejected_before_actuation`; `test_radio_budget_includes_heater_and_storage_loss`; `test_total_power_loss_disables_radio_without_inventing_radio_fault`. |
| `attitude_fault` | Simplified pointing error reduces generation and can lose link; persistent pointing residual. | Alarm-gated one-time backup ADCS, ≥10% reserve and available actuator; substitutes 5° pointing, no wheel/control dynamics. | `test_overlapping_faults_and_actuator_recovery` exercises the existing plant; current assurance permission/state checks are generic, not a dedicated exhaustive ADCS evaluation. |
| `battery_leak` | Up to 20 W × active severity of storage drain, bounded by available energy; contributes heat and storage residual. | No leak repair action. Reserve protection; leakage is included in kernel recovery budgets through ideal loss telemetry. | `test_adjacent_episodes_do_not_steal_preceding_interval_detections`; `test_resource_and_heat_balances_across_seeded_faults`; `test_radio_budget_includes_heater_and_storage_loss` tests the loss-budget guard. |

## Requirements-to-tests crosswalk

Paths are relative to this repository. These tests verify local code behavior under their stated inputs, not complete V5 requirements or flight suitability.

| Requirement | Executable evidence |
|---|---|
| Strict proposals, finite actions, source permissions and run/state-bound evidence | `tests/test_assurance.py::AssuranceTests.test_kernel_requires_current_evidence_and_permissions`; `test_same_time_proposal_cannot_rebind_to_changed_state_or_run`; `test_budget_and_input_contracts_are_bounded`; `test_corrupt_state_fails_closed_without_exception`. |
| Finite registry discovery, detached definitions and no capability expansion | `tests/test_agent_registry.py::AgentRegistryTests.test_registry_discovery_and_inputs_cannot_mutate_permissions`; `test_malformed_unknown_duplicate_and_self_granted_definitions_are_rejected`. |
| Independent proposal evidence check before kernel/actuation | Same registry class: `test_verifier_rejects_stale_unbound_malformed_and_unauthorized_proposals`; `test_alarm_actions_require_current_confirmed_diagnostic_evidence`; `test_orchestrator_rejects_invalid_evidence_before_kernel_or_execution`; `test_actual_run_records_verification_before_every_executed_action`. |
| Reject unsafe actions before mutation, enforce actuator/retry/dwell limits | `tests/test_assurance.py::AssuranceTests.test_unsafe_requests_rejected_before_actuation`; `test_retry_dwell_and_safe_mode_cannot_be_bypassed`; `test_disabled_actuator_never_executes_and_budget_exhaustion_is_safe`. |
| Full load, storage loss, reserve and combined heater/normal budget | Same class: `test_randomized_radio_actions_always_preserve_modeled_reserve`; `test_radio_budget_includes_heater_and_storage_loss`; `test_heater_reconnect_and_normal_recovery_share_one_feasible_budget`. |
| Real plant integration, reproducibility, observed effects, no ungated normal recovery | Same class: `test_actual_plant_is_gated_reproducible_and_has_observed_outcomes`; `test_seeded_assured_plant_preserves_conservation_and_gate`; `test_every_normal_recovery_has_prior_kernel_approval`. |
| Cooperative cancellation in both strategies | Same class: `test_cancellation_returns_interval_boundary_checkpoint`; `test_cancellation_covers_baseline_phase`. |
| Approval before execution and durable completed result | `tests/test_assurance_workflow.py::WorkflowTests.test_explicit_digest_approval_and_durable_result`; `test_prepared_work_can_be_cancelled_without_execution`; `test_bad_inputs_and_identifiers_do_not_create_jobs`. |
| Source/result integrity and concurrent observer behavior | Same class: `test_stale_source_approval_and_corrupt_result_are_rejected`; `test_observer_store_does_not_interrupt_another_live_owner`. |
| Connected solar/unsafe-probe/isolation/baseline/replay/export/normal-return demonstration | `tests/test_assurance_acceptance.py::AssuranceAcceptance.test_connected_solar_fault_rejection_recovery_replay_export`. |
| HTTP prepared-plan workflow and background result | `tests/test_control_center.py::ControlCenterTests.test_assurance_requires_explicit_plan_approval`; `test_background_assurance_run_returns_real_complete_evidence`. |
| Same-app frontend prepares, approves, renders seven roles/evidence and replays actual report | `tests/test_frontend.py::FrontendTests.test_real_dashboard_script_with_engine_reports`, invoking `tests/frontend-integration.cjs`. This uses a DOM harness; native browser inspection is separate evidence. |
| Preserve physical reference checks and offline contract | `tests/test_engineering_physics.py`; `tests/test_engineering_fdir.py`; `tests/test_engineering_cli.py`; `tests/test_reliability.py`; `tests/test_integration.py`; original simulator tests. |

The 4-job, 64-job, 30-second and serialized-size limits are explicit code guards; do not read the crosswalk as exhaustive boundary/load/crash testing of all limits. Deferred verification includes multi-process contention beyond a live-owner observer, forced process termination/restart cases, hard resource containment, measurement delay/bias and formal safety properties. Prioritize trustworthy observations and broader targeted failure testing before adding dynamic LLM reasoning or more specialist roles.
