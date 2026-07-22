#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  boolean, integer, mcpPayload, number, runBridge, serve, string,
} from "./mcp-common.mjs";

const SERVER_NAME = "powerpoint-live";
const SERVER_VERSION = "1.0.0";

const targetProperties = {
  presentation_path: string("Optional full path of an already-open presentation. Omit to use the active presentation."),
  slide_index: integer("1-based slide index. Omit to use the active or first slide.", { minimum: 1 }),
};

const geometry = {
  x: number("Left coordinate in PowerPoint points."),
  y: number("Top coordinate in PowerPoint points."),
  width: number("Width in points.", { exclusiveMinimum: 0 }),
  height: number("Height in points.", { exclusiveMinimum: 0 }),
};

const textStyle = {
  text: string("Editable text content."),
  font_name: string("Font family, for example Aptos or Arial."),
  font_size: number("Font size in points.", { minimum: 1, maximum: 300 }),
  font_color: string("Text color as #RRGGBB."),
  bold: boolean("Use bold text."),
  italic: boolean("Use italic text."),
  align: string("Horizontal alignment.", { enum: ["left", "center", "right"] }),
  vertical_align: string("Vertical alignment.", { enum: ["top", "middle", "bottom"] }),
  margin: number("All text-frame margins in points.", { minimum: 0 }),
  margin_left: number("Left text margin in points.", { minimum: 0 }),
  margin_right: number("Right text margin in points.", { minimum: 0 }),
  margin_top: number("Top text margin in points.", { minimum: 0 }),
  margin_bottom: number("Bottom text margin in points.", { minimum: 0 }),
};

const boxStyle = {
  fill_visible: boolean("Whether the fill is visible."),
  fill_color: string("Fill color as #RRGGBB."),
  fill_transparency: number("Fill transparency from 0 to 1.", { minimum: 0, maximum: 1 }),
  line_visible: boolean("Whether the outline is visible."),
  line_color: string("Outline color as #RRGGBB."),
  line_width: number("Outline width in points.", { minimum: 0, maximum: 50 }),
  dashed: boolean("Use a dashed outline."),
};

const lineStyle = {
  color: string("Line color as #RRGGBB."),
  width: number("Line width in points.", { minimum: 0, maximum: 50 }),
  dashed: boolean("Use a dashed line."),
  start_arrow: string("Start arrow style.", { enum: ["none", "triangle"] }),
  end_arrow: string("End arrow style.", { enum: ["none", "triangle"] }),
};

