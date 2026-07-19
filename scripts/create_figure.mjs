#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1280;
const H = 720;
const C = {
  ink: "#173042",
  muted: "#647482",
  paper: "#FBFCFD",
  white: "#FFFFFF",
  grid: "#DCE3E8",
  neutralFill: "#F3F5F7",
  neutralStroke: "#68727D",
  blueFill: "#DDEBF7",
  blueStroke: "#3979A8",
  greenFill: "#DDF2EA",
  greenStroke: "#2E8064",
  orangeFill: "#FCE8DC",
  orangeStroke: "#B7683A",
  purpleFill: "#EEE7F7",
  purpleStroke: "#72539A"
};

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function addText(slide, name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 }
  });
  shape.text = text;
  shape.text.style = {
    fontFamily: "Arial",
    fontSize: style.fontSize ?? 18,
    bold: style.bold ?? false,
    color: style.color ?? C.ink,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle"
  };
  return shape;
}

function addBox(slide, name, label, position, role = "neutral", detail = "") {
  const palette = {
    representation: [C.blueFill, C.blueStroke],
    proposed: [C.greenFill, C.greenStroke],
    auxiliary: [C.orangeFill, C.orangeStroke],
    output: [C.purpleFill, C.purpleStroke],
    neutral: [C.neutralFill, C.neutralStroke]
  }[role] ?? [C.neutralFill, C.neutralStroke];
  const box = slide.shapes.add({
    geometry: "roundRect",
    name: `module.${name}`,
    position,
    fill: palette[0],
    line: { style: "solid", fill: palette[1], width: role === "proposed" ? 2.5 : 1.7 },
    borderRadius: 14
  });
  box.text = detail ? `${label}\n${detail}` : label;
  box.text.style = {
    fontFamily: "Arial",
    fontSize: detail ? 17 : 18,
    bold: true,
    color: C.ink,
    alignment: "center",
    verticalAlignment: "middle"
  };
  return box;
}

function connect(slide, from, to, name, options = {}) {
  const connector = slide.shapes.connect(from, to, {
    kind: options.kind ?? "straight",
    fromSide: options.fromSide ?? "right",
    toSide: options.toSide ?? "left",
    line: {
      style: options.dashed ? "dashed" : "solid",
      fill: options.color ?? C.muted,
      width: options.width ?? 2
    },
    tail: { type: "arrow", width: "med", length: "med" }
  });
  connector.name = `arrow.${name}`;
  connector.bringToFront();
  return connector;
}

function header(slide, role, title, subtitle) {
  addText(slide, `label.role.${role.toLowerCase()}`, role, { left: 64, top: 34, width: 170, height: 24 }, { fontSize: 13, bold: true, color: C.greenStroke });
  addText(slide, `label.title.${role.toLowerCase()}`, title, { left: 64, top: 62, width: 980, height: 52 }, { fontSize: 36, bold: true });
  addText(slide, `label.subtitle.${role.toLowerCase()}`, subtitle, { left: 64, top: 112, width: 1080, height: 34 }, { fontSize: 17, color: C.muted });
  slide.shapes.add({ geometry: "line", name: `rule.${role.toLowerCase()}`, position: { left: 64, top: 153, width: 1152, height: 0 }, fill: "none", line: { style: "solid", fill: C.grid, width: 1 } });
}

function addMainPipeline(slide, spec, y = 300, scale = 1, detailed = false) {
  const items = [
    { id: "input", label: spec.input, role: "neutral", detail: detailed ? "RGB / source data" : "" },
    ...spec.stages,
    { id: "output", label: spec.output, role: "output", detail: detailed ? "Dense task output" : "" }
  ];
  const gap = 34 * scale;
  const boxW = 182 * scale;
  const boxH = (detailed ? 118 : 92) * scale;
  const total = items.length * boxW + (items.length - 1) * gap;
  const left = (W - total) / 2;
  const nodes = [];
  items.forEach((item, index) => {
    const position = { left: left + index * (boxW + gap), top: y, width: boxW, height: boxH };
    const node = addBox(slide, item.id, detailed ? "" : item.label, position, item.role, detailed ? "" : item.detail ?? "");
    if (detailed) {
      addText(slide, `label.module.${item.id}`, item.label, { left: position.left + 12, top: position.top + 11, width: position.width - 24, height: 38 }, { fontSize: 16, bold: true, alignment: "center" });
      addText(slide, `label.detail.${item.id}`, item.detail ?? "", { left: position.left + 12, top: position.top + 49, width: position.width - 24, height: 22 }, { fontSize: 12, color: C.muted, alignment: "center" });
    }
    nodes.push(node);
  });
  for (let index = 0; index < nodes.length - 1; index += 1) {
    connect(slide, nodes[index], nodes[index + 1], `${items[index].id}-to-${items[index + 1].id}`);
  }
  return { nodes, items, left, boxW, boxH, gap };
}

