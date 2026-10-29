# Mission-assurance verification — 2026-10-29

Verified scope: the existing application's optional, deterministic seven-role recovery workflow. This is a connected Phase 1 reference implementation with a bounded portion of the Phase 2 interface, not the entire V5 platform. See [capabilities and physical assumptions](ASSURANCE_STATUS.md).

## Executed checks

| Check | Actual result |
|---|---|
| Before this increment, restore point `f2d1a2c` | 64 tests passed; existing clean feature branch preserved. |
| Final `python3 -m unittest discover -s tests -v` | **93 tests passed**, 2.366 seconds on this machine. Includes original simulator, offline contracts, engineering references, research, frontend harness, new registry/verifier/kernel/workflow and HTTP tests. |
| `node --test tests/frontend.test.cjs` | 1 test passed; replay timing, seek bounds and telemetry-to-scene mapping. Also exercised by the Python frontend suite. |
| `node --check spacecraft_lab/web/assurance.js` and `node --check spacecraft_lab/web/app.js` | Both passed. |
| `python3 -m compileall -q spacecraft_lab assurance.py` | Passed. |
| `git diff --check` | Passed. |
| Default engineering reports versus `f2d1a2c` | **16 reports exactly equal**: seeds 0–3, baseline/assisted policies, nominal and overlapping solar/heater faults. Comparison executed the previous engine source with the same installed reference modules. |
| Preserved legacy/integration source | No changes to legacy simulator or offline integration files; original regression tests pass. |
| Acceptance CLI prepare → approve → export → independent replay | Completed and full JSON dictionaries exactly equal. |
| Independent source review | Prior resource/cancellation/normal-mode bypass findings corrected; targeted final registry/verifier/binding review found no blocking issue. This is code review, not independent spacecraft-model validation. |

HTTP tests need temporary loopback socket access. This coding sandbox initially denied `socket.bind`; rerunning with local socket permission produced the complete passing suite. There was no remaining test failure or skipped HTTP verification.

## Reproducible acceptance result

Input: [assurance_solar_thermal.json](../scenarios/assurance_solar_thermal.json), seed 7, 3,600 simulated seconds, 10-second intervals. Options: `probe_unsafe=true`, default 128-decision budget. This low-reserve solar/thermal/link demonstration does not implement the V5 extended-eclipse forecasting/optimization scenario.

- Stored CLI job: `42908b566f7849b4aca6fad35137c218` in the local ignored workflow database.
- Plan SHA-256: `0ed4022809aaa0e98cffd6c78124c599b231315ca17d66fb9c8f1a58d8f99a2d`.
- Engine run: `eng-9cfa497ac32c1a63a283cc5b`; research wrapper run: `research-137e9dbd3501bbde828d0c83`.
- Report content SHA-256: `81b18f7ca5e1e98b63b134ef8afda871e7a5a9bd1f950e0a20d08aadea0e92a5` using canonical `contracts.digest()`; this is not the pretty-printed file's byte hash.
- Complete machine-readable report and activity ledger: `artifacts/assurance_acceptance.json` (1,189,652 bytes). Full local results are ignored by Git; the [committed summary](../examples/assurance_acceptance_summary.json) includes source hashes, configuration, decisions, observed outcomes and metrics.

| Event / evidence | Measured result |
|---|---|
| Prepare plan | `PREPARED`; no simulation result, approval required. |
| Initial low reserve | Safe-mode request authorized and executed at 0 s; hard protection remains active. |
| Solar degradation | Solar output 36 W during the initial degraded sunlit interval; confirmed detection at 30 s. |
| Deliberately premature normal request | Rejected at 0 and 120 s; the latter cites normal preconditions, healthy dwell and normal-load budget. |
| Heater anomaly | Confirmed at 130 s; `ISOLATE_HEATER` independently verified, kernel-approved and executed at 130 s. |
| Outcome verification | The 130–140 s row has `heater_isolated=true`; observed outcome `ACHIEVED`. Clearing the residual does not mean the injected fault has physically disappeared. |
| Link outage | Confirmed at 330 s; resource-infeasible reset proposals rejected. External blackout ends according to the input, not a claimed radio repair. |
| Normal-mode recovery | Approved and executed at 2,770 s; final row is normal, 48.638% stored energy. |
| Proposal ledger | 37 proposals, 34 rejected, 3 approved and executed. Every executed action has pre-execution evidence and kernel approval. |
| Conservation | No checker violations in either strategy. Maximum assured power residual 5.31e-15 Wh; thermal residual 5.69e-10 J. |
| Replay / restore | Fresh replay exactly equals saved report; the browser also restores the CLI-produced job by ID. |

