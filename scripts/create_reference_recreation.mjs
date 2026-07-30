#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { loadManifest } from "./validate_reference_scene.mjs";

const DEFAULTS = {
  font: "Arial",
  ink: "#111827",
  muted: "#6B7280",
  line: "#4B5563",
  paper: "#FFFFFF",
};

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function writeBlob(file, blob) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function position(element) {
  return { left: element.x, top: element.y, width: element.w, height: element.h };
}

function lineConfig(element = {}) {
  return {
    style: element.dashed ? "dashed" : "solid",
    fill: element.stroke ?? DEFAULTS.line,
    width: element.strokeWidth ?? 1.5,
  };
}

function textStyle(element = {}) {
  return {
    fontFamily: element.fontFamily ?? DEFAULTS.font,
    fontSize: element.fontSize ?? 16,
    bold: element.bold ?? false,
    italic: element.italic ?? false,
    color: element.color ?? DEFAULTS.ink,
    alignment: element.align ?? "center",
    verticalAlignment: element.valign ?? "middle",
  };
}

function addText(slide, element) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: element.name,
    position: position(element),
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
    rotation: element.rotation ?? 0,
  });
  shape.text = element.text ?? "";
  shape.text.style = textStyle(element);
  return shape;
}

function addShape(slide, element) {
  const geometry = element.geometry ?? "rect";
  const config = {
    geometry,
    name: element.name,
    position: position(element),
    fill: element.fill ?? "none",
    line: element.stroke === "none"
      ? { style: "solid", fill: "none", width: 0 }
      : lineConfig(element),
    rotation: element.rotation ?? 0,
  };
  if (["rect", "textbox", "roundRect"].includes(geometry)) {
    config.borderRadius = element.radius ?? (geometry === "roundRect" ? 8 : undefined);
  }
  const shape = slide.shapes.add(config);
  if (element.text !== undefined) {
    shape.text = element.text;
    shape.text.style = textStyle(element);
  }
  return shape;
}

function addLine(slide, element) {
  const shape = slide.shapes.add({
    geometry: "line",
    name: element.name,
    position: {
      left: Math.min(element.x1, element.x2),
      top: Math.min(element.y1, element.y2),
      width: Math.abs(element.x2 - element.x1),
      height: Math.abs(element.y2 - element.y1),
    },
    fill: "none",
    line: lineConfig(element),
    flipHorizontal: element.x2 < element.x1,
    flipVertical: element.y2 < element.y1,
  });
  const items = [shape];
  const arrowSize = Math.max(11, (element.strokeWidth ?? 1.5) * 3.2);
  const addArrow = (name, x, y, dx, dy) => {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    items.push(addShape(slide, {
      type: "shape",
      geometry: "triangle",
      name,
      x: x - arrowSize / 2,
      y: y - arrowSize / 2,
      w: arrowSize,
      h: arrowSize,
      fill: element.stroke ?? DEFAULTS.line,
      stroke: "none",
      rotation: angle,
    }));
  };
  if (element.arrowEnd && element.arrowEnd !== "none") {
    addArrow(`${element.name}.arrow-end`, element.x2, element.y2, element.x2 - element.x1, element.y2 - element.y1);
  }
  if (element.arrowStart && element.arrowStart !== "none") {
    addArrow(`${element.name}.arrow-start`, element.x1, element.y1, element.x1 - element.x2, element.y1 - element.y2);
  }
  return items;
}

function cycle(values, index, fallback) {
  if (Array.isArray(values) && values.length) return values[index % values.length];
  return values ?? fallback;
}

function addStack(slide, element) {
  const dx = element.dx ?? 8;
  const dy = element.dy ?? -8;
  const items = [];
  for (let index = element.count - 1; index >= 0; index -= 1) {
    const item = addShape(slide, {
      ...element,
      type: "shape",
      name: `${element.name}.${String(index + 1).padStart(2, "0")}`,
      x: element.x + dx * index,
      y: element.y + dy * index,
      fill: cycle(element.fills, index, element.fill ?? "#F3F4F6"),
      text: Array.isArray(element.labels) ? element.labels[index] ?? "" : index === 0 ? element.text : "",
    });
    items.push(item);
  }
  return items;
}

