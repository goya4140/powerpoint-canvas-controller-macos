#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 583;
const H = 346;
const OUT_DIR = path.resolve("docs/strict-recreation/icml-fit-fig2");
const OUT = path.join(OUT_DIR, "editable.pptx");
const REFERENCE = path.resolve("docs/benchmark/references/icml-fit-fig2.png");

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
    fontFamily: "Arial",
    fontSize: size,
    bold: options.bold ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
}

function arrow(slide, name, x1, y1, x2, y2) {
  const line = shape(slide, name, "line", Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), "none", "#111111", 1);
  line.flipHorizontal = x2 < x1;
  line.flipVertical = y2 < y1;
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
  const head = shape(slide, `${name}.head`, "triangle", x2 - 3, y2 - 3, 6, 6, "#111111");
  head.rotation = angle;
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

function bracket(slide, name, x1, x2, y) {
  const center = (x1 + x2) / 2;
  shape(slide, `${name}.left`, "line", x1, y, center - 7 - x1, 0, "none", "#333333", 1);
  shape(slide, `${name}.notch-left`, "line", center - 7, y, 7, 7, "none", "#333333", 1);
  const notchRight = shape(slide, `${name}.notch-right`, "line", center, y, 7, 7, "none", "#333333", 1);
  notchRight.flipVertical = true;
  shape(slide, `${name}.right`, "line", center + 7, y, x2 - center - 7, 0, "none", "#333333", 1);
}

async function main() {
  const assetDir = path.join(OUT_DIR, "assets");
  await fs.mkdir(assetDir, { recursive: true });
  const crops = [
    ["cat-large-top.png", 6, 84, 120, 93],
    ["cat-resize-top.png", 167, 95, 90, 69],
    ["cat-crop-top.png", 305, 96, 67, 64],
    ["dog-output.png", 483, 100, 51, 61],
    ["cat-large-bottom.png", 6, 237, 120, 91],
    ["cat-resize-bottom.png", 219, 247, 90, 70],
    ["balloon-output.png", 460, 257, 99, 58],
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

  await addPng(slide, "top.input", path.join(assetDir, "cat-large-top.png"), { left: 6, top: 44, width: 120, height: 93 }, "Input cat image");
  await addPng(slide, "top.resize", path.join(assetDir, "cat-resize-top.png"), { left: 167, top: 55, width: 90, height: 69 }, "Resized cat image");
  await addPng(slide, "top.crop", path.join(assetDir, "cat-crop-top.png"), { left: 305, top: 56, width: 67, height: 64 }, "Center-cropped cat image");
  await addPng(slide, "top.output", path.join(assetDir, "dog-output.png"), { left: 483, top: 60, width: 51, height: 61 }, "Fixed-resolution dog output");

  arrow(slide, "top.arrow.resize", 126, 90, 166, 90);
  text(slide, "top.label.resize", "Resize", 122, 67, 48, 22, 8);
  arrow(slide, "top.arrow.crop", 257, 90, 304, 90);
  text(slide, "top.label.crop", "Center\nCrop", 255, 69, 50, 35, 10);
  arrow(slide, "top.arrow.dit", 372, 90, 383, 90);
  shape(slide, "top.dit", "roundRect", 384, 27, 57, 125, "#F4F4F4", "#25425F", 1);
  text(slide, "top.dit.label", "DiT", 389, 73, 47, 32, 18);
  arrow(slide, "top.arrow.output", 441, 90, 454, 90);
  shape(slide, "top.fixed.frame", "roundRect", 455, 27, 108, 125, "none", "#25425F", 1, true);
  text(slide, "top.fixed.title", "Fixed Resolution", 455, 35, 108, 24, 10);

  shape(slide, "divider", "line", 0, 166, 566, 0, "none", "#666666", 1, true);

  await addPng(slide, "bottom.input", path.join(assetDir, "cat-large-bottom.png"), { left: 6, top: 197, width: 120, height: 91 }, "Input cat image");
  await addPng(slide, "bottom.resize", path.join(assetDir, "cat-resize-bottom.png"), { left: 219, top: 207, width: 90, height: 70 }, "Resized cat image");
  await addPng(slide, "bottom.output", path.join(assetDir, "balloon-output.png"), { left: 460, top: 217, width: 99, height: 58 }, "Flexible-resolution balloon output");

  arrow(slide, "bottom.arrow.resize", 126, 242, 218, 242);
  text(slide, "bottom.label.resize", "Resize", 148, 219, 50, 22, 10);
  arrow(slide, "bottom.arrow.fit", 309, 242, 383, 242);
  shape(slide, "bottom.fit", "roundRect", 384, 180, 57, 126, "#F4F4F4", "#25425F", 1);
  text(slide, "bottom.fit.label", "FiT", 389, 226, 47, 32, 18, { color: "#FF0000" });
  arrow(slide, "bottom.arrow.output", 441, 242, 454, 242);
  shape(slide, "bottom.flexible.frame", "roundRect", 454, 180, 111, 126, "none", "#25425F", 1, true);
  text(slide, "bottom.flexible.title", "Flexible Resolution", 454, 188, 111, 24, 10);

  bracket(slide, "bracket.data", 6, 372, 311);
  bracket(slide, "bracket.generate", 384, 565, 311);
  text(slide, "caption.data", "Data Preprocess", 128, 323, 125, 23, 12);
  text(slide, "caption.generate", "Generate", 425, 323, 100, 23, 12);

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- FiT: Flexible Vision Transformer for Diffusion Model, ICML 2024, Figure 2: https://proceedings.mlr.press/v235/lu24k.html\n[/Sources]",
  );
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
