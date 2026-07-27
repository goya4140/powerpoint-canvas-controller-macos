---
name: draw-in-powerpoint
description: Build editable Level 1 academic method figures in PowerPoint from Method text, pseudocode, sketches, semantic graphs, or existing PPTX figures. Use when Codex must design the structural foundation of an AI-paper figure with native shapes, text boxes, containers, and semantic connectors; generate two or three alternative wireframes for user review; refine a confirmed pipeline, hierarchy, swimlane, hub-spoke, loop, or multi-agent layout; preserve stable object names; or prepare semantic asset slots for later Level 2 icon replacement and Level 3 illustration upgrades.
---

# Draw Level 1 Figures in PowerPoint

Treat Level 1 as the editable semantic source of truth for every later visual upgrade. Build a technically correct, readable structure before adding icons or illustrations.

## Load the relevant guidance

1. Read `references/workflow.md` for every new figure or substantial redesign.
2. Read `references/level-1-grammar.md` before defining nodes, edges, groups, or upgrade slots.
3. Read `references/layout-patterns.md` when selecting candidate topologies.
4. Read `references/powerpoint-authoring.md` before creating or editing PPTX objects.
5. Read `references/academic-style.md` when choosing typography, color, density, or paper sizing.
6. Read `references/quality-checklist.md` before delivery.

## Follow the mandatory structure-first loop

1. Extract a Figure Brief: message, audience, input, output, modules, edges, groups, claimed contribution, target width, and technical uncertainties.
2. Encode the brief as the Level 1 semantic specification defined in `references/level-1-grammar.md`. Do not invent a technical edge.
3. Run `scripts/validate_level1_spec.mjs --spec <json>` and resolve every error.
4. Select two or three meaningfully different layouts. Generate wireframes without `selected_layout`:

   ```bash
   node scripts/create_level1_figure.mjs --spec <json> --out <pptx> --preview-dir <dir>
   ```

5. Show all wireframes and ask the user to confirm reading order, module boundaries, contribution emphasis, and the layout choice. Do not interpret silence as approval.
6. Add the confirmed layout as `selected_layout`, rerun the generator, and refine only the selected structure.
7. Render and inspect every page. Run `scripts/check_layout.mjs --layout-dir <dir>` and the presentation overflow checker.
8. Preserve the Level 1 graph and object names during later Level 2/3 work. Replace an `asset_slot`; do not rebuild unrelated structure.

Skip the confirmation gate only when the user explicitly requests one-pass generation or the task is a tiny local edit.

## Enforce Level 1 boundaries

- Use native PowerPoint shapes, text boxes, connectors, and restrained semantic color.
- Use icons only as placeholders when their absence would make a slot ambiguous; keep them out of the confirmed Level 1 output by default.
- Keep one dominant reading direction and 5–12 primary modules.
- Use solid arrows for the main path and dashed arrows for feedback, supervision, optional, or parameter-update relations.
- Keep standard modules compact and give the claimed contribution more area or stronger stroke contrast.
- Split the figure instead of shrinking labels below the intended paper-size readability threshold.
- Never flatten the whole figure into an image.

## Preserve upgradeability

- Name objects with stable dot-separated identifiers such as `module.skill-selector`, `arrow.selector-to-executor`, and `group.agent-core`.
- Assign every node a semantic `type`, `role`, and optional `asset_slot`.
- Preserve node IDs, edge IDs, coordinates, and connectors when upgrading visual treatment.
- Store reusable Level 2/3 assets on a `COMPONENTS` page or in a separate component library; do not contaminate the Level 1 source graph.

## Use bundled resources

- Start from `assets/level1-example-spec.json` for the supported semantic format.
- Use `scripts/validate_level1_spec.mjs` for deterministic graph and constraint validation.
- Use `scripts/create_level1_figure.mjs` for supported Level 1 layouts.
- Treat `scripts/create_figure.mjs` and `assets/example-spec.json` as the legacy pipeline prototype only.
- Use a task-specific Artifact Tool script when the confirmed topology cannot be expressed faithfully by the bundled generator; retain the same schema, naming, and QA gates.

## Deliver

Return the editable PPTX and a rendered preview of the confirmed figure. Identify the working wireframe pages and the confirmed final page. State unresolved technical ambiguity, the selected layout, and which nodes expose `asset_slot` values for later Level 2/3 replacement.
