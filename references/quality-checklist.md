# Figure Quality Checklist

## Technical meaning

- Every node and edge matches the supplied method description.
- Reading order and arrow direction are unambiguous.
- The claimed contribution receives appropriate visual emphasis.
- Unknown relationships are disclosed rather than invented.
- The delivered graph matches the user-confirmed wireframe, not an earlier candidate.
- Every cycle is encoded as feedback, update, or optional behavior unless the method explicitly defines another cyclic relation.

## Visual quality

- No unintended overlap, clipping, overflow, or text wrapping.
- No connector crosses a label or module interior.
- Alignment, spacing, stroke width, corner radius, and arrowheads are consistent.
- Text remains legible at the intended paper width.
- Color meanings are consistent and remain distinguishable in grayscale.
- Decoration does not compete with technical content.

## PowerPoint structure

- Primary modules are individual editable objects.
- Connectors remain attached when modules move.
- Important objects use stable semantic names.
- Repeated components are grouped sensibly.
- The final figure is not flattened into a bitmap.
- Node, edge, and group object names derive from stable semantic IDs.
- Every declared `asset_slot` remains traceable to exactly one node for later Level 2/3 replacement.

## Level 1 gate

- Two or three structurally distinct wireframes were shown unless the confirmation gate was explicitly skipped.
- The selected layout is recorded in the semantic specification.
- The figure remains understandable after removing all decorative or replacement assets.
- The main reading direction, group boundaries, arrow semantics, and contribution emphasis are visually unambiguous.
- The confirmed figure uses 5–12 primary modules unless a documented exception is necessary.

## Delivery

- Render and inspect every page individually at full size.
- Run the layout checker on exported layout JSON.
- Open or structurally inspect the final PPTX.
- Identify the final paper page and working pages.
- Export the requested PDF, SVG, or PNG and check the exported result when those formats are requested.