function createOptionsSlide(presentation, spec) {
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  header(slide, "WIREFRAMES", "Choose the structure before polishing the modules", "Three editable alternatives expose different reading priorities.");

  const cards = [
    { x: 64, title: "A · Main pipeline", note: "Fastest reading order", mode: "pipeline" },
    { x: 448, title: "B · Multi-scale hierarchy", note: "Makes feature levels explicit", mode: "hierarchy" },
    { x: 832, title: "C · Contribution-first", note: "Gives fusion the visual focus", mode: "focus" }
  ];

  cards.forEach((card, cardIndex) => {
    slide.shapes.add({ geometry: "roundRect", name: `wireframe.${String.fromCharCode(97 + cardIndex)}`, position: { left: card.x, top: 184, width: 344, height: 448 }, fill: C.white, line: { style: "solid", fill: C.grid, width: 1.3 }, borderRadius: 16 });
    addText(slide, `wireframe.${cardIndex}.title`, card.title, { left: card.x + 22, top: 204, width: 300, height: 30 }, { fontSize: 20, bold: true });
    addText(slide, `wireframe.${cardIndex}.note`, card.note, { left: card.x + 22, top: 236, width: 300, height: 26 }, { fontSize: 15, color: C.muted });
    if (card.mode === "pipeline") {
      const y = 352;
      const xs = [card.x + 24, card.x + 106, card.x + 188, card.x + 270];
      const mini = xs.map((x, i) => addBox(slide, `wf-a-${i}`, ["I", "E", "F", "O"][i], { left: x, top: y, width: 58, height: 62 }, i === 2 ? "proposed" : i === 1 ? "representation" : "neutral"));
      for (let i = 0; i < mini.length - 1; i += 1) connect(slide, mini[i], mini[i + 1], `wf-a-${i}`, { width: 1.4 });
    } else if (card.mode === "hierarchy") {
      const input = addBox(slide, "wf-b-input", "Input", { left: card.x + 24, top: 370, width: 62, height: 58 });
      const levels = [306, 370, 434].map((top, i) => addBox(slide, `wf-b-level-${i}`, `L${i + 1}`, { left: card.x + 130, top, width: 58, height: 48 }, "representation"));
      const fusion = addBox(slide, "wf-b-fusion", "Fuse", { left: card.x + 246, top: 354, width: 70, height: 92 }, "proposed");
      levels.forEach((node, i) => connect(slide, input, node, `wf-b-input-${i}`, { kind: "elbow", width: 1.3 }));
      levels.forEach((node, i) => connect(slide, node, fusion, `wf-b-fusion-${i}`, { kind: "elbow", width: 1.3 }));
    } else {
      const left = addBox(slide, "wf-c-context", "Context", { left: card.x + 24, top: 370, width: 72, height: 58 });
      const focus = addBox(slide, "wf-c-focus", "Fusion", { left: card.x + 120, top: 326, width: 112, height: 146 }, "proposed");
      const right = addBox(slide, "wf-c-output", "Output", { left: card.x + 256, top: 370, width: 64, height: 58 }, "output");
      connect(slide, left, focus, "wf-c-left", { width: 1.4 });
      connect(slide, focus, right, "wf-c-right", { width: 1.4 });
    }
    addText(slide, `wireframe.${cardIndex}.footer`, cardIndex === 2 ? "Recommended when the fusion module is the paper's main contribution." : "Useful when this structure matches the technical story.", { left: card.x + 22, top: 545, width: 298, height: 58 }, { fontSize: 14, color: cardIndex === 2 ? C.greenStroke : C.muted });
  });
  return slide;
}

