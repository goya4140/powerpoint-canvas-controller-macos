#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { boolean, integer, mcpPayload, runBridge, serve, string } from "./mcp-common.mjs";

const SERVER_NAME = "powerpoint-file-utils";
const SERVER_VERSION = "1.0.0";

const presentationTarget = {
  presentation_path: string("Full path of a PPTX. Omit only to operate on the active presentation."),
  slide_index: integer("1-based slide index; defaults to the active or first slide.", { minimum: 1 }),
};

const tools = [
  {
    name: "powerpoint_file_inspect",
    description: "Open a PPTX through PowerPoint, inspect native editable objects and geometry, then close it without saving by default.",
    inputSchema: {
      type: "object",
      properties: { ...presentationTarget, max_shapes: integer("Maximum objects returned; defaults to 500.", { minimum: 1, maximum: 5000 }), include_text: boolean("Include full text; defaults to true."), close_after: boolean("Close a file opened for inspection; defaults to true.") },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_file_validate",
    description: "Detect objects outside the supported 16:9 slide bounds. Text-overflow metrics are not exposed by the current PowerPoint JavaScript API.",
    inputSchema: { type: "object", properties: { ...presentationTarget, close_after: boolean("Close a file opened for validation; defaults to true.") }, additionalProperties: false },
  },
  {
    name: "powerpoint_file_save",
    description: "Save the active editable presentation, or save it to a new PPTX path. Existing output requires overwrite=true.",
    inputSchema: {
      type: "object",
      properties: { presentation_path: presentationTarget.presentation_path, output_path: string("Optional destination .pptx path."), overwrite: boolean("Permit replacing output_path."), close_after: boolean("Close a file opened by this call; defaults to true.") },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_file_export_slide",
    description: "Export one slide through PowerPoint as PNG or JPG at an exact pixel width. Optionally return a PNG image block for immediate visual inspection.",
    inputSchema: {
      type: "object",
      required: ["output_path"],
      properties: {
        ...presentationTarget, output_path: string("Destination .png or .jpg path."), format: string("Raster format.", { enum: ["PNG", "JPG"] }),
        width_px: integer("Output width in pixels; defaults to 2000.", { minimum: 100, maximum: 20000 }),
        height_px: integer("Optional exact height; otherwise preserves slide aspect ratio.", { minimum: 100, maximum: 20000 }),
        overwrite: boolean("Permit replacing the output file."), include_image: boolean("For PNG, also return the raster as an MCP image block."), close_after: boolean("Close a file opened by this call; defaults to true."),
      },
      additionalProperties: false,
    },
  },
  {
    name: "powerpoint_file_export_pdf",
    description: "Export the presentation to PDF through PowerPoint itself.",
    inputSchema: {
      type: "object",
      required: ["output_path"],
      properties: { presentation_path: presentationTarget.presentation_path, output_path: string("Destination .pdf path."), overwrite: boolean("Permit replacing the PDF."), close_after: boolean("Close a file opened by this call; defaults to true.") },
      additionalProperties: false,
    },
  },
];

async function handleTool(name, args) {
  if (name === "powerpoint_file_inspect") return runBridge("inspect", args);
  if (name === "powerpoint_file_validate") return runBridge("validate", args);
  if (name === "powerpoint_file_save") return runBridge("save", args);
  if (name === "powerpoint_file_export_pdf") return runBridge("export_pdf", args);
  if (name === "powerpoint_file_export_slide") {
    const result = await runBridge("export_slide", args);
    if (args.include_image && (args.format || path.extname(args.output_path).slice(1)).toUpperCase() === "PNG") {
      return mcpPayload(result, { imageData: (await fs.readFile(result.path)).toString("base64"), mimeType: "image/png" });
    }
    return result;
  }
  throw new Error(`Unknown tool: ${name}`);
}

serve({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  instructions: "Inspect, validate, save, and export PowerPoint files through the native bridge for the current platform: the PowerPoint JavaScript API on macOS or COM on Windows. Read-only inspection and validation do not modify files. Exported previews use PowerPoint's renderer.",
  tools,
  handleTool,
});
