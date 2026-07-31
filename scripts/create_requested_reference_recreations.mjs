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
  if (options.rotation) item.rotation = options.rotation;
  return item;
}

function text(slide, name, value, position, options = {}) {
  const item = shape(slide, name, "textbox", position);
  item.text = value;
  item.text.style = {
    fontFamily: options.fontFamily ?? "Arial",
    fontSize: options.fontSize ?? 18,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "left",
    verticalAlignment: options.verticalAlignment ?? "middle",
  };
  if (options.rotation) item.rotation = options.rotation;
  return item;
}

function box(slide, name, position, options = {}) {
  return shape(slide, name, options.geometry ?? "rect", position, {
    fill: options.fill ?? "#FFFFFF",
    stroke: options.stroke ?? "#111111",
    strokeWidth: options.strokeWidth ?? 1.5,
    dashed: options.dashed,
    rotation: options.rotation,
  });
}

function line(slide, name, x1, y1, x2, y2, options = {}) {
  return addReferenceSegment(
    slide,
    name,
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    options,
  );
}

function arrow(slide, name, x1, y1, x2, y2, options = {}) {
  return addReferenceArrow(
    slide,
    name,
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    {
      color: options.color ?? "#111111",
      width: options.width ?? 2.2,
      headLength: options.headLength ?? 14,
      headWidth: options.headWidth ?? 14,
      dashed: options.dashed,
    },
  );
}

function polyArrow(slide, name, points, options = {}) {
  for (let index = 0; index < points.length - 2; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    line(slide, `${name}.segment.${index}`, from[0], from[1], to[0], to[1], options);
  }
  const from = points.at(-2);
  const to = points.at(-1);
  arrow(slide, `${name}.end`, from[0], from[1], to[0], to[1], options);
}

function polygon(slide, name, points, options = {}) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const commands = [
    { moveTo: { x: points[0][0] - left, y: points[0][1] - top } },
    ...points.slice(1).map(([x, y]) => ({
      lineTo: { x: x - left, y: y - top },
    })),
    { close: {} },
  ];
  return slide.shapes.add({
    geometry: "custom",
    name,
    position: { left, top, width, height },
    fill: options.fill ?? "#FFFFFF",
    line: {
      style: options.dashed ? "dashed" : "solid",
      fill: options.stroke ?? "#111111",
      width: options.strokeWidth ?? 1,
    },
    customPaths: [{ width, height, commands }],
  });
}

async function addPng(slide, name, file, position, alt = name) {
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
    path.join(ROOT, "scripts/crop_image_asset.py"),
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
    position ?? { left: sx, top: sy, width: sw, height: sh },
    alt,
  );
}

function sectionTitle(slide, name, value, left, top, width, height, options = {}) {
  return text(slide, name, value, { left, top, width, height }, {
    fontFamily: options.fontFamily ?? "Times New Roman",
    fontSize: options.fontSize ?? 26,
    bold: options.bold ?? true,
    color: options.color ?? "#111111",
    align: options.align ?? "left",
  });
}

function ellipse(slide, name, x, y, width, height, fill, options = {}) {
  return box(slide, name, { left: x, top: y, width, height }, {
    geometry: "ellipse",
    fill,
    stroke: options.stroke ?? "#111111",
    strokeWidth: options.strokeWidth ?? 2.4,
  });
}

function pointOnPlane(u, v) {
  const topLeft = { x: 829, y: 603 };
  const topRight = { x: 1514, y: 603 };
  const bottomLeft = { x: 456, y: 994 };
  const bottomRight = { x: 1120, y: 994 };
  return {
    x:
      (1 - u) * (1 - v) * topLeft.x
      + u * (1 - v) * topRight.x
      + (1 - u) * v * bottomLeft.x
      + u * v * bottomRight.x,
    y:
      (1 - u) * (1 - v) * topLeft.y
      + u * (1 - v) * topRight.y
      + (1 - u) * v * bottomLeft.y
      + u * v * bottomRight.y,
  };
}

function planeCell(slide, row, column, fill) {
  const u0 = column / 3;
  const u1 = (column + 1) / 3;
  const v0 = row / 3;
  const v1 = (row + 1) / 3;
  const p00 = pointOnPlane(u0, v0);
  const p10 = pointOnPlane(u1, v0);
  const p11 = pointOnPlane(u1, v1);
  const p01 = pointOnPlane(u0, v1);
  polygon(slide, `memory-plane.cell.${row}.${column}`, [
    [p00.x, p00.y],
    [p10.x, p10.y],
    [p11.x, p11.y],
    [p01.x, p01.y],
  ], { fill, stroke: fill, strokeWidth: 0.1 });
}

