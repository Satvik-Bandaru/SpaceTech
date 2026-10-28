# Control center verification — 2026-10-28

Branch `feature/health-control-center`, built on engineering milestone `a97b327`.

- 52 tests passed: all 46 prior tests plus six HTTP tests. Tests execute the actual engine through a temporary local server and cover deterministic paired reports, explicit asset routes, host/origin restrictions, malformed/oversized/expensive input, duplicate JSON keys, huge numeric values and accepted-connection timeouts.
- Browser verified the example (540 intervals per policy), comparison metrics, custom 120-second seed-12 scenario, play, seek-to-60-seconds with automatic pause, and invalid 17-second horizon refusal while retaining the previous report.
- Browser export saved a JSON file with both complete 540-interval reports; parsed export verified synthetic provenance and no invariant violations.
- Independent review caught replay multipliers ignoring dt, unbounded header reads on accepted connections and an unhandled numeric overflow. Corrected all three; added regression coverage for server cases. Replay timers now use dt_seconds * 1000 / multiplier.
- Mobile-width rendering inspected in the in-app browser. No external fonts, libraries or assets fetched.

Run locally with `python3 -m spacecraft_lab.control_center --port 8014`, then open http://127.0.0.1:8014/. Stop with Ctrl+C. Tests need permission to bind loopback sockets. Runtime adds no installed dependencies and performs no cross-project reads or writes.

Remaining limits: one reference satellite, schematic SVG rather than physical 3D geometry, recorded replay rather than live physics stepping, no saved experiment database or server authentication. The benchmark CLI remains the tool for multi-seed statistical reports. Model assumptions and non-flight-qualified status remain unchanged.
