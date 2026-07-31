#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import {
  addReferenceArrow,
  addReferenceSegment,
} from "./lib/reference_line_geometry.mjs";

const ROOT = path.resolve(".");

function shape(slide, name, geometry, position, options = {}) {
  return slide.shapes.add({
    geometry,
    name,
    position,
    fill: options.fill ?? "none",
    line: options.stroke
      ? { style: options.dashed ? "dashed" : "solid", fill: options.stroke, width: options.strokeWidth ?? 1 }
      : { style: "solid", fill: "none", width: 0 },
  });
}

function text(slide, name, value, position, options = {}) {
  const item = shape(slide, name, "textbox", position);
  item.text = value;
  item.text.style = {
    fontFamily: options.fontFamily ?? "Arial",
    fontSize: options.fontSize ?? 16,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "center",
    verticalAlignment: options.verticalAlignment ?? "middle",
  };
  if (options.rotation) item.rotation = options.rotation;
  return item;
}

function box(slide, name, position, options = {}) {
  return shape(slide, name, options.geometry ?? "rect", position, {
    fill: options.fill ?? "#FFFFFF",
    stroke: options.stroke ?? "#111111",
    strokeWidth: options.strokeWidth ?? 1.4,
    dashed: options.dashed,
  });
}

function labelBox(slide, name, value, position, options = {}) {
  box(slide, `${name}.box`, position, options);
  return text(slide, `${name}.text`, value, position, options);
}

function line(slide, name, x1, y1, x2, y2, options = {}) {
  return addReferenceSegment(slide, name, { x: x1, y: y1 }, { x: x2, y: y2 }, options);
}

function arrow(slide, name, x1, y1, x2, y2, options = {}) {
  return addReferenceArrow(slide, name, { x: x1, y: y1 }, { x: x2, y: y2 }, {
    color: options.color ?? "#111111",
    width: options.width ?? 1.5,
    headLength: options.headLength ?? 12,
    headWidth: options.headWidth ?? 12,
    dashed: options.dashed,
  });
}

function polyArrow(slide, name, points, options = {}) {
  points.slice(0, -2).forEach((point, index) => {
    const next = points[index + 1];
    line(slide, `${name}.segment.${index}`, point[0], point[1], next[0], next[1], options);
  });
  const from = points.at(-2);
  const to = points.at(-1);
  arrow(slide, `${name}.end`, from[0], from[1], to[0], to[1], options);
}