| Metric | Protected no-actuator recovery | Assured recovery |
|---|---:|---:|
| Safe-mode time / s | 3,350 | 2,770 |
| Minimum battery / % | 11.214 | 16.049 |
| Peak temperature / K | 297.886 | 297.147 |
| Unserved energy / Wh | 0 | 0 |
| Link availability / % | 83.333 | 83.333 |

These are outcomes from one selected synthetic scenario. They do not establish general multi-agent superiority, a statistical effect, real spacecraft failure probability or flight certification. The starting reserve is already below 25%; action guards are not a claim that arbitrary trajectories always maintain that reserve.

Reproduce from the repository root:

```bash
python3 assurance.py prepare scenarios/assurance_solar_thermal.json --probe-unsafe
# Use the returned job_id and plan_sha256, not the historical values above:
python3 assurance.py approve JOB_ID --digest PLAN_SHA256
python3 assurance.py export JOB_ID --out artifacts/assurance_acceptance.json
python3 -m unittest discover -s tests -p test_assurance_acceptance.py -v
```

Changing physics/assurance source changes the manifest and run/plan identities. Restart the local process after a source edit and prepare a new plan. Completed historical reports remain readable.

## Browser acceptance

Verified in the in-app browser at `http://127.0.0.1:8014/`:

1. Existing standard experiment still loads, with the original workspace navigation and conservation status.
2. Mission assurance preparation remains `PREPARED`; the exact scenario, budget, source manifest and digest can be inspected before execution.
3. Explicit approval produces a real background run and `COMPLETE`, seven measured role records, 37 decisions and the matched comparison above.
4. Expanding the rejected 120 s decision displays proposal-2.0 run/state binding, pre-execution verifier result and specific kernel reasons.
5. Replay selects the assured report, disables unrelated strategy selection, and shows the rejected requests in the ordinary journal.
6. Seeking to 140 s and selecting Thermal control shows heater isolation and 40 W served demand. Native WebGL 3D inspection renders the same row. Seeking to the final interval shows normal mode and 48.6% reserve.
7. A new prepared plan clears old job results and can be cancelled without executing. Restoring the CLI job returns its complete report. The evidence-export control was exercised; no browser console errors were recorded.

Local screenshots: `artifacts/mission-assurance.png` and `artifacts/assurance-replay.png`. They show recorded synthetic state; geometry and orbit are illustrative. Workflow pause, live agent streaming and mid-integrator continuation are not implemented.

## Bounded performance observation

[assurance_performance.json](../examples/assurance_performance.json) records five actual in-process repeats on Python 3.12.8 / arm64. Each repeat executes 360 assured intervals plus 360 baseline intervals; all complete results are exactly equal. Wall time: **0.0558–0.0998 seconds**, mean **0.0661 seconds**. These timings exclude process startup, SQLite, serialization and browser rendering. They are machine/load dependent and do not support a real-time, FPS or spacecraft reliability claim.

Repeat timing independently:

```bash
python3 - <<'PY'
import json, time
from pathlib import Path
from spacecraft_lab.assurance.runner import run_assurance
scenario = json.loads(Path('scenarios/assurance_solar_thermal.json').read_text())
reference = run_assurance(scenario, {'probe_unsafe': True})
for _ in range(5):
    start = time.perf_counter()
    result = run_assurance(scenario, {'probe_unsafe': True})
    elapsed = time.perf_counter() - start
    assert result == reference
    print(f'{elapsed:.6f} seconds')
PY
```

## Regressions caught before completion

Fail-first tests reproduced and now guard: omitted heater/leak load in radio budgets; cancellation ignored during the comparator; unapproved normal-mode exit; separately feasible heater retry/normal proposals exceeding their combined budget; a same-time proposal reused against another state/run; and previous job results remaining visible after a new preparation. New registry/verifier tests also reject unknown/self-expanded definitions, stale or insufficient evidence and execution without independent verification.

The implementation adds `spacecraft_lab/assurance/` (contracts, registry, verifier, orchestrator, kernel, runner and workflow), `assurance.py`, the acceptance scenario and assurance UI assets. It extends `engineering/model.py`, `reliability.py`, `control_center.py`, `web/app.js`, `web/index.html`, test suites and documentation. The original simulator and versioned offline adapter remain intact. No external deployment, Git remote, hardware path or cloud data writes were introduced.

SQLite connections use explicit close in addition to transaction context management; Python's [documented context-manager semantics](https://docs.python.org/3/library/sqlite3.html#how-to-use-the-connection-context-manager) were checked through Context7. No runtime framework was added.

Next priority: test uncertain/delayed observations and targeted worker interruption/resource boundaries, then introduce matched candidate counterfactuals against the existing basic recovery strategy. Broader dynamics, all 20 specialist roles, fleet, optimization and RL remain planned.
