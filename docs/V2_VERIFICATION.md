# V2 verification record — 2026-10-29

Baseline 52 tests passed before implementation. Final suite: **64 tests passed, zero skips** on local arm64 / Python 3.12.8 with Node 24 for frontend checks. Command: `python3 -m unittest discover -s tests -v`. HTTP tests require loopback socket access. No new runtime package installed.

New automated coverage includes:

- Three strategies with identical scenario hashes, distinct run IDs, no actuator commands for the `none` strategy, preservation of input and repeatable runs.
- Structured protection/actuator records, immediate outcomes, success-proxy failure and the five-state operational assessment including consecutive failure dwell.
- Known Student-t and Wilson calculations; bounded distinct evaluation seeds excluding calibration; paired study repeatability.
- V2 health content/event identities, deterministic replay validation, rejection of forged state/times/status/run ID, and local reader duplicate-key refusal.
- Local research API run/study/exchange, strict request keys and resource limits, alongside all prior origin/host/input protections.
- Replay timing and seek bounds; telemetry-to-scene mapping; execution of the actual dashboard script with engine-generated reports in a minimal DOM adapter, asserting initial metrics, seek, policy alignment, comparison rows and previous-report retention after failed edits. This adapter is not a real browser rendering test.

Browser verification in the existing in-app tab at http://127.0.0.1:8014/:

- Loaded all three strategies, rendered native WebGL, rotated by drag and zoomed with keyboard.
- Ran the five-seed study and inspected its confidence table and interpretation limits.
- Selected nominal preset, added a heater fault through the form, executed the run, sought to T+13:30 and inspected the observed heater isolation/retry records and evidence.
- Reloaded final example, selected enhanced strategy, sought into eclipse (T+66:50), observed zero solar power with eclipse indication, then switched successfully back to 2D.
- Final state left open as a local user-facing deliverable. Browser reports and CLI reports use the same underlying run path. Exported study and health JSON verified through the CLI/API; the existing Blob download mechanism remains in place.

Additional evidence:

- `examples/reliability-study-v2.json` reproduced exactly from the supplied five-seed command; every strategy/seed passed conservation checks.
- The legacy v1 result matched the original pre-change handoff byte-for-byte (`sim-defc7460d92b8b643e1f`).
- Default engineering reports compared equal to the pre-V2 implementation from commit `500d4a2` for nominal and injected-heater cases, both policies.
- JavaScript syntax and Python compilation checks passed. Independent read-only review found a weak health-packet validation check; fixed with deterministic semantic replay and added forged-report regression coverage. No remaining substantial findings in the reviewed slice.

Not verified: real spacecraft hardware, high-fidelity external models, flight reliability, Lunar Ops-side importer, public/production operation or live actuation. See `V2_STATUS.md` for the explicit implemented/partial/planned matrix.
