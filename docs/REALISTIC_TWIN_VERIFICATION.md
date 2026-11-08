# Realistic spacecraft twin — verification, 2026-11-07

Scope: the user's CubeSat/Earth reference is applied to the existing spacecraft digital twin in the independent `spacecraft-reliability-lab` app on localhost:8014. Baseline `1b090c2`, isolated branch `feature/realistic-spacecraft-twin`. No changes to `space-tech`, ChainMind, the original Downloads source, simulation equations, safety kernel, diagnostic policies or offline contracts. No deployment, push, new runtime dependency or hardware service.

## Implemented

- A dark exterior with machined panel edges, fasteners, MLI accents, open optical barrel/rings, dark glass, secondary support structure, thin panel contacts and smooth curved hardware. Exterior has a larger visual bus, four illustrative solar panels and a fixed 8-degree presentation tilt; the original six-panel subsystem schematic is retained. Neither is a CAD/flight configuration or a change to modeled array area, power or optical capability.
- Procedural material separation, Fresnel highlights, analytic Earth fill/reflections, restrained surface grain, filmic exposure/gamma and optional derivative-based cell antialiasing. A restrained fallback works without `OES_standard_derivatives`. No shadow maps, ray tracing, calibrated bidirectional reflectance or measured optical properties. Vertex normals are normalized before entering fragment `mediump` to bound thin-part values; Fresnel dot products are clamped to avoid undefined negative-base powers. Native testing does not establish compatibility with every mobile GPU.
- A directly accessible Realistic exterior / Subsystem cutaway selector. Choosing exterior restores the material view and closes exploded inspection. Thermal/power overlays or explosion identify their effective view as cutaway. Selecting a subsystem reveals its original measured inspection. Existing 3D/2D, labels, camera presets/reset/zoom/drag/keyboard, replay, scenarios and all seven workspaces remain available.
- A local generated Earth-only PNG with the existing SVG behind it as fallback. [Asset provenance](EARTH_BACKDROP_ASSET.md) records the prompt, dimensions and digest. Scenery is an illustration, not a live image, propagated ground track or Sun ephemeris. Recorded `sunlit` drives spacecraft key-light attenuation; the static scenery is independent of that cycle. Pointing error retains its existing illustrative yaw mapping, not full three-axis attitude.

## Executed evidence

Baseline: 144 tests pass in 10.550 seconds after allowing temporary loopback sockets. The initial restricted run reported two socket `PermissionError` setup failures; those are test-environment restrictions, not application defects. New selector/renderer/image-route assertions were observed failing before implementation (unsupported `exterior`, missing connected selector and HTTP 404). The effective-mode test then failed before the exterior/cutaway control fix.

Final development regression after shader range guards: **145 tests pass** in 6.598 seconds. This includes the new PNG route/header test, original Python engineering/assurance/campaign/observation tests, real JavaScript controller tests with engineering reports, connected-tree presentation tests and renderer boundary assertions. The two focused frontend harness tests also pass in 0.406 seconds. The extracted-download verification and archive hash are recorded beside the ZIP in its `.verification.json` delivery record. Node syntax, Python compilation and whitespace checks pass. Independent review's thin-part normal-range finding is resolved; no review findings remain.

Renderer boundary checks cover immutable telemetry/configuration, continuous battery/thermal/power mapping, strict options, curved unit normals, finite inverse-scale matrices, exterior/cutaway separation, 112 exterior versus 168 schematic cells, framing at desktop/mobile sizes, camera reset/zoom bounds, ordinary scrolling versus modified-wheel zoom, and context loss. These adapters inspect geometry/state; native browser verification separately checks actual GLSL compilation and rendering.

Numerical preservation: [16 complete report hashes](../examples/realistic_twin_preservation.json) match the archived baseline exactly for seeds 7, 11, 19 and 23 across `none`, `basic`, `enhanced` and `assured`. Comparison covers each complete canonical JSON report, including telemetry, events, decisions, metrics and provenance. This proves preservation for those cases, not physical validation or a general AI benefit.

Native local browser verification passed:

- Actual WebGL exterior and generated background load, with no captured browser errors/warnings.
- Camera keyboard rotation, front preset, zoom/reset, 2D hiding/restoring the model selector, cutaway, thermal overlay, explosion and exterior restoration.
- Recorded eclipse at T+81:00: solar 0 W, battery 47.6%, temperature 304.1 K and pointing error 5 degrees. Spacecraft shading dims with that recorded interval; scene controls do not mutate telemetry.
- At 320×760: document width/scroll width both 320, canvas width 296; full scene/camera controls fit after navigation settles. At 1280×900: document and scroll widths both 1280, model fits and controls remain usable. Temporary viewport override is reset after verification.
- Original recorded run/seed identity remains unchanged; beginning-of-trace rewind restores the actual initial readings.

Local screenshots: `artifacts/realistic-twin-desktop.png`, `artifacts/realistic-twin-mobile.png` and `artifacts/realistic-twin-eclipse.png`. They are generated verification artifacts, not telemetry or packaged flight evidence. The updated tracked-source ZIP includes the generated backdrop and setup instructions, but excludes local databases, saved accounts/jobs, artifacts, environments and Git metadata.

Still simplified: one thermal node, prescribed eclipse cycle, simplified electrical/attitude/link behavior, illustrative shapes/dimensions and fixed screen-space data callouts. Optical geometry does not acquire real camera data. This graphics increment does not add orbital propagation, calibrated digital-twin physics, real spacecraft connectivity or flight qualification.
