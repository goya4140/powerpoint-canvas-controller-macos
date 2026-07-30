#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 977;
const H = 639;
const OUT = path.resolve("docs/strict-recreation/iclr-usf-fig4/editable.pptx");

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
    alignment: options.align ?? "center",
    verticalAlignment: "middle",
  };
}

function circle(slide, name, x, y, diameter, fill, label = "", labelColor = "#FFFFFF") {
  const item = shape(slide, name, "ellipse", x, y, diameter, diameter, fill, "#554629", 1);
  if (label) {
    item.text = label;
    item.text.style = {
      fontFamily: "Arial",
      fontSize: Math.max(8, diameter * 0.42),
      bold: true,
      color: labelColor,
      alignment: "center",
      verticalAlignment: "middle",
    };
  }
}

function arrow(slide, name, x1, y1, x2, y2) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const item = shape(
    slide,
    name,
    "chevron",
    (x1 + x2) / 2 - length / 2,
    (y1 + y2) / 2 - 14,
    length,
    28,
    "#FFFFFF",
    "#7B786B",
    3.5,
  );
  item.rotation = angle;
}

async function main() {
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  text(slide, "dataset.title", "Dataset of Evaluated schedules", 343, 27, 299, 32, 18, { bold: true });
  shape(slide, "dataset.frame", "roundRect", 418, 65, 148, 154, "none", "#5A5A5A", 1, true);
  const rows = [
    { y: 77, s: "S₁", f: "F₁" },
    { y: 134, s: "S₂", f: "F₂" },
  ];
  for (const [index, row] of rows.entries()) {
    shape(slide, `dataset.row.${index}`, "roundRect", 430, row.y, 124, 49, "#FFFFFF", "#52727A", 1, true);
    circle(slide, `dataset.schedule.${index}`, 440, row.y + 11, 26, "#A98B3B");
    text(slide, `dataset.schedule-label.${index}`, row.s, 440, row.y + 11, 26, 26, 8, {
      bold: true,
      color: "#FFFFFF",
    });
    text(slide, `dataset.score.${index}`, "Score:", 470, row.y + 7, 69, 34, 14, { bold: true, align: "left" });
    text(slide, `dataset.value.${index}`, row.f, 529, row.y + 7, 25, 34, 14, {
      bold: true,
      color: "#E31B23",
    });
  }
  text(slide, "dataset.more", "……", 464, 181, 58, 25, 18, { color: "#294E93" });

  shape(slide, "sampled.frame", "ellipse", 178, 238, 179, 179, "none", "#555555", 1, true);
  const sampled = [
    [244, 272], [279, 250], [209, 312], [267, 312], [279, 359], [236, 374],
  ];
  sampled.forEach(([x, y], index) => circle(slide, `sampled.node.${index}`, x, y, 25, "#9C7D48"));
  text(slide, "sampled.label", "Sampled Schedules", 174, 413, 190, 33, 18, { bold: true });

  shape(slide, "search.frame", "ellipse", 411, 438, 178, 178, "none", "#555555", 1, true);
  const searchNodes = [
    [442, 468, "#D8D8D8"], [476, 472, "#9C7D48"], [510, 451, "#9C7D48"],
    [537, 482, "#D8D8D8"], [442, 512, "#9C7D48"], [479, 543, "#D8D8D8"],
    [511, 515, "#9C7D48"], [537, 535, "#D8D8D8"], [468, 575, "#9C7D48"],
    [511, 559, "#9C7D48"], [435, 547, "#D8D8D8"],
  ];
  searchNodes.forEach(([x, y, fill], index) => circle(slide, `search.node.${index}`, x, y, 25, fill));
  const searchEdges = [
    [489, 484, 522, 464], [489, 484, 454, 524], [454, 524, 523, 571],
    [523, 571, 481, 587], [454, 524, 524, 527],
  ];
  for (const [index, [x1, y1, x2, y2]] of searchEdges.entries()) {
    const edge = shape(slide, `search.edge.${index}`, "line", Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), "none", "#C2A65A", 1);
    edge.flipHorizontal = x2 < x1;
    edge.flipVertical = y2 < y1;
  }
  text(slide, "search.label", "Search Space", 426, 612, 150, 27, 18, { bold: true });

  const predictor = shape(slide, "predictor", "trapezoid", 628, 251, 223, 176, "#7FC0D3");
  predictor.rotation = 270;
  text(slide, "predictor.label", "Predictor", 658, 299, 161, 78, 30, { bold: true });

  const orange = "#E78336";
  text(slide, "step.1", "1. Sample a subset of\nschedules through\nevolutionary search", 130, 476, 220, 78, 18, {
    color: orange,
  });
  text(slide, "step.2", "2. Evaluate the true\nperformance of sampled\nschedules", 138, 129, 224, 78, 18, {
    color: orange,
  });
  text(slide, "step.3", "3. Train the predictor\nwith all evaluated\nschedules", 650, 128, 225, 78, 18, {
    color: orange,
  });
  text(slide, "step.4", "4. Use the trained\npredictor to guide the\nevolutionary search", 650, 469, 237, 78, 18, {
    color: orange,
  });

  arrow(slide, "arrow.sample-search", 390, 525, 315, 449);
  arrow(slide, "arrow.sample-dataset", 320, 232, 389, 151);
  arrow(slide, "arrow.dataset-predictor", 596, 148, 679, 229);
  arrow(slide, "arrow.predictor-search", 679, 444, 604, 526);

  circle(slide, "legend.schedule", 154, 618, 25, "#9C7D48");
  text(slide, "legend.label", "Solver Schedules", 184, 608, 170, 31, 16, { bold: true, align: "left" });

  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- A Unified Sampling Framework for Solver Searching of Diffusion Probabilistic Models, ICLR 2024, Figure 4: https://openreview.net/forum?id=W2d3LZbhhI\n[/Sources]",
  );
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const deck = await PresentationFile.exportPptx(presentation);
  await deck.save(OUT);
  console.log(`Created ${OUT}`);
}

await main();
