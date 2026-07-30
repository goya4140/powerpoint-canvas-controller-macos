#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1119;
const H = 210;
const OUT_DIR = path.resolve("docs/strict-recreation/emnlp-prof-fig1");
const OUT = path.join(OUT_DIR, "editable.pptx");
const REFERENCE = path.resolve("docs/benchmark/references/emnlp-prof-fig1.png");

function addShape(slide, name, geometry, x, y, w, h, fill, stroke = "#777777", strokeWidth = 1) {
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

function addText(slide, name, value, x, y, w, h, size, options = {}) {
  const item = addShape(slide, name, "textbox", x, y, w, h, "none", "none", 0);
  item.text = value;
  item.text.style = {
    fontFamily: options.fontFamily ?? "Arial",
    fontSize: size,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    color: options.color ?? "#555555",
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
  return item;
}

function addArrow(slide, name, x1, y1, x2, y2, color = "#555555", width = 1.5) {
  const line = addShape(
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
  line.flipHorizontal = x2 < x1;
  line.flipVertical = y2 < y1;
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
  const head = addShape(slide, `${name}.head`, "triangle", x2 - 4, y2 - 4, 8, 8, color, "none", 0);
  head.rotation = angle;
}

function addLine(slide, name, x1, y1, x2, y2, color, width = 2) {
  const line = addShape(
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
  line.flipHorizontal = x2 < x1;
  line.flipVertical = y2 < y1;
  return line;
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

async function main() {
  const assets = path.join(OUT_DIR, "assets");
  await fs.mkdir(assets, { recursive: true });
  const cropSpecs = [
    ["input-writing.png", 88, 65, 81, 111],
    ["feedback-formula.png", 308, 84, 80, 80],
    ["student-formula.png", 522, 77, 59, 89],
    ["openai-logo.png", 632, 93, 74, 72],
    ["scoring-formula.png", 719, 106, 79, 31],
    ["preference-relation.png", 820, 68, 139, 113],
    ["updated-model.png", 991, 81, 78, 84],
  ];
  for (const [name, x, y, width, height] of cropSpecs) {
    execFileSync("python3", [
      "scripts/crop_image_asset.py",
      REFERENCE,
      path.join(assets, name),
      String(x),
      String(y),
      String(width),
      String(height),
    ]);
  }
  const logo = path.join(assets, "openai-logo.png");

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  addText(slide, "title.initial", "Initial Writings", 42, 22, 116, 28, 14, { bold: true });
  await addPng(
    slide,
    "asset.input-writing",
    path.join(assets, "input-writing.png"),
    { left: 66, top: 54, width: 81, height: 111 },
    "Initial writing set",
  );

  addShape(slide, "panel.feedback", "rect", 175, 0, 198, 168, "#FFF0C9", "#777777", 1);
  addText(slide, "title.feedback", "Generating Feedback", 192, 18, 164, 30, 14, { bold: true });
  addShape(slide, "module.feedback", "roundRect", 184, 66, 80, 86, "#FFE49A", "#777777", 1);
  addText(slide, "formula.model", "Mₜ", 191, 79, 66, 56, 34, {
    fontFamily: "Cambria Math",
    italic: true,
    color: "#111111",
  });
  await addPng(
    slide,
    "asset.feedback-formula",
    path.join(assets, "feedback-formula.png"),
    { left: 285, top: 77, width: 80, height: 80 },
    "Generated feedback samples",
  );

  addShape(slide, "panel.student", "rect", 393, 0, 174, 168, "#D7E6F3", "#777777", 1);
  addText(slide, "title.student", "Revisions from Student\nSimulator", 395, 10, 170, 45, 14, { bold: true });
  addShape(slide, "module.student", "roundRect", 404, 66, 62, 86, "#9DBDEA", "#6B7B8D", 1);
  addText(slide, "label.student", "S", 411, 79, 48, 56, 35, {
    fontFamily: "Cambria Math",
    italic: true,
    color: "#111111",
  });
  await addPng(
    slide,
    "asset.student-formula",
    path.join(assets, "student-formula.png"),
    { left: 499, top: 70, width: 59, height: 89 },
    "Student revisions",
  );

  addShape(slide, "panel.scoring", "rect", 586, 0, 198, 168, "#DCD4E8", "#777777", 1);
  addText(slide, "title.scoring", "Scoring Revisions for\nPreference Pair Selection", 591, 10, 188, 45, 14, { bold: true });
  addShape(slide, "frame.logo", "rect", 593, 64, 88, 88, "#FFFFFF", "#999999", 0.8);
  await addPng(slide, "asset.openai-logo", logo, { left: 602, top: 73, width: 70, height: 70 }, "OpenAI scoring model");
  await addPng(
    slide,
    "asset.scoring-formula",
    path.join(assets, "scoring-formula.png"),
    { left: 696, top: 99, width: 79, height: 31 },
    "Scored preference pair",
  );

  addText(slide, "title.preference", "Preference Relations", 791, 22, 155, 28, 14, { bold: true });
  await addPng(
    slide,
    "asset.preference-relation",
    path.join(assets, "preference-relation.png"),
    { left: 797, top: 55, width: 139, height: 113 },
    "Preference relations",
  );

  addShape(slide, "panel.dpo", "rect", 954, 0, 105, 168, "#F4F4F4", "#777777", 1);
  addText(slide, "title.dpo", "DPO", 971, 22, 70, 28, 14, { bold: true });
  await addPng(
    slide,
    "asset.updated-model",
    path.join(assets, "updated-model.png"),
    { left: 968, top: 66, width: 78, height: 84 },
    "Updated model",
  );

  addArrow(slide, "arrow.input-feedback", 145, 112, 183, 112);
  addArrow(slide, "arrow.feedback-student", 264, 112, 403, 112);
  addArrow(slide, "arrow.student-scoring", 466, 112, 592, 112);
  addArrow(slide, "arrow.scoring-preference", 681, 112, 796, 112);
  addArrow(slide, "arrow.preference-dpo", 936, 112, 966, 112);

  addLine(slide, "feedback.vertical-right", 1007, 152, 1007, 200, "#FF0000", 3);
  addLine(slide, "feedback.horizontal", 1007, 200, 223, 200, "#FF0000", 3);
  addLine(slide, "feedback.vertical-left", 223, 200, 223, 163, "#FF0000", 3);
  const feedbackHead = addShape(slide, "feedback.head", "triangle", 216, 158, 14, 14, "#FF0000", "none", 0);
  feedbackHead.rotation = 0;
  addText(slide, "feedback.label", "Model for next iteration", 490, 176, 250, 23, 13, {
    bold: true,
    color: "#FF0000",
  });

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- Closing the Loop: Learning to Generate Writing Feedback via Language Model Simulated Student Revisions, EMNLP 2024, Figure 1: https://aclanthology.org/2024.emnlp-main.928/\n[/Sources]",
  );
  await fs.mkdir(OUT_DIR, { recursive: true });
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
