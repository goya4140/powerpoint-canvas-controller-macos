#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 978;
const H = 276;
const OUT = path.resolve("docs/strict-recreation/neurips-dot-fig2/editable.pptx");

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
    italic: options.italic ?? false,
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
    options.color ?? "#6BAE45",
    options.width ?? 1.5,
    options.dashed ?? false,
  );
  item.flipHorizontal = x2 < x1;
  item.flipVertical = y2 < y1;
  if (options.arrowEnd) {
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
    const head = shape(slide, `${name}.head`, "triangle", x2 - 3.5, y2 - 3.5, 7, 7, options.color ?? "#6BAE45");
    head.rotation = angle;
  }
}

function token(slide, name, x, y, fill, label = "", dashed = false) {
  const item = shape(slide, name, "ellipse", x, y, 34, 34, fill, "#9A9A9A", 1.2, dashed);
  if (label) {
    item.text = label;
    item.text.style = {
      fontFamily: "Times New Roman",
      fontSize: 12,
      color: "#111111",
      alignment: "center",
      verticalAlignment: "middle",
    };
  }
}

function row(slide, prefix, x, y, fills, dashed = false) {
  const rowWidth = 44 + fills.length * 40;
  for (let offset = 7; offset >= 0; offset -= 3.5) {
    shape(slide, `${prefix}.frame.${offset}`, "roundRect", x + offset, y + offset, rowWidth, 42, "#FFFFFF", "#AAAAAA", 1.1);
  }
  token(slide, `${prefix}.s`, x + 8, y + 4, "#FFF4EC", "s");
  fills.forEach((fill, index) => token(slide, `${prefix}.token.${index}`, x + 50 + index * 40, y + 4, fill, "", dashed));
}

function pill(slide, name, value, x, y, w, fill, stroke = "#AAAAAA", color = "#555555") {
  const item = shape(slide, name, "roundRect", x, y, w, 27, fill, stroke, 1);
  item.text = value;
  item.text.style = {
    fontFamily: "Times New Roman",
    fontSize: 12,
    color,
    alignment: "center",
    verticalAlignment: "middle",
  };
}