function createSelectedSlide(presentation, spec) {
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  header(slide, "SELECTED", "Confirmed structure fixes reading order and emphasis", "Major modules and the auxiliary prompt are fixed before internal detail is added.");
  const pipeline = addMainPipeline(slide, spec, 316, 0.96, false);
  const fusionIndex = pipeline.items.findIndex((item) => item.id === spec.auxiliary.target);
  const prompt = addBox(slide, "prompt", spec.auxiliary.label, { left: pipeline.left + fusionIndex * (pipeline.boxW + pipeline.gap) + 20, top: 205, width: pipeline.boxW - 40, height: 66 }, "auxiliary");
  connect(slide, prompt, pipeline.nodes[fusionIndex], "prompt-to-fusion", { kind: "straight", fromSide: "bottom", toSide: "top", dashed: true, color: C.orangeStroke });
  addText(slide, "callout.structure-confirmed", "Structure confirmed", { left: 943, top: 540, width: 220, height: 34 }, { fontSize: 17, bold: true, color: C.greenStroke, alignment: "right" });
  addText(slide, "callout.next", "Next: fill internal modules and visual semantics", { left: 792, top: 575, width: 370, height: 30 }, { fontSize: 14, color: C.muted, alignment: "right" });
  return slide;
}

function createFinalSlide(presentation, spec) {
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  header(slide, "FINAL FIGURE", spec.title, "Editable native objects · restrained academic palette · double-column composition");

  const pipeline = addMainPipeline(slide, spec, 318, 0.96, true);
  const fusionIndex = pipeline.items.findIndex((item) => item.id === spec.auxiliary.target);
  const encoderIndex = pipeline.items.findIndex((item) => item.id === "encoder");
  const encoder = pipeline.nodes[encoderIndex];
  const fusion = pipeline.nodes[fusionIndex];

  for (let i = 0; i < 3; i += 1) {
    slide.shapes.add({ geometry: "rect", name: `feature.scale.${i + 1}`, position: { left: encoder.position.left + 35 + i * 37, top: encoder.position.top + 88 - i * 5, width: 26, height: 17 + i * 5 }, fill: i === 0 ? "#A8CCE5" : i === 1 ? "#7FB4D6" : "#5A9AC4", line: { style: "solid", fill: C.blueStroke, width: 1 }, borderRadius: 4 });
  }

  const dotXs = [fusion.position.left + 51, fusion.position.left + 81, fusion.position.left + 111];
  dotXs.forEach((x, i) => slide.shapes.add({ geometry: "ellipse", name: `token.fusion.${i + 1}`, position: { left: x, top: fusion.position.top + 88, width: 18, height: 18 }, fill: i === 1 ? "#6DB395" : "#A9D7C5", line: { style: "solid", fill: C.greenStroke, width: 1 } }));

  const prompt = addBox(slide, "prompt", spec.auxiliary.label, { left: fusion.position.left + 14, top: 202, width: fusion.position.width - 28, height: 72 }, "auxiliary", "Semantic guidance");
  connect(slide, prompt, fusion, "prompt-to-fusion", { kind: "straight", fromSide: "bottom", toSide: "top", dashed: true, color: C.orangeStroke });

  addText(slide, "callout.proposed", "PROPOSED", { left: fusion.position.left + 38, top: fusion.position.top - 32, width: fusion.position.width - 76, height: 24 }, { fontSize: 12, bold: true, color: C.greenStroke, alignment: "center" });
  const legendY = 540;
  [["Main data path", C.muted, false], ["Auxiliary guidance", C.orangeStroke, true], ["Proposed module", C.greenStroke, false]].forEach((item, i) => {
    const x = 366 + i * 210;
    slide.shapes.add({ geometry: "line", name: `legend.line.${i}`, position: { left: x, top: legendY + 11, width: 42, height: 0 }, fill: "none", line: { style: item[2] ? "dashed" : "solid", fill: item[1], width: 2 } });
    addText(slide, `legend.label.${i}`, item[0], { left: x + 50, top: legendY, width: 150, height: 24 }, { fontSize: 14, color: C.muted });
  });
  addText(slide, "figure.caption", "Figure concept: hierarchical visual features are aligned with a text prompt before task-specific decoding.", { left: 160, top: 605, width: 960, height: 30 }, { fontSize: 15, color: C.muted, alignment: "center" });
  return slide;
}

function createComponentsSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  header(slide, "COMPONENTS", "Reusable elements stay editable on a dedicated page", "Copy these native shapes into future figures and keep their semantic object names.");

  const cards = [
    { x: 64, title: "Feature pyramid", role: "representation" },
    { x: 352, title: "Attention fusion", role: "proposed" },
    { x: 640, title: "Auxiliary prompt", role: "auxiliary" },
    { x: 928, title: "Dense output", role: "output" }
  ];
  cards.forEach((card, i) => {
    const box = addBox(slide, `component-${i}`, card.title, { left: card.x, top: 220, width: 240, height: 250 }, card.role);
    box.text.style = { fontFamily: "Arial", fontSize: 20, bold: true, color: C.ink, alignment: "center", verticalAlignment: "top" };
    if (i === 0) {
      for (let j = 0; j < 4; j += 1) slide.shapes.add({ geometry: "rect", name: `component.feature.${j}`, position: { left: card.x + 47 + j * 36, top: 330 - j * 12, width: 28, height: 34 + j * 12 }, fill: "#7FB4D6", line: { style: "solid", fill: C.blueStroke, width: 1 }, borderRadius: 4 });
    } else if (i === 1) {
      for (let j = 0; j < 5; j += 1) slide.shapes.add({ geometry: "ellipse", name: `component.token.${j}`, position: { left: card.x + 44 + j * 31, top: 330 + (j % 2) * 22, width: 20, height: 20 }, fill: j === 2 ? "#5FA88C" : "#B8DFD0", line: { style: "solid", fill: C.greenStroke, width: 1 } });
    } else if (i === 2) {
      addText(slide, "component.prompt.text", "T", { left: card.x + 82, top: 320, width: 76, height: 72 }, { fontSize: 44, bold: true, color: C.orangeStroke, alignment: "center" });
    } else {
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) slide.shapes.add({ geometry: "rect", name: `component.output.${row}.${col}`, position: { left: card.x + 65 + col * 28, top: 307 + row * 28, width: 24, height: 24 }, fill: (row + col) % 3 === 0 ? "#9B82BA" : "#D7CAE7", line: { style: "solid", fill: C.purpleStroke, width: 0.6 }, borderRadius: 3 });
    }
    addText(slide, `component.${i}.hint`, ["repeated scales", "token interaction", "semantic signal", "pixel-wise result"][i], { left: card.x + 28, top: 425, width: 184, height: 25 }, { fontSize: 14, color: C.muted, alignment: "center" });
  });
  addText(slide, "component.footer", "Component pages are working material; only the FINAL or EXPORT page should enter the paper.", { left: 230, top: 560, width: 820, height: 32 }, { fontSize: 16, color: C.muted, alignment: "center" });
  return slide;
}

async function writeBlob(file, blob) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  const specPath = getArg("--spec");
  const outPath = getArg("--out", "outputs/academic-figure.pptx");
  const previewDir = getArg("--preview-dir", "outputs/preview");
  if (!specPath) throw new Error("Missing --spec <json>");
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  if (!spec.title || !spec.input || !Array.isArray(spec.stages) || !spec.output) throw new Error("Spec requires title, input, stages[], and output");
  if (!spec.auxiliary?.target || !spec.stages.some((stage) => stage.id === spec.auxiliary.target)) throw new Error("auxiliary.target must match a stage id");

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  createOptionsSlide(presentation, spec);
  createSelectedSlide(presentation, spec);
  createFinalSlide(presentation, spec);
  createComponentsSlide(presentation);

  await fs.mkdir(previewDir, { recursive: true });
  for (const [index, slide] of presentation.slides.items.entries()) {
    const number = String(index + 1).padStart(2, "0");
    await writeBlob(path.join(previewDir, `slide-${number}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(previewDir, `slide-${number}.layout.json`), await layout.text());
  }
  const pptx = await PresentationFile.exportPptx(presentation);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await pptx.save(outPath);
  console.log(`Created ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
