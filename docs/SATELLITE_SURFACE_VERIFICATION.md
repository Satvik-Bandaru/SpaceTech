# Satellite structure and surface verification — 2026-11-07

Scope: improve the satellite itself in the existing digital twin, starting from `0f493b1` on isolated branch `feature/spacecraft-materials-and-shadows`. This is the independent local Spacecraft Reliability Lab on port 8014. No other project, original Downloads source, physical equation, diagnostic policy, safety kernel, assurance workflow or offline contract is changed. No deployment, push or new runtime dependency.

## Implemented

- Cached detailed exterior: beveled bus and faceplates, dark rails, textured gold insulation, radiator, fasteners, sockets/retention hardware, harnesses, wing hinges/stops, four deployed panels and 112 clipped solar cells. A smaller optical opening has a deep barrel, baffles and recessed glass. Four authored meshes and 423 deterministic draw commands are constructed once; replay inputs are not mutated.
- Two local generated material maps, with complete neutral textures during loading and procedural fallback after failure. Native canvas resampling produces power-of-two mipmapped images within GPU limits. Native uploads use 1024×1024 for the supplied 1254×1254 originals. No remote textures or runtime service. [Provenance and integrity hashes](SATELLITE_MATERIAL_ASSETS.md) identify the unchanged source PNGs.
- Roughness-aware GGX microfacets, Smith visibility, Schlick Fresnel, linearized color, bounded shader domains, filmic exposure and gamma. This uses familiar rendering equations described in the [Khronos glTF material reference](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#appendix-b-brdf-implementation), without claiming glTF conformance or measured physical optics.
- Shared world-space Sun direction for lighting and a bounded 1024×1024 packed-depth map, filtered with 3×3 percentage-closer comparisons. The depth/main passes share the same submitted models; light bounds cover every component. Recorded eclipse attenuates the key and disables its shadow pass. Analytic Earth fill/reflections remain artistic.
- Optional shadow resources and fragment precision are capability checked. Incomplete framebuffer, shadow shader failure, missing image APIs or failed uploads preserve rendering. Devices without adequate fragment highp skip shadows and derivative bump reconstruction. Without derivatives, geometric folds/material color remain; ordinary WebGL failure retains the original 2D fallback.
- Existing API and schematic defaults, direct exterior/cutaway selector, labels, camera presets/reset/zoom/keyboard, replay, overlays, exploded view, 2D and all seven workspaces remain. Thermal/power maps keep their telemetry colors, without photographic color contamination. Only existing state indicators change from telemetry; panel textures are not a power measurement.

## Executed evidence

Baseline: **145 tests pass** in 6.735 s. The new local material/model route assertion was first observed failing with HTTP 404, then passed after the exact static routes and helper script order were added. The server retains its explicit allowlist, same-origin policy and security headers.

Final frozen implementation regression: **148 tests pass** in 8.331 s, including the existing engineering, assurance, campaign, observation, offline-contract and production-JavaScript checks. The final geometry color adjustment also passes its focused geometry and syntax checks; it changes no geometry or simulation state. Python compilation, JavaScript syntax and whitespace checks pass. The final extracted-archive suite is recorded separately in the ZIP's adjacent `.verification.json`, along with archive SHA-256 and commit identity.

New geometry checks cover deterministic finite nondegenerate triangles, unit normals, cached allocations, bounded exterior framing, immutable inputs and state-driven marker behavior. New renderer boundary checks cover texture completeness/mipmaps/resource reuse, identical depth/main transforms, light coverage, material selection, eclipse, missing/incomplete resources, shader/upload failures, mediump fallback, context loss and the actual detailed-model integration. These synthetic adapters do not compile GLSL; native browser checks separately confirm actual shaders and appearance. Independent review found a mediump bump-gradient risk; highp gating and a safe fallback floor resolve it, with a capability regression. No remaining actionable review findings.

Numerical preservation: [16 complete canonical report hashes](../examples/satellite_surface_preservation.json) exactly match the committed pre-graphics reports for seeds 7, 11, 19 and 23, across `none`, `basic`, `enhanced` and `assured`. This covers telemetry, events, decisions, metrics and provenance for those cases, not all possible scenarios or scientific validation.

Native local browser evidence:

- Actual detailed exterior and both textures render; canvas reports `modelDetail=detailed`, `renderMaterials=textured`, `renderShadows=mapped` in sunlight. No captured browser warnings/errors.
- Front preset, keyboard rotation, reset and zoom work. Thermal/power/exploded inspection select the retained schematic; choosing exterior restores materials. The 2D view hides/restores inspection controls. Play/pause and rewind work.
- At T+81:00, recorded eclipse shows 0 W solar, 47.6% battery, 304.1 K and 5° pointing error; the shadow pass is disabled. This is recorded state, not a new orbital solver.
- Desktop 1280×900: document width 1280, canvas 687×365. Phone 320×760: document width 320, canvas 296×340. Full arrays fit both; viewport override is reset after testing. Screenshots are local verification artifacts under `artifacts/satellite-surface-desktop.png` and `artifacts/satellite-surface-mobile.png`, excluded from the source archive.

Reproduce from the repository root:

```sh
python3 -m unittest discover -s tests -q
node tests/frontend-materials.test.cjs
node tests/scene-model.test.cjs
node --check spacecraft_lab/web/scene.js
node --check spacecraft_lab/web/scene-model.js
python3 -m spacecraft_lab.control_center --port 8014
```

Python runtime is standard library only. Node enables the frontend regression harnesses; they are skipped if unavailable. HTTP tests need permission to bind temporary loopback sockets. Open `http://127.0.0.1:8014/`, choose **Digital twin**, then rotate/select inspection modes.

## Limits

This is an illustrative engineering visualization, not a measured spacecraft CAD model. Dimensions, mounts, aperture, harness routing and deployed geometry are authored for visual plausibility. The exterior's four panels and historical schematic's six panels do not alter configured array capacity. Pointing error retains an illustrative yaw proxy; no full attitude quaternion, ephemeris or propagated Earth position is introduced.

Generated material maps contain baked tonal detail and are not measured albedo, normal, roughness or spectral response. Sun intensity, analytic environment, exposure, reflectance and bump strength are artistic parameters. Shadows are finite-resolution raster comparisons, not ray tracing or calibrated solar flux/thermal occlusion; their result does not feed the simulation. Recessed glass does not simulate telescope images or infer object substances. Actual appearance was checked on this browser/GPU, not every WebGL device. No flight certification, physical-model improvement or AI advantage is claimed.