async function main() {
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  shape(slide, "panel.problem", "roundRect", 0, 0, 196, 274, "none", "#B8B8B8", 1, true);
  text(slide, "problem.s-label", "s", 0, 13, 17, 22, 14, { italic: true });
  shape(slide, "problem.source", "roundRect", 21, 19, 153, 110, "#FFF5EE", "#999999", 1.2);
  text(
    slide,
    "problem.source-text",
    "A robe takes 2 bolts\nof blue fiber and\nhalf that much white\nfiber. How many\nbolts in total does\nit take?",
    31,
    28,
    129,
    82,
    12,
    { fontFamily: "Courier New", color: "#D47C5F", align: "left" },
  );
  text(slide, "problem.source-label", "Source", 119, 100, 48, 18, 8, { color: "#777777" });
  token(slide, "problem.s-token", 207, 19, "#FFF4EC", "s");
  line(slide, "problem.s-path", 249, 36, 270, 36, { arrowEnd: true });
  text(slide, "problem.rationales", "Rationales", 52, 127, 83, 20, 12, { color: "#777777" });
  line(slide, "problem.rationale-down", 132, 125, 132, 145, { arrowEnd: true });
  pill(slide, "problem.r1", "2+1=3", 23, 151, 58, "#EEEEEE");
  pill(slide, "problem.r2", "2/2=1", 91, 151, 66, "#EEEEEE");
  line(slide, "problem.r-between", 91, 164, 82, 164, { arrowEnd: true });
  text(slide, "problem.r-label", "r₁", 0, 151, 18, 25, 14, { italic: true });
  line(slide, "problem.answer-down", 52, 179, 52, 203, { arrowEnd: true });
  pill(slide, "problem.answer", "#### 3", 23, 207, 58, "#DCE6F2", "#999999", "#5F82B7");
  text(slide, "problem.answer-label", "Answer", 95, 207, 63, 27, 12, { color: "#777777" });
  text(slide, "problem.a-label", "a", 0, 207, 18, 25, 14, { italic: true });
  token(slide, "problem.a-token", 207, 202, "#E6EEF5", "a");
  line(slide, "problem.a-path", 270, 219, 249, 219, { arrowEnd: true });
  text(slide, "problem.caption", "Problem-solving tasks", 9, 244, 183, 27, 14, { bold: true, italic: true });

  shape(slide, "panel.diffusion", "roundRect", 277, 0, 529, 274, "none", "#C5C5C5", 1, true);
  text(slide, "single.tT", "t=T", 287, 20, 34, 25, 13, { italic: true });
  text(slide, "single.t0", "t=0", 287, 112, 34, 25, 13, { italic: true });
  text(slide, "single.more", "⋮", 293, 58, 18, 34, 18);
  row(slide, "single.row.0", 328, 19, ["#E4F2E0", "#E4F2E0", "#E4F2E0"], true);
  row(slide, "single.row.1", 328, 62, ["#E5F1F2", "#E5F1F2", "#E5F1F2"], true);
  row(slide, "single.row.2", 328, 105, ["#D8E8F3", "#D8E8F3", "#D8E8F3"]);
  line(slide, "single.down", 316, 60, 316, 99, { arrowEnd: true });
  text(slide, "single.formula", "a ∼ pθ(a|s,zₜ)", 342, 157, 142, 26, 14, { italic: true });
  pill(slide, "single.button", "Single-Pass", 343, 197, 132, "#F6FFF1", "#A6D48E", "#4D8138");

  token(slide, "multi.col1.s.0", 537, 19, "#FFF4EC", "s");
  token(slide, "multi.col1.h.0", 579, 19, "#FFFDF4", "", true);
  token(slide, "multi.col1.s.1", 537, 64, "#FFF4EC", "s");
  token(slide, "multi.col1.h.1", 579, 64, "#FFFDF4", "", true);
  token(slide, "multi.col1.s.2", 537, 109, "#FFF4EC", "s");
  token(slide, "multi.col1.h.2", 579, 109, "#F7D9C9");
  line(slide, "multi.down.1", 528, 59, 528, 101, { arrowEnd: true });
  line(slide, "multi.path.1", 623, 102, 648, 60, { arrowEnd: true });

  row(slide, "multi.row.0", 665, 19, ["#F7D9C9", "#E5E7EF"], true);
  row(slide, "multi.row.1", 665, 64, ["#F8D7C1", "#F3DFD2"], true);
  row(slide, "multi.row.2", 665, 109, ["#F8D7C1", "#F8D7C1"]);
  text(slide, "multi.formula", "a ∼ pθ(a|[s;r₁;…;rₙ],zₜⁿ)…pθ(r₁|s,zₜ¹)", 510, 157, 286, 27, 12, {
    italic: true,
  });
  pill(slide, "multi.button", "Multi-Pass", 585, 198, 166, "#F6FFF1", "#A6D48E", "#4D8138");
  text(slide, "diffusion.caption", "Diffusion-of-Thoughts (DoT)", 309, 240, 262, 30, 17, { bold: true, italic: true });
  shape(slide, "legend.text-space", "ellipse", 542, 251, 14, 14, "#E6EEF5", "#999999", 0.8);
  text(slide, "legend.text-space-label", "in text space", 558, 247, 72, 22, 9, { italic: true, color: "#777777" });
  shape(slide, "legend.hidden-space", "ellipse", 622, 251, 14, 14, "#FFFDF4", "#999999", 0.8, true);
  text(slide, "legend.hidden-space-label", "in hidden space", 638, 247, 80, 22, 9, { italic: true, color: "#777777" });
  line(slide, "legend.reasoning", 718, 260, 742, 260, { arrowEnd: true });
  text(slide, "legend.reasoning-label", "Reasoning path", 742, 247, 60, 22, 8, { italic: true, color: "#777777" });

  shape(slide, "panel.self-correction-divider", "line", 806, 0, 0, 239, "none", "#C5C5C5", 1);
  shape(slide, "training.label", "rect", 806, 0, 78, 23, "#F5FFF0", "#B8DDA8", 0.8);
  text(slide, "training.label.text", "Training", 811, 0, 68, 23, 10, { color: "#6F8F62" });
  line(slide, "training.axis-y", 862, 38, 862, 136, { color: "#8CC766", arrowEnd: true });
  text(slide, "training.z0", "z₀", 847, 25, 30, 18, 11, { italic: true });
  text(slide, "training.zT", "zₜ", 847, 135, 30, 18, 11, { italic: true });
  line(slide, "training.expected", 862, 128, 900, 60, { color: "#A6D989", dashed: true, arrowEnd: true });
  line(slide, "training.predicted.1", 862, 128, 876, 99, { color: "#66B044", arrowEnd: true });
  line(slide, "training.predicted.2", 876, 99, 902, 80, { color: "#66B044", arrowEnd: true });
  text(slide, "training.recover", "Learning to recover\nfrom mistakes", 884, 24, 90, 38, 9, { color: "#D87070" });
  text(slide, "training.expected-label", "Expected", 811, 76, 56, 20, 10, { color: "#86BC6A" });
  text(slide, "training.predicted-label", "Predicted", 901, 97, 60, 20, 10, { color: "#4F9436" });
  text(slide, "training.prediction", "ẑₜ", 903, 59, 31, 20, 12, { italic: true });

  shape(slide, "inference.label", "rect", 806, 153, 78, 23, "#F5FFF0", "#B8DDA8", 0.8);
  text(slide, "inference.label.text", "Inference", 811, 153, 68, 23, 10, { color: "#6F8F62" });
  text(slide, "inference.lines", "t=T    2/2=2   2+2=4\n⋮       2/2=1   2+2=4\nt=0    2/2=1   2+1=3", 831, 181, 137, 58, 12, {
    align: "left",
  });
  text(slide, "self.caption", "Self-correction", 820, 244, 150, 27, 14, { bold: true, italic: true });

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- Diffusion of Thought: Chain-of-Thought Reasoning in Diffusion Language Models, NeurIPS 2024, Figure 2: https://proceedings.neurips.cc/paper_files/paper/2024/hash/be30024e7fa2c29cac7a6dafcbb8571f-Abstract-Conference.html\n[/Sources]",
  );
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