function addTokens(slide, element) {
  const gapX = element.gapX ?? 4;
  const gapY = element.gapY ?? 4;
  const cellW = (element.w - gapX * (element.cols - 1)) / element.cols;
  const cellH = (element.h - gapY * (element.rows - 1)) / element.rows;
  const items = [];
  for (let row = 0; row < element.rows; row += 1) {
    for (let col = 0; col < element.cols; col += 1) {
      const index = row * element.cols + col;
      items.push(addShape(slide, {
        type: "shape",
        geometry: element.geometry ?? "roundRect",
        name: `${element.name}.${String(row + 1).padStart(2, "0")}.${String(col + 1).padStart(2, "0")}`,
        x: element.x + col * (cellW + gapX),
        y: element.y + row * (cellH + gapY),
        w: cellW,
        h: cellH,
        fill: cycle(element.fills, index, element.fill ?? "#E5E7EB"),
        stroke: element.stroke ?? "#6B7280",
        strokeWidth: element.strokeWidth ?? 0.8,
        radius: ["rect", "roundRect"].includes(element.geometry ?? "roundRect") ? element.radius ?? 3 : undefined,
        text: Array.isArray(element.labels) ? element.labels[index] ?? "" : "",
        fontSize: element.fontSize ?? Math.max(8, Math.min(13, cellH * 0.45)),
        color: element.color ?? DEFAULTS.ink,
      }));
    }
  }
  return items;
}

function addNetwork(slide, element) {
  const nodeById = new Map(element.nodes.map((node) => [node.id, node]));
  const items = [];
  for (const [index, edge] of element.edges.entries()) {
    const from = nodeById.get(edge[0]);
    const to = nodeById.get(edge[1]);
    if (!from || !to) continue;
    items.push(...addLine(slide, {
      type: "line",
      name: `${element.name}.edge.${String(index + 1).padStart(2, "0")}`,
      x1: element.x + from.x * element.w,
      y1: element.y + from.y * element.h,
      x2: element.x + to.x * element.w,
      y2: element.y + to.y * element.h,
      stroke: element.edgeColor ?? "#9CA3AF",
      strokeWidth: element.edgeWidth ?? 1,
    }));
  }
  const radius = element.nodeRadius ?? 7;
  for (const [index, node] of element.nodes.entries()) {
    items.push(addShape(slide, {
      type: "shape",
      geometry: "ellipse",
      name: `${element.name}.node.${node.id}`,
      x: element.x + node.x * element.w - radius,
      y: element.y + node.y * element.h - radius,
      w: radius * 2,
      h: radius * 2,
      fill: node.fill ?? cycle(element.nodeFills, index, "#60A5FA"),
      stroke: node.stroke ?? element.nodeStroke ?? "#374151",
      strokeWidth: element.nodeStrokeWidth ?? 0.8,
      text: node.label ?? "",
      fontSize: Math.max(7, radius * 0.9),
      color: "#111827",
    }));
  }
  return items;
}

