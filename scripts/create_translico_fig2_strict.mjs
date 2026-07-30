#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1116;
const H = 572;
const OUT = path.resolve("docs/strict-recreation/acl-translico-fig2/editable.pptx");

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
    alignment: options.align ?? "left",
    verticalAlignment: "middle",
  };
}

function labeledBox(slide, name, value, x, y, w, h, fill, options = {}) {
  const item = shape(
    slide,
    name,
    options.geometry ?? "roundRect",
    x,
    y,
    w,
    h,
    fill,
    options.stroke ?? "#1F3B5B",
    options.strokeWidth ?? 1,
    options.dashed ?? false,
  );
  item.text = value;
  item.text.style = {
    fontFamily: "Arial",
    fontSize: options.fontSize ?? 12,
    bold: options.bold ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
}

function line(slide, name, x1, y1, x2, y2, options = {}) {
  const item = shape(
    slide,
    name,
    "line",
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
    "none",
    options.color ?? "#111111",
    options.width ?? 1.3,
    options.dashed ?? false,
  );
  item.flipHorizontal = x2 < x1;
  item.flipVertical = y2 < y1;
  if (options.arrowEnd) {
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
    const head = shape(slide, `${name}.head`, "triangle", x2 - 4, y2 - 4, 8, 8, options.color ?? "#111111");
    head.rotation = angle;
  }
  return item;
}

function transformer(slide, prefix, y, tokenLabels) {
  shape(slide, `${prefix}.panel`, "rect", 355, y, 396, 110, "#E3F1DA", "#25425F", 1);
  text(slide, `${prefix}.label`, "Transformer", 357, y + 38, 110, 35, 13, { bold: true });
  shape(slide, `${prefix}.output-frame`, "rect", 492, y + 30, 275, 46, "none", "#25425F", 1, true);
  text(slide, `${prefix}.output-label`, "8th layer output:", 496, y + 28, 118, 20, 11);
  for (let i = 0; i < tokenLabels.length; i += 1) {
    labeledBox(slide, `${prefix}.output.${i}`, "", 454 + i * 41, y + 48, 39, 20, "#E7F1E1", {
      geometry: "roundRect",
      stroke: "#25425F",
      strokeWidth: 0.8,
    });
  }
  for (const [index, labelValue] of tokenLabels.entries()) {
    const x = 454 + index * 41;
    labeledBox(slide, `${prefix}.input.${index}`, labelValue, x, y + 153, 39, 21, "#BFD5EC", {
      geometry: "roundRect",
      stroke: "#25425F",
      strokeWidth: 0.8,
      fontSize: 8,
    });
    line(slide, `${prefix}.input-arrow.${index}`, x + 19.5, y + 153, x + 19.5, y + 113, { arrowEnd: true });
  }
}

async function main() {
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  shape(slide, "objectives.frame", "roundRect", 10, 38, 320, 123, "none", "#25425F", 1.5, true);
  text(
    slide,
    "objectives.text",
    "Fine-tuning Objectives:\nMasked Language Modeling (MLM)\nTransliteration Contrastive Modeling (TCM)",
    22,
    66,
    292,
    66,
    15,
    { bold: true },
  );

  transformer(slide, "top", 58, ["</s>", "[mask]", "люди", "рівні", "."]);
  labeledBox(slide, "top.sentence", "original sentence:  всі люди рівні.", 11, 200, 272, 47, "#DCE9F8", {
    bold: true,
    fontSize: 14,
  });
  text(slide, "top.random-mask", "random mask", 296, 199, 112, 30, 14);
  line(slide, "top.random-mask-line", 283, 221, 454, 221, { dashed: true, color: "#555555", width: 1 });
  labeledBox(slide, "top.cls", "всі", 495, 0, 39, 21, "#E5E2FA", { fontSize: 10 });
  line(slide, "top.cls-arrow", 514, 58, 514, 22, { arrowEnd: true });
  line(slide, "top.mean-pool", 770, 111, 913, 111, { arrowEnd: true, width: 2 });
  text(slide, "top.mean-pool-label", "mean pooling", 787, 82, 105, 28, 14);
  labeledBox(slide, "top.sequence", "sequence representation", 916, 93, 184, 35, "#F5E7ED", {
    fontSize: 14,
  });

  text(slide, "heading.mlm", "Masked Language Modeling", 470, 247, 230, 32, 15, { bold: true });
  text(slide, "heading.tcm", "Transliteration Contrastive Modeling", 820, 247, 289, 32, 13, { bold: true });

  line(slide, "left.transliterate", 146, 247, 146, 496, { dashed: true, color: "#555555", arrowEnd: true });
  text(slide, "left.transliterate-label", "transliterate", 154, 348, 104, 32, 14);

  transformer(slide, "bottom", 360, ["</s>", "vsi", "ly", "[mask]", "ri", "vni", "."]);
  labeledBox(slide, "bottom.sentence", "transliteration:  vsi lyudi rivni.", 10, 496, 272, 47, "#DCE9F8", {
    bold: true,
    fontSize: 14,
  });
  text(slide, "bottom.random-mask", "random mask", 292, 493, 112, 30, 14);
  line(slide, "bottom.random-mask-line", 282, 522, 454, 522, { dashed: true, color: "#555555", width: 1 });
  labeledBox(slide, "bottom.cls", "udi", 575, 302, 39, 21, "#E5E2FA", { fontSize: 10 });
  line(slide, "bottom.cls-arrow", 594, 360, 594, 323, { arrowEnd: true });
  line(slide, "bottom.mean-pool", 770, 412, 912, 412, { arrowEnd: true, width: 2 });
  text(slide, "bottom.mean-pool-label", "mean pooling", 787, 383, 105, 28, 14);
  labeledBox(slide, "bottom.sequence", "sequence representation", 914, 396, 186, 35, "#FFF0CB", {
    fontSize: 14,
  });

  line(slide, "contrastive.top", 1009, 138, 1009, 385, { arrowEnd: true });
  line(slide, "contrastive.bottom", 1009, 385, 1009, 139, { arrowEnd: true });

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- TransliCo: A Contrastive Learning Framework to Address the Script Barrier in Multilingual Pretrained Language Models, ACL 2024, Figure 2: https://aclanthology.org/2024.acl-long.136/\n[/Sources]",
  );
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
