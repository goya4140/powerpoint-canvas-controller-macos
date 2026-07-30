---
name: draw-in-powerpoint
description: Recreate academic paper figures from reference images as editable PowerPoint objects, or build Level 1 semantic figures from Method text. Use when Codex must decompose a supplied paper figure into panels, modules, repeated motifs, typography, colors, and connectors; encode an editable scene specification; generate reference/recreation comparisons; preserve stable object names; validate layout fidelity; or prepare the semantic foundation for later reference-guided and text-only figure generation.
---

# Recreate Academic Figures in PowerPoint

Prioritize the repository's current strict 1 → 1 goal: given one reference figure, reconstruct all visible content, coordinates, typography, colors, and connections as editable PowerPoint objects.

Do not treat the reference as a flat background to trace. Do not rewrite, omit, normalize, simplify, or substitute visible content. Create an explicit inventory/specification that can be validated, revised, regenerated, and compared.

## Route the task

### Reference image supplied

Use the 1 → 1 recreation workflow below.

### Reference image + Method text supplied

The repository is not yet at the 0.5 → 1 stage. First recreate the reference structure, then identify which scene elements are supported or contradicted by the Method text. Do not silently change the technical graph.

### Method text only

Use the legacy Level 1 workflow in `references/workflow.md` and `references/level-1-grammar.md`. Treat the result as a semantic skeleton, not as proof that the 0 → 1 visual-generation problem is solved.

## Load the relevant guidance

For every reference recreation:

1. Read `references/reference-recreation.md`.
2. Read `references/powerpoint-authoring.md`.
3. Read `references/academic-style.md`.
4. Read `references/quality-checklist.md` before delivery.

For Method-only semantic figures, also read:

1. `references/workflow.md`
2. `references/level-1-grammar.md`
3. `references/layout-patterns.md`

## Mandatory 1 → 1 loop

1. Record paper title, venue, year, Figure number, paper URL, and the local research reference.
2. Crop the actual Figure region for comparison without destroying the source image.
3. Decompose the reference in this order:
   - canvas and major regions;
   - primary modules and reading direction;
   - connectors, feedback paths, and skip relations;
   - repeated tokens, layers, image stacks, or network nodes;
   - typography, palette, line weight, radius, and spacing.
4. Write one sentence describing the reconstruction logic.
5. Encode the reconstruction as the Scene Spec in `references/reference-recreation.md`.
6. Use stable object names such as `panel.training`, `module.encoder`, and `arrow.encoder-to-decoder`.
7. Run:

   ```bash
   node scripts/validate_reference_scene.mjs --manifest <manifest.json>
   ```

8. Generate the editable deck, previews, layout JSON, and comparisons:

   ```bash
   node scripts/create_reference_recreation.mjs --manifest <manifest.json>
   ```

9. Inspect every recreation, comparison, overlay, and difference image at full size.
10. Run strict pixel, foreground, edge, text, object-count, anti-underlay, layout, and overflow checks.
11. Revise tracked source inputs and regenerate. A semantic sketch may not be reported as a 1 → 1 pass.

## Fidelity priorities

Resolve mismatches in this order:

1. wrong topology or arrow direction;
2. wrong panel and module silhouette;
3. wrong alignment, spacing, or relative scale;
4. wrong color and typography hierarchy;
5. missing repeated motifs or small details.

Every priority is blocking for strict 1 → 1.

## Editability requirements

- Keep important modules as independent PowerPoint shapes.
- Use attached connectors for semantic relationships.
- Put filled stage and panel regions behind connectors.
- Keep labels above connectors.
- Use native repeated shapes for tokens, blocks, layers, and network nodes.
- Never flatten the full reconstruction into a bitmap.
- A neutral placeholder makes the result a semantic sketch; it cannot pass strict 1 → 1.

## Benchmark support

The strict benchmark is defined by:

- `benchmark/strict/manifest.json`
- `benchmark/strict/*.json`
- `docs/strict-recreation/`

Default commands:

```bash
npm run qa:strict
```

The generated strict deliverables are:

- reference and recreation PNGs;
- a side-by-side comparison;
- a 50% overlay;
- an amplified difference image;
- a JSON machine report.

## Deliver

Return the editable PPTX, rendered recreation, comparison, overlay, difference image, and machine report. Identify the source and reconstruction logic. Any known simplification makes the case a semantic sketch rather than a strict 1 → 1 pass.
