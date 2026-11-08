# Satellite material assets

These two PNGs are AI-generated illustrative material color maps for the local synthetic satellite visualization. They are not measured optical properties, a validated BRDF, flight hardware documentation, or a scientific model of Kapton or solar-cell response. Lighting, surface normals, geometry, cell contacts and shadows are supplied by the renderer.

## Provenance

- Generated on 2026-11-07 with the built-in `image_gen.imagegen` tool; one independent generation call per material.
- No API key, CLI fallback, external deployment or additional runtime dependency was used.
- Each selected PNG was copied byte-for-byte from its built-in generation output. No cropping, resizing, image editing, recompression, color adjustment, or seam correction was applied.
- Both prompts request 1024 × 1024; the built-in tool returned 1254 × 1254 PNGs, preserved unchanged.
- Seamless tiling is a generation prompt constraint, not a numerical seam-continuity guarantee. Inspect repeated UVs at the chosen texture scale.

| Project asset | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `spacecraft_lab/web/mli-material.png` | 1254 × 1254 | 2,705,385 | `b70549222b401debde27ae32307d184a256a098b584d6ce0af9186812669c647` |
| `spacecraft_lab/web/solar-material.png` | 1254 × 1254 | 2,033,067 | `9c741f676a8571fb50b64d039d1c6312a974f0c7d0368194901b3ec35feb8c0c` |

Original gold output: `/Users/satvikbandaru/.codex/generated_images/01a1b87b-8ae8-79e2-8793-697c09f42390/exec-e884685f-376f-47d7-bf7d-d28fadad85cd.png`.

Original solar output: `/Users/satvikbandaru/.codex/generated_images/01a1b87b-8ae8-79e2-8793-697c09f42390/exec-8deaea27-1e71-435c-aefe-01f12ab17985.png`.

## Exact gold MLI prompt

```text
Use case: scientific-educational
Asset type: seamless square material color texture for a locally rendered 3D satellite, 1024 by 1024 pixels.
Primary request: a photographic orthographic macro scan of gold spacecraft multilayer insulation (crumpled gold Kapton / aluminized polyimide blanket) filling every pixel.
Composition/framing: flat straight-on view, continuous edge-to-edge material only; seamless tile with naturally matching opposite edges and no visible tile seam.
Materials/textures: warm metallic gold foil with small natural irregular wrinkles, soft shallow creases and fine micro-crumpling at an even scale; realistic organic fold detail, no repeating stamped pattern.
Lighting/mood: neutral, diffuse, spatially consistent illumination suitable as an albedo-like color map; minimize baked lighting and contrast; no large directional shadow or bright white specular hotspot.
Color palette: rich golden amber and restrained darker gold creases, unmistakably gold.
Constraints: this is only a texture swatch, not a spacecraft, not a panel, not an object photograph. Entire image is continuous material. No framing, background, perspective, border, seams, tape, fasteners, labels, logos, text, watermark, circuits, stars, vignette, cast shadows, glare, bloom or white highlights.
```

## Exact solar-cell material prompt

```text
Use case: scientific-educational
Asset type: seamless square material color texture for individual cells on a locally rendered 3D satellite solar array, 1024 by 1024 pixels.
Primary request: a photographic orthographic macro scan of the continuous dark midnight-blue photovoltaic GaAs / silicon-like solar-cell surface material, filling every pixel.
Composition/framing: flat straight-on view, edge-to-edge single uninterrupted semiconductor material; seamless tile with matching opposite edges and no visible tile seam.
Materials/textures: subtle realistic fine crystalline grain, microscopic nonuniformity and restrained blue-violet iridescent variation. Fine-scale texture only, smooth glass-like semiconductor finish with very weak satin reflectance. It must read predominantly as dark midnight navy blue.
Lighting/mood: neutral diffuse even flat lighting, albedo-like and suitable for shading by a 3D renderer; no directional lighting, no white glare, no large bright area, no gradients or vignette.
Color palette: deep navy / midnight blue with very subtle indigo and blue-violet fine-grain variations, strongly darker than gold foil.
Constraints: a continuous material swatch only; the renderer supplies all cell shapes, cut corners, panel grid and metal contacts. No complete solar panel, no cell outline, no grid, no busbars, no contact fingers, no border, no framing, no bevel, no circuits, no wires, no markings, no text, no logos, no watermark, no object, no background, no stars, no cast shadows, no perspective, no glare, no bloom.
```

## Review and use

Visual review of the generated originals confirmed material-only, edge-to-edge texture swatches: gold irregular foil folds and a dark navy semiconductor grain. There is no panel grid, object framing, text, logo, or large white hotspot. Solar-cell outlines, cut corners and fine metal contacts belong in geometry or renderer overlays so the texture does not bake those shapes into every surface. The images retain small local tonal variations and fold highlights from the generation; use them as illustrative color maps, not calibrated physical measurements.

A reproducible integrity check (from the repository root):

```sh
LC_ALL=C shasum -a 256 spacecraft_lab/web/mli-material.png spacecraft_lab/web/solar-material.png
```
