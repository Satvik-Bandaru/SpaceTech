# Local Spacecraft Health Control Center

Build on the existing engine without changing its physics. The user's “do it” is taken as authorization to implement the previously described future control center. Implementation choice: standard-library loopback HTTP server and dependency-free HTML/CSS/JavaScript, avoiding a frontend build/runtime dependency for this local milestone. A React/3D renderer can be added later if needed; the current single-node model does not justify detailed spatial thermal graphics.

The interface has a spacecraft subsystem schematic, telemetry plots, event history, editable scenarios, baseline/assisted comparison, pause/play/seek/speed controls and JSON export. Replay shows recorded simulation states, not a live spacecraft or real-time physics integration. Both policies run through the same existing engine. Show synthetic/advisory labels and conservation violations prominently. No network connections to other projects, cloud services or hardware.

Implementation steps:

1. Add failing HTTP tests for static assets, deterministic paired reports, invalid input, body/step bounds, host/origin refusal and path restrictions.
2. Implement a loopback-only server with explicit routes, JSON parsing limits, same-origin protections and a bounded simulation budget.
3. Build the responsive interface and connect it to the paired-report API; use recorded telemetry for every changing numeric value and subsystem indication.
4. Verify all existing tests, HTTP integration tests and browser workflows (run, edit, compare, pause/seek, export); document startup and limitations.

Review focus: stale playback after edited scenarios, untrusted JSON rendered as HTML, mismatched policy time cursors, unsafe local HTTP origins, expensive inputs. The interface must reset playback on each successful run, use textContent for supplied values, use aligned cursors, reject cross-origin requests, and cap web runs to 2,000 samples per policy.
