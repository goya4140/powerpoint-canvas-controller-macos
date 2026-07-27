# PowerPoint Canvas Tool Reference

On macOS, the MCP surface matches the upstream Windows tool contract. Shapes, text boxes, lines, groups, updates, inspection, and exports run through the PowerPoint JavaScript API. Connectors are managed lines rather than COM-attached connectors; moves performed through MCP reroute them.

## Coordinates and colors

- Coordinates and sizes use PowerPoint points (`72 pt = 1 inch`).
- A common 16:9 canvas is `960 x 540` points.
- Colors accept `#RRGGBB`.
- Object names must be unique within a slide.

## Batch operation types

`powerpoint_live_draw_sequence` accepts these `operations[].type` values:

- `shape`: accepts the same fields as `powerpoint_live_add_shape` except presentation targeting.
- `text`: accepts the same fields as `powerpoint_live_add_text`.
- `line`: fixed `x1`, `y1`, `x2`, `y2` line or arrow.
- `connector`: named `source` and `target`, with `straight`, `elbow`, or `curve` geometry.
- `picture`: independent image object from a full local path.
- `update`: `name` plus only the properties to change.
- `delete`: deletes one named object.
- `wait`: pauses for `ms` without editing.

Example:

```json
{
  "step_delay_ms": 100,
  "operations": [
    {
      "type": "shape",
      "name": "input_card",
      "shape_type": "rounded",
      "text": "Input",
      "x": 80,
      "y": 180,
      "width": 210,
      "height": 90,
      "fill_color": "#EEF4FC",
      "line_color": "#17345B",
      "font_size": 20,
      "bold": true
    },
    {
      "type": "shape",
      "name": "model_card",
      "text": "Model",
      "x": 380,
      "y": 180,
      "width": 210,
      "height": 90
    },
    {
      "type": "connector",
      "name": "input_to_model",
      "source": "input_card",
      "target": "model_card",
      "connector_type": "straight",
      "end_arrow": "triangle"
    }
  ]
}
```

## Screenshots and deliverables

- `powerpoint_live_screenshot` returns a PNG image block rendered by PowerPoint.
- `powerpoint_file_export_slide` exports PNG/JPG at an exact pixel width and can return a PNG image block with `include_image: true`.
- `powerpoint_file_save` saves the active presentation or uses `output_path` for a new `.pptx`.
- `powerpoint_file_export_pdf` exports the whole presentation as PDF.

## Safe file behavior

- Inspection and validation open an explicitly named file read-only and close it by default.
- Existing output files require `overwrite: true`.
- Clearing a slide and closing a presentation require `confirm: true`.