function renderScene(slide, scene) {
  slide.background.fill = scene.background ?? DEFAULTS.paper;
  const namedShapes = new Map();
  const connectors = [];
  const foreground = [];
  const isBackground = (element) => element.layer === "background"
    || element.name.startsWith("panel.")
    || element.name.startsWith("group.")
    || element.name.endsWith(".frame")
    || element.name.includes(".frame");

  for (const element of scene.elements) {
    if (element.type === "connector") {
      connectors.push(element);
      continue;
    }
    if (element.type === "shape") {
      const shape = addShape(slide, element);
      namedShapes.set(element.name, shape);
      if (!isBackground(element)) foreground.push(shape);
    } else if (element.type === "text") foreground.push(addText(slide, element));
    else if (element.type === "line") foreground.push(...addLine(slide, element));
    else if (element.type === "stack") foreground.push(...addStack(slide, element));
    else if (element.type === "tokens") foreground.push(...addTokens(slide, element));
    else if (element.type === "network") foreground.push(...addNetwork(slide, element));
  }

  for (const element of connectors) {
    const connector = slide.shapes.connect(namedShapes.get(element.from), namedShapes.get(element.to), {
      kind: element.kind ?? "straight",
      fromSide: element.fromSide,
      toSide: element.toSide,
      line: lineConfig(element),
      tail: element.arrowEnd === "none" ? undefined : { type: element.arrowEnd ?? "arrow", width: "med", length: "med" },
      head: element.arrowStart ? { type: element.arrowStart, width: "sm", length: "sm" } : undefined,
    });
    connector.name = element.name;
    connector.bringToFront();
    if (element.label) addText(slide, {
      type: "text",
      name: `${element.name}.label`,
      x: element.labelX,
      y: element.labelY,
      w: element.labelW ?? 120,
      h: element.labelH ?? 24,
      text: element.label,
      fontSize: element.fontSize ?? 12,
      color: element.color ?? element.stroke ?? DEFAULTS.line,
      fill: element.labelFill ?? "none",
    });
  }
  for (const shape of foreground) shape.bringToFront();
  slide.speakerNotes.textFrame.setText(
    `[Sources]\n- ${scene.paper_title}, ${scene.venue} ${scene.year}, ${scene.figure}: ${scene.paper_url}\n[/Sources]`
  );
}

