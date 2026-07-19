# Interactive Figure Workflow

## 1. Build the Figure Brief

Capture only information that changes the drawing:

- central message and intended reader;
- input, output, modules, and named contributions;
- directed edges, branches, loops, skip connections, and hierarchy;
- target single-column, double-column, full-page, or presentation size;
- required notation, mathematical symbols, legends, and reference material;
- delivery formats and whether an existing PPTX must be preserved.

Represent uncertainty explicitly. Do not silently turn a textual sequence into a causal edge or infer an unmentioned training branch.

## 2. Create a semantic graph

Use a compact task-local structure such as:

```text
image -> encoder -> fusion -> decoder -> prediction
prompt ----------------^ 
encoder -> {low, mid, high resolution features}
```

Record node roles separately from their eventual shapes. This allows technical corrections without redesigning the page.

## 3. Select candidate layouts

Offer two or three meaningfully different structures:

- **Pipeline:** best for a dominant left-to-right transformation.
- **Layered:** best for hierarchical or multi-resolution processing.
- **Contribution-first:** enlarge the novel module and compress standard context.
- **Swimlane:** separate training/inference or modalities.
- **Overview + inset:** keep the main path simple and explain one dense module in a local inset.

Do not present cosmetic variants as structural alternatives.

## 4. Confirm the wireframe

Ask the user to confirm:

- technical direction and reading order;
- primary contribution and relative emphasis;
- whether to split or merge content;
- which modules need internal detail;
- intended paper width.

Skip confirmation only when explicitly requested or when the task is a tiny local edit.

## 5. Refine progressively

Add detail in this order:

1. main containers and connectors;
2. internal repeated components;
3. labels and mathematical notation;
4. semantic color;
5. callouts, legends, and restrained emphasis;
6. object grouping and stable naming.

Prefer one strong visual hierarchy over a collection of equally prominent boxes.

## 6. Iterate incrementally

Resolve requested objects by stable names. Preserve position, color, and connectors outside the requested scope. If a change affects the global layout, explain the necessary propagation before rebuilding adjacent regions.
