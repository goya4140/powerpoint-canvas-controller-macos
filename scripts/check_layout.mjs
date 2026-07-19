#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const layoutDir = arg("--layout-dir");
if (!layoutDir) {
  console.error("Usage: check_layout.mjs --layout-dir <directory>");
  process.exit(2);
}

const entries = (await fs.readdir(layoutDir)).filter((name) => name.endsWith(".json"));
const issues = [];

for (const entry of entries) {
  const file = path.join(layoutDir, entry);
  const raw = await fs.readFile(file, "utf8");
  const layout = JSON.parse(raw);
  const serialized = JSON.stringify(layout);
  for (const marker of ["overflow", "outOfBounds", "overlapWarning", "clipped"]) {
    if (serialized.includes(`\"${marker}\":true`) || serialized.includes(`\"${marker}\":\"true\"`)) {
      issues.push(`${entry}: ${marker}`);
    }
  }
  const frame = layout.slide?.frame;
  if (!frame) {
    issues.push(`${entry}: missing slide frame`);
    continue;
  }
  for (const element of layout.elements ?? []) {
    if (!Array.isArray(element.bbox) || element.bbox.length !== 4) continue;
    const [left, top, width, height] = element.bbox;
    const tolerance = 1;
    if (left < frame.left - tolerance || top < frame.top - tolerance || left + width > frame.left + frame.width + tolerance || top + height > frame.top + frame.height + tolerance) {
      issues.push(`${entry}: ${element.name ?? element.id ?? "unnamed"} exceeds slide bounds`);
    }
    if (element.name?.startsWith("label.title.") && element.textLayout?.lineCount > 1) {
      issues.push(`${entry}: ${element.name} wraps to ${element.textLayout.lineCount} lines`);
    }
  }
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log(`Checked ${entries.length} layout files; no explicit overflow markers found.`);
