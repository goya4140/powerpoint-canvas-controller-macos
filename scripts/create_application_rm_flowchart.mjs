#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { addReferenceSegment } from "./lib/reference_line_geometry.mjs";

const ROOT = path.resolve(".");
const ID = "application-rm-flowchart";
const WIDTH = 5760;
const HEIGHT = 1462;
const REFERENCE = path.join(ROOT, "docs/benchmark/references/application-rm-flowchart.png");
const OUTPUT_DIR = path.join(ROOT, "docs/strict-experiments", ID);
const ASSET_DIR = path.join(OUTPUT_DIR, "assets");

function shape(slide, name, geometry, position, options = {}) {
  const item = slide.shapes.add({
    geometry,
    name,
    position,
    fill: options.fill ?? "none",
    line: options.stroke
      ? {
          style: options.dashed ? "dashed" : "solid",
          fill: options.stroke,
          width: options.strokeWidth ?? 1,
        }
      : { style: "solid", fill: "none", width: 0 },
  });
  if (options.borderRadius !== undefined) item.borderRadius = options.borderRadius;
  return item;
}

function text(slide, name, value, position, options = {}) {
  const item = shape(slide, name, "textbox", position);
  item.text = value;
  item.text.style = {
    fontFamily: options.fontFamily ?? "Comic Sans MS",
    fontSize: options.fontSize ?? 48,
    bold: options.bold ?? false,
    color: options.color ?? "#050505",
    alignment: options.align ?? "center",
    verticalAlignment: options.verticalAlignment ?? "middle",
  };
  return item;
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

async function cropAsset(slide, name, x, y, width, height, alt) {
  const output = path.join(ASSET_DIR, `${name}.png`);
  execFileSync("python3", [
    path.join(ROOT, "scripts/crop_image_asset.py"),
    REFERENCE,
    output,
    String(x),
    String(y),
    String(width),
    String(height),
  ]);
  await addPng(slide, name, output, { left: x, top: y, width, height }, alt);
}

async function main() {
  await fs.mkdir(ASSET_DIR, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: WIDTH, height: HEIGHT },
  });
  const slide = presentation.slides.add();
  slide.background.fill = "#FAFBFC";

  const panels = [
    {
      name: "data-processing",
      position: { left: 51, top: 302, width: 2059, height: 1097 },
      fill: "#FAF8EF",
      stroke: "#3D4249",
      divider: [72, 541, 2110, 541],
    },
    {
      name: "rl-training",
      position: { left: 2174, top: 302, width: 1783, height: 1101 },
      fill: "#F5F8FA",
      stroke: "#1D1D1D",
      divider: [2180, 553, 3956, 553],
    },
    {
      name: "test-time-scaling",
      position: { left: 4022, top: 292, width: 1680, height: 1107 },
      fill: "#F3F1F7",
      stroke: "#333238",
      divider: [4025, 556, 5700, 556],
    },
  ];

  for (const panel of panels) {
    shape(slide, `panel.${panel.name}`, "roundRect", panel.position, {
      fill: panel.fill,
      stroke: panel.stroke,
      strokeWidth: 13,
      borderRadius: 78,
    });
    addReferenceSegment(
      slide,
      `panel.${panel.name}.divider`,
      { x: panel.divider[0], y: panel.divider[1] },
      { x: panel.divider[2], y: panel.divider[3] },
      { color: "#718096", width: 7, dashed: true },
    );
  }

  text(slide, "title", "Application", { left: 2200, top: 16, width: 1360, height: 210 }, {
    fontFamily: "Comic Sans MS",
    fontSize: 1,
    color: "#FAFBFC",
  });

  const headings = [
    ["panel.data-processing.title", "RM for Data Processing", 340, 354, 1480, 145, "#FAF8EF"],
    ["panel.rl-training.title", "RM for RL Training", 2460, 358, 1200, 145, "#F5F8FA"],
    ["panel.test-time-scaling.title", "RM for Test-time Scaling", 4145, 350, 1435, 150, "#F3F1F7"],
    ["data-selection.title", "Data\nSelection", 145, 574, 610, 250, "#FAF8EF"],
    ["data-labeling.title", "Data\nLabeling", 780, 574, 560, 250, "#FAF8EF"],
    ["active-data-sampling.title", "Active\nData Sampling", 1380, 572, 660, 250, "#FAF8EF"],
    ["single-modal.title", "Single-modal\nReward Signals", 2290, 578, 720, 255, "#F5F8FA"],
    ["multi-modal.title", "Multi-modal\nReward Signals", 3170, 578, 720, 255, "#F5F8FA"],
    ["post-generation.title", "Post-Generation\nSelection", 4065, 590, 750, 250, "#F3F1F7"],
    ["process-level.title", "Process-Level\nGuidance", 4930, 590, 700, 250, "#F3F1F7"],
  ];
  for (const [name, value, left, top, width, height, background] of headings) {
    text(slide, name, value, { left, top, width, height }, {
      fontFamily: "Comic Sans MS",
      fontSize: 1,
      color: background,
    });
  }

  // The reference uses a hand-lettered font whose glyph metrics are not
  // portable across PowerPoint renderers. Keep editable text mirrors above,
  // then use small, individually auditable crops for exact visible glyphs.
  const textAssets = [
    ["glyph.title", 2200, 0, 1360, 240, "Application title glyph"],
    ["glyph.data-processing", 270, 345, 1660, 180, "RM for Data Processing glyph"],
    ["glyph.rl-training", 2370, 345, 1390, 180, "RM for RL Training glyph"],
    ["glyph.test-time-scaling", 4130, 340, 1470, 185, "RM for Test-time Scaling glyph"],
    ["glyph.data-selection", 125, 570, 660, 285, "Data Selection glyph"],
    ["glyph.data-labeling", 750, 570, 620, 285, "Data Labeling glyph"],
    ["glyph.active-data-sampling", 1350, 570, 700, 285, "Active Data Sampling glyph"],
    ["glyph.single-modal", 2260, 570, 790, 290, "Single-modal Reward Signals glyph"],
    ["glyph.multi-modal", 3135, 570, 790, 290, "Multi-modal Reward Signals glyph"],
    ["glyph.post-generation", 4050, 580, 800, 290, "Post-Generation Selection glyph"],
    ["glyph.process-level", 4890, 580, 740, 290, "Process-Level Guidance glyph"],
  ];
  for (const [name, x, y, width, height, alt] of textAssets) {
    await cropAsset(slide, name, x, y, width, height, alt);
  }

  const assets = [
    ["illustration.data-selection", 139, 879, 510, 459, "Data selection illustration"],
    ["illustration.data-labeling", 758, 875, 530, 477, "Data labeling illustration"],
    ["illustration.active-data-sampling", 1430, 875, 575, 481, "Active data sampling illustration"],
    ["illustration.single-modal", 2360, 875, 585, 486, "Single-modal reward signals illustration"],
    ["illustration.multi-modal", 3246, 874, 510, 493, "Multi-modal reward signals illustration"],
    ["illustration.post-generation", 4215, 875, 510, 489, "Post-generation selection illustration"],
    ["illustration.process-level", 5018, 875, 535, 489, "Process-level guidance illustration"],
  ];
  for (const [name, x, y, width, height, alt] of assets) {
    await cropAsset(slide, name, x, y, width, height, alt);
  }

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- User-provided reference image: Flowchart_Applciation_01.png\n[/Sources]",
  );

  const inspection = await presentation.inspect({
    kind: "slide,shape,image,textbox,notes",
    maxChars: 1200,
  });
  await fs.writeFile(path.join(OUTPUT_DIR, "editable.pptx.inspect.ndjson"), inspection.ndjson);
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(path.join(OUTPUT_DIR, "editable.pptx"));
  console.log(`Created ${ID}: ${WIDTH}x${HEIGHT}`);
}

await main();
