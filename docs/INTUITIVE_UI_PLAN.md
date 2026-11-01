# Intuitive mission UI refinement — 2026-10-31

Baseline: `17982de`, 113 tests passing. Isolated branch: `feature/intuitive-mission-ui`.

The user requests a more intuitive interface and better graphics, preserving the already selected mission-console direction. This is a focused refinement of the current native WebGL/DOM implementation; no framework rewrite, external asset service, runtime dependency, physics, safety or database change.

Implementation choices:

1. Increase useful text/controls to readable sizes, strengthen contrast and spacing, and make Run scenario the primary action. Separate six workspaces from the overview's section shortcuts.
2. Use the existing original 3D/2D controls as the only view toggle; preserve IDs and handlers. Put camera/overlay/exploded options in Inspection settings, keep Reset/Zoom accessible, and give the scene one clear help line.
3. Show actual saved replay name/strategy/seed in the transport; hide the irrelevant disabled standard-policy selector for saved runs. Preserve standard strategy switching.
4. Retain all measurements and reports, while placing secondary model details in a disclosure and reducing repeated metadata. Keep synthetic/illustrative provenance visible.
5. Refine the local SVG scenery and shader materials while preserving state colors, illumination, framing and input behavior.

Verification: add failing shell/interaction checks for view consolidation, state selection and replay provenance; retain node identity/handler coverage; run the entire suite, syntax/whitespace checks, and native browser flows at desktop/tablet/compact widths. Inspect saved assurance and campaign reports; capture actual screenshots. Commit locally without deployment.
