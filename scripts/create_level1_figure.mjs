#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { validateSpec } from "./validate_level1_spec.mjs";

const W = 1280;
const H = 720;
const FRAME = { left: 76, top: 176, width: 1128, height: 420 };
const C = {
  ink: "#173042", muted: "#667784", paper: "#FBFCFD", white: "#FFFFFF", grid: "#D8E0E5",
  neutralFill: "#F3F5F7", neutralStroke: "#68727D", blueFill: "#DDEBF7", blueStroke: "#3979A8",
  greenFill: "#DDF2EA", greenStroke: "#2E8064", orangeFill: "#FCE8DC", orangeStroke: "#B7683A",
  purpleFill: "#EEE7F7", purpleStroke: "#72539A", redFill: "#F9E1E1", redStroke: "#A84A4A"
};

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function addText(slide, name, text, position, style = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", name, position, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = text;
  shape.text.style = {
    fontFamily: "Arial", fontSize: style.fontSize ?? 16, bold: style.bold ?? false,
    color: style.color ?? C.ink, alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle"
  };
  return shape;
}

function rolePalette(role) {
  return {
    neutral: [C.neutralFill, C.neutralStroke], representation: [C.blueFill, C.blueStroke],
    proposed: [C.greenFill, C.greenStroke], auxiliary: [C.orangeFill, C.orangeStroke],
    output: [C.purpleFill, C.purpleStroke], risk: [C.redFill, C.redStroke]
  }[role] ?? [C.neutralFill, C.neutralStroke];
}

function geometryFor(type) {
  if (type === "decision") return "diamond";
  if (type === "memory") return "roundRect";
  if (type === "input" || type === "output") return "roundRect";
  if (type === "external") return "rect";
  return "roundRect";
}

function nodeSize(type, compact = false) {
  if (type === "decision") return compact ? { width: 112, height: 82 } : { width: 145, height: 104 };
  return compact ? { width: 132, height: 72 } : { width: 164, height: 84 };
}

function topologicalOrder(spec) {
  const primary = spec.edges.filter((edge) => ["data", "control"].includes(edge.type));
  const indegree = new Map(spec.nodes.map((node) => [node.id, 0]));
  const adjacency = new Map(spec.nodes.map((node) => [node.id, []]));
  for (const edge of primary) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)?.push(edge.to);
  }
  const queue = spec.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const ordered = [];
  while (queue.length) {
    const id = queue.shift(); ordered.push(id);
    for (const next of adjacency.get(id) ?? []) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return [...ordered, ...spec.nodes.map((node) => node.id).filter((id) => !ordered.includes(id))];
}

function pipelineLayout(spec) {
  const order = topologicalOrder(spec);
  const gap = 22;
  const width = Math.min(154, (FRAME.width - gap * (order.length - 1)) / order.length);
  const total = width * order.length + gap * (order.length - 1);
  const left = FRAME.left + (FRAME.width - total) / 2;
  const positions = new Map();
  order.forEach((id, index) => {
    const node = spec.nodes.find((item) => item.id === id);
    const height = node.type === "decision" ? 102 : 86;
    positions.set(id, { left: left + index * (width + gap), top: 371 - height / 2, width, height });
  });
  return { positions, regions: [] };
}

