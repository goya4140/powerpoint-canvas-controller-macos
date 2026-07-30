#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ELEMENT_TYPES = new Set(["shape", "text", "line", "connector", "stack", "tokens", "network"]);
const SHAPE_TYPES = new Set([
  "rect", "roundRect", "ellipse", "diamond", "triangle", "rtTriangle",
  "trapezoid", "parallelogram", "hexagon", "pentagon", "chevron", "can",
]);
const CONNECTOR_SIDES = new Set(["top", "right", "bottom", "left"]);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function checkBox(box, label, canvas, errors) {
  if (!box || !["x", "y", "w", "h"].every((key) => isFiniteNumber(box[key]))) {
    errors.push(`${label} requires numeric x, y, w, h.`);
    return;
  }
  if (box.w <= 0 || box.h <= 0) errors.push(`${label} requires positive w and h.`);
  const tolerance = 0.5;
  if (box.x < -tolerance || box.y < -tolerance || box.x + box.w > canvas.width + tolerance || box.y + box.h > canvas.height + tolerance) {
    errors.push(`${label} exceeds the ${canvas.width}×${canvas.height} canvas.`);
  }
}

function checkPointLine(element, label, canvas, errors) {
  if (![element.x1, element.y1, element.x2, element.y2].every(isFiniteNumber)) {
    errors.push(`${label} requires numeric x1, y1, x2, y2.`);
    return;
  }
  for (const [axis, value, max] of [
    ["x1", element.x1, canvas.width], ["x2", element.x2, canvas.width],
    ["y1", element.y1, canvas.height], ["y2", element.y2, canvas.height],
  ]) {
    if (value < 0 || value > max) errors.push(`${label}.${axis} lies outside the canvas.`);
  }
}

export function validateScene(scene, sourceFile = "<scene>") {
  const errors = [];
  const warnings = [];
  if (!scene || typeof scene !== "object") return { errors: [`${sourceFile}: scene must be an object.`], warnings };

  for (const field of ["id", "venue", "year", "paper_title", "figure", "paper_url", "reference"]) {
    if (scene[field] === undefined || scene[field] === "") errors.push(`${sourceFile}: ${field} is required.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scene.id ?? "")) errors.push(`${sourceFile}: id must be lowercase hyphen-case.`);
  if (!Number.isInteger(scene.year) || scene.year < 2000 || scene.year > 2100) errors.push(`${sourceFile}: year must be a four-digit integer.`);
  if (!scene.canvas || !isFiniteNumber(scene.canvas.width) || !isFiniteNumber(scene.canvas.height)) {
    errors.push(`${sourceFile}: canvas.width and canvas.height are required.`);
  }
  const canvas = scene.canvas ?? { width: 1200, height: 600 };
  if (canvas.width < 400 || canvas.height < 240) warnings.push(`${sourceFile}: canvas is unusually small for an editable paper figure.`);
  if (!Array.isArray(scene.elements) || !scene.elements.length) errors.push(`${sourceFile}: elements must be a non-empty array.`);

  const names = new Set();
  const connectable = new Set();
  for (const [index, element] of (scene.elements ?? []).entries()) {
    const label = `${sourceFile}: elements[${index}]`;
    if (!ELEMENT_TYPES.has(element.type)) errors.push(`${label}.type is unsupported: ${element.type}.`);
    if (!element.name || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(element.name)) errors.push(`${label}.name must be a stable lowercase identifier.`);
    if (names.has(element.name)) errors.push(`${label}.name duplicates ${element.name}.`);
    names.add(element.name);

    if (["shape", "text", "stack", "tokens", "network"].includes(element.type)) checkBox(element, label, canvas, errors);
    if (element.type === "shape") {
      if (!SHAPE_TYPES.has(element.geometry ?? "rect")) errors.push(`${label}.geometry is unsupported: ${element.geometry}.`);
      connectable.add(element.name);
    }
    if (element.type === "line") checkPointLine(element, label, canvas, errors);
    if (element.type === "connector") {
      if (!element.from || !element.to) errors.push(`${label} requires from and to.`);
      if (element.fromSide && !CONNECTOR_SIDES.has(element.fromSide)) errors.push(`${label}.fromSide is invalid.`);
      if (element.toSide && !CONNECTOR_SIDES.has(element.toSide)) errors.push(`${label}.toSide is invalid.`);
    }
    if (element.type === "stack") {
      if (!Number.isInteger(element.count) || element.count < 2 || element.count > 20) errors.push(`${label}.count must be 2–20.`);
    }
    if (element.type === "tokens") {
      if (!Number.isInteger(element.rows) || element.rows < 1 || element.rows > 20) errors.push(`${label}.rows must be 1–20.`);
      if (!Number.isInteger(element.cols) || element.cols < 1 || element.cols > 30) errors.push(`${label}.cols must be 1–30.`);
    }
    if (element.type === "network") {
      if (!Array.isArray(element.nodes) || element.nodes.length < 2) errors.push(`${label}.nodes must contain at least two nodes.`);
      if (!Array.isArray(element.edges)) errors.push(`${label}.edges must be an array.`);
    }
  }

  for (const [index, element] of (scene.elements ?? []).entries()) {
    if (element.type !== "connector") continue;
    if (!connectable.has(element.from)) errors.push(`${sourceFile}: elements[${index}].from references non-shape ${element.from}.`);
    if (!connectable.has(element.to)) errors.push(`${sourceFile}: elements[${index}].to references non-shape ${element.to}.`);
  }

  const crop = scene.reference_crop ?? { left: 0, top: 0, right: 0, bottom: 0 };
  for (const edge of ["left", "top", "right", "bottom"]) {
    if (!isFiniteNumber(crop[edge] ?? 0) || (crop[edge] ?? 0) < 0 || (crop[edge] ?? 0) >= 0.9) errors.push(`${sourceFile}: reference_crop.${edge} must be in [0, 0.9).`);
  }
  if ((crop.left ?? 0) + (crop.right ?? 0) >= 0.95 || (crop.top ?? 0) + (crop.bottom ?? 0) >= 0.95) {
    errors.push(`${sourceFile}: reference_crop removes the full image.`);
  }
  if ((scene.elements ?? []).length < 8) warnings.push(`${sourceFile}: fewer than eight elements may underfit the reference.`);

  return { errors, warnings };
}

export async function loadManifest(manifestPath) {
  const absoluteManifest = path.resolve(manifestPath);
  const manifest = JSON.parse(await fs.readFile(absoluteManifest, "utf8"));
  if (!Array.isArray(manifest.cases) || manifest.cases.length < 1) throw new Error("Manifest requires cases[].");
  const root = path.dirname(absoluteManifest);
  const scenes = [];
  const ids = new Set();
  for (const relative of manifest.cases) {
    const file = path.resolve(root, relative);
    const scene = JSON.parse(await fs.readFile(file, "utf8"));
    const result = validateScene(scene, relative);
    for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    if (ids.has(scene.id)) throw new Error(`Duplicate scene id: ${scene.id}`);
    ids.add(scene.id);
    scenes.push({ ...scene, __file: file });
  }
  return { ...manifest, scenes, __file: absoluteManifest };
}

async function main() {
  const manifestPath = arg("--manifest");
  if (!manifestPath) {
    console.error("Usage: validate_reference_scene.mjs --manifest <manifest.json>");
    process.exitCode = 2;
    return;
  }
  const manifest = await loadManifest(manifestPath);
  console.log(`Valid reference-recreation manifest: ${manifest.scenes.length} cases.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
