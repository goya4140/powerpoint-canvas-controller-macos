#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

class Client {
  constructor(script) {
    this.child = spawn(process.execPath, [script], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = "";
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => {
      const message = JSON.parse(line);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  async call(name, args = {}) {
    const result = await this.request("tools/call", { name, arguments: args });
    if (result.isError) throw new Error(result.structuredContent?.error || result.content?.[0]?.text || `Tool failed: ${name}`);
    return result;
  }

  close() {
    this.child.stdin.end();
    this.child.kill();
  }
}

const outputBase = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
await fs.mkdir(outputBase, { recursive: true });
const outputRoot = await fs.mkdtemp(path.join(outputBase, "ppt-canvas-selftest-"));
await fs.mkdir(outputRoot, { recursive: true });
const pptx = path.join(outputRoot, "powerpoint-canvas-selftest.pptx");
const png = path.join(outputRoot, "powerpoint-canvas-selftest.png");
const live = new Client(path.join(root, "live-server.mjs"));
const files = new Client(path.join(root, "file-server.mjs"));
let testPresentationPath = null;

try {
  await live.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "self-test", version: "1" } });
  await files.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "self-test", version: "1" } });
  const created = await live.call("powerpoint_live_new_presentation", { slide_width: 960, slide_height: 540, slides: 1 });
  const drawn = await live.call("powerpoint_live_draw_sequence", {
    step_delay_ms: 10,
    operations: [
      { type: "text", name: "title", text: "PowerPoint 原生画布 API", x: 50, y: 35, width: 860, height: 50, font_name: "Microsoft YaHei", font_size: 28, bold: true, font_color: "#17345B", align: "center" },
      { type: "shape", name: "input", shape_type: "rounded", text: "Editable input", x: 90, y: 180, width: 210, height: 95, fill_color: "#EEF4FC", line_color: "#17345B", line_width: 2, font_size: 20, bold: true },
      { type: "shape", name: "process", shape_type: "rounded", text: "Native PowerPoint process", x: 375, y: 180, width: 210, height: 95, fill_color: "#EBF8F6", line_color: "#23938D", line_width: 2, font_size: 20, bold: true },
      { type: "shape", name: "output", shape_type: "rounded", text: "Editable output", x: 660, y: 180, width: 210, height: 95, fill_color: "#FFF1F2", line_color: "#FF4055", line_width: 2, font_size: 20, bold: true },
      { type: "connector", name: "input-to-process", source: "input", target: "process", connector_type: "straight", color: "#17345B", width: 2.5, end_arrow: "triangle" },
      { type: "connector", name: "process-to-output", source: "process", target: "output", connector_type: "straight", color: "#17345B", width: 2.5, end_arrow: "triangle" },
      { type: "text", name: "caption", text: "All text, shapes, and connectors remain editable.", x: 170, y: 335, width: 620, height: 36, font_size: 16, font_color: "#55657A", align: "center" },
    ],
  });
  const inspected = await live.call("powerpoint_live_inspect", { max_shapes: 50, include_text: true });
  const screenshot = await live.call("powerpoint_live_screenshot", { width_px: 1200 });
  const saved = await files.call("powerpoint_file_save", { output_path: pptx, overwrite: true, close_after: false });
  testPresentationPath = saved.structuredContent?.path || pptx;
  const validated = await files.call("powerpoint_file_validate", { presentation_path: pptx, slide_index: 1 });
  const exported = await files.call("powerpoint_file_export_slide", { presentation_path: pptx, slide_index: 1, output_path: png, format: "PNG", width_px: 1200, overwrite: true, include_image: true });
  const fileInspected = await files.call("powerpoint_file_inspect", { presentation_path: pptx, slide_index: 1, max_shapes: 50, include_text: true });

  const summary = {
    ok: true,
    output_root: outputRoot,
    pptx,
    png,
    created: created.structuredContent,
    batch: drawn.structuredContent,
    live_shape_count: inspected.structuredContent?.total,
    screenshot_image_blocks: screenshot.content.filter((item) => item.type === "image").length,
    saved: saved.structuredContent,
    validation: validated.structuredContent,
    exported: exported.structuredContent,
    export_image_blocks: exported.content.filter((item) => item.type === "image").length,
    reopened_shape_count: fileInspected.structuredContent?.total,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  try {
    if (testPresentationPath) await live.call("powerpoint_live_close_presentation", { presentation_path: testPresentationPath, confirm: true, save: false });
    else await live.call("powerpoint_live_close_presentation", { confirm: true, save: false });
  } catch {}
  live.close();
  files.close();
}
