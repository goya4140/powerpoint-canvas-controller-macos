#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 489;
const H = 470;
const OUT_DIR = path.resolve("docs/strict-recreation/neurips-controlmllm-fig1");
const OUT = path.join(OUT_DIR, "editable.pptx");
const REFERENCE = path.resolve("docs/benchmark/references/neurips-controlmllm-fig1.png");

function shape(slide, name, geometry, x, y, w, h, fill = "none", stroke = "none", strokeWidth = 1, dashed = false) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: stroke === "none"
      ? { style: "solid", fill: "none", width: 0 }
      : { style: dashed ? "dashed" : "solid", fill: stroke, width: strokeWidth },
  });
}

function text(slide, name, value, x, y, w, h, size, options = {}) {
  const item = shape(slide, name, "textbox", x, y, w, h);
  item.text = value;
  item.text.style = {
    fontFamily: options.fontFamily ?? "Times New Roman",
    fontSize: size,
    bold: options.bold ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
}

function line(slide, name, x1, y1, x2, y2, options = {}) {
  const item = shape(
    slide,
    name,
    "line",
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
    "none",
    options.color ?? "#111111",
    options.width ?? 2,
    options.dashed ?? false,
  );
  item.flipHorizontal = x2 < x1;
  item.flipVertical = y2 < y1;
  if (options.arrowEnd) {
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
    const head = shape(slide, `${name}.head`, "triangle", x2 - 4, y2 - 4, 8, 8, options.color ?? "#111111");
    head.rotation = angle;
  }
}

async function addPng(slide, name, file, position, alt) {
  const bytes = await fs.readFile(file);
  slide.images.add({
    blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    contentType: "image/png",
    name,
    alt,
    fit: "contain",
    position,
  });
}

function promptStrip(slide, prefix, y, fill) {
  shape(slide, `${prefix}.frame`, "roundRect", 7, y, 64, 31, "none", "#2D68A7", 1.4, true);
  for (let i = 0; i < 4; i += 1) {
    shape(slide, `${prefix}.cell.${i}`, "rect", 13 + i * 13, y + 7, 15, 18, fill, "#477B34", 0.8);
  }
}

async function model(slide, prefix, y, snowflake) {
  shape(slide, `${prefix}.model`, "roundRect", 81, y, 344, 71, "#E8E8E8", "#666666", 1.2);
  text(slide, `${prefix}.model-label`, "MLLM", 172, y + 16, 160, 39, 26);
  await addPng(slide, `${prefix}.frozen`, snowflake, { left: 386, top: y + 8, width: 29, height: 29 }, "Frozen model");
}

function check(slide, name, x, y) {
  text(slide, name, "✓", x, y, 50, 45, 50, { fontFamily: "Arial", color: "#00A651" });
}

async function main() {
  const assetDir = path.join(OUT_DIR, "assets");
  await fs.mkdir(assetDir, { recursive: true });
  const crops = [
    ["top-source.png", 9, 97, 64, 61],
    ["top-person.png", 130, 182, 60, 61],
    ["bottom-source.png", 6, 301, 62, 61],
    ["bottom-sale.png", 97, 389, 102, 64],
    ["bottom-region.png", 199, 383, 104, 70],
    ["snowflake.png", 388, 102, 29, 29],
  ];
  for (const [name, x, y, width, height] of crops) {
    execFileSync("python3", [
      "scripts/crop_image_asset.py",
      REFERENCE,
      path.join(assetDir, name),
      String(x),
      String(y),
      String(width),
      String(height),
    ]);
  }

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  text(slide, "title", "Ours Training-free Method", 90, 5, 320, 35, 22, { bold: true });
  text(slide, "top.subtitle", "Inference on free domain prompt", 14, 49, 270, 33, 16, { align: "left" });
  await addPng(slide, "top.source", path.join(assetDir, "top-source.png"), { left: 9, top: 97, width: 64, height: 61 }, "Free-domain source prompt");
  await model(slide, "top", 94, path.join(assetDir, "snowflake.png"));
  promptStrip(slide, "top.prompt", 186, "#75B94D");
  line(slide, "top.source-to-prompt", 39, 158, 39, 185, { color: "#E31B23", arrowEnd: true });
  line(slide, "top.prompt-horizontal", 71, 201, 107, 201);
  line(slide, "top.prompt-up", 107, 201, 107, 165, { arrowEnd: true });
  line(slide, "top.model-to-source", 81, 129, 73, 129, { color: "#F28C38", arrowEnd: true });

  await addPng(slide, "top.person", path.join(assetDir, "top-person.png"), { left: 130, top: 182, width: 60, height: 61 }, "In-domain horse image");
  shape(slide, "top.region.frame", "rect", 223, 182, 65, 62, "#FFFFFF", "#111111", 2);
  shape(slide, "top.region.mark", "rect", 245, 189, 12, 27, "none", "#6DBB45", 3);
  shape(slide, "top.question", "rect", 302, 182, 115, 62, "#FFF9DD", "#3D78A9", 1);
  text(slide, "top.question.text", "What color is is\nhat the person is\nwearing?", 307, 185, 105, 54, 11);
  line(slide, "top.person-up", 160, 182, 160, 165, { arrowEnd: true });
  line(slide, "top.region-up", 253, 182, 253, 165, { arrowEnd: true });
  line(slide, "top.question-up", 363, 182, 363, 165, { arrowEnd: true });
  check(slide, "top.check.region", 255, 213);
  check(slide, "top.check.question", 389, 213);

  line(slide, "divider", 18, 252, 413, 252, { color: "#666666", width: 1.5, dashed: true });
  text(slide, "bottom.subtitle", "Inference on free domain prompt", 18, 253, 270, 33, 16, { align: "left" });
  await addPng(slide, "bottom.source", path.join(assetDir, "bottom-source.png"), { left: 6, top: 301, width: 62, height: 61 }, "Free-domain sale prompt");
  await model(slide, "bottom", 294, path.join(assetDir, "snowflake.png"));
  promptStrip(slide, "bottom.prompt", 396, "#FFD719");
  line(slide, "bottom.source-to-prompt", 36, 362, 36, 395, { color: "#E31B23", arrowEnd: true });
  line(slide, "bottom.prompt-horizontal", 71, 411, 91, 411);
  line(slide, "bottom.prompt-up", 91, 411, 91, 365, { arrowEnd: true });
  line(slide, "bottom.model-to-source", 80, 329, 68, 329, { color: "#F28C38", arrowEnd: true });

  await addPng(slide, "bottom.sale", path.join(assetDir, "bottom-sale.png"), { left: 97, top: 389, width: 102, height: 64 }, "Sale image");
  await addPng(slide, "bottom.region", path.join(assetDir, "bottom-region.png"), { left: 199, top: 383, width: 104, height: 70 }, "Selected red region");
  shape(slide, "bottom.question", "rect", 304, 388, 115, 64, "#FFF9DD", "#3D78A9", 1);
  text(slide, "bottom.question.text", "Describe the text\nin the region.", 309, 392, 105, 52, 11);
  line(slide, "bottom.sale-up", 149, 389, 149, 365, { arrowEnd: true });
  line(slide, "bottom.region-up", 253, 383, 253, 365, { arrowEnd: true });
  line(slide, "bottom.question-up", 368, 388, 368, 365, { arrowEnd: true });
  check(slide, "bottom.check.region", 265, 426);
  check(slide, "bottom.check.question", 395, 426);

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- ControlMLLM: Training-Free Visual Prompt Learning for Multimodal Large Language Models, NeurIPS 2024, Figure 1: https://proceedings.neurips.cc/paper_files/paper/2024/hash/4fd96b997454b5b02698595df70fccaf-Abstract-Conference.html\n[/Sources]",
  );
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
