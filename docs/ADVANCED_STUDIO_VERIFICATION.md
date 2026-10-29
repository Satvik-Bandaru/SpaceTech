# Advanced studio verification — 2026-10-29

## Executed evidence

| Verification | Actual result |
|---|---|
| Baseline at `279ce6d` | 93 tests passed before changes. |
| `python3 -m unittest discover -s tests -q` | **110 tests passed**, 4.147 seconds on this machine. Local HTTP tests ran with loopback socket access. |
| Default engineering outputs versus `279ce6d` | **16 complete reports exactly equal**: seeds 0–3, nominal/overlapping faults, baseline/assisted policies. |
| Python compileall; syntax checks for app/assurance/campaign/scene JavaScript | Passed. |
| Standalone Node replay/inspection tests | Passed, including a GPU-boundary adapter for camera matrices, measured geometry/overlays, input immutability and context-loss fallback. |
| Actual campaign replay | Three fresh full simulations exactly equal the stored JSON report. |
| Independent review | No remaining actionable findings after restore, export-provenance, common-criteria and evidence-key fixes. |
| Browser | Prepared without execution, approved, completed 24/24, inspected tables/plots, restored after reload, selected a case and replayed its own telemetry. Camera/top/reset/zoom, thermal/power/exploded inspection and retained 2D verified. No browser console errors recorded. |

## Actual default studio campaign

Stored job `acdacdec56904722ab0303654192f457`; campaign `campaign-d5ea1e89600b9a6dfb669424`. The browser's built-in low-reserve solar/heater/link scenario ran 3,600 seconds per case with paired seeds 0 and 1. Variants were solar generation 220 W and safe base load 25 W. All four strategies ran: 24 primary cases, 30 checked reports including protected assured comparators, 10,800 engine intervals. There were zero conservation-check violations.

| Configuration | No-recovery safe time / s | Basic / s | Enhanced / s | Assured / s |
|---|---:|---:|---:|---:|
| Reference | 3,350 | 2,810 | 2,810 | 2,770 |
| More solar | 3,170 | 2,750 | 2,750 | 2,725 |
| Lower safe load | 3,260 | 2,750 | 2,750 | 2,710 |

These are means of two selected noise seeds, conditional on this fixed synthetic scenario. For example, the assured more-solar variant's paired safe-time difference is −45 seconds, with a Student-t interval of approximately [−108.53, 18.53] seconds. This does not establish superiority. All 24 cases met the common reference research proxy; that heterogeneous descriptive count is not an estimate of hardware reliability. Two successes in a cell still have a wide Wilson interval.

Report checks: maximum power residual 8.91e-15 Wh; maximum thermal residual 5.69e-10 J. Full JSON is `artifacts/advanced-campaign.json` (19,229,623 bytes), alongside CSV and Markdown. Canonical report SHA-256 is `c01352534f235a1e9f470cf561ff54d7af7a91d49a9b158b31aa52695c2d44e6` using `contracts.digest`, not the pretty-printed file's byte hash. The committed [summary/case index](../examples/advanced_campaign_summary.json) includes the exact request, criteria, metrics and source manifest.

Three in-process repeats took 0.5943, 0.6831 and 0.6314 seconds on Python 3.12.8 / arm64, mean 0.6363 seconds. These observations exclude process startup, SQLite, serialization and browser work. See [recorded timing scope](../examples/advanced_campaign_performance.json); there is no FPS, real-time control or flight-performance claim.

## Reproduce

From this repository:

```bash
python3 -m spacecraft_lab.control_center --port 8014
python3 -m unittest discover -s tests -v
python3 assurance.py prepare-campaign examples/counterfactual_campaign.json
python3 assurance.py approve JOB_ID --digest PLAN_SHA256
python3 assurance.py history --limit 20
python3 assurance.py export JOB_ID --out artifacts/campaign.json
python3 assurance.py export JOB_ID --format csv --out artifacts/campaign.csv
python3 assurance.py export JOB_ID --format md --out artifacts/campaign.md
```

Use actual returned identifiers. The CLI example intentionally contains a solar/heater scenario; the browser default additionally injects a link outage. To repeat the exact browser dataset, use the `configuration` retained in the full export or committed summary:

```bash
python3 - <<'PY'
import json
from pathlib import Path
from spacecraft_lab.campaigns import run_campaign
from spacecraft_lab.assurance.contracts import digest
saved = json.loads(Path('artifacts/advanced-campaign.json').read_text())
replayed = run_campaign(saved['configuration'])
assert replayed == saved
print(digest(replayed))
PY
```

Browser: choose **Counterfactual studio**, edit controlled variants/seeds, prepare, inspect the exact plan, then approve. After completion, choose an outcome metric or recorded case. **Replay selected run** opens its telemetry in Health control; **3D inspection** exposes overlays/camera/exploded controls. History can reopen either campaign or assurance jobs. Complete jobs do not rerun when restored.

Screenshots: `artifacts/advanced-campaign-dashboard.png`, `artifacts/advanced-comparisons.png`, and `artifacts/advanced-twin-inspection.png`. The browser recovery required refreshing the automation connection; no application change or policy bypass was needed.

## Coverage and limitations

`tests/test_campaigns.py` covers strict normalization, input preservation, deterministic cases, weighted budgets, matching paired arithmetic, n=1 behavior, report/check rejection, cancellation, export scope and the relaxed-temperature-limit false-success regression. `test_campaign_workflow.py` covers exact approval, progress/history/restore, original SQLite schema migration, invalid admission, CLI exports and cancellation during a real multi-case run. The controlled clock makes cancellation polling independent of machine speed.

`test_campaign_frontend.py` executes the actual script against engine reports, including common-versus-own success criteria, fallback reference strategies, Wilson intervals, exports/provenance, selected-report replay and stale response races. Existing frontend tests also prevent cross-workspace campaign restore from corrupting assurance controls. `test_control_center.py` exercises campaign preparation/background results/history and rejects invalid queries/payloads. Original simulation, conservation, research and offline contracts remain covered.

Remaining verification gaps: forced 30-second expiry and every storage/queue admission boundary, multiprocess contention/crash recovery, and response races in older assurance controls. Running cancellation, detached UI result races and old-schema migration are tested, but this is not exhaustive concurrency or formal verification.

Source changes: new `spacecraft_lab/campaigns.py`, `web/campaign.js`/`.css`; extended `assurance/workflow.py`/`contracts.py`, `control_center.py`, `assurance.py`, `web/app.js`/`assurance.js`/`index.html`/`research.css`/`scene.js`/`ui-core.js`, tests and docs. The core engineering models and kernel rules were not replaced. No push, external deployment, cross-project mutation or paid service was performed.