function swimlaneLayout(spec) {
  const lanes = [...new Set(spec.nodes.map((node) => node.lane))];
  const laneGap = 10;
  const laneH = (FRAME.height - laneGap * (lanes.length - 1)) / lanes.length;
  const regions = [];
  const positions = new Map();
  lanes.forEach((lane, laneIndex) => {
    const top = FRAME.top + laneIndex * (laneH + laneGap);
    regions.push({ id: `lane-${lane.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: lane, position: { left: FRAME.left, top, width: FRAME.width, height: laneH } });
    const members = spec.nodes.filter((node) => node.lane === lane);
    const usableLeft = FRAME.left + 126;
    const usableWidth = FRAME.width - 150;
    const width = Math.min(156, (usableWidth - 26 * Math.max(0, members.length - 1)) / Math.max(1, members.length));
    const total = width * members.length + 26 * Math.max(0, members.length - 1);
    const left = usableLeft + (usableWidth - total) / 2;
    members.forEach((node, index) => {
      const height = node.type === "decision" ? Math.min(94, laneH - 14) : 70;
      positions.set(node.id, { left: left + index * (width + 26), top: top + (laneH - height) / 2, width, height });
    });
  });
  return { positions, regions };
}

function hubSpokeLayout(spec) {
  const hub = spec.hub_node;
  const others = spec.nodes.filter((node) => node.id !== hub);
  const positions = new Map([[hub, { left: 558, top: 315, width: 164, height: 94 }]]);
  const cx = 640; const cy = 362; const rx = 430; const ry = 155;
  others.forEach((node, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / others.length);
    const size = nodeSize(node.type, true);
    positions.set(node.id, { left: cx + Math.cos(angle) * rx - size.width / 2, top: cy + Math.sin(angle) * ry - size.height / 2, ...size });
  });
  return { positions, regions: [] };
}

function hierarchyLayout(spec) {
  const levels = [...new Set(spec.nodes.map((node) => node.level))].sort((a, b) => a - b);
  const positions = new Map();
  const rowGap = 12;
  const rowH = (FRAME.height - rowGap * (levels.length - 1)) / levels.length;
  levels.forEach((level, row) => {
    const members = spec.nodes.filter((node) => node.level === level);
    const width = Math.min(170, (FRAME.width - 36 * Math.max(0, members.length - 1)) / members.length);
    const total = width * members.length + 36 * Math.max(0, members.length - 1);
    const left = FRAME.left + (FRAME.width - total) / 2;
    members.forEach((node, index) => {
      const height = node.type === "decision" ? Math.min(82, rowH - 4) : 64;
      positions.set(node.id, { left: left + index * (width + 36), top: FRAME.top + row * (rowH + rowGap) + (rowH - height) / 2, width, height });
    });
  });
  return { positions, regions: [] };
}

function computeLayout(spec, layout) {
  if (layout === "pipeline") return pipelineLayout(spec);
  if (layout === "swimlane") return swimlaneLayout(spec);
  if (layout === "hub-spoke") return hubSpokeLayout(spec);
  if (layout === "hierarchy") return hierarchyLayout(spec);
  throw new Error(`Unsupported layout: ${layout}`);
}

function addHeader(slide, role, title, subtitle) {
  addText(slide, `label.role.${role}`, role.toUpperCase(), { left: 76, top: 35, width: 220, height: 22 }, { fontSize: 12, bold: true, color: C.greenStroke });
  addText(slide, `label.title.${role}`, title, { left: 76, top: 61, width: 1128, height: 44 }, { fontSize: 30, bold: true });
  addText(slide, `label.subtitle.${role}`, subtitle, { left: 76, top: 108, width: 1128, height: 30 }, { fontSize: 16, color: C.muted });
  slide.shapes.add({ geometry: "line", name: `rule.${role}`, position: { left: 76, top: 151, width: 1128, height: 0 }, fill: "none", line: { style: "solid", fill: C.grid, width: 1 } });
}

function addRegions(slide, regions) {
  for (const region of regions) {
    slide.shapes.add({ geometry: "roundRect", name: `group.${region.id}`, position: region.position, fill: "#F7F9FA", line: { style: "solid", fill: C.grid, width: 1 }, borderRadius: 10 });
    addText(slide, `label.group.${region.id}`, region.label, { left: region.position.left + 14, top: region.position.top + 8, width: 104, height: 24 }, { fontSize: 13, bold: true, color: C.muted });
  }
}

function addSemanticGroups(slide, spec, positions) {
  for (const group of spec.groups ?? []) {
    const boxes = group.members.map((id) => positions.get(id)).filter(Boolean);
    if (boxes.length < 2) continue;
    const left = Math.min(...boxes.map((box) => box.left)) - 12;
    const top = Math.min(...boxes.map((box) => box.top)) - 26;
    const right = Math.max(...boxes.map((box) => box.left + box.width)) + 12;
    const bottom = Math.max(...boxes.map((box) => box.top + box.height)) + 12;
    slide.shapes.add({ geometry: "roundRect", name: `group.${group.id}`, position: { left, top, width: right - left, height: bottom - top }, fill: "none", line: { style: "dashed", fill: C.grid, width: 1.2 }, borderRadius: 10 });
    addText(slide, `label.group.${group.id}`, group.label, { left: left + 10, top: top + 3, width: Math.min(180, right - left - 20), height: 20 }, { fontSize: 12, bold: true, color: C.muted });
  }
}

function addNode(slide, node, position, wireframe) {
  const palette = wireframe ? [C.white, node.role === "proposed" ? C.greenStroke : C.neutralStroke] : rolePalette(node.role);
  const geometry = geometryFor(node.type);
  const config = {
    geometry, name: `module.${node.id}`, position,
    fill: palette[0], line: { style: node.type === "external" ? "dashed" : "solid", fill: palette[1], width: node.role === "proposed" ? 2.4 : 1.5 },
  };
  if (["rect", "roundRect", "textbox"].includes(geometry)) config.borderRadius = node.type === "memory" ? 18 : 10;
  const shape = slide.shapes.add(config);
  shape.text = node.detail && !wireframe ? `${node.label}\n${node.detail}` : node.label;
  shape.text.style = { fontFamily: "Arial", fontSize: node.type === "decision" ? 12 : node.detail && !wireframe ? 14 : 15, bold: true, color: C.ink, alignment: "center", verticalAlignment: "middle" };
  if (node.asset_slot) shape.name = `module.${node.id}`;
  return shape;
}

function connectorSides(from, to) {
  const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
  const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function addEdges(slide, spec, shapes, positions, wireframe) {
  for (const edge of spec.edges) {
    const from = shapes.get(edge.from); const to = shapes.get(edge.to);
    const isReturn = ["feedback", "update"].includes(edge.type);
    const sameRowReturn = isReturn && Math.abs(positions.get(edge.from).top - positions.get(edge.to).top) < 18;
    const [defaultFromSide, defaultToSide] = connectorSides(positions.get(edge.from), positions.get(edge.to));
    const fromSide = isReturn ? sameRowReturn ? "bottom" : "right" : defaultFromSide;
    const toSide = isReturn ? sameRowReturn ? "bottom" : "right" : defaultToSide;
    const dashed = ["feedback", "update", "optional"].includes(edge.type);
    const color = edge.type === "feedback" || edge.type === "update" ? C.orangeStroke : C.muted;
    const connector = slide.shapes.connect(from, to, {
      kind: isReturn ? sameRowReturn ? "curved" : "elbow" : Math.abs(positions.get(edge.from).top - positions.get(edge.to).top) < 18 ? "straight" : "elbow",
      fromSide, toSide,
      line: { style: dashed ? "dashed" : "solid", fill: wireframe ? C.neutralStroke : color, width: wireframe ? 1.4 : 1.8 },
      head: edge.type === "bidirectional" ? { type: "arrow", width: "sm", length: "sm" } : undefined,
      tail: { type: "arrow", width: "med", length: "med" }
    });
    connector.name = `arrow.${edge.id}`;
    if (edge.label && !wireframe) {
      const a = positions.get(edge.from); const b = positions.get(edge.to);
      const x = sameRowReturn ? ((a.left + a.width / 2) + (b.left + b.width / 2)) / 2 - 62 : isReturn ? Math.min(W - 140, Math.max(a.left + a.width, b.left + b.width) + 8) : ((a.left + a.width / 2) + (b.left + b.width / 2)) / 2 - 62;
      const y = sameRowReturn ? Math.max(a.top + a.height, b.top + b.height) + 16 : ((a.top + a.height / 2) + (b.top + b.height / 2)) / 2 - 12;
      addText(slide, `label.arrow.${edge.id}`, edge.label, { left: x, top: y, width: 124, height: 24 }, { fontSize: 11, color, alignment: "center" });
    }
  }
}

function addDiagram(slide, spec, layout, wireframe = false) {
  const computed = computeLayout(spec, layout);
  addRegions(slide, computed.regions);
  if (!computed.regions.length) addSemanticGroups(slide, spec, computed.positions);
  const shapes = new Map();
  for (const node of spec.nodes) shapes.set(node.id, addNode(slide, node, computed.positions.get(node.id), wireframe));
  addEdges(slide, spec, shapes, computed.positions, wireframe);
  if (!wireframe) {
    for (const node of spec.nodes.filter((item) => item.asset_slot)) {
      const p = computed.positions.get(node.id);
      slide.shapes.add({ geometry: "rect", name: `slot.${node.id}.${node.asset_slot}`, position: { left: p.left + p.width - 2, top: p.top + p.height - 2, width: 1, height: 1 }, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
    }
  }
}

function createBriefSlide(presentation, spec) {
  const slide = presentation.slides.add(); slide.background.fill = C.paper;
  addHeader(slide, "brief", spec.figure.title, spec.figure.message);
  const left = { left: 76, top: 190, width: 500, height: 390 };
  const right = { left: 620, top: 190, width: 584, height: 390 };
  slide.shapes.add({ geometry: "roundRect", name: "brief.communication", position: left, fill: C.white, line: { style: "solid", fill: C.grid, width: 1.2 }, borderRadius: 12 });
  slide.shapes.add({ geometry: "roundRect", name: "brief.graph", position: right, fill: C.white, line: { style: "solid", fill: C.grid, width: 1.2 }, borderRadius: 12 });
  addText(slide, "brief.communication.title", "Communication job", { left: 102, top: 214, width: 430, height: 30 }, { fontSize: 20, bold: true });
  addText(slide, "brief.communication.body", `Audience\n${spec.figure.audience}\n\nTarget width\n${spec.figure.target_width ?? "unspecified"}\n\nContribution\n${(spec.figure.contribution_nodes ?? []).join(", ") || "not declared"}`, { left: 102, top: 260, width: 430, height: 250 }, { fontSize: 16, color: C.muted });
  addText(slide, "brief.graph.title", "Semantic graph", { left: 646, top: 214, width: 510, height: 30 }, { fontSize: 20, bold: true });
  const graphLines = spec.edges.map((edge) => `${edge.from}  →  ${edge.to}   [${edge.type}]`).join("\n");
  addText(slide, "brief.graph.body", graphLines, { left: 646, top: 254, width: 520, height: 292 }, { fontSize: 15, color: C.muted, verticalAlignment: "top" });
  addText(slide, "brief.status", spec.selected_layout ? `Confirmed layout: ${spec.selected_layout}` : "Status: awaiting wireframe selection", { left: 76, top: 620, width: 1128, height: 26 }, { fontSize: 16, bold: true, color: spec.selected_layout ? C.greenStroke : C.orangeStroke, alignment: "center" });
}

function createWireframeSlide(presentation, spec, layout, index) {
  const slide = presentation.slides.add(); slide.background.fill = C.paper;
  addHeader(slide, `wireframe-${layout}`, `Option ${String.fromCharCode(65 + index)} · ${layout}`, "Validate reading order, module boundaries, and contribution emphasis before visual refinement.");
  addDiagram(slide, spec, layout, true);
  addText(slide, `wireframe.${layout}.footer`, "Structure only · native PowerPoint objects · no decorative assets", { left: 76, top: 634, width: 1128, height: 24 }, { fontSize: 14, color: C.muted, alignment: "center" });
}

function createSelectedSlide(presentation, spec) {
  const slide = presentation.slides.add(); slide.background.fill = C.paper;
  addText(slide, "figure.title", spec.figure.title, { left: 76, top: 34, width: 1128, height: 42 }, { fontSize: 28, bold: true, alignment: "center" });
  addText(slide, "figure.message", spec.figure.message, { left: 110, top: 79, width: 1060, height: 30 }, { fontSize: 15, color: C.muted, alignment: "center" });
  slide.shapes.add({ geometry: "line", name: "figure.rule", position: { left: 76, top: 126, width: 1128, height: 0 }, fill: "none", line: { style: "solid", fill: C.grid, width: 1 } });
  addDiagram(slide, spec, spec.selected_layout, false);
  addText(slide, "figure.level", `LEVEL 1 · ${spec.selected_layout} · editable semantic skeleton`, { left: 76, top: 648, width: 1128, height: 22 }, { fontSize: 11, bold: true, color: C.greenStroke, alignment: "center" });
}

async function writeBlob(file, blob) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  const specPath = arg("--spec");
  const outPath = arg("--out", "outputs/level1-figure.pptx");
  const previewDir = arg("--preview-dir", "outputs/level1-preview");
  if (!specPath) throw new Error("Missing --spec <json>");
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const validation = validateSpec(spec);
  if (validation.errors.length) throw new Error(`Invalid Level 1 spec:\n${validation.errors.join("\n")}`);
  for (const warning of validation.warnings) console.warn(`WARNING: ${warning}`);

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  createBriefSlide(presentation, spec);
  spec.layout_candidates.forEach((layout, index) => createWireframeSlide(presentation, spec, layout, index));
  if (spec.selected_layout) createSelectedSlide(presentation, spec);

  await fs.mkdir(previewDir, { recursive: true });
  for (const entry of await fs.readdir(previewDir)) {
    if (/^slide-\d+\.(png|layout\.json)$/.test(entry) || entry === "montage.webp") await fs.unlink(path.join(previewDir, entry));
  }
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(previewDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(previewDir, `${stem}.layout.json`), await layout.text());
  }
  await writeBlob(path.join(previewDir, "montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await pptx.save(outPath);
  console.log(`Created ${outPath} with ${presentation.slides.items.length} slides.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