const tools = [
  {
    name: "powerpoint_live_launch",
    description: "Launch or attach to visible Microsoft PowerPoint through its native COM object model. Optionally open a PPTX, or create a blank editable presentation when none is active.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: string("Optional PPTX file to open visibly."),
        create_if_missing: boolean("Create a blank presentation if none is active; defaults to true."),
        slide_width: number("New-presentation width in points; defaults to 960."),
        slide_height: number("New-presentation height in points; defaults to 540."),
        slide_index: integer("Slide to activate or report.", { minimum: 1 }),
        maximize: boolean("Maximize the PowerPoint window; defaults to true."),
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_status",
    description: "Report the visible PowerPoint session, active presentation, slide size, slide index, and editable object count.",
    inputSchema: { type: "object", properties: targetProperties, additionalProperties: false },
  },
  {
    name: "powerpoint_live_new_presentation",
    description: "Create a new visible blank PowerPoint presentation with editable slides.",
    inputSchema: {
      type: "object",
      properties: {
        slide_width: number("Slide width in points; defaults to 960.", { exclusiveMinimum: 0 }),
        slide_height: number("Slide height in points; defaults to 540.", { exclusiveMinimum: 0 }),
        slides: integer("Number of blank slides; defaults to 1.", { minimum: 1, maximum: 100 }),
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_add_slide",
    description: "Add a blank editable slide to the active presentation.",
    inputSchema: {
      type: "object",
      properties: { presentation_path: targetProperties.presentation_path, index: integer("1-based insertion index; defaults to the end.", { minimum: 1 }) },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_add_shape",
    description: "Add one editable native PowerPoint shape directly to the visible slide.",
    inputSchema: {
      type: "object",
      required: ["name", "x", "y", "width", "height"],
      properties: {
        ...targetProperties, name: string("Stable unique shape name."),
        shape_type: string("Native shape kind.", { enum: ["rectangle", "rounded", "ellipse", "triangle", "diamond", "hexagon", "parallelogram", "cloud"] }),
        ...geometry, ...boxStyle, ...textStyle,
        rotation: number("Clockwise rotation in degrees."),
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_add_text",
    description: "Add one editable native PowerPoint text box with no fill or outline by default.",
    inputSchema: {
      type: "object",
      required: ["name", "text", "x", "y", "width", "height"],
      properties: { ...targetProperties, name: string("Stable unique text-box name."), ...geometry, ...textStyle, ...boxStyle, rotation: number("Clockwise rotation in degrees.") },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_add_line",
    description: "Add one editable native straight line or arrow using exact point coordinates.",
    inputSchema: {
      type: "object",
      required: ["name", "x1", "y1", "x2", "y2"],
      properties: {
        ...targetProperties, name: string("Stable unique line name."),
        x1: number("Start x coordinate."), y1: number("Start y coordinate."), x2: number("End x coordinate."), y2: number("End y coordinate."), ...lineStyle,
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_add_connector",
    description: "Add an editable native PowerPoint connector between two named shapes. PowerPoint keeps the connector attached when either shape moves.",
    inputSchema: {
      type: "object",
      required: ["name", "source", "target"],
      properties: {
        ...targetProperties, name: string("Stable unique connector name."), source: string("Source shape name."), target: string("Target shape name."),
        connector_type: string("Connector geometry.", { enum: ["straight", "elbow", "curve"] }),
        source_site: integer("PowerPoint connection-site index; defaults to 1.", { minimum: 1 }),
        target_site: integer("PowerPoint connection-site index; defaults to 1.", { minimum: 1 }),
        x1: number("Initial start x; optional."), y1: number("Initial start y; optional."), x2: number("Initial end x; optional."), y2: number("Initial end y; optional."), ...lineStyle,
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_add_picture",
    description: "Insert an image as an independent editable PowerPoint picture object. The source image is not flattened with text or arrows.",
    inputSchema: {
      type: "object",
      required: ["name", "path", "x", "y"],
      properties: { ...targetProperties, name: string("Stable unique picture name."), path: string("Full local image path."), x: geometry.x, y: geometry.y, width: number("Width in points; omit to preserve native size."), height: number("Height in points; omit to preserve native size."), rotation: number("Clockwise rotation in degrees.") },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_update_shape",
    description: "Update an existing editable PowerPoint object in place. Only explicitly supplied properties change.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        ...targetProperties, name: string("Existing shape name."), new_name: string("Optional replacement name."),
        ...geometry, rotation: number("Clockwise rotation in degrees."), ...boxStyle, ...textStyle,
        z_order: string("Move object to front or back.", { enum: ["front", "back"] }),
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_delete_shape",
    description: "Delete one named object from the visible PowerPoint slide.",
    inputSchema: { type: "object", required: ["name"], properties: { ...targetProperties, name: string("Shape name to delete.") }, additionalProperties: false },
  },
  {
    name: "powerpoint_live_group_shapes",
    description: "Group two or more named PowerPoint objects while keeping the group editable.",
    inputSchema: {
      type: "object",
      required: ["name", "names"],
      properties: { ...targetProperties, name: string("Unique group name."), names: { type: "array", minItems: 2, maxItems: 500, items: { type: "string" } } },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_draw_sequence",
    description: "Execute a visible sequence of shape, text, line, connector, picture, update, delete, and wait operations. Each operation is a separate COM edit with a default 100 ms delay.",
    inputSchema: {
      type: "object",
      required: ["operations"],
      properties: {
        ...targetProperties,
        operations: { type: "array", minItems: 1, maxItems: 1000, items: { type: "object", description: "Operation with type: shape, text, line, connector, picture, update, delete, or wait." } },
        step_delay_ms: integer("Delay after each operation; defaults to 100 ms.", { minimum: 0, maximum: 10000 }),
        screenshot_after: boolean("Return a PowerPoint-rendered PNG after the batch; defaults to false."),
        screenshot_width_px: integer("Screenshot width; defaults to 1600.", { minimum: 100, maximum: 10000 }),
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_clear",
    description: "Remove every object on the target slide. This is destructive and requires confirm=true.",
    inputSchema: { type: "object", required: ["confirm"], properties: { ...targetProperties, confirm: boolean("Must be true.") }, additionalProperties: false },
  },
  {
    name: "powerpoint_live_close_presentation",
    description: "Close exactly one target presentation without quitting PowerPoint. Requires confirm=true; save defaults to false.",
    inputSchema: {
      type: "object",
      required: ["confirm"],
      properties: { ...targetProperties, confirm: boolean("Must be true."), save: boolean("Save before closing; defaults to false.") },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_inspect",
    description: "Return a compact inventory of editable objects, geometry, text, fill, line, and z-order from the visible slide.",
    inputSchema: {
      type: "object",
      properties: { ...targetProperties, max_shapes: integer("Maximum objects returned; defaults to 500.", { minimum: 1, maximum: 5000 }), include_text: boolean("Include full text; defaults to true.") },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_live_screenshot",
    description: "Render the target slide through PowerPoint itself and return a PNG for visual inspection.",
    inputSchema: {
      type: "object",
      properties: { ...targetProperties, width_px: integer("PNG width; defaults to 1600.", { minimum: 100, maximum: 10000 }) },
      additionalProperties: false,
    },
  },
];

async function screenshot(args) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppt-live-shot-"));
  const output = path.join(root, "slide.png");
  try {
    const result = await runBridge("export_slide", { ...args, output_path: output, format: "PNG", width_px: args.width_px || args.screenshot_width_px || 1600, overwrite: true, close_after: false });
    const imageData = (await fs.readFile(output)).toString("base64");
    return mcpPayload(result, { imageData, mimeType: "image/png" });
  } finally { await fs.rm(root, { recursive: true, force: true }).catch(() => {}); }
}

async function handleTool(name, args) {
  const map = {
    powerpoint_live_launch: "launch", powerpoint_live_status: "status", powerpoint_live_new_presentation: "new_presentation",
    powerpoint_live_add_slide: "add_slide", powerpoint_live_add_shape: "add_shape", powerpoint_live_add_text: "add_text",
    powerpoint_live_add_line: "add_line", powerpoint_live_add_connector: "add_connector", powerpoint_live_add_picture: "add_picture",
    powerpoint_live_update_shape: "update_shape", powerpoint_live_delete_shape: "delete_shape", powerpoint_live_group_shapes: "group_shapes",
    powerpoint_live_clear: "clear", powerpoint_live_close_presentation: "close_presentation", powerpoint_live_inspect: "inspect",
  };
  if (name === "powerpoint_live_screenshot") return screenshot(args);
  if (name === "powerpoint_live_draw_sequence") {
    const value = await runBridge("batch", args, { timeoutMs: Math.max(120000, (args.operations?.length || 1) * ((args.step_delay_ms ?? 100) + 500)) });
    if (args.screenshot_after) {
      const shot = await screenshot({ presentation_path: args.presentation_path, slide_index: args.slide_index, width_px: args.screenshot_width_px });
      return mcpPayload(value, { imageData: shot.imageData, mimeType: "image/png" });
    }
    return value;
  }
  const action = map[name];
  if (!action) throw new Error(`Unknown tool: ${name}`);
  return runBridge(action, args);
}

serve({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  instructions: "Control only Microsoft PowerPoint through its native COM object model. Use named editable objects and point coordinates. Prefer paced batches at 100 ms, inspect after each logical region, and render screenshots through PowerPoint for correction. Never use OS mouse or keyboard automation.",
  tools,
  handleTool,
});
