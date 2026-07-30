#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1216;
const H = 370;
const OUT_DIR = path.resolve("docs/strict-recreation/cvpr-sned-fig1");
const OUT = path.join(OUT_DIR, "editable.pptx");
const REFERENCE = path.resolve("docs/benchmark/references/cvpr-sned-fig1.png");

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
  item.rotation = options.rotation ?? 0;
  return item;
}

function line(slide, name, x1, y1, x2, y2, color = "#111111", width = 1.2) {
  const item = shape(slide, name, "line", Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), "none", color, width);
  item.flipHorizontal = x2 < x1;
  item.flipVertical = y2 < y1;
}

function arrow(slide, name, x1, y1, x2, y2, color = "#1010D4", width = 9) {
  line(slide, name, x1, y1, x2, y2, color, width);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
  const head = shape(slide, `${name}.head`, "triangle", x2 - 15, y2 - 15, 30, 30, color);
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

function network(slide, prefix, x, y, w, h, counts, options = {}) {
  const colors = options.colors ?? ["#4E73F1", "#F4B437", "#13D735", "#F27359"];
  const spacing = options.spacing ?? 29;
  const layers = counts.map((count, layerIndex) => {
    const yy = y + (counts.length === 1 ? h / 2 : layerIndex * h / (counts.length - 1));
    return Array.from({ length: count }, (_, index) => ({
      x: x + index * spacing,
      y: yy,
      fill: colors[layerIndex % colors.length],
    }));
  });
  let edgeIndex = 0;
  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    for (const from of layers[layerIndex]) {
      for (const to of layers[layerIndex + 1]) {
        line(slide, `${prefix}.edge.${edgeIndex}`, from.x, from.y, to.x, to.y, "#111111", options.edgeWidth ?? 1.1);
        edgeIndex += 1;
      }
    }
  }
  const diameter = options.nodeDiameter ?? 13;
  layers.forEach((layer, layerIndex) => {
    layer.forEach((node, nodeIndex) => {
      const fill = options.grayLast && nodeIndex === layer.length - 1 ? "#949494" : node.fill;
      shape(
        slide,
        `${prefix}.node.${layerIndex}.${nodeIndex}`,
        "ellipse",
        node.x - diameter / 2,
        node.y - diameter / 2,
        diameter,
        diameter,
        fill,
      );
    });
  });
}

