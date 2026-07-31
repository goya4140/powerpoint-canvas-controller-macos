const DEFAULT_LINE = "#111111";

function requireFinite(label, value) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite, received ${value}`);
  }
}

function addPresetShape(slide, config) {
  return slide.shapes.add(config);
}

export function addReferenceSegment(slide, name, from, to, options = {}) {
  for (const [label, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })) {
    requireFinite(`${name}.${label}`, value);
  }
  if (from.x === to.x && from.y === to.y) {
    throw new RangeError(`${name} has zero length`);
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const centerX = (from.x + to.x) / 2;
  const centerY = (from.y + to.y) / 2;
  const item = addPresetShape(slide, {
    geometry: "line",
    name,
    position: {
      left: centerX - length / 2,
      top: centerY,
      width: length,
      height: 0,
    },
    fill: "none",
    line: {
      style: options.dashed ? "dashed" : "solid",
      fill: options.color ?? DEFAULT_LINE,
      width: options.width ?? 1.2,
    },
  });
  // A horizontal primitive rotated around its center is stable in both the
  // Artifact Tool renderer and exported OOXML. Bounding-box flips are not:
  // negative-slope lines can silently become positive-slope lines on export.
  item.rotation = Math.atan2(dy, dx) * 180 / Math.PI;
  return item;
}

export function addReferenceArrow(slide, name, from, to, options = {}) {
  const color = options.color ?? DEFAULT_LINE;
  const lineWidth = options.width ?? 1.8;
  const headLength = options.headLength ?? Math.max(10, lineWidth * 2.6);
  const headWidth = options.headWidth ?? Math.max(10, lineWidth * 2.6);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!length) {
    throw new RangeError(`${name} has zero length`);
  }
  const ux = dx / length;
  const uy = dy / length;
  const shaftEnd = {
    x: to.x - ux * headLength * 0.46,
    y: to.y - uy * headLength * 0.46,
  };
  const shaft = addReferenceSegment(slide, `${name}.shaft`, from, shaftEnd, {
    color,
    width: lineWidth,
    dashed: options.dashed,
  });
  const head = addPresetShape(slide, {
    geometry: "triangle",
    name: `${name}.head`,
    position: {
      left: to.x - headWidth / 2,
      top: to.y - headLength / 2,
      width: headWidth,
      height: headLength,
    },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
  head.rotation = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  return { shaft, head };
}

export function completeAdjacentEdges(layers, options = {}) {
  const omitted = new Set((options.omit ?? []).map(([layer, from, to]) => `${layer}:${from}:${to}`));
  const edges = [];
  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    for (let fromIndex = 0; fromIndex < layers[layerIndex].length; fromIndex += 1) {
      for (let toIndex = 0; toIndex < layers[layerIndex + 1].length; toIndex += 1) {
        if (!omitted.has(`${layerIndex}:${fromIndex}:${toIndex}`)) {
          edges.push({ from: [layerIndex, fromIndex], to: [layerIndex + 1, toIndex] });
        }
      }
    }
  }
  return edges;
}

export function validateLayeredNetwork(spec) {
  if (!spec?.name) throw new TypeError("network.name is required");
  if (!Array.isArray(spec.layers) || spec.layers.length < 2) {
    throw new TypeError(`${spec.name}.layers must contain at least two layers`);
  }
  spec.layers.forEach((layer, layerIndex) => {
    if (!Array.isArray(layer) || !layer.length) {
      throw new TypeError(`${spec.name}.layers[${layerIndex}] must contain nodes`);
    }
    layer.forEach((node, nodeIndex) => {
      requireFinite(`${spec.name}.layers[${layerIndex}][${nodeIndex}].x`, node.x);
      requireFinite(`${spec.name}.layers[${layerIndex}][${nodeIndex}].y`, node.y);
      if (!node.fill) throw new TypeError(`${spec.name}.layers[${layerIndex}][${nodeIndex}].fill is required`);
    });
  });
  const edges = spec.edges ?? completeAdjacentEdges(spec.layers, spec);
  edges.forEach((edge, edgeIndex) => {
    const [fromLayer, fromNode] = edge.from ?? [];
    const [toLayer, toNode] = edge.to ?? [];
    if (!spec.layers[fromLayer]?.[fromNode] || !spec.layers[toLayer]?.[toNode]) {
      throw new RangeError(`${spec.name}.edges[${edgeIndex}] references a missing node`);
    }
    if (toLayer !== fromLayer + 1) {
      throw new RangeError(`${spec.name}.edges[${edgeIndex}] must connect adjacent layers`);
    }
  });
  return edges;
}

export function addLayeredNetwork(slide, spec) {
  const edges = validateLayeredNetwork(spec);
  const diameter = spec.nodeDiameter ?? 12;
  edges.forEach((edge, edgeIndex) => {
    const from = spec.layers[edge.from[0]][edge.from[1]];
    const to = spec.layers[edge.to[0]][edge.to[1]];
    const color = edge.color
      ?? (typeof spec.edgeColor === "function" ? spec.edgeColor(from, to, edge) : spec.edgeColor)
      ?? DEFAULT_LINE;
    addReferenceSegment(slide, `${spec.name}.edge.${edgeIndex}`, from, to, {
      color,
      width: edge.width ?? spec.edgeWidth ?? 1.4,
    });
  });
  spec.layers.forEach((layer, layerIndex) => {
    layer.forEach((node, nodeIndex) => {
      const nodeDiameter = node.diameter ?? diameter;
      addPresetShape(slide, {
        geometry: "ellipse",
        name: `${spec.name}.node.${layerIndex}.${nodeIndex}`,
        position: {
          left: node.x - nodeDiameter / 2,
          top: node.y - nodeDiameter / 2,
          width: nodeDiameter,
          height: nodeDiameter,
        },
        fill: node.fill,
        line: { style: "solid", fill: "none", width: 0 },
      });
    });
  });
  return { edgeCount: edges.length, nodeCount: spec.layers.reduce((sum, layer) => sum + layer.length, 0) };
}