async function renderTaxonomy(ctx) {
  const s = ctx.slide;
  s.background.fill = "#FFFFFF";

  const panelAssets = [
    ["context-condensation", 54, 73, 439, 146],
    ["context-branching", 526, 73, 202, 139],
    ["internalizing-experiences", 807, 76, 658, 116],
    ["kv-generation", 1486, 78, 339, 113],
    ["extract-insights", 57, 249, 391, 253],
    ["multimodal-rag", 55, 542, 416, 138],
    ["knowledge-graph", 56, 725, 382, 141],
    ["model-editing", 55, 906, 294, 160],
    ["kv-reuse", 1487, 230, 340, 149],
    ["latent-generation", 1546, 417, 283, 155],
    ["legend", 1607, 602, 224, 279],
    ["latent-repository", 1484, 928, 341, 131],
  ];
  for (const [name, x, y, w, h] of panelAssets) {
    await cropAsset(ctx, `panel.${name}`, x, y, w, h, null, `${name} systems`);
  }

  const panelTitles = [
    ["Context Condensation", 58, 39, 420],
    ["Context Branching", 525, 44, 260],
    ["Internalizing Experiences", 818, 42, 390],
    ["KV Generation", 1590, 48, 250],
    ["Extract Insights", 58, 220, 260],
    ["Multimodal RAG", 58, 508, 250],
    ["Knowledge Graph", 58, 696, 250],
    ["Model & Knowledge Editing", 58, 875, 330],
    ["KV Reuse/Compression", 1510, 194, 310],
    ["Latent Memory Generation", 1538, 383, 330],
    ["Latent Repository", 1594, 895, 260],
  ];
  for (const [label, x, y, w] of panelTitles) {
    sectionTitle(s, `title.${label}`, label, x, y, w, 32, {
      fontSize: 23.5,
      bold: false,
    });
  }

  const cellColors = [
    ["#DDE9E6", "#BED6D3", "#9FC2C0"],
    ["#E8E1DB", "#D9D4CE", "#AEB9B7"],
    ["#E6D6CF", "#D8BBB5", "#C69E98"],
  ];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      planeCell(s, row, column, cellColors[row][column]);
    }
  }
  const planeBorder = [
    [829, 603],
    [1514, 603],
    [1120, 994],
    [456, 994],
  ];
  for (let index = 0; index < planeBorder.length; index += 1) {
    const from = planeBorder[index];
    const to = planeBorder[(index + 1) % planeBorder.length];
    line(s, `memory-plane.border.${index}`, from[0], from[1], to[0], to[1], {
      width: 2.2,
      dashed: true,
      color: "#333333",
    });
  }
  box(s, "memory-plane.front.token", { left: 456, top: 994, width: 229, height: 44 }, {
    fill: "#EFF4F2", stroke: "#333333", strokeWidth: 0.4,
  });
  box(s, "memory-plane.front.parametric", { left: 685, top: 994, width: 228, height: 44 }, {
    fill: "#C4E2DF", stroke: "#333333", strokeWidth: 0.4,
  });
  box(s, "memory-plane.front.latent", { left: 913, top: 994, width: 207, height: 44 }, {
    fill: "#5BA7AC", stroke: "#333333", strokeWidth: 0.4,
  });
  line(s, "memory-plane.front.bottom", 456, 1038, 1120, 1038, {
    color: "#333333",
    width: 2,
    dashed: true,
  });

  const dashedProjections = [
    [515, 217, 595, 991], [639, 211, 752, 813], [812, 192, 931, 690],
    [876, 192, 1001, 844], [1007, 190, 1158, 681], [1050, 191, 1204, 806],
    [1220, 190, 1310, 741], [515, 503, 620, 813], [712, 212, 848, 821],
    [1011, 230, 1091, 616], [1244, 378, 1268, 562],
  ];
  dashedProjections.forEach((segment, index) => {
    line(s, `projection.${index}`, ...segment, {
      color: "#6A6A6A",
      width: 2.6,
      dashed: true,
    });
  });

  const flowArrows = [
    ["condensation", [[494, 207], [500, 248], [548, 278], [650, 315], [692, 384]]],
    ["insights", [[449, 304], [511, 316], [555, 360], [607, 405]]],
    ["multimodal", [[470, 520], [449, 500], [440, 528], [496, 500]]],
    ["knowledge", [[438, 795], [459, 769], [471, 802], [500, 768]]],
    ["editing", [[760, 942], [600, 958], [465, 956], [349, 946]]],
    ["branching", [[729, 145], [760, 172], [756, 260], [801, 436]]],
    ["experience", [[940, 607], [922, 438], [927, 275], [907, 193]]],
    ["kv-generation", [[1368, 248], [1425, 216], [1452, 189], [1486, 188]]],
    ["kv-reuse", [[1276, 501], [1325, 451], [1372, 331], [1487, 306]]],
    ["latent-generation", [[1160, 625], [1282, 630], [1427, 514], [1546, 453]]],
    ["latent-repository", [[1064, 850], [1134, 1018], [1254, 1080], [1484, 978]]],
  ];
  for (const [name, points] of flowArrows) {
    polyArrow(s, `flow.${name}`, points, {
      color: "#111111",
      width: 2.4,
      headLength: 17,
      headWidth: 17,
    });
  }

  const ovals = [
    ["brain", 602, 381, 112, 68, "#E9DEDA", "💭", 631, 392],
    ["image", 490, 476, 104, 54, "#E6D0CE", "🖼", 525, 484],
    ["previous", 636, 541, 121, 76, "#E7DDD8", "↪", 681, 554],
    ["graph", 487, 682, 178, 112, "#E1D2CF", "🕸", 546, 715],
    ["database", 516, 813, 132, 83, "#E8D9D5", "🗄", 558, 831],
    ["editing", 748, 802, 197, 114, "#DFC8C4", "📖", 807, 826],
    ["experience", 846, 606, 158, 93, "#E9DED8", "🏅", 899, 628],
    ["central-small", 774, 695, 107, 56, "#D9BBB6", "", 0, 0],
    ["latent-books", 997, 819, 121, 74, "#5DAAA5", "📚", 1034, 833],
    ["latent-center", 961, 681, 162, 85, "#61AAA5", "", 0, 0],
    ["repository", 1065, 559, 181, 102, "#8AB6B1", "🗄", 1127, 577],
    ["kv-memory", 1030, 466, 138, 78, "#CDE2D4", "", 0, 0],
    ["robot", 802, 428, 110, 57, "#75B1A7", "🤖", 838, 437],
    ["green-small", 899, 417, 106, 55, "#67ACA3", "", 0, 0],
    ["bunny", 777, 244, 104, 54, "#E9DDD8", "🐇", 810, 252],
    ["green-top", 973, 229, 172, 90, "#CFE2D2", "", 0, 0],
    ["gears", 1210, 315, 143, 88, "#C6DEDA", "⚙", 1257, 337],
    ["kv-chip", 1239, 452, 168, 88, "#BFD8D2", "🧩", 1296, 471],
  ];
  for (const [name, x, y, w, h, fill, icon, ix, iy] of ovals) {
    ellipse(s, `oval.${name}`, x, y, w, h, fill);
    if (icon) {
      text(s, `oval.${name}.icon`, icon, { left: ix, top: iy, width: 48, height: 43 }, {
        fontSize: 32,
        align: "center",
      });
    }
  }

  sectionTitle(s, "label.previous", "Previous\nTraj.", 586, 628, 140, 58, {
    fontSize: 22,
    bold: false,
    align: "center",
  });
  sectionTitle(s, "label.database", "Vector\nDatabase", 425, 858, 140, 62, {
    fontSize: 22,
    bold: false,
    align: "center",
  });
  sectionTitle(s, "label.editing", "Model & Knowledge\nEditing", 639, 916, 250, 66, {
    fontSize: 23,
    bold: false,
    align: "center",
  });
  sectionTitle(s, "label.repository", "Latent\nRepository", 923, 888, 180, 65, {
    fontSize: 23,
    bold: false,
    align: "center",
  });
  sectionTitle(s, "label.kvgen", "KV Generation", 1287, 260, 190, 36, {
    fontSize: 23,
    bold: false,
  });
  sectionTitle(s, "label.kvreuse", "KV Reuse/\nCompression", 1161, 403, 170, 70, {
    fontSize: 23,
    bold: false,
  });

  const formLabels = [
    ["Token-level\nMemory", 468, "#88AAA3"],
    ["Parametric\nMemory", 689, "#78958F"],
    ["Latent\nMemory", 911, "#4E6D6B"],
  ];
  for (const [label, x, color] of formLabels) {
    text(s, `form.${label}`, label, { left: x, top: 1044, width: 190, height: 72 }, {
      fontFamily: "Times New Roman",
      fontSize: 28,
      bold: true,
      color,
      align: "center",
    });
  }
  line(s, "form.bracket.left", 468, 1128, 468, 1143, { width: 2.2 });
  line(s, "form.bracket.right", 1064, 1128, 1064, 1143, { width: 2.2 });
  line(s, "form.bracket.horizontal", 468, 1143, 1064, 1143, { width: 2.2 });
  sectionTitle(s, "form.bracket.label", "Diverse Memory Forms", 520, 1148, 500, 45, {
    fontSize: 28,
    bold: true,
    align: "center",
  });

  const dynamics = [
    ["Working\nMemory", 1392, 642],
    ["Short-term", 1457, 738],
    ["Experiential\nMemory", 1270, 760],
    ["Long-term", 1307, 898],
    ["Factual\nMemory", 1160, 900],
  ];
  for (const [label, x, y] of dynamics) {
    text(s, `dynamic.${label}`, label, { left: x, top: y, width: 180, height: 76 }, {
      fontFamily: "Times New Roman",
      fontSize: 26,
      bold: true,
      italic: true,
      color: "#C55E55",
      align: "center",
      rotation: -45,
    });
  }

  text(s, "caption.figure", "Figure 1", { left: 45, top: 1200, width: 165, height: 44 }, {
    fontFamily: "Arial",
    fontSize: 30,
    bold: true,
  });
  text(
    s,
    "caption.body",
    "Overview of agent memory organized by the unified taxonomy of forms (Section 3), functions (Section 4), and dynamics (Section 5). The diagram positions memory artifacts by their dominant form and primary function. It further maps representative systems into this taxonomy to provide a consolidated landscape.",
    { left: 184, top: 1191, width: 1680, height: 154 },
    {
      fontFamily: "Times New Roman",
      fontSize: 31,
      align: "left",
      verticalAlignment: "top",
    },
  );
}

