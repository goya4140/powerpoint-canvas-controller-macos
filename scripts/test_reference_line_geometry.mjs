#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  completeAdjacentEdges,
  validateLayeredNetwork,
} from "./lib/reference_line_geometry.mjs";

const node = (x, y) => ({ x, y, fill: "#111111" });
const layers = [
  [node(0, 0), node(10, 0)],
  [node(0, 10), node(10, 10), node(20, 10)],
  [node(0, 20), node(10, 20)],
];

const complete = completeAdjacentEdges(layers);
assert.equal(complete.length, 12, "complete adjacent topology should contain 2×3 + 3×2 edges");

const sparse = completeAdjacentEdges(layers, { omit: [[1, 2, 1]] });
assert.equal(sparse.length, 11, "an omitted reference edge must not be regenerated");
assert.equal(
  sparse.some((edge) => edge.from[0] === 1 && edge.from[1] === 2 && edge.to[1] === 1),
  false,
  "the explicit omission must survive topology expansion",
);

assert.equal(
  validateLayeredNetwork({ name: "valid", layers, omit: [[1, 2, 1]] }).length,
  11,
  "validated topology should preserve the explicit edge set",
);

assert.throws(
  () => validateLayeredNetwork({
    name: "invalid",
    layers,
    edges: [{ from: [0, 0], to: [2, 0] }],
  }),
  /adjacent layers/,
  "non-adjacent inferred edges must be rejected",
);

console.log("Reference line geometry tests passed.");
