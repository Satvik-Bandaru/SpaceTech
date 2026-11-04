# Mission Investigation Studio — 2026-11-01

Status 2026-11-04: **proposed, unimplemented**. The user's subsequent specific observation/assistant request is implemented separately in [OBSERVATORY_PLAN.md](OBSERVATORY_PLAN.md). This document is retained as backlog context; no investigation completion is claimed.

User scope: more useful features in this independent local lab. Baseline `713b32a`; branch `feature/mission-investigation-studio`. Space Tech Program Steward backlog mappings: ST-015/016/020 (replay, trace comparison, explanation), ST-258/259/265 (charts, interactive time, exports). These are local partial implementations, not completion of the wider Space Tech platform. Linear search found no matching project/issues; shared agent-context endpoint was unavailable. No external records are changed.

Deliver one additional investigation workspace, preserving the current six workspaces and their controls:

1. Multi-channel telemetry chart, per-channel observed-range scaling explicitly labeled, finite-value handling and replay cursor.
2. Selected time window and per-channel min/max/sample mean/last/count; full saved trace versus through-cursor modes clearly distinguished.
3. Searchable recorded event table, event categories, seek-to-event and previous/next event navigation using existing replay controls.
4. Matched configuration/seed reference comparisons: existing standard strategies or an assured report's own protected baseline. Only aligned finite timestamps contribute; descriptive deltas, never automatic AI superiority.
5. Named bounded session bookmarks, tied to the actual run; bookmarks/notes travel with exported investigation JSON/Markdown.
6. Telemetry CSV and reproducible investigation JSON/Markdown exports with run/configuration/window/units/synthetic limitations.

Architecture: pure `web/investigation-data.js` derives evidence; `web/investigation.js` and CSS render controls; app.js supplies current recorded report/comparison candidates and a bounded pause/seek hook. No engine, kernel, model, contract or database changes. No cloud dependency, external LLM, live spacecraft command or deployment.

Acceptance: fail-first pure-data tests against generated standard/assured reports, missing-channel/window/comparison mismatch/export cases; real frontend bridge checks; full regression and native desktop/compact workflows; saved assurance and campaign reports remain readable. Update verification and BUILD_STATE, commit locally.
