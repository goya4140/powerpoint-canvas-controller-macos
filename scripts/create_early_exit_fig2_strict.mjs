#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 583;
const H = 374;
const OUT_DIR = path.resolve("docs/strict-recreation/icml-early-exit-fig2");
const OUT = path.join(OUT_DIR, "editable.pptx");
const REFERENCE = path.resolve("docs/benchmark/references/icml-early-exit-fig2.png");

function shape(slide, name, geometry, x, y, w, h, fill = "none", stroke = "none", strokeWidth = 1) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: stroke === "none"
      ? { style: "solid", fill: "none", width: 0 }
      : { style: "solid", fill: stroke, width: strokeWidth },
  });
}

function labelBox(slide, name, value, x, y, w, h, fill, size = 12) {
  const box = shape(slide, name, "rect", x, y, w, h, fill, "#222222", 0.8);
  box.text = value;
  box.text.style = {
    fontFamily: "Arial",
    fontSize: size,
    color: "#111111",
    alignment: "center",
    verticalAlignment: "middle",
  };
}

function line(slide, name, x1, y1, x2, y2, arrowEnd = false, color = "#222222", width = 1) {
  const item = shape(
    slide,
    name,
    "line",
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
    "none",
    color,
    width,
  );
  item.flipHorizontal = x2 < x1;
  item.flipVertical = y2 < y1;
  if (arrowEnd) {
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
    const head = shape(slide, `${name}.head`, "triangle", x2 - 3, y2 - 3, 6, 6, color);
    head.rotation = angle;
  }
}

function text(slide, name, value, x, y, w, h, size, options = {}) {
  const item = shape(slide, name, "textbox", x, y, w, h);
  item.text = value;
  item.text.style = {
    fontFamily: options.fontFamily ?? "Cambria Math",
    fontSize: size,
    italic: options.italic ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
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

function tower(slide, index, x, blocks, decoderY, skipBottom) {
  const topY = 55;
  labelBox(slide, `tower.${index}.top`, "", x, topY, 70, 39, "#DCEAF4");
  line(slide, `tower.${index}.stem.top`, x + 35, 94, x + 35, 106);
  for (const [blockIndex, block] of blocks.entries()) {
    labelBox(
      slide,
      `tower.${index}.block.${blockIndex}`,
      block.label,
      x,
      block.y,
      70,
      38,
      block.fill,
      12,
    );
    if (blockIndex < blocks.length - 1) {
      line(slide, `tower.${index}.stem.${blockIndex}`, x + 35, block.y + 38, x + 35, blocks[blockIndex + 1].y);
    }
  }
  labelBox(slide, `tower.${index}.decoder`, "Decoder", x, decoderY, 70, 20, "#E6F3DF", 11);
  if (blocks.length) {
    const last = blocks.at(-1);
    line(slide, `tower.${index}.to-decoder`, x + 35, last.y + 38, x + 35, decoderY);
  } else {
    line(slide, `tower.${index}.to-decoder`, x + 35, 94, x + 35, decoderY);
  }

  const skipX = x - 14;
  line(slide, `tower.${index}.skip.top`, skipX, 38, x + 35, 38);
  line(slide, `tower.${index}.skip.input`, x + 35, 38, x + 35, 55, true);
  line(slide, `tower.${index}.skip.left`, skipX, 38, skipX, skipBottom);
  line(slide, `tower.${index}.skip.bottom`, skipX, skipBottom, x + 35, skipBottom);
  line(slide, `tower.${index}.skip.return`, x + 35, skipBottom, x + 35, decoderY + 20);
}

async function main() {
  await fs.mkdir(path.join(OUT_DIR, "assets"), { recursive: true });
  const equation = path.join(OUT_DIR, "assets", "reverse-sde.png");
  execFileSync("python3", [
    "scripts/crop_image_asset.py",
    REFERENCE,
    equation,
    "96",
    "374",
    "404",
    "46",
  ]);

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  text(slide, "noise", "∼ 𝒩(0, I)", 0, 5, 92, 34, 20, { italic: true, align: "left" });
  line(slide, "noise.arrow", 27, 35, 27, 55, true);

  labelBox(slide, "partial.block1", "Block 1", 0, 57, 65, 38, "#DCEAF4", 12);
  line(slide, "partial.stem", 27, 95, 27, 108);
  labelBox(slide, "partial.decoder", "Decoder", 0, 108, 65, 20, "#E6F3DF", 11);

  tower(slide, 1, 83, [{ label: "Block 2", y: 108, fill: "#98C0E1" }], 159, 177);
  tower(slide, 2, 195, [{ label: "Block 2", y: 108, fill: "#98C0E1" }], 159, 177);
  tower(
    slide,
    3,
    295,
    [
      { label: "", y: 108, fill: "#98C0E1" },
      { label: "Block 3", y: 161, fill: "#FFF0C6" },
    ],
    212,
    248,
  );
  tower(
    slide,
    4,
    396,
    [
      { label: "", y: 108, fill: "#98C0E1" },
      { label: "Block 3", y: 161, fill: "#FFF0C6" },
    ],
    212,
    248,
  );
  tower(
    slide,
    5,
    496,
    [
      { label: "", y: 108, fill: "#98C0E1" },
      { label: "", y: 161, fill: "#FFF0C6" },
      { label: "Block 4", y: 212, fill: "#FFE6A1" },
    ],
    263,
    297,
  );
  line(slide, "output.arrow", 531, 283, 531, 315, true);
  text(slide, "output.label", "x₀", 510, 314, 42, 31, 21, { italic: true });

  await addPng(
    slide,
    "asset.reverse-sde",
    equation,
    { left: 96, top: 328, width: 404, height: 46 },
    "Reverse-time SDE equation",
  );

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- A Simple Early Exiting Framework for Accelerated Sampling in Diffusion Models, ICML 2024, Figure 2: https://proceedings.mlr.press/v235/moon24a.html\n[/Sources]",
  );
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