async function renderPoster(ctx) {
  const s = ctx.slide;
  s.background.fill = "#FFFFFF";
  box(s, "header.background", { left: 14, top: 14, width: 1052, height: 217 }, {
    fill: "#E5EFFD",
    stroke: "#E5EFFD",
    strokeWidth: 0,
  });
  text(
    s,
    "header.title",
    "From Past To Path: Masked History Learning for\nNext-Item Prediction in Generative Recommendation",
    { left: 50, top: 27, width: 680, height: 68 },
    {
      fontFamily: "Arial",
      fontSize: 25,
      bold: true,
      align: "left",
      verticalAlignment: "top",
    },
  );
  text(
    s,
    "header.authors",
    "Kaiwen Wei¹*, Kejun He¹*, Xiaomian Kang², Jie Zhang³, Yuming Yang¹,\nLi Jin⁴, Zhenyang Li⁵, Jiang Zhong¹†, He Bai³, Junnan Zhu²†",
    { left: 51, top: 94, width: 650, height: 36 },
    {
      fontFamily: "Arial",
      fontSize: 12,
      bold: true,
      align: "left",
      verticalAlignment: "top",
    },
  );
  text(
    s,
    "header.affiliations",
    "¹College of Computer Science, Chongqing University\n²MAIS, Institute of Automation, Chinese Academy of Sciences\n³Independent Researcher\n⁴Aerospace Information Research Institute, Chinese Academy of Sciences\n⁵Department of Computer Science, City University of Hong Kong",
    { left: 51, top: 132, width: 640, height: 86 },
    {
      fontFamily: "Arial",
      fontSize: 12,
      align: "left",
      verticalAlignment: "top",
    },
  );
  await cropAsset(ctx, "header.acl", 739, 14, 327, 63, null, "ACL 2026 banner");
  await cropAsset(ctx, "header.cqu", 646, 95, 417, 126, null, "Chongqing University logo");

  const heading = (name, value, x, y, w) => sectionTitle(
    s,
    name,
    value,
    x,
    y,
    w,
    35,
    { fontSize: 23.5, color: "#004B78", bold: true },
  );
  heading("introduction.title", "Introduction", 53, 232, 230);
  text(
    s,
    "introduction.body",
    "Generative recommendation has recently emerged as a promising paradigm by leveraging pre-trained language models to directly generate semantic item identifiers. Compared with traditional sequential recommenders, it provides greater flexibility in modeling user preferences and recommendation paths. However, existing generative recommenders are predominantly trained with an autoregressive next-item prediction objective. This left-to-right paradigm emphasizes local transitions and recent interactions, while overlooking deeper dependencies hidden in the entire user history. As a result, models often rely on recency bias and struggle to capture the latent intent that drives a user’s behavior sequence.",
    { left: 54, top: 262, width: 672, height: 135 },
    {
      fontFamily: "Times New Roman",
      fontSize: 14,
      align: "left",
      verticalAlignment: "top",
    },
  );
  await cropAsset(ctx, "introduction.concept", 741, 261, 289, 274, null, "User-intent concept diagram");

  heading("contributions.title", "Main Contributions", 53, 400, 280);
  text(
    s,
    "contributions.body",
    "(1) Entropy-Guided Masking. We selectively mask high-entropy items—those appearing in diverse behavioral contexts—to focus reconstruction on the most informative and critical historical junctions.\n(2) Curriculum Learning Scheduler. We progressively transition from an initial random masking warmup to a high-ratio entropy-guided masking phase, then gradually reduce the ratio to adapt the model’s deep contextual understanding to the inherent causal structure of autoregressive generation.",
    { left: 54, top: 431, width: 672, height: 104 },
    {
      fontFamily: "Times New Roman",
      fontSize: 14,
      align: "left",
      verticalAlignment: "top",
    },
  );

  heading("method.title", "Mask History Learning", 53, 538, 390);
  text(
    s,
    "method.body",
    "We propose Masked History Learning (MHL), which augments generative recommendation models with an auxiliary objective of reconstructing masked historical items. By jointly optimizing next-item prediction and history reconstruction, MHL shifts the focus from local transitions to deep path comprehension and latent intent understanding. We introduce entropy-guided masking to selectively target high-entropy items for reconstruction, and an adaptive curriculum scheduler that progressively transitions from random masking to high-ratio entropy masking, then gradually reduces the ratio to align deep contextual understanding with autoregressive generation.",
    { left: 54, top: 570, width: 270, height: 345 },
    {
      fontFamily: "Times New Roman",
      fontSize: 14,
      align: "left",
      verticalAlignment: "top",
    },
  );
  await cropAsset(ctx, "method.pipeline", 330, 570, 700, 343, null, "Masked History Learning pipeline");

  heading("performance.title", "Performance comparisons", 53, 916, 500);
  await cropAsset(ctx, "performance.tables", 48, 952, 551, 372, null, "Performance comparison tables");
  await cropAsset(ctx, "performance.case-study", 628, 952, 401, 373, null, "Historical purchase sequence and bar charts");

  heading("conclusion.title", "Conclusion", 53, 1340, 220);
  text(
    s,
    "conclusion.body",
    "Performance comparisons demonstrate MHL’s effectiveness across dimensions. MHL consistently outperforms state-of-the-art baselines across all datasets. The generalization study validates significant improvements over RPG on text token sequences. The case study shows MHL generates recommendations that align more closely with the user’s true subsequent sequence, revealing deeper latent intent behind the historical path. The cold-start comparison confirms superior performance across all item frequency bins, including low-frequency items. In summary, MHL achieves substantial gains in accuracy, generalizability, intent-awareness, and cold-start performance by deeply understanding user historical paths.",
    { left: 54, top: 1370, width: 978, height: 113 },
    {
      fontFamily: "Times New Roman",
      fontSize: 14,
      align: "left",
      verticalAlignment: "top",
    },
  );
}

