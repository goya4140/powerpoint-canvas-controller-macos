#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1115;
const H = 213;
const OUT = path.resolve("docs/strict-recreation/acl-obsd-fig2/editable.pptx");
const REFERENCE = path.resolve("docs/benchmark/references/acl-obsd-fig2.png");
const ASSET_DIR = path.resolve("docs/strict-recreation/acl-obsd-fig2/assets");

function shape(slide, name, geometry, left, top, width, height, fill, stroke = "none", lineWidth = 1) {
  const item = slide.shapes.add({
    geometry,
    name,
    position: { left, top, width, height },
    fill,
    line: stroke === "none"
      ? { style: "solid", fill: "none", width: 0 }
      : { style: "solid", fill: stroke, width: lineWidth },
  });
  return item;
}

function text(slide, name, value, left, top, width, height, size, options = {}) {
  const item = shape(slide, name, "textbox", left, top, width, height, "none");
  item.text = value;
  item.text.style = {
    fontFamily: options.fontFamily ?? "Arial",
    fontSize: size,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
  return item;
}

function arrow(slide, name, x1, y1, x2, y2, width = 1.5) {
  const line = shape(
    slide,
    name,
    "line",
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
    "none",
    "#111111",
    width,
  );
  line.flipHorizontal = x2 < x1;
  line.flipVertical = y2 < y1;
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
  const head = shape(slide, `${name}.head`, "triangle", x2 - 4, y2 - 4, 8, 8, "#111111");
  head.rotation = angle;
}

async function addImage(slide, name, file, position, alt) {
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

async function main() {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const crops = [
    ["obs-input.png", 174, 104, 64, 69],
    ["initial-output.png", 541, 106, 80, 70],
    ["final-output.png", 922, 106, 71, 70],
  ];
  for (const [name, x, y, width, height] of crops) {
    execFileSync("python3", [
      "scripts/crop_image_asset.py",
      REFERENCE,
      path.join(ASSET_DIR, name),
      String(x),
      String(y),
      String(width),
      String(height),
    ]);
  }

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  shape(slide, "panel.overall", "roundRect", 108, 0, 900, 213, "#FFF9EA");
  shape(slide, "panel.initial", "roundRect", 249, 45, 239, 168, "#DCECCF");
  shape(slide, "panel.refinement", "roundRect", 630, 47, 238, 166, "#C9E1F3");

  text(slide, "title.initial", "Initial Decipherment", 249, 5, 239, 31, 23);
  text(slide, "title.refinement", "Zero-shot Refinement", 614, 5, 270, 31, 21);
  text(slide, "label.local-sampling", "Local Structural Sampling", 265, 49, 210, 25, 14);
  text(slide, "label.reference", "Reference Xᵣₑբ", 670, 45, 164, 25, 14);

  text(slide, "label.input-symbol", "X̃", 146, 59, 68, 28, 23, { fontFamily: "Cambria Math" });
  text(slide, "label.initial-symbol", "X₀", 526, 59, 68, 28, 23, { fontFamily: "Cambria Math" });
  text(slide, "label.final-symbol", "Xꜰ", 902, 59, 68, 28, 23, { fontFamily: "Cambria Math" });

  shape(slide, "frame.obs-input", "rect", 139, 92, 88, 88, "#FFFFFF", "#111111", 1);
  shape(slide, "frame.initial-output", "rect", 514, 92, 88, 88, "#FFFFFF", "#111111", 1);
  shape(slide, "frame.final-output", "rect", 891, 92, 88, 88, "#FFFFFF", "#111111", 1);

  await addImage(
    slide,
    "asset.obs-glyph",
    path.join(ASSET_DIR, "obs-input.png"),
    { left: 151, top: 101, width: 64, height: 69 },
    "OBS input glyph",
  );
  await addImage(
    slide,
    "asset.initial-glyph",
    path.join(ASSET_DIR, "initial-output.png"),
    { left: 518, top: 100, width: 80, height: 70 },
    "Initial decipherment output glyph",
  );
  await addImage(
    slide,
    "asset.final-glyph",
    path.join(ASSET_DIR, "final-output.png"),
    { left: 899, top: 100, width: 71, height: 70 },
    "Final refinement output glyph",
  );

  const initialLeft = shape(slide, "diffusion.initial.left", "trapezoid", 258, 92, 99, 87, "#9FB58F", "#274A61", 1.4);
  initialLeft.rotation = 90;
  const initialRight = shape(slide, "diffusion.initial.right", "trapezoid", 379, 92, 99, 87, "#9FB58F", "#274A61", 1.4);
  initialRight.rotation = 270;
  const refineLeft = shape(slide, "diffusion.refine.left", "trapezoid", 639, 92, 99, 87, "#6588A8", "#274A61", 1.4);
  refineLeft.rotation = 90;
  const refineRight = shape(slide, "diffusion.refine.right", "trapezoid", 759, 92, 99, 87, "#6588A8", "#274A61", 1.4);
  refineRight.rotation = 270;

  arrow(slide, "arrow.local-left", 309, 72, 309, 94);
  arrow(slide, "arrow.local-right", 429, 72, 429, 94);
  arrow(slide, "arrow.reference-left", 735, 79, 689, 99);
  arrow(slide, "arrow.reference-right", 761, 79, 808, 99);

  text(slide, "asset.reference-glyph", "龍", 737, 67, 24, 25, 18, { fontFamily: "STSong" });
  text(slide, "caption.obs-input", "OBS Input", 124, 184, 119, 27, 18);
  text(slide, "caption.initial-diffusion", "Diffusion", 312, 184, 111, 27, 18);
  text(slide, "caption.initial-output", "Initial Output", 493, 184, 130, 27, 18);
  text(slide, "caption.refine-diffusion", "Diffusion", 693, 184, 111, 27, 18);
  text(slide, "caption.final-output", "Final Output", 874, 184, 125, 27, 18);

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- Deciphering Oracle Bone Language with Diffusion Models, ACL 2024, Figure 2: https://aclanthology.org/2024.acl-long.831/\n[/Sources]",
  );

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
