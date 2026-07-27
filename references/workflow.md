# Interactive Level 1 Figure Workflow

## 1. Build the Figure Brief

Capture only information that changes the drawing:

- one-sentence message and intended reader;
- input, output, modules, and named contributions;
- directed edges, branches, loops, skip connections, and hierarchy;
- system boundaries, lanes, shared resources, and external components;
- target single-column, double-column, full-page, or presentation size;
- required notation, delivery formats, and whether an existing PPTX must be preserved.

Represent uncertainty explicitly. Do not silently turn textual order into causality or invent an unmentioned training branch.

## 2. Encode the semantic graph

Use the schema in `level-1-grammar.md`. Separate technical roles from eventual shapes and assets. Assign stable IDs before positioning nodes.

Record upgrade hints with `asset_slot`, but do not add the assets during Level 1 generation.

## 3. Validate before drawing

Run:

```bash
node scripts/validate_level1_spec.mjs --spec <json>
```

Resolve unknown node references, duplicate IDs, invalid cycles, excessive label length, and missing layout metadata before opening the drawing canvas.

## 4. Generate structural alternatives

Choose two or three layouts from `layout-patterns.md`. Prefer candidates that answer different structural questions:

- pipeline versus swimlane;
- pipeline versus contribution-first hierarchy;
- hub-spoke versus loop-oriented flow.

Do not present cosmetic variants as alternatives.

Render-screen every candidate before showing it. Discard a layout if spatial order implies a technical sequence that is absent from the semantic graph, especially when a pipeline interleaves multiple independent sources or branches.

## 5. Double check with the user

Ask the user to confirm:

- technical direction and reading order;
- missing, merged, or incorrectly split modules;
- primary contribution and relative emphasis;
- system boundaries and shared resources;
- selected layout and intended paper width.

Keep `selected_layout` absent until confirmation. If the user changes the method graph, regenerate all affected wireframes.

## 6. Refine the confirmed Level 1 figure

Add detail in this order:

1. main containers and connectors;
2. concise labels and notation;
3. internal repeated primitives;
4. restrained semantic color;
5. callouts and legends only when necessary;
6. object grouping, stable naming, and asset-slot metadata.

Prefer one strong hierarchy over equally prominent boxes.

## 7. Validate at paper size

Render the confirmed slide at full size and target paper width. Check connectors, text wrapping, whitespace, grayscale, object editability, and slide bounds. Fix the source script or semantic spec and rerender; do not patch only the preview image.

## 8. Upgrade without structural drift

For Level 2, replace declared `asset_slot` values with small reusable icons while preserving coordinates and connectors. For Level 3, retain the confirmed graph as a comparison layer and require user approval for any composition change caused by illustration scale.
