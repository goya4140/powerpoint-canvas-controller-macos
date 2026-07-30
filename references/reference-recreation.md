# Reference Recreation Specification

## Goal

Recreate a supplied academic figure as editable PowerPoint objects while preserving its observable visual structure and technical reading order.

The target is structural and stylistic fidelity, not pixel-level copying of protected photographs, illustrations, or textures.

## Decomposition order

Analyze the reference in this order:

1. **Canvas**: aspect ratio, background, and usable figure bounds.
2. **Regions**: panels, stages, lanes, comparison columns, or inset areas.
3. **Primary modules**: the largest boxes, model blocks, inputs, outputs, and contribution modules.
4. **Connectivity**: reading order, arrows, feedback paths, skip connections, and branch semantics.
5. **Repeated motifs**: tokens, layers, network nodes, image stacks, blocks, or examples.
6. **Typography**: title hierarchy, label sizes, weight, alignment, and line breaks.
7. **Visual tokens**: fills, strokes, dash patterns, corner radius, and semantic color roles.
8. **Detail budget**: preserve details that define the silhouette or technical meaning; simplify incidental pixels.

Do not start by tracing every small object. Match the global silhouette first.

## Scene format

Every benchmark case declares:

```json
{
  "id": "venue-paper-figure",
  "venue": "ICLR",
  "year": 2024,
  "paper_title": "Paper title",
  "figure": "Figure 2",
  "paper_url": "https://...",
  "reference": "../../docs/benchmark/references/case.png",
  "reference_crop": {
    "left": 0.02,
    "top": 0.10,
    "right": 0.02,
    "bottom": 0.20
  },
  "reconstruction_logic": "One sentence explaining the visual decomposition.",
  "canvas": {
    "width": 1200,
    "height": 600
  },
  "background": "#FFFFFF",
  "elements": []
}
```

Coordinates use canvas pixels. Important objects require stable lowercase names such as:

```text
panel.training
module.visual-encoder
tokens.prompt
arrow.encoder-to-decoder
label.feedback
```

## Primitives

### `shape`

Use for a single native PowerPoint shape.

```json
{
  "type": "shape",
  "name": "module.predictor",
  "geometry": "trapezoid",
  "x": 870,
  "y": 205,
  "w": 235,
  "h": 235,
  "fill": "#7EC3D8",
  "stroke": "#7EC3D8",
  "rotation": 90,
  "text": "Predictor",
  "fontSize": 30,
  "bold": true
}
```

Supported geometry includes rectangles, rounded rectangles, ellipses, diamonds, triangles, trapezoids, parallelograms, chevrons, hexagons and cylinders.

Set `"layer": "background"` for a filled region that must remain behind connectors.

### `text`

Use for independent labels and titles.

```json
{
  "type": "text",
  "name": "label.search-space",
  "x": 480,
  "y": 557,
  "w": 240,
  "h": 30,
  "text": "Search Space",
  "fontSize": 19,
  "bold": true
}
```

### `connector`

Use when the arrow must stay attached to two named shapes.

```json
{
  "type": "connector",
  "name": "arrow.input-to-model",
  "from": "input.image",
  "to": "module.model",
  "fromSide": "right",
  "toSide": "left",
  "kind": "straight"
}
```

Connectors are raised above background panels, then endpoint modules and labels are returned to the foreground.

### `line`

Use for exact-position lines, feedback paths, separators, and arrows that do not attach to named modules.

```json
{
  "type": "line",
  "name": "feedback.return",
  "x1": 1095,
  "y1": 490,
  "x2": 275,
  "y2": 490,
  "stroke": "#E31B23",
  "strokeWidth": 4,
  "arrowEnd": "arrow"
}
```

### `stack`

Use for offset cards, images, rationales, or repeated modules.

```json
{
  "type": "stack",
  "name": "images.training",
  "geometry": "rect",
  "x": 35,
  "y": 155,
  "w": 120,
  "h": 84,
  "count": 3,
  "dx": 0,
  "dy": 105,
  "fills": ["#B5D2E6", "#D5E5B5", "#E4C7B7"]
}
```

### `tokens`

Use for regular token, block, cell, or layer grids.

```json
{
  "type": "tokens",
  "name": "tokens.prompt",
  "x": 320,
  "y": 235,
  "w": 250,
  "h": 34,
  "rows": 1,
  "cols": 5,
  "gapX": 8,
  "fills": ["#D7E8F2", "#B5D9A7"]
}
```

### `network`

Use for a small editable node-edge topology. Node coordinates are normalized inside the element box.

## Mandatory loop

1. Record source metadata and copy a low-resolution research reference.
2. Set the crop that isolates the actual Figure.
3. Write one sentence describing the reconstruction logic.
4. Recreate the large-scale silhouette with regions and primary modules.
5. Add connectors and verify direction.
6. Add repeated motifs only after the silhouette matches.
7. Validate the manifest.
8. Generate PPTX, PNG, layout JSON, and comparison PNG.
9. Inspect every recreation at full size.
10. Run layout and overflow checks.
11. Revise the spec rather than applying untracked edits to the output deck.

## Fidelity rubric

Review each case on five axes:

| Axis | Question |
|---|---|
| Topology | Are the same regions, modules, branches, and feedback paths present? |
| Geometry | Are major sizes, alignments, whitespace, and silhouettes comparable? |
| Style | Are palette, stroke, corner, and type hierarchy similar? |
| Detail | Are repeated motifs and distinguishing small structures represented? |
| Editability | Are important modules independent native objects with stable names? |

Topology and geometry are blocking. Style and detail are iterative. Editability is mandatory.

## Copyright boundary

Reference images are evaluation inputs, not reusable assets. Do not copy protected photos, characters, icons, or illustrations into the recreation. Replace them with neutral editable placeholders when the visual role can be preserved without copying the asset itself.
