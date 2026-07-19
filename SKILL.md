---
name: draw-in-powerpoint
description: Create, reconstruct, and incrementally edit publication-ready AI research figures as editable PowerPoint objects. Use when Codex must turn Method text, pseudocode, sketches, screenshots, reference figures, or existing PPTX pages into model architecture diagrams, method pipelines, system frameworks, experiment flows, data-flow diagrams, or ablation illustrations; generate alternative wireframes for review; maintain reusable figure components; check academic styling and layout; or export figures for papers.
---

# Draw in PowerPoint

Create research figures as editable PowerPoint shapes, text boxes, and connectors. Treat the slide as a vector drawing canvas, not as a conventional presentation page.

## Route the request

1. Read `references/workflow.md` for every new figure or substantial redesign.
2. Read `references/academic-style.md` when choosing typography, color, density, or paper sizing.
3. Read `references/powerpoint-authoring.md` before creating or modifying PPTX objects.
4. Read `references/quality-checklist.md` before final delivery.
5. Use `scripts/create_figure.mjs` only for a left-to-right pipeline matching its input contract. For other topologies, author a task-specific Artifact Tool script using the same naming and QA rules.

## Follow the structure-first workflow

1. Extract a Figure Brief: communication goal, audience, inputs, outputs, modules, edges, hierarchy, emphasized contribution, target width, and requested format.
2. Convert the brief into a semantic graph before drawing. Never invent missing technical relationships; label uncertain relationships and ask only when the ambiguity changes the figure materially.
3. Create two or three low-fidelity wireframes using only containers, module labels, and primary connectors.
4. Present the alternatives and recommend one using explicit tradeoffs. Pause for user confirmation unless the user requests a one-pass result or the figure is trivial.
5. Refine the selected wireframe. Add internal components, annotations, color semantics, and reusable mini-elements only after the structure is confirmed.
6. Render every slide and inspect it at full size and at intended paper size.
7. Inspect the PPTX object structure and confirm that primary elements remain individually editable.
8. Apply follow-up requests incrementally. Preserve unrelated objects and stable object names.

## Organize multi-page working decks

Use slide names or visible role labels consistently:

- `BRIEF`: figure goal and semantic graph.
- `WIREFRAME-A`, `WIREFRAME-B`, `WIREFRAME-C`: competing structural alternatives.
- `SELECTED`: confirmed structure.
- `FINAL`: publication-oriented composition.
- `COMPONENTS`: reusable mini-elements.
- `QA`: optional size, grayscale, or comparison checks.
- `EXPORT`: final crop or paper-sized version.

Do not place production notes on a page intended for publication.

## Preserve editability

- Prefer native PowerPoint shapes, text boxes, and connectors.
- Use SVG for a complex reusable icon only when native shapes would be fragile.
- Use raster images only for inherently raster content such as example inputs or heatmaps.
- Never flatten the entire figure into one image.
- Name important objects using the conventions in `references/powerpoint-authoring.md`.
- Create connectors before nodes when practical; otherwise rerun the final authoring pass so connectors are behind nodes.

## Use bundled resources

- Run `scripts/create_figure.mjs --spec <json> --out <pptx> --preview-dir <dir>` to produce the supported pipeline prototype.
- Run `scripts/check_layout.mjs --layout-dir <dir>` after exporting Artifact Tool layout JSON.
- Start from `assets/example-spec.json` when preparing a pipeline specification.
- Reuse `assets/component-library.pptx` only as a source of editable elements; copy components rather than flattening them.

## Deliver

Return the editable PPTX and a rendered preview. State which slide is the final paper figure and which pages are working material. Mention any unresolved technical ambiguity or export limitation.
