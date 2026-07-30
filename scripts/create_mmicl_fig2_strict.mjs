#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 979;
const H = 273;
const OUT = path.resolve("docs/strict-recreation/iclr-mmicl-fig2/editable.pptx");

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
    fontFamily: options.fontFamily ?? "Times New Roman",
    fontSize: size,
    bold: options.bold ?? false,
    color: options.color ?? "#111111",
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
}

function arrow(slide, name, x1, y1, x2, y2, color = "#111111", width = 1.4) {
  const line = shape(
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
  const head = shape(slide, `${name}.head`, "triangle", x2 - 3.5, y2 - 3.5, 7, 7, color);
  head.rotation = angle;
}

function boxText(slide, name, value, x, y, w, h, fill, size = 12, stroke = "none", geometry = "roundRect") {
  const box = shape(slide, name, geometry, x, y, w, h, fill, stroke, 0.7);
  box.text = value;
  box.text.style = {
    fontFamily: "Times New Roman",
    fontSize: size,
    color: "#111111",
    alignment: "center",
    verticalAlignment: "middle",
  };
}

function addLlm(slide, name, x, y, w) {
  const llm = shape(slide, name, "roundRect", x, y, w, 44, "#1F9DCA");
  llm.text = "LLM";
  llm.text.style = {
    fontFamily: "Times New Roman",
    fontSize: 13,
    color: "#FFFFFF",
    alignment: "center",
    verticalAlignment: "middle",
  };
}

function addVpg(slide, name, x, y, w = 73) {
  boxText(slide, name, "VPG", x, y, w, 23, "#C8F0C2", 13);
}

function addImg(slide, name, x, y, w = 43) {
  boxText(slide, name, "Img", x, y, w, 21, "#E2F4F6", 9);
}

async function main() {
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  addLlm(slide, "a.llm", 42, 79, 208);
  arrow(slide, "a.output", 146, 79, 146, 47);
  const aTokens = [
    ["embed", 35, 58, "#F7C7B5"],
    ["Text", 106, 42, "#DDD7F5"],
    ["Text", 161, 41, "#DDD7F5"],
    ["Text", 215, 40, "#DDD7F5"],
  ];
  for (const [index, [label, x, w, fill]] of aTokens.entries()) {
    boxText(slide, `a.token.${index}`, label, x, 145, w, 20, fill, 9, "none", "rect");
    arrow(slide, `a.token-arrow.${index}`, x + w / 2, 145, x + w / 2, 126, "#888888", 1);
  }
  addVpg(slide, "a.vpg", 28, 180);
  addImg(slide, "a.img", 44, 220);
  arrow(slide, "a.img-vpg", 65, 220, 65, 205);
  arrow(slide, "a.vpg-embed", 65, 180, 65, 165);
  text(slide, "a.caption", "(a) VLMs Focused on a single image", 0, 248, 335, 25, 17, { align: "left" });

  addLlm(slide, "b.llm", 434, 79, 190);
  arrow(slide, "b.output", 529, 79, 529, 47);
  const bTokens = [
    ["embed", 292, 59, "#F7C7B5"],
    ["embed", 370, 59, "#F7C7B5"],
    ["Text", 444, 42, "#DDD7F5"],
    ["Text", 506, 42, "#DDD7F5"],
    ["Text", 568, 42, "#DDD7F5"],
  ];
  for (const [index, [label, x, w, fill]] of bTokens.entries()) {
    boxText(slide, `b.token.${index}`, label, x, 145, w, 20, fill, 9, "none", "rect");
    arrow(slide, `b.token-arrow.${index}`, x + w / 2, 145, x + w / 2, 126, "#888888", 1);
  }
  addVpg(slide, "b.vpg.1", 286, 180);
  addVpg(slide, "b.vpg.2", 363, 180);
  addImg(slide, "b.img.1", 302, 220);
  addImg(slide, "b.img.2", 379, 220);
  arrow(slide, "b.img-vpg.1", 323, 220, 323, 205);
  arrow(slide, "b.img-vpg.2", 400, 220, 400, 205);
  arrow(slide, "b.vpg-embed.1", 323, 180, 323, 165);
  arrow(slide, "b.vpg-embed.2", 400, 180, 400, 165);
  text(slide, "b.caption", "(b) VLMs with few-shot ability", 335, 248, 320, 25, 17);

  addLlm(slide, "c.llm", 650, 79, 329);
  arrow(slide, "c.output", 815, 79, 815, 47);
  const cTokens = [
    ["Text", 650, 42, "#FDE57C"],
    ["[IMG]", 692, 43, "#FDE57C"],
    ["embed", 735, 52, "#F7C7B5"],
    ["Text", 797, 40, "#FDE57C"],
    ["Text", 846, 40, "#DDD7F5"],
    ["[IMG]", 893, 43, "#FDE57C"],
    ["embed", 936, 43, "#F7C7B5"],
  ];
  for (const [index, [label, x, w, fill]] of cTokens.entries()) {
    boxText(slide, `c.token.${index}`, label, x, 145, w, 20, fill, label === "[IMG]" ? 6.5 : 9, "none", "rect");
    arrow(slide, `c.token-arrow.${index}`, x + w / 2, 145, x + w / 2, 126, "#888888", 1);
  }
  shape(slide, "c.image-declaration.frame", "roundRect", 684, 137, 108, 40, "none", "#B58900", 1.2, true);
  text(slide, "c.image-declaration.label", "Image Declaration", 624, 178, 112, 18, 10, { color: "#B58900" });
  addVpg(slide, "c.vpg.1", 720, 180);
  addVpg(slide, "c.vpg.2", 912, 180);
  addImg(slide, "c.img.1", 736, 220);
  addImg(slide, "c.img.2", 928, 220);
  arrow(slide, "c.img-vpg.1", 757, 220, 757, 205);
  arrow(slide, "c.img-vpg.2", 949, 220, 949, 205);
  arrow(slide, "c.vpg-embed.1", 757, 180, 757, 166);
  arrow(slide, "c.vpg-embed.2", 949, 180, 949, 166);
  text(slide, "c.caption", "(c) MMICL", 760, 248, 150, 25, 17);

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- MMICL: Empowering Vision-language Model with Multi-Modal In-Context Learning, ICLR 2024, Figure 2: https://openreview.net/forum?id=5KojubHBr8\n[/Sources]",
  );
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
