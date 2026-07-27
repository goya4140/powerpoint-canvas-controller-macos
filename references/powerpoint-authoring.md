# PowerPoint Authoring Rules

## Object policy

Prefer editable native objects in this order:

1. PowerPoint shapes, text boxes, and connectors;
2. editable SVG icons;
3. raster content only where pixels are semantically necessary.

Never use a full-slide rasterization as the primary deliverable.

## Stable names

Name important objects with lowercase dot-separated identifiers:

```text
module.encoder
module.fusion
module.fusion.attention
label.fusion
arrow.encoder-to-fusion
group.multi-scale-features
callout.proposed
```

Use IDs from the Level 1 semantic graph. Add upgrade placeholders as `slot.<node-id>.<asset-slot>` and keep the corresponding module name stable when an icon later replaces or enters it.

Use stable semantic names instead of coordinates or generated indices. Add a short numeric suffix only for genuinely repeated elements, such as `token.prompt.01`.

## Layers and connectors

- Put background regions first.
- Put connectors behind nodes and labels.
- Attach connectors to shape connection sites instead of drawing detached lines.
- Use elbow connectors for orthogonal routing and straight connectors for simple adjacent stages.
- Keep arrow meaning stable throughout the page.

## Grouping

Group elements that should move as one conceptual component, but do not create one giant group for the full figure. Keep major modules independently selectable.

## Incremental editing

Inspect before editing. Locate an object by stable name, render the affected slide, apply the smallest change, re-render, and re-inspect. Preserve the input PPTX unless the user explicitly requests an in-place edit.

## Multi-page roles

Use working pages for alternatives and components, but keep the `FINAL` or `EXPORT` page free of production commentary. Store reusable mini-elements on a dedicated `COMPONENTS` page or in `assets/component-library.pptx`.

For Level 1 decks use `BRIEF`, `WIREFRAME-<LAYOUT>`, and `SELECTED-<LAYOUT>` roles. Do not create a selected page before the user confirms a layout unless the user explicitly requests a one-pass result.
