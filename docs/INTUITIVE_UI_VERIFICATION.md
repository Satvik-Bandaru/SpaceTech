# Intuitive UI verification — 2026-10-31

Baseline `17982de`; branch `feature/intuitive-mission-ui`. The user's request refines the established mission-console interface and graphics. No backend model, safety kernel, workflow, database, campaign evaluation, contract or other repository changed. No deployment or new runtime dependency.

## Changes

- Readable text, higher contrast, clearer spacing and one prominent Run scenario action. Six workspaces are separated from in-page shortcuts and saved history.
- One original 3D/2D button pair, with accurate pressed state. Existing camera reset/zoom controls remain visible; presets, overlays and explosion use a native Inspection settings disclosure. All original IDs/nodes/handlers are retained.
- Detailed subsystem telemetry opens when a subsystem is selected. Model assumptions and illustrative-geometry details remain accessible. Label visibility works in both 2D and 3D.
- Saved replay identity includes its actual label and seed; the irrelevant standard strategy selector is hidden and returns when standard experiments resume. Seed metadata is not repeated.
- Ordinary wheel gestures scroll the page over the spacecraft. Ctrl/Command-wheel zooms; +/- and keyboard controls remain. 2D/context-loss fallback synchronizes selection state.
- Softer local vector Earth/cloud/atmosphere layers, material-specific metallic/solar/foil highlights and smooth analytic dish normals. Recorded state, illumination, camera framing, thermal/power overlays and explosion geometry remain authoritative.
- The previous compressed presentation stylesheet is replaced with readable scoped rules to remove conflicting tiny-font overrides and make further UI maintenance practical.

## Evidence

Baseline: **113 tests passed**. Final root regression: **113 tests passed in 11.019 seconds**. All browser JavaScript syntax and diff-whitespace checks pass. Protected engine/assurance/campaign/contract paths have no differences from baseline.

```bash
python3 -m unittest discover -s tests -q
node --check spacecraft_lab/web/mission-control.js
node --check spacecraft_lab/web/scene.js
git diff --check
```

Extended connected-tree shell tests cover reused view controls, direct reset access, native disclosure placement, original node/handler preservation, pressed-state semantics, actual replay identity, restoration of standard selection, no duplicated seed metadata, visible subsystem feedback and accessible decision selection. Frontend integration exercises synchronization through the actual 2D/fallback function. GPU-boundary tests exercise smooth dish normals and ordinary versus modified wheel handling. New behavior checks were observed failing before implementation and passing afterward.

Native browser verification:

- Desktop 1680×1050, tablet 768×1024 and compact 390×844; additionally checked 320-pixel width. Document width equals viewport width at every checked size; no duplicate runtime IDs. All 140 original HTML IDs remain.
- Actual overlay/preset/explosion/reset controls, 2D/3D switching, disclosures, subsystem feedback and default page scrolling over the scene.
- Restored assurance job `42908b566f7849b4aca6fad35137c218`: correct saved replay identity, hidden unrelated standard selector, seven recorded roles and recorded end-of-run telemetry.
- Restored 24-case campaign `acdacdec56904722ab0303654192f457`; selected variant/seed/assured case replays correctly. Standard policy comparison restores the selector. Fault editor, research workspace and compact fault form remain accessible.
- No new browser console warnings/errors in final clean-reload checks. Screenshots: `artifacts/intuitive-ui-{desktop,tablet,compact,full}.jpg`.

## Limits

Graphics are illustrative, with screen-space readouts rather than physical sensor locations. No new orbit propagation, hardware fidelity, thermal nodes, AI provider, physics or flight-certification claim. The health ring still counts four defined checks, not a reliability probability. Tests validate UI/implementation consistency; visual quality was reviewed in the native browser. Historical statistical/engineering limitations remain in the existing model documentation.
