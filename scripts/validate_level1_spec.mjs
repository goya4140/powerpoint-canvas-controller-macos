#!/usr/bin/env node

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NODE_TYPES = new Set(["input", "output", "process", "model", "memory", "decision", "external"]);
const NODE_ROLES = new Set(["neutral", "representation", "proposed", "auxiliary", "output", "risk"]);
const EDGE_TYPES = new Set(["data", "control", "feedback", "update", "optional", "bidirectional"]);
const LAYOUTS = new Set(["pipeline", "swimlane", "hub-spoke", "hierarchy"]);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function detectPrimaryCycle(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges.filter((item) => ["data", "control"].includes(item.type))) {
    if (adjacency.has(edge.from)) adjacency.get(edge.from).push(edge.to);
  }
  const state = new Map();
  function visit(id) {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const next of adjacency.get(id) ?? []) if (visit(next)) return true;
    state.set(id, 2);
    return false;
  }
  return nodes.some((node) => visit(node.id));
}

export function validateSpec(spec) {
  const errors = [];
  const warnings = [];
  if (!spec || typeof spec !== "object") return { errors: ["Spec must be a JSON object."], warnings };
  if (!spec.figure?.title) errors.push("figure.title is required.");
  if (!spec.figure?.message) errors.push("figure.message is required.");
  if (!spec.figure?.audience) errors.push("figure.audience is required.");
  if (!Array.isArray(spec.nodes)) errors.push("nodes must be an array.");
  if (!Array.isArray(spec.edges)) errors.push("edges must be an array.");
  if (!Array.isArray(spec.layout_candidates)) errors.push("layout_candidates must be an array.");
  if (errors.length) return { errors, warnings };

  if (spec.nodes.length < 3 || spec.nodes.length > 12) errors.push(`nodes must contain 3–12 items; found ${spec.nodes.length}.`);
  const ids = new Set();
  for (const [index, node] of spec.nodes.entries()) {
    const prefix = `nodes[${index}]`;
    if (!ID_PATTERN.test(node.id ?? "")) errors.push(`${prefix}.id must be lowercase hyphen-case.`);
    if (ids.has(node.id)) errors.push(`${prefix}.id duplicates ${node.id}.`);
    ids.add(node.id);
    if (!node.label) errors.push(`${prefix}.label is required.`);
    if ((node.label ?? "").length > 42) errors.push(`${prefix}.label exceeds 42 characters.`);
    if ((node.detail ?? "").length > 64) errors.push(`${prefix}.detail exceeds 64 characters.`);
    if (!NODE_TYPES.has(node.type)) errors.push(`${prefix}.type is invalid: ${node.type}.`);
    if (!NODE_ROLES.has(node.role)) errors.push(`${prefix}.role is invalid: ${node.role}.`);
    if (node.asset_slot && !ID_PATTERN.test(node.asset_slot)) errors.push(`${prefix}.asset_slot must be semantic hyphen-case.`);
    if (node.level !== undefined && (!Number.isInteger(node.level) || node.level < 0 || node.level > 4)) errors.push(`${prefix}.level must be an integer from 0 to 4.`);
  }

  const edgeIds = new Set();
  for (const [index, edge] of spec.edges.entries()) {
    const prefix = `edges[${index}]`;
    if (!ID_PATTERN.test(edge.id ?? "")) errors.push(`${prefix}.id must be lowercase hyphen-case.`);
    if (edgeIds.has(edge.id)) errors.push(`${prefix}.id duplicates ${edge.id}.`);
    edgeIds.add(edge.id);
    if (!ids.has(edge.from)) errors.push(`${prefix}.from references unknown node ${edge.from}.`);
    if (!ids.has(edge.to)) errors.push(`${prefix}.to references unknown node ${edge.to}.`);
    if (edge.from === edge.to) errors.push(`${prefix} cannot connect a node to itself.`);
    if (!EDGE_TYPES.has(edge.type)) errors.push(`${prefix}.type is invalid: ${edge.type}.`);
    if ((edge.label ?? "").length > 34) warnings.push(`${prefix}.label exceeds 34 characters and may wrap.`);
  }

  const candidates = spec.layout_candidates;
  if (candidates.length < 2 || candidates.length > 3) errors.push(`layout_candidates must contain 2–3 layouts; found ${candidates.length}.`);
  if (new Set(candidates).size !== candidates.length) errors.push("layout_candidates must be unique.");
  for (const layout of candidates) if (!LAYOUTS.has(layout)) errors.push(`Unsupported layout candidate: ${layout}.`);
  if (spec.selected_layout && !candidates.includes(spec.selected_layout)) errors.push("selected_layout must appear in layout_candidates.");
  if (candidates.includes("swimlane")) {
    const missing = spec.nodes.filter((node) => !node.lane).map((node) => node.id);
    if (missing.length) errors.push(`swimlane requires lane on every node: ${missing.join(", ")}.`);
    const lanes = new Set(spec.nodes.map((node) => node.lane).filter(Boolean));
    if (lanes.size > 4) errors.push(`swimlane supports at most four lanes; found ${lanes.size}.`);
  }
  if (candidates.includes("hierarchy")) {
    const missing = spec.nodes.filter((node) => !Number.isInteger(node.level)).map((node) => node.id);
    if (missing.length) errors.push(`hierarchy requires integer level on every node: ${missing.join(", ")}.`);
  }
  if (candidates.includes("hub-spoke") && !ids.has(spec.hub_node)) errors.push("hub-spoke requires hub_node referencing a declared node.");
  if (candidates.includes("pipeline")) {
    if (spec.nodes.length > 8) warnings.push("pipeline with more than eight nodes may be too dense; consider hierarchy or swimlane.");
    const primaryTargets = new Set(spec.edges.filter((edge) => ["data", "control"].includes(edge.type)).map((edge) => edge.to));
    const independentSources = spec.nodes.filter((node) => !primaryTargets.has(node.id));
    if (independentSources.length > 1) warnings.push(`pipeline has ${independentSources.length} independent sources (${independentSources.map((node) => node.id).join(", ")}) and may imply a false sequence.`);
  }

  for (const id of spec.figure?.contribution_nodes ?? []) if (!ids.has(id)) errors.push(`figure.contribution_nodes references unknown node ${id}.`);
  for (const [index, group] of (spec.groups ?? []).entries()) {
    if (!ID_PATTERN.test(group.id ?? "")) errors.push(`groups[${index}].id must be lowercase hyphen-case.`);
    if (!Array.isArray(group.members) || group.members.length < 2) errors.push(`groups[${index}].members must contain at least two node IDs.`);
    for (const member of group.members ?? []) if (!ids.has(member)) errors.push(`groups[${index}] references unknown node ${member}.`);
  }
  if (detectPrimaryCycle(spec.nodes, spec.edges)) errors.push("Primary data/control edges contain a cycle. Mark the return relation as feedback, update, or optional.");
  if (!(spec.figure?.contribution_nodes ?? []).length) warnings.push("No contribution_nodes declared; the figure may lack reviewer-facing emphasis.");

  return { errors, warnings };
}

async function main() {
  const specPath = arg("--spec");
  if (!specPath) {
    console.error("Usage: validate_level1_spec.mjs --spec <json>");
    process.exitCode = 2;
    return;
  }
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const result = validateSpec(spec);
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Valid Level 1 spec: ${spec.nodes.length} nodes, ${spec.edges.length} edges, ${spec.layout_candidates.length} candidates${spec.selected_layout ? `, selected=${spec.selected_layout}` : ", awaiting selection"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
