---
name: control-powerpoint-canvas-macos
description: Create, recreate, revise, inspect, validate, save, or export editable Microsoft PowerPoint slides on macOS through the native PowerPoint JavaScript API and a local MCP bridge. Use when the user wants live visible drawing in desktop PowerPoint for Mac, asks for an editable PPT/PPTX figure or slide with text, shapes, arrows, managed connectors, groups, or pictures, rejects OS mouse or keyboard automation, requests paced step-by-step construction, or needs PNG/PDF previews rendered from the active PowerPoint document.
---

# Control PowerPoint Canvas on macOS

Operate PowerPoint only through the `powerpoint-live` and `powerpoint-file-utils` MCP tools. On macOS, keep the **PowerPoint Canvas Bridge** task pane open so the MCP server can execute commands through Microsoft's supported PowerPoint JavaScript API. Keep text, shapes, managed connectors, groups, and pictures as native editable objects.

## Prepare macOS

1. Run `npm install` once in the plugin root.
2. Run `npm run setup:macos`.
3. Restart PowerPoint, open a presentation, and choose **Home → Add-ins → PowerPoint Canvas Bridge**. Keep the bridge closed in other presentations.
4. Call `powerpoint_live_status`. If no bridge is connected, do not create a second presentation; ask the user to open the task pane.

The bridge listens only on `127.0.0.1`. It does not use mouse or keyboard automation. macOS connectors are managed line objects: moves made through `powerpoint_live_update_shape` reroute them, while arbitrary manual moves in the PowerPoint UI require an explicit reroute or redraw.

## Workflow

1. Call `powerpoint_live_status` before creating anything.
2. Reuse the active or explicitly named presentation whenever possible. Do not create multiple test or work presentations. Call `powerpoint_live_new_presentation` only when no suitable target exists or the user asks for a new deck.
3. Treat slide coordinates as points. Read the actual slide width and height from status or inspection before laying out objects.
4. Build one logical region at a time with stable unique names. Prefer `powerpoint_live_draw_sequence` with `step_delay_ms: 100` for visible paced drawing.
5. Use managed connectors when arrows should follow objects moved through MCP. Use straight lines for exact fixed geometry.
6. After each logical region, call `powerpoint_live_screenshot` and `powerpoint_live_inspect`; correct overlap, crooked arrows, weak information density, and text balance before continuing.
7. Before delivery, call `powerpoint_file_validate` to catch off-slide objects, then inspect the screenshot for text fit. The current macOS API does not expose reliable text-overflow metrics.
8. Save the editable `.pptx`, then export the requested PNG/JPG/PDF through PowerPoint. Use width 2000 px for a final PNG unless the user specifies another size.

## Editing rules

- Preserve user content and unrelated open presentations.
- Never clear a slide without `confirm: true` and clear user intent.
- Do not close a user presentation unless the user asks. `powerpoint_live_close_presentation` exists mainly for a precisely named temporary presentation.
- Avoid filler micro-labels added merely to cover empty space. Increase density through stronger core objects, larger useful text, tighter layout, and meaningful relationships.
- Keep images as independent picture objects. Do not bake editable text, arrows, or labels into a raster image.
- Use `powerpoint_live_update_shape` for targeted changes; it changes only supplied properties.
- Keep object names semantic, such as `stage2_reward_model`, `cot1_card`, or `arrow_encoder_to_llm`.

## Tool selection

- Live construction or revision: `powerpoint-live` tools.
- Read-only file inventory or overflow checks: `powerpoint_file_inspect` and `powerpoint_file_validate`.
- Deliverables: `powerpoint_file_save`, `powerpoint_file_export_slide`, and `powerpoint_file_export_pdf`.
- For detailed operation fields and batch examples, read [tool-reference.md](references/tool-reference.md).