async function buildRecreationDeck(scenes, outFile, previewDir) {
  const first = scenes[0];
  const presentation = Presentation.create({ slideSize: { width: first.canvas.width, height: first.canvas.height } });
  for (const scene of scenes) {
    if (scene.canvas.width !== first.canvas.width || scene.canvas.height !== first.canvas.height) {
      throw new Error(`All benchmark scenes must share one canvas size; ${scene.id} differs.`);
    }
    renderScene(presentation.slides.add(), scene);
  }

  await fs.mkdir(previewDir, { recursive: true });
  for (const [index, slide] of presentation.slides.items.entries()) {
    const scene = scenes[index];
    await writeBlob(path.join(previewDir, `${scene.id}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(previewDir, `${scene.id}.layout.json`), await layout.text());
  }
  await fs.rm(path.join(previewDir, "recreation-montage.webp"), { force: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await pptx.save(outFile);
  await fs.rm(`${outFile}.inspect.ndjson`, { force: true });
}

async function imageBytes(file) {
  const bytes = await fs.readFile(file);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function pngAsset(file) {
  const bytes = await fs.readFile(file);
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") throw new Error(`Expected PNG asset: ${file}`);
  return {
    blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function fitBox(aspect, frame) {
  let width = frame.width;
  let height = width / aspect;
  if (height > frame.height) {
    height = frame.height;
    width = height * aspect;
  }
  return {
    left: frame.left + (frame.width - width) / 2,
    top: frame.top + (frame.height - height) / 2,
    width,
    height,
  };
}

function addLabel(slide, name, text, x, color) {
  addShape(slide, {
    type: "shape", geometry: "roundRect", name, x, y: 92, w: 154, h: 38,
    fill: color, stroke: color, radius: 7, text, fontSize: 18, bold: true, color: "#FFFFFF",
  });
}

async function buildComparisonGallery(scenes, recreationDir, comparisonDir) {
  const W = 1600;
  const H = 900;
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  for (const [index, scene] of scenes.entries()) {
    const slide = presentation.slides.add();
    slide.background.fill = "#F4F5F7";
    addText(slide, {
      type: "text", name: `comparison.${scene.id}.title`, x: 70, y: 32, w: 1460, h: 42,
      text: `${String(index + 1).padStart(2, "0")} · ${scene.venue} ${scene.year} · ${scene.paper_title} · ${scene.figure}`,
      fontSize: 24, bold: true, align: "left", color: "#18212B",
    });
    addLabel(slide, `comparison.${scene.id}.reference-label`, "REFERENCE", 70, "#596579");
    addLabel(slide, `comparison.${scene.id}.recreated-label`, "RECREATED", 815, "#1B7A65");
    addShape(slide, {
      type: "shape", geometry: "rect", name: `comparison.${scene.id}.reference-frame`,
      x: 70, y: 144, w: 715, h: 650, fill: "#FFFFFF", stroke: "#C7CDD4", strokeWidth: 1.2,
    });
    addShape(slide, {
      type: "shape", geometry: "rect", name: `comparison.${scene.id}.recreated-frame`,
      x: 815, y: 144, w: 715, h: 650, fill: "#FFFFFF", stroke: "#C7CDD4", strokeWidth: 1.2,
    });
    const crop = { left: 0, top: 0, right: 0, bottom: 0, ...(scene.reference_crop ?? {}) };
    const referenceAsset = await pngAsset(scene.reference);
    const croppedAspect = (referenceAsset.width * (1 - crop.left - crop.right))
      / (referenceAsset.height * (1 - crop.top - crop.bottom));
    slide.images.add({
      blob: referenceAsset.blob,
      contentType: "image/png",
      alt: `${scene.paper_title} ${scene.figure} reference`,
      fit: "cover",
      crop,
      position: fitBox(croppedAspect, { left: 88, top: 164, width: 679, height: 610 }),
    });
    slide.images.add({
      blob: await imageBytes(path.join(recreationDir, `${scene.id}.png`)),
      contentType: "image/png",
      alt: `${scene.paper_title} ${scene.figure} editable recreation`,
      fit: "contain",
      position: { left: 833, top: 164, width: 679, height: 610 },
    });
    addText(slide, {
      type: "text", name: `comparison.${scene.id}.footer`, x: 70, y: 818, w: 1460, h: 34,
      text: `${scene.reconstruction_logic}  ·  Editable native PowerPoint objects`,
      fontSize: 16, color: "#596579", align: "center",
    });
    slide.speakerNotes.textFrame.setText(
      `[Sources]\n- ${scene.paper_title}, ${scene.venue} ${scene.year}, ${scene.figure}: ${scene.paper_url}\n[/Sources]`
    );
  }

  await fs.mkdir(comparisonDir, { recursive: true });
  for (const [index, slide] of presentation.slides.items.entries()) {
    await writeBlob(path.join(comparisonDir, `${scenes[index].id}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
  }
  await fs.rm(path.join(comparisonDir, "comparison-montage.webp"), { force: true });
}

async function writeSources(scenes, outFile) {
  const header = "id,venue,year,paper_title,figure,paper_url,reference,reconstruction_logic\n";
  const quote = (value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  const rows = scenes.map((scene) => [
    scene.id, scene.venue, scene.year, scene.paper_title, scene.figure,
    scene.paper_url, `references/${scene.id}.png`, scene.reconstruction_logic,
  ].map(quote).join(","));
  await fs.writeFile(outFile, header + rows.join("\n") + "\n");
}

async function main() {
  const manifestPath = arg("--manifest", "benchmark/manifest.json");
  const outFile = path.resolve(arg("--out", "docs/benchmark/reference-recreation-benchmark.pptx"));
  const previewDir = path.resolve(arg("--preview-dir", "docs/benchmark/recreated"));
  const comparisonDir = path.resolve(arg("--comparison-dir", "docs/benchmark/comparisons"));
  const manifest = await loadManifest(manifestPath);
  const scenes = manifest.scenes.map((scene) => ({
    ...scene,
    reference: path.resolve(path.dirname(scene.__file), scene.reference),
  }));
  await buildRecreationDeck(scenes, outFile, previewDir);
  await buildComparisonGallery(scenes, previewDir, comparisonDir);
  await writeSources(scenes, path.join(path.dirname(outFile), "sources.csv"));
  console.log(`Created ${outFile}, ${scenes.length} recreation previews, and ${scenes.length} comparison images.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