async function main() {
  const assetDir = path.join(OUT_DIR, "assets");
  await fs.mkdir(assetDir, { recursive: true });
  const crops = [
    ["training-large.png", 70, 74, 94, 88],
    ["training-medium.png", 85, 170, 66, 57],
    ["training-small.png", 97, 240, 41, 44],
    ["output-large.png", 1077, 50, 104, 103],
    ["output-medium.png", 1094, 172, 62, 59],
    ["output-small.png", 1103, 273, 46, 45],
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

  text(slide, "training.title", "Training\nData", 31, 0, 115, 53, 22);
  await addPng(slide, "training.large", path.join(assetDir, "training-large.png"), { left: 45, top: 54, width: 94, height: 88 }, "High-resolution training data");
  await addPng(slide, "training.medium", path.join(assetDir, "training-medium.png"), { left: 60, top: 151, width: 66, height: 57 }, "Medium-resolution training data");
  await addPng(slide, "training.small", path.join(assetDir, "training-small.png"), { left: 72, top: 221, width: 41, height: 44 }, "Low-resolution training data");
  text(slide, "training.different", "Different\nResolution", 38, 273, 112, 54, 19);
  arrow(slide, "training.to-supernet", 151, 171, 205, 171);

  text(slide, "supernet.title", "SuperNet", 235, 39, 134, 37, 22);
  shape(slide, "supernet.frame", "roundRect", 219, 72, 166, 190, "#FFFFFF", "#111111", 2);
  network(slide, "supernet.graph", 241, 89, 122, 145, [4, 4, 4, 4], {
    grayLast: true,
    nodeDiameter: 18,
    edgeWidth: 1.2,
    spacing: 41,
  });
  text(slide, "supernet.caption", "Dynamic Cost Sampling", 199, 270, 207, 35, 20);

  text(slide, "resolution.a", "Resolution A", 398, 58, 114, 35, 18, { rotation: 325 });
  text(slide, "resolution.b", "Resolution B", 388, 132, 128, 34, 18);
  text(slide, "resolution.c", "Resolution C", 398, 205, 122, 35, 18, { rotation: 35 });
  line(slide, "resolution.arrow.a", 393, 129, 520, 43, "#111111", 2);
  const headA = shape(slide, "resolution.arrow.a.head", "triangle", 513, 34, 18, 18, "#111111");
  headA.rotation = 55;
  line(slide, "resolution.arrow.b", 393, 158, 520, 158, "#111111", 2);
  const headB = shape(slide, "resolution.arrow.b.head", "triangle", 513, 149, 18, 18, "#111111");
  headB.rotation = 90;
  line(slide, "resolution.arrow.c", 393, 183, 520, 274, "#111111", 2);
  const headC = shape(slide, "resolution.arrow.c.head", "triangle", 513, 265, 18, 18, "#111111");
  headC.rotation = 125;
  text(slide, "subnet.vertical", "Subnet with different model size", 430, 179, 220, 30, 15, { rotation: 270 });

  network(slide, "subnet.a.1", 570, 11, 87, 70, [4, 3, 4], { nodeDiameter: 13 });
  network(slide, "subnet.a.2", 713, 11, 86, 70, [3, 4, 3], { nodeDiameter: 13 });
  network(slide, "subnet.a.3", 853, 11, 58, 70, [2, 3, 3], { nodeDiameter: 13 });
  network(slide, "subnet.b.1", 571, 100, 87, 103, [2, 4, 4, 3], { nodeDiameter: 13 });
  network(slide, "subnet.b.2", 714, 100, 86, 103, [3, 3, 3, 4], { nodeDiameter: 13 });
  network(slide, "subnet.b.3", 853, 100, 58, 103, [2, 3, 3], { nodeDiameter: 13 });
  network(slide, "subnet.c.1", 571, 220, 87, 96, [3, 4, 4, 4], { nodeDiameter: 13 });
  network(slide, "subnet.c.2", 714, 220, 60, 96, [3, 3, 3, 2], { nodeDiameter: 13 });
  network(slide, "subnet.c.3", 854, 220, 90, 87, [2, 2, 4], { nodeDiameter: 13 });

  arrow(slide, "output.arrow.large", 966, 58, 1019, 58);
  arrow(slide, "output.arrow.medium", 966, 174, 1019, 174);
  arrow(slide, "output.arrow.small", 966, 285, 1019, 285);
  text(slide, "output.title", "Output", 1036, 0, 114, 39, 22);
  await addPng(slide, "output.large", path.join(assetDir, "output-large.png"), { left: 1052, top: 40, width: 104, height: 103 }, "Large generated image");
  await addPng(slide, "output.medium", path.join(assetDir, "output-medium.png"), { left: 1069, top: 162, width: 62, height: 59 }, "Medium generated image");
  await addPng(slide, "output.small", path.join(assetDir, "output-small.png"), { left: 1078, top: 263, width: 46, height: 45 }, "Small generated image");

  text(slide, "caption.a", "(a) SuperNet Training Process", 48, 329, 323, 37, 22);
  text(slide, "caption.b", "(b) Subnets with different size targeting different resolution options", 489, 329, 695, 37, 22);

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- SNED: Superposition Network Architecture Search for Efficient Video Diffusion Model, CVPR 2024, Figure 1: https://openaccess.thecvf.com/content/CVPR2024/html/Li_SNED_Superposition_Network_Architecture_Search_for_Efficient_Video_Diffusion_Model_CVPR_2024_paper.html\n[/Sources]",
  );
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
