#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { addLayeredNetwork, addReferenceArrow } from "./lib/reference_line_geometry.mjs";

const W = 1216;
const H = 370;
const OUT_DIR = path.resolve("docs/strict-recreation/cvpr-sned-fig1");
const OUT = path.join(OUT_DIR, "editable.pptx");
const REFERENCE = path.resolve("docs/benchmark/references/cvpr-sned-fig1.png");
const COLORS = {
  blue: "#5571FF",
  yellow: "#FFC63F",
  green: "#15FF2E",
  red: "#FF7755",
  gray: "#999999",
};

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

function nodes(y, xs, fill) {
  return xs.map((x) => ({ x, y, fill }));
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
  addReferenceArrow(slide, "training.to-supernet", { x: 151, y: 171 }, { x: 205, y: 171 }, {
    color: "#0200D4",
    width: 9,
    headLength: 30,
    headWidth: 30,
  });

  text(slide, "supernet.title", "SuperNet", 235, 39, 134, 37, 22);
  shape(slide, "supernet.frame", "roundRect", 218, 81, 168, 190, "#FFFFFF", "#111111", 2);
  addLayeredNetwork(slide, {
    name: "supernet.graph",
    layers: [
      [
        { x: 240, y: 98, fill: COLORS.blue },
        { x: 280, y: 98, fill: COLORS.blue },
        { x: 320, y: 98, fill: COLORS.gray },
        { x: 362, y: 98, fill: COLORS.gray },
      ],
      [
        { x: 240, y: 148, fill: COLORS.yellow },
        { x: 280, y: 148, fill: COLORS.yellow },
        { x: 320, y: 148, fill: COLORS.yellow },
        { x: 362, y: 148, fill: COLORS.gray },
      ],
      [
        { x: 241, y: 195, fill: COLORS.green },
        { x: 281, y: 195, fill: COLORS.green },
        { x: 321, y: 195, fill: COLORS.green },
        { x: 363, y: 195, fill: COLORS.green },
      ],
      [
        { x: 242, y: 243, fill: COLORS.red },
        { x: 282, y: 243, fill: COLORS.red },
        { x: 322, y: 243, fill: COLORS.red },
        { x: 363, y: 243, fill: COLORS.gray },
      ],
    ],
    nodeDiameter: 18,
    edgeWidth: 1.4,
    edgeColor: (from, to) => from.fill === COLORS.gray || to.fill === COLORS.gray ? COLORS.gray : "#111111",
  });
  text(slide, "supernet.caption", "Dynamic Cost Sampling", 199, 270, 207, 35, 20);

  text(slide, "resolution.a", "Resolution A", 398, 58, 114, 35, 18, { rotation: 325 });
  text(slide, "resolution.b", "Resolution B", 388, 132, 128, 34, 18);
  text(slide, "resolution.c", "Resolution C", 398, 205, 122, 35, 18, { rotation: 35 });
  addReferenceArrow(slide, "resolution.arrow.a", { x: 393, y: 137 }, { x: 520, y: 44 }, {
    width: 2,
    headLength: 18,
    headWidth: 18,
  });
  addReferenceArrow(slide, "resolution.arrow.b", { x: 393, y: 167 }, { x: 520, y: 167 }, {
    width: 2,
    headLength: 18,
    headWidth: 18,
  });
  addReferenceArrow(slide, "resolution.arrow.c", { x: 393, y: 193 }, { x: 520, y: 285 }, {
    width: 2,
    headLength: 18,
    headWidth: 18,
  });
  text(slide, "subnet.vertical", "Subnet with different model size", 430, 179, 220, 30, 15, { rotation: 270 });

  const subnetSpecs = [
    {
      name: "subnet.a.1",
      layers: [
        nodes(12, [570, 598, 626, 656], COLORS.blue),
        nodes(47, [569, 598, 626], COLORS.yellow),
        nodes(81, [570, 599, 627, 656], COLORS.green),
      ],
    },
    {
      name: "subnet.a.2",
      layers: [
        nodes(10, [713, 741, 770], COLORS.blue),
        nodes(45, [713, 741, 770, 799], COLORS.yellow),
        nodes(79, [714, 742], COLORS.green),
      ],
    },
    {
      name: "subnet.a.3",
      layers: [
        nodes(12, [853, 882], COLORS.blue),
        nodes(47, [853, 881, 910], COLORS.yellow),
        nodes(81, [854, 882, 911], COLORS.green),
      ],
    },
    {
      name: "subnet.b.1",
      layers: [
        nodes(100, [571, 600], COLORS.blue),
        nodes(135, [571, 600, 628, 658], COLORS.yellow),
        nodes(168, [572, 601, 629], COLORS.green),
        nodes(202, [573, 601, 629], COLORS.red),
      ],
    },
    {
      name: "subnet.b.2",
      layers: [
        nodes(100, [716, 744, 773], COLORS.blue),
        nodes(135, [716, 744, 773], COLORS.yellow),
        nodes(169, [717, 745], COLORS.green),
        nodes(203, [717, 746, 774, 803], COLORS.red),
      ],
    },
    {
      name: "subnet.b.3",
      layers: [
        nodes(100, [854, 882], COLORS.blue),
        nodes(135, [854, 882, 911], COLORS.yellow),
        nodes(169, [855, 883, 911], COLORS.green),
        nodes(203, [855], COLORS.red),
      ],
    },
    {
      name: "subnet.c.1",
      layers: [
        nodes(221, [571, 600], COLORS.blue),
        nodes(256, [571, 600, 628, 657], COLORS.yellow),
        nodes(290, [572, 601, 629, 658], COLORS.green),
        nodes(324, [573, 601, 629], COLORS.red),
      ],
    },
    {
      name: "subnet.c.2",
      layers: [
        nodes(219, [716, 745, 773], COLORS.blue),
        nodes(254, [716, 745, 773], COLORS.yellow),
        nodes(288, [717, 746, 774], COLORS.green),
        nodes(322, [717, 746], COLORS.red),
      ],
    },
    {
      name: "subnet.c.3",
      layers: [
        nodes(237, [857, 885], COLORS.blue),
        nodes(272, [857, 885], COLORS.yellow),
        nodes(306, [857, 886, 914, 943], COLORS.green),
      ],
      omit: [[1, 1, 3]],
    },
  ];
  subnetSpecs.forEach((spec) => addLayeredNetwork(slide, {
    ...spec,
    nodeDiameter: 12,
    edgeWidth: 1.4,
  }));

  const outputArrowStyle = { color: "#0200D4", width: 9, headLength: 30, headWidth: 30 };
  addReferenceArrow(slide, "output.arrow.large", { x: 966, y: 58 }, { x: 1019, y: 58 }, outputArrowStyle);
  addReferenceArrow(slide, "output.arrow.medium", { x: 966, y: 174 }, { x: 1019, y: 174 }, outputArrowStyle);
  addReferenceArrow(slide, "output.arrow.small", { x: 966, y: 285 }, { x: 1019, y: 285 }, outputArrowStyle);
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