const CASES = [
  {
    id: "agent-memory-taxonomy-fig1",
    reference: path.join(ROOT, "docs/benchmark/references/agent-memory-taxonomy-fig1.png"),
    width: 1924,
    height: 1398,
    render: renderTaxonomy,
    source: "User-provided screenshot: 截屏2026-07-31 13.46.26.png",
  },
  {
    id: "acl2026-mhl-poster",
    reference: path.join(ROOT, "docs/benchmark/references/acl2026-mhl-poster.jpg"),
    width: 1080,
    height: 1516,
    render: renderPoster,
    source: "User-provided image: 宣传一下我们被ACL 2026录用oral的工作",
  },
];

async function buildCase(spec) {
  const outputDir = path.join(ROOT, "docs/strict-experiments", spec.id);
  const assetDir = path.join(outputDir, "assets");
  await fs.mkdir(assetDir, { recursive: true });
  const presentation = Presentation.create({
    slideSize: { width: spec.width, height: spec.height },
  });
  const slide = presentation.slides.add();
  const ctx = { ...spec, outputDir, assetDir, slide };
  await spec.render(ctx);
  slide.speakerNotes.textFrame.setText(
    `[Sources]\n- ${spec.source}\n[/Sources]`,
  );
  const inspection = await presentation.inspect({
    kind: "slide,shape,image,textbox,notes",
    maxChars: 1200,
  });
  await fs.writeFile(
    path.join(outputDir, "editable.pptx.inspect.ndjson"),
    inspection.ndjson,
  );
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(path.join(outputDir, "editable.pptx"));
  console.log(`Created ${spec.id}: ${spec.width}x${spec.height}`);
}

for (const spec of CASES) {
  await buildCase(spec);
}