function node(slide, name, x, y, r, fill, value = "", options = {}) {
  shape(slide, name, "ellipse", { left: x - r, top: y - r, width: r * 2, height: r * 2 }, {
    fill,
    stroke: options.stroke ?? "#1177BB",
    strokeWidth: options.strokeWidth ?? 1,
  });
  if (value) {
    text(slide, `${name}.label`, value, { left: x - r, top: y - r, width: r * 2, height: r * 2 }, {
      fontSize: options.fontSize ?? Math.max(8, r),
      color: options.color ?? "#111111",
    });
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

async function cropAsset(ctx, name, sx, sy, sw, sh, position = null, alt = name) {
  const output = path.join(ctx.assetDir, `${name}.png`);
  execFileSync("python3", [
    "scripts/crop_image_asset.py",
    ctx.reference,
    output,
    String(sx),
    String(sy),
    String(sw),
    String(sh),
  ]);
  await addPng(
    ctx.slide,
    name,
    output,
    position ?? {
      left: sx - ctx.crop.left,
      top: sy - ctx.crop.top,
      width: sw,
      height: sh,
    },
    alt,
  );
}

function title(slide, name, value, x, y, w, h, size = 17, options = {}) {
  return text(slide, name, value, { left: x, top: y, width: w, height: h }, {
    fontSize: size,
    bold: options.bold ?? true,
    align: options.align ?? "center",
    color: options.color,
    fontFamily: options.fontFamily,
  });
}

async function renderGrace(ctx) {
  const s = ctx.slide;
  line(s, "divider.1", 387, 84, 387, 329, { color: "#333333", width: 1, dashed: true });
  line(s, "divider.2", 764, 84, 764, 329, { color: "#333333", width: 1, dashed: true });
  const panels = [
    { x: 58, id: "12138", image: [84, 261, 97, 65], caption: "(a) Learning to memorize" },
    { x: 431, id: "12138", caption: "(b) Learning to retrieve" },
    { x: 806, id: "13768", image: [831, 14, 99, 70], caption: "(c) Inference" },
  ];
  for (const [index, panel] of panels.entries()) {
    box(s, `mllm.${index}.frame`, { left: panel.x, top: 95, width: 287, height: 139 }, {
      geometry: "roundRect",
      fill: "#F6F6F6",
      stroke: "#555555",
      strokeWidth: 1,
    });
    title(s, `mllm.${index}.title`, "MLLM", panel.x + 14, 108, 100, 28, 17);
    labelBox(s, `mllm.${index}.visual`, "Visual\nEncoder", {
      left: panel.x + 11,
      top: 159,
      width: 128,
      height: 64,
    }, { geometry: "roundRect", fill: "#A8D9F0", stroke: "#058AC1", fontSize: 17, bold: true });
    labelBox(s, `mllm.${index}.language`, "Language\nModel", {
      left: panel.x + 160,
      top: 109,
      width: 108,
      height: 72,
    }, { geometry: "roundRect", fill: "#FFDBB0", stroke: "#DF7800", fontSize: 17, bold: true });
    arrow(s, `mllm.${index}.visual-language`, panel.x + 139, 145, panel.x + 160, 145, { width: 1.4 });
    arrow(s, `mllm.${index}.input-visual`, panel.x + 75, 260, panel.x + 75, 223, { width: 1.4 });
    arrow(s, `mllm.${index}.query-language`, panel.x + 214, 253, panel.x + 214, 181, { width: 1.4 });
    arrow(s, `mllm.${index}.identifier`, panel.x + 214, 109, panel.x + 214, 72, { width: 1.4 });
    title(s, `mllm.${index}.id`, `id: ${panel.id}`, panel.x + 154, 39, 126, 30, 18);
    title(s, `mllm.${index}.caption`, panel.caption, panel.x + 14, 330, 260, 32, 17);
  }
  await cropAsset(ctx, "memorize.image", 84, 261, 97, 65, null, "Training image");
  await cropAsset(ctx, "inference.image", 831, 14, 99, 70, null, "Query image");
  arrow(s, "inference.image-id", 934, 58, 968, 58, { width: 1.4, dashed: true });
  text(s, "memorize.prompt", "Predict the identifier\nfor the <image>", { left: 190, top: 250, width: 180, height: 53 }, {
    fontSize: 16,
    bold: true,
  });
  text(s, "retrieve.prompt", "Predict the image identifier\ncorresponding to the given\nquery: A girl hops across\nthe river, from rock to rock.", { left: 481, top: 246, width: 245, height: 79 }, {
    fontSize: 15,
    bold: true,
  });
  text(s, "inference.prompt", "Predict the image identifier\ncorresponding to the given query:\nThree dogs play together in a field.", { left: 836, top: 244, width: 278, height: 69 }, {
    fontSize: 15,
    bold: true,
  });
}

async function renderEx2(ctx) {
  const s = ctx.slide;
  title(s, "panel.a", "(A)", 6, 4, 58, 30, 23, { bold: false });
  title(s, "panel.b", "(B)", 650, 4, 58, 30, 23, { bold: false });
  line(s, "panel.divider", 646, 0, 646, 252, { color: "#111111", width: 2, dashed: true });
  labelBox(s, "prompt", "Describe\nAbyssinian", { left: 26, top: 31, width: 115, height: 43 }, {
    fill: "#FFFFFF", stroke: "#888888", dashed: true, fontSize: 16, fontFamily: "Courier New",
  });
  labelBox(s, "llm.left", "LLM\nAgent", { left: 64, top: 132, width: 101, height: 56 }, {
    fill: "#C7AFD4", stroke: "#765780", fontSize: 19,
  });
  labelBox(s, "vlm", "VLM", { left: 270, top: 132, width: 101, height: 56 }, {
    fill: "#C7AFD4", stroke: "#765780", fontSize: 20,
  });
  labelBox(s, "llm.right", "LLM\nAgent", { left: 481, top: 103, width: 102, height: 56 }, {
    fill: "#C7AFD4", stroke: "#765780", fontSize: 18,
  });
  text(s, "fire", "🔥", { left: 47, top: 113, width: 29, height: 35 }, { fontSize: 25 });
  text(s, "snow", "❄", { left: 255, top: 112, width: 28, height: 36 }, { fontSize: 25, color: "#28A8FF" });
  await cropAsset(ctx, "cat", 314, 27, 66, 51, null, "Abyssinian cat");
  text(s, "response", "Response", { left: 170, top: 70, width: 108, height: 28 }, { fontSize: 14 });
  text(s, "similarity", "Image-Response\nCosine Similarity", { left: 153, top: 207, width: 160, height: 44 }, { fontSize: 15 });
  text(s, "descriptions.a", "• Describe Abyssinian\n• ...\n• Describe Sphynx", { left: 434, top: 4, width: 184, height: 65 }, {
    fontSize: 15, align: "left", fontFamily: "Courier New",
  });
  text(s, "descriptions.b", "• Slender Cat\n• ...\n• Bald Cat", { left: 461, top: 161, width: 156, height: 76 }, {
    fontSize: 15, align: "left", fontFamily: "Courier New",
  });
  polyArrow(s, "loop.prompt", [[37, 76], [20, 113], [49, 157]], { width: 1.4 });
  polyArrow(s, "loop.response", [[113, 122], [184, 81], [322, 121]], { width: 1.4 });
  polyArrow(s, "loop.image", [[322, 79], [412, 101], [385, 158]], { width: 1.4 });
  polyArrow(s, "loop.similarity", [[326, 192], [215, 229], [114, 200]], { width: 1.4 });
  polyArrow(s, "loop.llm", [[583, 130], [609, 169], [583, 191]], { width: 1.4 });
  await cropAsset(ctx, "inspector.icon", 901, 13, 30, 27, { left: 901, top: 13, width: 30, height: 27 }, "Magnifier");
  labelBox(s, "inspector", "Inspector", { left: 923, top: 21, width: 113, height: 47 }, {
    fill: "#C7AFD4", stroke: "#765780", fontSize: 19,
  });
  await cropAsset(ctx, "human", 930, 158, 69, 82, null, "Human inspector");
  labelBox(s, "attributes", "Attributes\ncontribute to\nthis VLM’s\nrepresenta-\ntions", {
    left: 675, top: 141, width: 136, height: 107,
  }, { fill: "#FFFFFF", stroke: "#777777", dashed: true, fontSize: 15, fontFamily: "Courier New" });
  text(s, "concepts", "• Slender Cat\n• ...\n• Bald Cat", { left: 693, top: 4, width: 150, height: 60 }, {
    fontSize: 15, align: "left", fontFamily: "Courier New",
  });
  text(s, "attribute-list", "• W/ Attributes\n• ...\n• W/ Attributes", { left: 1016, top: 96, width: 146, height: 74 }, {
    fontSize: 14, align: "left", fontFamily: "Courier New",
  });
  arrow(s, "concepts-inspector", 824, 44, 879, 44, { width: 1.5 });
  polyArrow(s, "inspector-output", [[1064, 44], [1113, 44], [1113, 68]], { width: 1.5 });
  polyArrow(s, "output-human", [[1114, 170], [1114, 216], [1063, 216]], { width: 1.5 });
  arrow(s, "human-attributes", 886, 216, 832, 216, { width: 1.5 });
}

async function renderAddp(ctx) {
  const s = ctx.slide;
  text(s, "legend.decode", "Token-to-Pixel\nDecoding", { left: 78, top: 111, width: 105, height: 45 }, {
    fontFamily: "Times New Roman", fontSize: 15,
  });
  text(s, "legend.generate", "Pixel-to-Token\nGeneration", { left: 78, top: 160, width: 105, height: 45 }, {
    fontFamily: "Times New Roman", fontSize: 15,
  });
  arrow(s, "legend.blue", 46, 129, 75, 129, { color: "#3172D5", width: 1.4, headLength: 9, headWidth: 8 });
  arrow(s, "legend.red", 46, 177, 75, 177, { color: "#D7191C", width: 1.4, headLength: 9, headWidth: 8 });
  title(s, "process", "Alternating\nDenoising\nProcess", 55, 231, 116, 68, 17, { fontFamily: "Times New Roman" });
  const matrixCrops = [
    ["matrix.z0", 218, 157, 53, 70],
    ["matrix.zbar0", 299, 157, 58, 70],
    ["matrix.zt", 488, 157, 54, 70],
    ["matrix.zbart", 569, 157, 58, 70],
    ["matrix.zT", 757, 157, 54, 70],
    ["matrix.zbarT", 838, 157, 58, 70],
  ];
  for (const [name, x, y, w, h] of matrixCrops) await cropAsset(ctx, name, x, y, w, h);
  const photos = [
    ["photo.x0", 184, 265, 76, 77],
    ["photo.x1", 311, 265, 76, 77],
    ["photo.xt", 451, 265, 78, 77],
    ["photo.xt1", 579, 265, 78, 77],
    ["photo.xT", 723, 265, 77, 77],
  ];
  for (const [name, x, y, w, h] of photos) await cropAsset(ctx, name, x, y, w, h);
  const labels = [
    ["z0", "z₀", 218, 105], ["zb0", "z̄₀", 299, 105],
    ["zt", "zₜ", 488, 105], ["zbt", "z̄ₜ", 569, 105],
    ["zT", "zT", 757, 105], ["zbT", "z̄T", 838, 105],
    ["x0", "x₀", 201, 301], ["x1", "x₁", 329, 301],
    ["xt", "xₜ", 473, 301], ["xt1", "xₜ₊₁", 592, 301], ["xT", "xT", 744, 301],
  ];
  for (const [name, value, x, y] of labels) {
    text(s, `label.${name}`, value, { left: x - 14, top: y, width: 60, height: 23 }, {
      fontFamily: "Times New Roman", fontSize: 16, italic: true,
    });
  }
  const blue = "#3172D5";
  const red = "#D7191C";
  arrow(s, "decode.0", 245, 227, 222, 265, { color: blue, width: 1.3 });
  arrow(s, "generate.0", 312, 265, 326, 227, { color: red, width: 1.3 });
  arrow(s, "decode.t", 514, 227, 489, 265, { color: blue, width: 1.3 });
  arrow(s, "generate.t", 579, 265, 598, 227, { color: red, width: 1.3 });
  arrow(s, "decode.T", 784, 227, 762, 265, { color: blue, width: 1.3 });
  text(s, "ellipsis.1", "···", { left: 397, top: 265, width: 42, height: 30 }, { fontSize: 24 });
  text(s, "ellipsis.2", "···", { left: 668, top: 265, width: 42, height: 30 }, { fontSize: 24 });
}

async function renderDiffuco(ctx) {
  const s = ctx.slide;
  title(s, "forward", "Forward Process", 290, 17, 240, 42, 27, { color: "#2F80ED", bold: false });
  title(s, "reverse", "Reverse Process", 289, 343, 240, 42, 26, { color: "#6AA84F", bold: false });
  arrow(s, "forward.arrow", 1007, 80, 226, 80, { color: "#3979D7", width: 4, headLength: 24, headWidth: 24 });
  arrow(s, "reverse.arrow", 226, 335, 1010, 335, { color: "#6AA84F", width: 4, headLength: 24, headWidth: 24 });
  const graphCrops = [
    ["graph.left", 161, 202, 138, 141],
    ["graph.middle", 571, 202, 139, 141],
    ["graph.right", 948, 202, 140, 141],
  ];
  for (const [name, x, y, w, h] of graphCrops) await cropAsset(ctx, name, x, y, w, h);
  title(s, "state.left", "Xᵀ", 187, 80, 80, 50, 35, { fontFamily: "Times New Roman", bold: false });
  title(s, "state.middle", "Xᵀ⁄₂", 578, 80, 100, 50, 35, { fontFamily: "Times New Roman", bold: false });
  title(s, "state.right", "X₀", 970, 80, 90, 50, 35, { fontFamily: "Times New Roman", bold: false });
  text(s, "stats.left", "Set size: 10\n#violations: 12", { left: 169, top: 142, width: 120, height: 48 }, { fontSize: 15 });
  text(s, "stats.middle", "Set size: 9\n#violations: 9", { left: 580, top: 142, width: 120, height: 48 }, { fontSize: 15 });
  text(s, "stats.right", "Set size: 6\n#violations: 0", { left: 965, top: 142, width: 120, height: 48 }, { fontSize: 15 });
  arrow(s, "backward.1", 906, 159, 869, 159, { color: "#3979D7", width: 4, headLength: 18, headWidth: 18 });
  arrow(s, "backward.2", 765, 159, 728, 159, { color: "#3979D7", width: 4, headLength: 18, headWidth: 18 });
  arrow(s, "backward.3", 552, 159, 513, 159, { color: "#3979D7", width: 4, headLength: 18, headWidth: 18 });
  arrow(s, "backward.4", 406, 159, 367, 159, { color: "#3979D7", width: 4, headLength: 18, headWidth: 18 });
  arrow(s, "forward.1", 362, 261, 405, 261, { color: "#6AA84F", width: 4, headLength: 18, headWidth: 18 });
  arrow(s, "forward.2", 510, 261, 553, 261, { color: "#6AA84F", width: 4, headLength: 18, headWidth: 18 });
  arrow(s, "forward.3", 717, 261, 761, 261, { color: "#6AA84F", width: 4, headLength: 18, headWidth: 18 });
  arrow(s, "forward.4", 866, 261, 910, 261, { color: "#6AA84F", width: 4, headLength: 18, headWidth: 18 });
  text(s, "ellipsis.top.1", "···", { left: 444, top: 190, width: 50, height: 30 }, { fontSize: 25 });
  text(s, "ellipsis.top.2", "···", { left: 806, top: 190, width: 50, height: 30 }, { fontSize: 25 });
}

async function renderGem(ctx) {
  const s = ctx.slide;
  line(s, "divider", 472, 0, 472, 276, { color: "#111111", width: 1, dashed: true });
  await cropAsset(ctx, "flat.image", 15, 34, 68, 99, null, "Flat DRL example");
  await cropAsset(ctx, "structural.image", 15, 176, 68, 99, null, "Structural DRL example");
  await cropAsset(ctx, "gem.image", 482, 48, 123, 183, null, "GEM input image");
  labelBox(s, "flat.encoder", "Encoder", { left: 105, top: 34, width: 56, height: 99 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#888888", fontSize: 12, color: "#777777",
  });
  labelBox(s, "struct.encoder", "Encoder", { left: 105, top: 176, width: 56, height: 54 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#888888", fontSize: 12, color: "#777777",
  });
  arrow(s, "flat.image-encoder", 85, 82, 101, 82, { color: "#DDDDDD", width: 6, headLength: 12, headWidth: 12 });
  arrow(s, "struct.image-encoder", 85, 203, 101, 203, { color: "#DDDDDD", width: 6, headLength: 12, headWidth: 12 });
  title(s, "flat.title", "VAE-based flat DRL", 166, 2, 150, 27, 14, { bold: false, color: "#555555" });
  title(s, "struct.title", "VAE-based structural DRL", 159, 145, 186, 27, 14, { bold: false, color: "#555555" });
  const attributes = ["hat", "eyes", "mustache", "smile", "hairline"];
  attributes.forEach((value, index) => {
    labelBox(s, `flat.attr.${index}`, value, { left: 221, top: 35 + index * 19, width: 66, height: 15 }, {
      fill: "#F7F7F7", stroke: "#999999", strokeWidth: 0.8, fontSize: 10, color: "#777777",
    });
  });
  text(s, "flat.errors", "✖ Impractical in real scenarios\n✖ Negligence of logical relations\n✖ Fundamentally impossible to achieve", {
    left: 294, top: 53, width: 174, height: 70,
  }, { fontSize: 10, align: "left", color: "#C93333" });
  await cropAsset(ctx, "struct.graph", 164, 199, 154, 72, null, "Hierarchical and causal latent graph");
  text(s, "struct.errors", "✖ Rely on priors and supervisions\n✖ binary or unidirectional relations\n✖ Inflexible architecture", {
    left: 319, top: 188, width: 148, height: 70,
  }, { fontSize: 10, align: "left", color: "#C93333" });
  title(s, "gem.title", "GEM: β-VAE and MLLM based DRL Framework with DisGraph", 510, 1, 493, 33, 17, {
    bold: true,
  });
  labelBox(s, "gem.encoder", "Encoder\nβ-VAE", { left: 628, top: 51, width: 90, height: 75 }, {
    geometry: "roundRect", fill: "#DDEEF7", stroke: "#111111", fontSize: 17,
  });
  labelBox(s, "gem.mllm", "MLLM\nGPT-4o", { left: 628, top: 155, width: 90, height: 75 }, {
    geometry: "roundRect", fill: "#F7D9A5", stroke: "#111111", fontSize: 17,
  });
  arrow(s, "gem.image-encoder", 605, 87, 624, 87, { color: "#DDEEF7", width: 8, headLength: 14, headWidth: 14 });
  arrow(s, "gem.image-mllm", 605, 193, 624, 193, { color: "#F7D9A5", width: 8, headLength: 14, headWidth: 14 });
  box(s, "disgraph.frame", { left: 765, top: 50, width: 238, height: 181 }, {
    fill: "#F8FAFD", stroke: "#263B68", strokeWidth: 1.5, dashed: true,
  });
  title(s, "disgraph.title", "DisGraph", 836, 52, 100, 25, 15);
  const graphNodes = [
    [831, 88, "hat"], [979, 88, "hairline"], [790, 142, "eyes"], [878, 135, "smile"],
    [943, 129, "age"], [856, 181, "mouth"], [948, 204, "beard"], [884, 180, "mustache"],
  ];
  const graphEdges = [
    [0, 1], [0, 3], [0, 5], [1, 4], [1, 7], [2, 3], [2, 5],
    [3, 4], [3, 5], [3, 7], [4, 6], [4, 7], [5, 6], [5, 7], [7, 6],
  ];
  for (const [index, [a, b]] of graphEdges.entries()) {
    line(s, `disgraph.edge.${index}`, graphNodes[a][0], graphNodes[a][1], graphNodes[b][0], graphNodes[b][1], {
      color: "#E58B1A", width: 1.2,
    });
  }
  graphNodes.forEach(([x, y, value], index) => node(s, `disgraph.node.${index}`, x, y, 10, "#FFFFFF", value, {
    stroke: "#0071BC", fontSize: 7,
  }));
  arrow(s, "encoder-graph", 718, 87, 818, 87, { color: "#0071BC", width: 1.2, dashed: true });
  arrow(s, "mllm-graph", 718, 193, 846, 193, { color: "#E58B1A", width: 1.2, dashed: true });
  text(s, "gem.benefits", "✓ Unsupervised    ✓ Logical and practical    ✓ Rely on bidirectional & weighted relations    ✓ Interpretable", {
    left: 476, top: 249, width: 533, height: 31,
  }, { fontSize: 11, color: "#098C4A" });
}

async function renderSd4match(ctx) {
  const s = ctx.slide;
  await cropAsset(ctx, "image.a", 15, 27, 132, 135, null, "Source image A");
  await cropAsset(ctx, "image.b", 15, 192, 132, 132, null, "Source image B");
  text(s, "image.a.label", "Iᴬ", { left: 55, top: 163, width: 58, height: 30 }, {
    fontFamily: "Times New Roman", fontSize: 23, italic: true,
  });
  text(s, "image.b.label", "Iᴮ", { left: 55, top: 325, width: 58, height: 30 }, {
    fontFamily: "Times New Roman", fontSize: 23, italic: true,
  });
  shape(s, "dinov2", "triangle", { left: 155, top: 96, width: 100, height: 129 }, {
    fill: "#FFE3BF", stroke: "#FF8C1A", strokeWidth: 2,
  });
  text(s, "dinov2.label", "DINOv2", { left: 155, top: 143, width: 100, height: 40 }, { fontSize: 17, bold: true });
  text(s, "dinov2.snow", "❄", { left: 166, top: 199, width: 34, height: 31 }, { fontSize: 27, color: "#29B6F6" });
  const bar = (name, x, y, h, fill, width = 14) => box(s, name, { left: x, top: y, width, height: h }, {
    geometry: "roundRect", fill, stroke: "#111111", strokeWidth: 1,
  });
  bar("global.a", 266, 82, 79, "#FF6868");
  bar("global.b", 266, 185, 79, "#6AAEF4");
  title(s, "global.title", "Global\nDescriptor", 218, 23, 122, 53, 16);
  const patchXs = [311, 331, 351, 371, 391, 411];
  patchXs.forEach((x, i) => {
    bar(`patch.a.${i}`, x, 82, 79, "#FF6868");
    bar(`patch.b.${i}`, x, 185, 79, "#6AAEF4");
  });
  box(s, "patch.a.group", { left: 306, top: 64, width: 121, height: 111 }, { fill: "none", stroke: "#111111", dashed: true });
  box(s, "patch.b.group", { left: 306, top: 179, width: 121, height: 101 }, { fill: "none", stroke: "#111111", dashed: true });
  title(s, "patch.title", "Local Feature\nPatches", 313, 23, 138, 52, 16);
  labelBox(s, "concat", "Concat", { left: 430, top: 145, width: 57, height: 31 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", fontSize: 14, bold: true,
  });
  polyArrow(s, "patch.concat.a", [[427, 121], [457, 121], [457, 142]], { width: 1.2, dashed: true });
  polyArrow(s, "patch.concat.b", [[427, 221], [457, 221], [457, 179]], { width: 1.2, dashed: true });
  const featureXs = [503, 520, 537, 554, 571, 588];
  featureXs.forEach((x, i) => {
    bar(`feature.a.${i}`, x, 98, 72, "#FF6868");
    bar(`feature.b.${i}`, x, 170, 72, "#6AAEF4");
  });
  arrow(s, "concat-feature", 487, 160, 500, 160, { width: 1.3 });
  title(s, "feature.title", "ℱᴬᴮ", 519, 54, 78, 36, 22, { fontFamily: "Times New Roman" });
  shape(s, "projection.feature", "triangle", { left: 612, top: 93, width: 94, height: 137 }, {
    fill: "#FFE3BF", stroke: "#FF8C1A", strokeWidth: 2,
  });
  text(s, "projection.feature.label", "g_d(·)", { left: 628, top: 147, width: 59, height: 36 }, {
    fontFamily: "Times New Roman", fontSize: 20, italic: true,
  });
  title(s, "projection.feature.title", "Projection\nAlong\nFeature Dimension", 595, 21, 138, 68, 17);
  text(s, "projection.feature.fire", "🔥", { left: 618, top: 205, width: 34, height: 31 }, { fontSize: 25 });
  arrow(s, "feature-projection", 605, 160, 612, 160, { width: 1.3 });
  const purpleXs = [714, 732, 750, 768, 786, 804];
  purpleXs.forEach((x, i) => bar(`projected.feature.${i}`, x, 135, 78, "#C796F5"));
  arrow(s, "projection-feature-out", 706, 174, 711, 174, { width: 1.3 });
  shape(s, "projection.patch", "triangle", { left: 833, top: 96, width: 94, height: 132 }, {
    fill: "#FFE3BF", stroke: "#FF8C1A", strokeWidth: 2,
  });
  text(s, "projection.patch.label", "g_n(·)", { left: 850, top: 147, width: 58, height: 34 }, {
    fontFamily: "Times New Roman", fontSize: 20, italic: true,
  });
  title(s, "projection.patch.title", "Projection\nAlong\nPatch Dimension", 818, 21, 131, 68, 17);
  arrow(s, "feature-patch", 814, 174, 831, 174, { width: 1.3 });
  labelBox(s, "pool", "p(·)", { left: 936, top: 154, width: 100, height: 46 }, {
    geometry: "roundRect", fill: "#FFF0D7", stroke: "#FF8C1A", strokeWidth: 2, fontFamily: "Times New Roman", fontSize: 21, italic: true,
  });
  title(s, "pool.title", "Patch-wise\nAdaptive\nMaxPooling", 932, 20, 145, 71, 16);
  arrow(s, "patch-pool", 928, 177, 933, 177, { width: 1.3 });
  const finalXs = [1058, 1076, 1094, 1112];
  finalXs.forEach((x, i) => bar(`final.feature.${i}`, x, 139, 79, "#C796F5"));
  arrow(s, "pool-final", 1037, 177, 1055, 177, { width: 1.3 });
  title(s, "final.label", "ℱ̂ᴬᴮ", 1052, 91, 81, 39, 21, { fontFamily: "Times New Roman" });

  polyArrow(s, "final-to-bottom", [[1091, 221], [1091, 286], [301, 286], [301, 321]], { width: 1.3, dashed: true });
  const bottomBars = (prefix, xs, y, colors) => xs.forEach((x, i) => bar(`${prefix}.${i}`, x, y, 81, colors[i] ?? colors[0]));
  bottomBars("bottom.f", [267, 285, 303, 321], 327, ["#C796F5"]);
  text(s, "multiply", "*", { left: 344, top: 351, width: 28, height: 35 }, { fontSize: 26, bold: true });
  bottomBars("bottom.weights", [379, 397, 415, 433], 327, ["#6FE8A2"]);
  text(s, "plus", "+", { left: 471, top: 351, width: 28, height: 35 }, { fontSize: 26, bold: true });
  bottomBars("bottom.pos", [515, 533, 551, 569], 327, ["#68E1E4"]);
  text(s, "equals", "=", { left: 608, top: 351, width: 28, height: 35 }, { fontSize: 26, bold: true });
  bottomBars("bottom.cond", [659, 677, 695, 713], 327, ["#FFF66B"]);
  arrow(s, "cond-global", 748, 367, 809, 367, { width: 1.3, dashed: true });
  bottomBars("bottom.global", [822, 840, 858, 876, 894, 912], 327, ["#FFB76B", "#FFB76B", "#FFF66B", "#FFF66B", "#FFF66B", "#FFF66B"]);
  title(s, "bottom.cond.title", "Conditional Prompt", 630, 411, 111, 29, 16);
  title(s, "bottom.global.title", "Global Prompt", 805, 411, 126, 29, 16);
  text(s, "legend", "🔥 Learnable\n❄ Frozen", { left: 19, top: 377, width: 160, height: 83 }, {
    fontFamily: "Times New Roman", fontSize: 17, align: "left",
  });
  box(s, "legend.frame", { left: 15, top: 366, width: 162, height: 104 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111" });
  text(s, "output", "To Text Encoder\n&\nStable Diffusion", { left: 942, top: 295, width: 165, height: 69 }, {
    fontSize: 16, bold: true,
  });
  arrow(s, "global-output", 930, 367, 1090, 367, { width: 1.3, dashed: true });
}

async function renderAdot(ctx) {
  const s = ctx.slide;
  const panels = [
    [14, 53, 382, 474], [409, 53, 398, 474], [819, 53, 329, 474],
  ];
  panels.forEach(([x, y, w, h], index) => box(s, `panel.${index}`, { left: x, top: y, width: w, height: h }, {
    geometry: "roundRect", fill: index === 1 ? "#FBFBFB" : "#FAFAFA", stroke: "#BBBBBB", strokeWidth: 1,
  }));
  box(s, "step.1", { left: 85, top: 17, width: 241, height: 47 }, { fill: "#FFFFFF", stroke: "#999999", dashed: true });
  box(s, "step.2", { left: 496, top: 17, width: 244, height: 47 }, { fill: "#FFFFFF", stroke: "#999999", dashed: true });
  box(s, "step.3", { left: 872, top: 17, width: 251, height: 47 }, { fill: "#FFFFFF", stroke: "#999999", dashed: true });
  title(s, "step.1.text", "Step 1. Measuring Question\nDifficulty", 88, 18, 235, 44, 16, { bold: false });
  title(s, "step.2.text", "Step 2. Adaptively Building\na Demonstration Set", 499, 18, 238, 44, 16, { bold: false });
  title(s, "step.3.text", "Step 3. Adaptively Retrieving\nDemonstration", 875, 18, 245, 44, 16, { bold: false });

  box(s, "questions", { left: 30, top: 70, width: 162, height: 165 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#AAAAAA", strokeWidth: 5 });
  text(s, "questions.text", "❓ Target\nquestion 1\n\n❓ Target\nquestion 2\n\n⋮", { left: 46, top: 82, width: 125, height: 136 }, {
    fontSize: 16, align: "left",
  });
  text(s, "llm.1", "◎", { left: 45, top: 256, width: 53, height: 53 }, { fontSize: 42, color: "#00A67E" });
  text(s, "fewshot", "Few-shot-cot\nby LLMs", { left: 101, top: 261, width: 113, height: 45 }, { fontSize: 14 });
  box(s, "rationales", { left: 31, top: 347, width: 162, height: 164 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#66C0ED", strokeWidth: 5 });
  text(s, "rationales.text", "💡 Rationale 1\n\n💡 Rationale 2\n\n⋮", { left: 47, top: 365, width: 125, height: 125 }, {
    fontSize: 15, align: "left",
  });
  arrow(s, "q-llm", 110, 236, 110, 254, { color: "#78D6D1", width: 6, headLength: 16, headWidth: 16 });
  arrow(s, "llm-r", 110, 311, 110, 344, { color: "#78D6D1", width: 6, headLength: 16, headWidth: 16 });

  const criterion = (name, y, value, icon) => {
    box(s, `${name}.frame`, { left: 238, top: y, width: 132, height: 133 }, { fill: "#FFFFFF", stroke: "#999999", dashed: true });
    text(s, `${name}.icon`, icon, { left: 246, top: y + 11, width: 32, height: 35 }, { fontSize: 23 });
    text(s, `${name}.value`, value, { left: 276, top: y + 5, width: 88, height: 111 }, { fontSize: 15 });
  };
  criterion("semantic", 63, "Target\nquestion i\n\nRationale i\nSemantic\ncomplexity", "❓");
  criterion("difficulty", 323, "Difficulty\n\nRationale i\nSyntactic complexity", "➕");
  arrow(s, "semantic-difficulty", 302, 198, 302, 318, { color: "#9DDDDC", width: 7, headLength: 17, headWidth: 17 });
  arrow(s, "rationale-difficulty", 205, 430, 233, 404, { color: "#78D6D1", width: 5, headLength: 16, headWidth: 16 });
  arrow(s, "rationale-semantic", 203, 341, 230, 285, { color: "#78D6D1", width: 5, headLength: 16, headWidth: 16 });

  title(s, "middle.random", "Randomly select N\nsample questions", 417, 59, 155, 42, 14, { bold: false });
  text(s, "middle.samples", "❓  ❓  ···", { left: 430, top: 96, width: 118, height: 36 }, { fontSize: 24 });
  labelBox(s, "middle.difficulty", "Difficulty", { left: 433, top: 147, width: 93, height: 27 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#777777", fontSize: 14,
  });
  box(s, "middle.chart", { left: 424, top: 191, width: 126, height: 135 }, { fill: "#FFFFFF", stroke: "#999999", dashed: true });
  text(s, "middle.chart.text", "Coefficient\nof variation\nof difficulty", { left: 436, top: 231, width: 101, height: 80 }, { fontSize: 15 });
  line(s, "middle.chart.axis.x", 448, 254, 518, 254, { width: 1.4 });
  line(s, "middle.chart.axis.y", 448, 254, 448, 211, { width: 1.4 });
  [17, 28, 15, 35].forEach((h, i) => box(s, `middle.chart.bar.${i}`, { left: 460 + i * 14, top: 254 - h, width: 8, height: h }, {
    fill: i % 2 ? "#F2C97D" : "#FFFFFF", stroke: "#555555",
  }));
  labelBox(s, "middle.partition", "Difficulty\nsection\npartitioning", { left: 431, top: 333, width: 115, height: 175 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#777777", fontSize: 15,
  });
  box(s, "middle.partition.band", { left: 433, top: 336, width: 24, height: 169 }, { geometry: "roundRect", fill: "#9BCB7B", stroke: "#9BCB7B" });
  text(s, "middle.partition.levels", "Hard\n\nNormal\n\nEasy", { left: 465, top: 342, width: 68, height: 151 }, { fontSize: 15 });
  arrow(s, "random-difficulty", 479, 133, 479, 144, { color: "#78D6D1", width: 5 });
  arrow(s, "difficulty-chart", 479, 175, 479, 188, { color: "#78D6D1", width: 5 });
  arrow(s, "chart-partition", 487, 327, 487, 331, { color: "#78D6D1", width: 5 });

  const ladder = [
    ["difficulty selection judgement", 562, 447, 229],
    ["Few-shot-cot demonstration", 562, 384, 229],
    ["Coherence Resolution", 562, 316, 229],
    ["Step\nDecomposition", 562, 247, 129],
    ["Optimized demonstrations", 562, 155, 229],
  ];
  for (const [value, x, y, w] of ladder) {
    labelBox(s, `ladder.${y}`, value, { left: x, top: y, width: w, height: value.includes("\n") ? 52 : 31 }, {
      geometry: "roundRect", fill: "#FFFFFF", stroke: "#777777", fontSize: 14,
    });
  }
  ["hard", "normal", "easy"].forEach((v, i) => labelBox(s, `level.${v}`, v, { left: 574 + i * 82, top: 414, width: 58, height: 25 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#777777", fontSize: 13,
  }));
  [603, 685, 767].forEach((x, i) => arrow(s, `ladder.up.${i}`, x, 410, x, 389, { color: "#78D6D1", width: 5 }));
  arrow(s, "ladder.coherence", 686, 382, 686, 349, { color: "#78D6D1", width: 5 });
  arrow(s, "ladder.step", 626, 315, 626, 302, { color: "#78D6D1", width: 5 });
  arrow(s, "ladder.optimized", 686, 245, 686, 189, { color: "#78D6D1", width: 5 });

  box(s, "demo.cylinder", { left: 833, top: 96, width: 118, height: 191 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#83C7EB", strokeWidth: 4 });
  text(s, "demo.cylinder.text", "Demonstration set\n\nSample question 1\n\nSample rationale 1\n\nDifficulty: 216\n⋮", {
    left: 843, top: 95, width: 99, height: 188,
  }, { fontSize: 13 });
  labelBox(s, "retrieval", "Difficulty\n-adapted\nretrieval", { left: 840, top: 331, width: 105, height: 99 }, {
    fill: "#FFFFFF", stroke: "#999999", dashed: true, fontSize: 15,
  });
  labelBox(s, "target", "Target question:\nWhat is the num\nof ... ?\nDifficulty: 132", { left: 830, top: 443, width: 129, height: 71 }, {
    fill: "#FFFFFF", stroke: "#999999", dashed: true, fontSize: 14,
  });
  labelBox(s, "final", "💡 Final rationale\nand answer", { left: 979, top: 76, width: 149, height: 69 }, {
    fill: "#FFFFFF", stroke: "#999999", dashed: true, fontSize: 15,
  });
  text(s, "llm.final", "◎", { left: 1023, top: 177, width: 56, height: 56 }, { fontSize: 45, color: "#00A67E" });
  labelBox(s, "demo.list", "Demonstration\n❓ Sample question 2\n💡 Sample rationale 2\n❓ Sample question 6\n💡 Sample rationale 6\n⋮\n❓ Target question", {
    left: 978, top: 264, width: 159, height: 250,
  }, { fill: "#FFFFFF", stroke: "#999999", dashed: true, fontSize: 13 });
  arrow(s, "target-retrieval", 894, 440, 894, 434, { color: "#78D6D1", width: 6 });
  arrow(s, "retrieval-demo", 948, 380, 974, 380, { color: "#78D6D1", width: 6 });
  arrow(s, "demo-llm", 1052, 259, 1052, 234, { color: "#B5E5E3", width: 6 });
  arrow(s, "llm-final", 1052, 173, 1052, 148, { color: "#B5E5E3", width: 6 });
}

async function renderVdr(ctx) {
  const s = ctx.slide;
  const y = (sourceY) => sourceY - ctx.crop.top;
  box(s, "training.frame", { left: 108, top: y(157), width: 422, height: 283 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", strokeWidth: 1.4,
  });
  box(s, "inference.frame", { left: 108, top: y(442), width: 422, height: 300 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", strokeWidth: 1.4,
  });
  title(s, "training.title", "Training", 117, y(159), 100, 30, 20, { align: "left", fontFamily: "Times New Roman" });
  title(s, "inference.title", "Inference", 117, y(444), 110, 30, 20, { align: "left", fontFamily: "Times New Roman" });
  await cropAsset(ctx, "code", 538, 157, 380, 585, { left: 538, top: y(157), width: 380, height: 585 }, "Training pseudo code");

  const addEncoder = (prefix, x, top, fill, label) => {
    shape(s, `${prefix}.encoder`, "triangle", { left: x, top, width: 62, height: 92 }, { fill, stroke: "#111111", strokeWidth: 1.2 });
    text(s, `${prefix}.encoder.text`, `Base\nEncoder\n${label}`, { left: x + 5, top: top + 15, width: 52, height: 61 }, { fontSize: 10 });
    shape(s, `${prefix}.head`, "triangle", { left: x + 118, top, width: 52, height: 92 }, { fill: "#DCE6F6", stroke: "#111111", strokeWidth: 1.2 });
    text(s, `${prefix}.head.text`, "DST\nHead", { left: x + 121, top: top + 27, width: 46, height: 40 }, { fontSize: 10 });
  };
  labelBox(s, "train.q", "Text\nQ", { left: 119, top: y(260), width: 58, height: 49 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", fontSize: 15 });
  labelBox(s, "train.p", "Data\nP", { left: 119, top: y(372), width: 58, height: 49 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", fontSize: 15 });
  addEncoder("train.q", 185, y(219), "#F5DFC9", "Q");
  addEncoder("train.p", 185, y(332), "#DDEED0", "P");
  arrow(s, "train.q.input", 177, y(285), 182, y(285), { width: 1.2 });
  arrow(s, "train.p.input", 177, y(397), 182, y(397), { width: 1.2 });
  arrow(s, "train.q.head", 247, y(265), 300, y(265), { width: 1.2 });
  arrow(s, "train.p.head", 247, y(378), 300, y(378), { width: 1.2 });
  labelBox(s, "contrastive", "Contrastive\nLoss", { left: 376, top: y(307), width: 80, height: 53 }, {
    geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", fontSize: 14, bold: true,
  });
  labelBox(s, "mask", "CTS\nMask", { left: 464, top: y(310), width: 60, height: 45 }, {
    geometry: "roundRect", fill: "#CCCCCC", stroke: "#777777", fontSize: 12,
  });
  arrow(s, "q.loss", 351, y(265), 376, y(322), { width: 1.2 });
  arrow(s, "p.loss", 351, y(378), 376, y(345), { width: 1.2 });
  arrow(s, "loss.mask", 456, y(333), 462, y(333), { width: 1.2 });

  labelBox(s, "infer.data", "Data\nP", { left: 214, top: y(507), width: 58, height: 45 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", fontSize: 15 });
  addEncoder("infer.p", 280, y(466), "#DDEED0", "P");
  labelBox(s, "corpus", "Embed\nCorpus", { left: 436, top: y(483), width: 90, height: 73 }, {
    geometry: "roundRect", fill: "#DCE6F6", stroke: "#111111", fontSize: 14, bold: true,
  });
  arrow(s, "infer.data-encoder", 272, y(530), 278, y(530), { width: 1.2 });
  arrow(s, "infer.encoder-head", 342, y(511), 395, y(511), { width: 1.2 });
  arrow(s, "infer.head-corpus", 447, y(511), 434, y(511), { width: 1.2 });
  labelBox(s, "option1.query", "Query\nQ", { left: 211, top: y(610), width: 61, height: 45 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", fontSize: 15 });
  addEncoder("option1", 280, y(571), "#F5DFC9", "Q");
  labelBox(s, "option2.query", "Query\nQ", { left: 211, top: y(690), width: 61, height: 45 }, { geometry: "roundRect", fill: "#FFFFFF", stroke: "#111111", fontSize: 15 });
  labelBox(s, "option2.tokenizer", "Tokenizer", { left: 303, top: y(682), width: 88, height: 41 }, {
    geometry: "roundRect", fill: "#DDDDDD", stroke: "#111111", fontSize: 14,
  });
  arrow(s, "option1.query-encoder", 272, y(633), 278, y(633), { width: 1.2 });
  arrow(s, "option2.query-tokenizer", 272, y(712), 300, y(712), { width: 1.2 });
  text(s, "options", "Option1:\nParametric\nInference\n\nOption2:\nNonparametric\nInference", { left: 119, top: y(580), width: 90, height: 157 }, {
    fontFamily: "Times New Roman", fontSize: 13, bold: true, align: "left",
  });
}

async function renderBlendfilter(ctx) {
  const s = ctx.slide;
  box(s, "top.external.bg", { left: 10, top: 12, width: 622, height: 171 }, { fill: "#FAFCF9", stroke: "#FAFCF9" });
  box(s, "top.internal.bg", { left: 632, top: 12, width: 414, height: 171 }, { fill: "#F8FAFE", stroke: "#F8FAFE" });
  box(s, "bottom.query.bg", { left: 10, top: 184, width: 402, height: 433 }, { fill: "#FFFCF5", stroke: "#FFFCF5" });
  box(s, "bottom.filter.bg", { left: 412, top: 184, width: 431, height: 433 }, { fill: "#FFF9F7", stroke: "#FFF9F7" });
  box(s, "bottom.answer.bg", { left: 843, top: 184, width: 203, height: 433 }, { fill: "#FAF7FC", stroke: "#FAF7FC" });
  title(s, "external.title", "External Knowledge Augmentation", 172, 157, 268, 28, 15, { bold: false });
  title(s, "internal.title", "Internal Knowledge Augmentation", 720, 157, 245, 28, 15, { bold: false });
  title(s, "query.title", "Query Generation\nBlending", 32, 190, 154, 43, 15, { bold: false });
  title(s, "filter.title", "Knowledge Filtering", 586, 190, 188, 32, 15, { bold: false });
  title(s, "answer.title", "Answer Generation", 865, 190, 157, 32, 15, { bold: false });

  const iconCrops = [
    ["query.top.left", 26, 66, 68, 45], ["wiki.top", 123, 67, 47, 47],
    ["docs.top", 198, 16, 112, 52], ["llm.top", 335, 68, 50, 52],
    ["response.top", 411, 18, 91, 55], ["query.top.mid", 413, 87, 64, 42],
    ["query.top.right", 652, 65, 66, 45], ["llm.top.right", 744, 67, 50, 52],
    ["response.top.right", 814, 17, 94, 55], ["query.top.final", 939, 64, 65, 45],
  ];
  for (const [name, x, y, w, h] of iconCrops) await cropAsset(ctx, name, x, y, w, h);
  const arrowsTop = [[95, 89, 119, 89], [171, 89, 194, 89], [310, 89, 331, 89], [386, 89, 407, 89], [505, 89, 529, 89], [719, 89, 741, 89], [796, 89, 811, 89], [910, 89, 935, 89]];
  arrowsTop.forEach((a, i) => arrow(s, `top.arrow.${i}`, ...a, { width: 3, headLength: 13, headWidth: 13 }));
  const rows = [
    { y: 243, query: [69, 238, 73, 50], wiki: [202, 239, 51, 51], docs: [299, 220, 111, 101], llm: [439, 239, 50, 52], result: [558, 234, 54, 65] },
    { y: 386, query: [69, 377, 73, 50], wiki: [202, 381, 51, 51], docs: [299, 329, 111, 101], llm: [439, 381, 50, 52], result: [548, 375, 72, 70] },
    { y: 530, query: [69, 514, 73, 50], wiki: [202, 520, 51, 51], docs: [299, 474, 111, 101], llm: [439, 520, 50, 52], result: [568, 514, 54, 65] },
  ];
  for (const [index, row] of rows.entries()) {
    await cropAsset(ctx, `row.${index}.query`, ...row.query);
    await cropAsset(ctx, `row.${index}.wiki`, ...row.wiki);
    await cropAsset(ctx, `row.${index}.docs`, ...row.docs);
    await cropAsset(ctx, `row.${index}.llm`, ...row.llm);
    await cropAsset(ctx, `row.${index}.result`, ...row.result);
    [[145, row.y + 23, 197, row.y + 23], [256, row.y + 23, 294, row.y + 23], [412, row.y + 23, 435, row.y + 23], [491, row.y + 23, 543, row.y + 23]].forEach((a, i) => {
      arrow(s, `row.${index}.arrow.${i}`, ...a, { width: 3, headLength: 13, headWidth: 13 });
    });
  }
  const union = [713, 342, 125, 139];
  await cropAsset(ctx, "union", ...union);
  arrow(s, "merge.1", 623, 262, 706, 402, { width: 5, headLength: 16, headWidth: 16 });
  arrow(s, "merge.2", 622, 411, 706, 411, { width: 5, headLength: 16, headWidth: 16 });
  arrow(s, "merge.3", 623, 549, 706, 421, { width: 5, headLength: 16, headWidth: 16 });
  await cropAsset(ctx, "answer.llm", 865, 381, 50, 52);
  await cropAsset(ctx, "answer.final", 950, 382, 39, 48);
  arrow(s, "union-llm", 839, 411, 860, 411, { width: 3, headLength: 13, headWidth: 13 });
  arrow(s, "llm-answer", 917, 411, 946, 411, { width: 3, headLength: 13, headWidth: 13 });
  text(s, "external.labels", "Input query q\nKnowledge\nBase\nRetrieved\nKnowledge\nLLM\nLLM Response\nExternal Knowledge\nAugmented Query q_in", {
    left: 18, top: 112, width: 595, height: 44,
  }, { fontSize: 10 });
  text(s, "internal.labels", "Input query q        LLM        LLM Response        Internal Knowledge\nAugmented Query q_in", {
    left: 648, top: 111, width: 374, height: 45,
  }, { fontSize: 10 });
}

async function renderHumannorm(ctx) {
  const s = ctx.slide;
  box(s, "geometry.bg", { left: 14, top: 15, width: 617, height: 284 }, {
    geometry: "roundRect", fill: "#F7FAF4", stroke: "#AAAAAA", strokeWidth: 1.2,
  });
  box(s, "texture.bg", { left: 635, top: 15, width: 617, height: 284 }, {
    geometry: "roundRect", fill: "#F5F8FC", stroke: "#AAAAAA", strokeWidth: 1.2,
  });
  const crops = [
    ["geometry.dm", 45, 56, 135, 154], ["geometry.normal", 225, 47, 84, 92],
    ["geometry.depth", 225, 164, 84, 91], ["geometry.text2normal", 360, 71, 95, 67],
    ["geometry.text2depth", 360, 185, 95, 67], ["geometry.loss1", 478, 80, 147, 58],
    ["geometry.loss2", 478, 181, 147, 58], ["texture.dm", 668, 58, 135, 154],
    ["texture.normal", 835, 46, 84, 92], ["texture.color", 835, 164, 84, 91],
    ["texture.model", 968, 77, 100, 90], ["texture.loss", 1098, 80, 146, 60],
    ["texture.final", 1117, 174, 95, 85], ["texture.multiloss", 945, 202, 176, 62],
  ];
  for (const [name, x, y, w, h] of crops) await cropAsset(ctx, name, x, y, w, h);
  const dashed = { width: 1.5, dashed: true };
  polyArrow(s, "geometry.back.top", [[551, 78], [551, 29], [110, 29], [110, 82]], dashed);
  polyArrow(s, "geometry.back.bottom", [[551, 239], [551, 278], [110, 278], [110, 232]], dashed);
  arrow(s, "geometry.dm-normal", 180, 116, 221, 116, { width: 1.5 });
  arrow(s, "geometry.dm-depth", 180, 205, 221, 205, { width: 1.5 });
  arrow(s, "geometry.normal-model", 309, 91, 356, 91, { width: 1.5 });
  arrow(s, "geometry.depth-model", 309, 209, 356, 209, { width: 1.5 });
  arrow(s, "geometry.model-loss1", 455, 104, 474, 104, { width: 1.5 });
  arrow(s, "geometry.model-loss2", 455, 211, 474, 211, { width: 1.5 });
  polyArrow(s, "texture.back.top", [[1174, 80], [1174, 29], [734, 29], [734, 82]], dashed);
  polyArrow(s, "texture.back.bottom", [[1117, 259], [1117, 278], [734, 278], [734, 232]], dashed);
  arrow(s, "texture.dm-normal", 803, 116, 831, 116, { width: 1.5 });
  arrow(s, "texture.dm-color", 803, 205, 831, 205, { width: 1.5 });
  arrow(s, "texture.normal-model", 919, 91, 964, 91, { width: 1.5 });
  arrow(s, "texture.color-model", 919, 209, 964, 209, { width: 1.5 });
  arrow(s, "texture.model-loss", 1068, 113, 1094, 113, { width: 1.5 });
  title(s, "caption.geometry", "(a) Geometry Generation", 205, 299, 245, 36, 18, { fontFamily: "Times New Roman", bold: false });
  title(s, "caption.texture", "(b) Texture Generation", 819, 299, 245, 36, 18, { fontFamily: "Times New Roman", bold: false });
  text(s, "geometry.back.label", "Back Propagation", { left: 118, top: 31, width: 135, height: 25 }, { fontSize: 14 });
  text(s, "texture.back.label", "Back Propagation", { left: 742, top: 31, width: 135, height: 25 }, { fontSize: 14 });
  text(s, "geometry.labels", "DMTET\nnormal z₀ⁿ\nAdd noise\n“A photo of Messi, [b], [v]”\ndepth z₀ᵈ", {
    left: 66, top: 207, width: 387, height: 71,
  }, { fontSize: 13 });
  text(s, "texture.labels", "DMTET\nnormal z₀ⁿ\nAdd noise\ncolor x₀\nMulti-denoise", {
    left: 685, top: 208, width: 535, height: 70,
  }, { fontSize: 13 });
}

const CASES = [
  {
    id: "acl-grace-fig2",
    reference: "docs/benchmark/references/acl-grace-fig2.png",
    sourceSize: [1165, 512],
    crop: { left: 0, top: 0, right: 0, bottom: 147 },
    source: "https://aclanthology.org/2024.acl-long.639/",
    render: renderGrace,
  },
  {
    id: "emnlp-ex2-fig2",
    reference: "docs/benchmark/references/emnlp-ex2-fig2.png",
    sourceSize: [1162, 433],
    crop: { left: 0, top: 0, right: 0, bottom: 170 },
    source: "https://aclanthology.org/2024.emnlp-main.547/",
    render: renderEx2,
  },
  {
    id: "iclr-addp-fig2",
    reference: "docs/benchmark/references/iclr-addp-fig2.png",
    sourceSize: [1018, 502],
    crop: { left: 14, top: 41, right: 14, bottom: 133 },
    source: "https://openreview.net/forum?id=cMPm8YFXZe",
    render: renderAddp,
  },
  {
    id: "icml-diffuco-fig1",
    reference: "docs/benchmark/references/icml-diffuco-fig1.png",
    sourceSize: [1246, 505],
    crop: { left: 0, top: 40, right: 0, bottom: 70 },
    source: "https://proceedings.mlr.press/v235/sanokowski24a.html",
    render: renderDiffuco,
  },
  {
    id: "neurips-gem-fig1",
    reference: "docs/benchmark/references/neurips-gem-fig1.png",
    sourceSize: [1019, 399],
    crop: { left: 0, top: 0, right: 0, bottom: 113 },
    source: "https://proceedings.neurips.cc/paper_files/paper/2024/hash/bac4d92b3f6decfe47eab9a5893dd1f6-Abstract-Conference.html",
    render: renderGem,
  },
  {
    id: "cvpr-sd4match-fig2",
    reference: "docs/benchmark/references/cvpr-sd4match-fig2.png",
    sourceSize: [1138, 560],
    crop: { left: 0, top: 0, right: 0, bottom: 57 },
    source: "https://openaccess.thecvf.com/content/CVPR2024/html/Li_SD4Match_Learning_to_Prompt_Stable_Diffusion_Model_for_Semantic_Matching_CVPR_2024_paper.html",
    render: renderSd4match,
  },
  {
    id: "emnlp-adot-fig2",
    reference: "docs/benchmark/references/emnlp-adot-fig2.png",
    sourceSize: [1162, 592],
    crop: { left: 0, top: 0, right: 0, bottom: 62 },
    source: "https://aclanthology.org/2024.emnlp-main.313/",
    render: renderAdot,
  },
  {
    id: "iclr-vdr-fig2",
    reference: "docs/benchmark/references/iclr-vdr-fig2.png",
    sourceSize: [1018, 802],
    crop: { left: 0, top: 145, right: 0, bottom: 58 },
    source: "https://openreview.net/forum?id=ZlQRiFmq7Y",
    render: renderVdr,
  },
  {
    id: "emnlp-blendfilter-fig1",
    reference: "docs/benchmark/references/emnlp-blendfilter-fig1.png",
    sourceSize: [1057, 684],
    crop: { left: 0, top: 0, right: 0, bottom: 67 },
    source: "https://aclanthology.org/2024.emnlp-main.58/",
    render: renderBlendfilter,
  },
  {
    id: "cvpr-humannorm-fig4",
    reference: "docs/benchmark/references/cvpr-humannorm-fig4.png",
    sourceSize: [1266, 543],
    crop: { left: 0, top: 0, right: 0, bottom: 195 },
    source: "https://openaccess.thecvf.com/content/CVPR2024/html/Huang_HumanNorm_Learning_Normal_Diffusion_Model_for_High-quality_and_Realistic_3D_CVPR_2024_paper.html",
    render: renderHumannorm,
  },
];

async function buildCase(spec) {
  const [sourceWidth, sourceHeight] = spec.sourceSize;
  const width = sourceWidth - spec.crop.left - spec.crop.right;
  const height = sourceHeight - spec.crop.top - spec.crop.bottom;
  const outputDir = path.join(ROOT, "docs/strict-recreation", spec.id);
  const assetDir = path.join(outputDir, "assets");
  await fs.mkdir(assetDir, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width, height } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  const ctx = {
    ...spec,
    width,
    height,
    outputDir,
    assetDir,
    reference: path.join(ROOT, spec.reference),
    slide,
  };
  await spec.render(ctx);
  slide.speakerNotes.textFrame.setText(`[Sources]\n- ${spec.source}\n[/Sources]`);
  const result = await presentation.inspect({ kind: "slide,shape,image,textbox", maxChars: 1000 });
  await fs.writeFile(path.join(outputDir, "editable.pptx.inspect.ndjson"), result.ndjson);
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(path.join(outputDir, "editable.pptx"));
  console.log(`Created ${spec.id}: ${width}x${height}`);
}

for (const spec of CASES) {
  await buildCase(spec);
}
