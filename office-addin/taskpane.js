/* global Office, PowerPoint */

const BROKER = "https://localhost:43127";
const clientId = globalThis.crypto?.randomUUID?.() || `ppt-${Date.now()}-${Math.random()}`;
let commandCount = 0;
let stopped = false;

Office.onReady(async (info) => {
  document.getElementById("host").textContent = `${info.host} / ${info.platform}`;
  const supported = ["1.4", "1.5", "1.8"].filter((version) =>
    Office.context.requirements.isSetSupported("PowerPointApi", version));
  document.getElementById("api").textContent = supported.length ? supported.join(", ") : "unsupported";
  if (info.host !== Office.HostType.PowerPoint || !supported.includes("1.4")) {
    setStatus("PowerPointApi 1.4 or newer is required.", "error");
    return;
  }
  try {
    await register(info, supported);
    setStatus("Connected — ready for Codex", "connected");
    poll();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

window.addEventListener("beforeunload", () => { stopped = true; });

async function register(info, supported) {
  const response = await fetch(`${BROKER}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      host: info.host,
      platform: info.platform,
      api_sets: supported,
      office_version: Office.context.diagnostics?.version || null,
    }),
  });
  if (!response.ok) throw new Error("Local Canvas Bridge is not running.");
}

async function poll() {
  while (!stopped) {
    try {
      const response = await fetch(`${BROKER}/api/commands/next?client_id=${encodeURIComponent(clientId)}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (payload.command) await handleCommand(payload.command);
      else await delay(180);
    } catch (error) {
      setStatus(`Bridge disconnected: ${error.message}`, "error");
      await delay(1000);
      try {
        await register({ host: Office.HostType.PowerPoint, platform: Office.context.platform }, []);
        setStatus("Connected — ready for Codex", "connected");
      } catch {}
    }
  }
}

async function handleCommand(command) {
  commandCount += 1;
  document.getElementById("commands").textContent = String(commandCount);
  setStatus(`Running ${command.action}…`);
  try {
    const result = await execute(command.action, command.args || {});
    await postResult({ id: command.id, ok: true, result });
    setStatus("Connected — ready for Codex", "connected");
  } catch (error) {
    await postResult({ id: command.id, ok: false, error: formatError(error) });
    setStatus(`${command.action} failed`, "error");
  }
}

async function postResult(value) {
  await fetch(`${BROKER}/api/commands/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}

async function execute(action, args) {
  if (action === "get_file") return getDocumentFile(args.file_type);
  return PowerPoint.run(async (context) => {
    if (action === "status") return getStatus(context, args);
    if (action === "add_slide") return addSlide(context, args);
    if (action === "add_shape") return addShape(context, args);
    if (action === "add_text") return addText(context, args);
    if (action === "add_line") return addLine(context, args);
    if (action === "add_connector") return addConnector(context, args);
    if (action === "add_picture") return addPicture(context, args);
    if (action === "update_shape") return updateShape(context, args);
    if (action === "delete_shape") return deleteShape(context, args);
    if (action === "group_shapes") return groupShapes(context, args);
    if (action === "clear") return clearSlide(context, args);
    if (action === "batch") return runBatch(context, args);
    if (action === "inspect") return inspect(context, args);
    if (action === "validate") return validate(context, args);
    if (action === "screenshot") return screenshot(context, args);
    throw new Error(`Unsupported macOS action: ${action}`);
  });
}

async function getStatus(context, args) {
  const slide = await getSlide(context, args.slide_index);
  const slides = context.presentation.slides;
  const slideCount = slides.getCount();
  const shapes = slide.shapes;
  const shapeCount = shapes.getCount();
  slide.load("id");
  await context.sync();
  return {
    powerpoint_version: Office.context.diagnostics?.version || null,
    visible: true,
    presentation: Office.context.document.url?.split("/").pop() || "active presentation",
    path: Office.context.document.url || null,
    saved: null,
    slides: slideCount.value,
    slide_index: args.slide_index || 1,
    slide_id: slide.id,
    slide_width: 960,
    slide_height: 540,
    shapes: shapeCount.value,
    control_scope: "PowerPoint JavaScript API through local Office Add-in",
    api_14: Office.context.requirements.isSetSupported("PowerPointApi", "1.4"),
    api_18: Office.context.requirements.isSetSupported("PowerPointApi", "1.8"),
  };
}

async function addSlide(context, args) {
  const slides = context.presentation.slides;
  if (args.index !== undefined && Office.context.requirements.isSetSupported("PowerPointApi", "1.9")) {
    slides.add({ index: Math.max(0, Number(args.index) - 1) });
  } else {
    slides.add();
  }
  await context.sync();
  const count = slides.getCount();
  await context.sync();
  return { slides: count.value, slide_index: args.index || count.value };
}

async function addShape(context, args) {
  const slide = await getSlide(context, args.slide_index);
  const shapeType = shapeTypeMap[args.shape_type || "rounded"] || PowerPoint.GeometricShapeType.roundRectangle;
  const shape = slide.shapes.addGeometricShape(shapeType, shapeOptions(args));
  shape.name = args.name;
  applyBoxStyle(shape, args);
  applyText(shape, args);
  if (args.rotation !== undefined) shape.rotation = Number(args.rotation);
  shape.load("id,name,type,left,top,width,height,rotation");
  await context.sync();
  return shapeInfo(shape, args.text || "");
}

async function addText(context, args) {
  const slide = await getSlide(context, args.slide_index);
  const shape = slide.shapes.addTextBox(String(args.text || ""), shapeOptions(args));
  shape.name = args.name;
  applyBoxStyle(shape, { ...args, fill_visible: args.fill_visible ?? false, line_visible: args.line_visible ?? false });
  applyText(shape, args);
  if (args.rotation !== undefined) shape.rotation = Number(args.rotation);
  shape.load("id,name,type,left,top,width,height,rotation");
  await context.sync();
  return shapeInfo(shape, args.text || "");
}

async function addLine(context, args) {
  const slide = await getSlide(context, args.slide_index);
  const line = slide.shapes.addLine(
    connectorType(args.connector_type),
    {
      left: Number(args.x1),
      top: Number(args.y1),
      width: Number(args.x2) - Number(args.x1),
      height: Number(args.y2) - Number(args.y1),
    },
  );
  line.name = args.name;
  applyLineStyle(line, args);
  const arrowheads = [];
  if (args.start_arrow === "triangle") {
    arrowheads.push(addArrowhead(slide, args, "start"));
  }
  if (args.end_arrow !== "none") {
    arrowheads.push(addArrowhead(slide, args, "end"));
  }
  line.load("id,name,type,left,top,width,height,rotation");
  await context.sync();
  return { ...shapeInfo(line, ""), arrowheads: arrowheads.map((shape) => shape.name) };
}

async function addConnector(context, args) {
  const slide = await getSlide(context, args.slide_index);
  const endpoints = await connectorEndpoints(context, slide, args.source, args.target);
  const result = await addLine(context, { ...args, ...endpoints });
  const connector = slide.shapes.getItem(args.name);
  try {
    connector.tags.add("PPT_CANVAS_SOURCE", args.source);
    connector.tags.add("PPT_CANVAS_TARGET", args.target);
    connector.tags.add("PPT_CANVAS_CONNECTOR", args.connector_type || "straight");
    await context.sync();
  } catch {}
  return { ...result, source: args.source, target: args.target, attached: "managed" };
}

async function addPicture(context, args) {
  const slide = await getSlide(context, args.slide_index);
  if (typeof slide.shapes.addPicture !== "function") {
    throw new Error("This PowerPoint build does not expose ShapeCollection.addPicture yet.");
  }
  const picture = slide.shapes.addPicture(args.base64, {
    left: Number(args.x),
    top: Number(args.y),
    ...(args.width !== undefined ? { width: Number(args.width) } : {}),
    ...(args.height !== undefined ? { height: Number(args.height) } : {}),
  });
  picture.name = args.name;
  if (args.rotation !== undefined) picture.rotation = Number(args.rotation);
  picture.load("id,name,type,left,top,width,height,rotation");
  await context.sync();
  return shapeInfo(picture, "");
}

async function updateShape(context, args) {
  const slide = await getSlide(context, args.slide_index);
  const shape = slide.shapes.getItem(args.name);
  if (args.new_name !== undefined) shape.name = String(args.new_name);
  if (args.x !== undefined) shape.left = Number(args.x);
  if (args.y !== undefined) shape.top = Number(args.y);
  if (args.width !== undefined) shape.width = Number(args.width);
  if (args.height !== undefined) shape.height = Number(args.height);
  if (args.rotation !== undefined) shape.rotation = Number(args.rotation);
  if (args.z_order !== undefined) {
    if (!Office.context.requirements.isSetSupported("PowerPointApi", "1.8")) {
      throw new Error("Changing z-order requires PowerPointApi 1.8.");
    }
    shape.setZOrder(args.z_order === "front"
      ? PowerPoint.ShapeZOrder.bringToFront : PowerPoint.ShapeZOrder.sendToBack);
  }
  applyBoxStyle(shape, args, true);
  applyText(shape, args, true);
  shape.load("id,name,type,left,top,width,height,rotation");
  await context.sync();
  const result = shapeInfo(shape, args.text);
  if (shape.type === PowerPoint.ShapeType.line) {
    await repositionCompanionArrowheads(context, slide, shape);
  }
  await rerouteManagedConnectors(context, slide, args.new_name || args.name);
  return result;
}

async function deleteShape(context, args) {
  const slide = await getSlide(context, args.slide_index);
  slide.shapes.load("items/name");
  await context.sync();
  const names = new Set([args.name, `${args.name}__start_arrow`, `${args.name}__end_arrow`]);
  const targets = slide.shapes.items.filter((shape) => names.has(shape.name));
  if (!targets.some((shape) => shape.name === args.name)) {
    throw new Error(`Shape not found: ${args.name}`);
  }
  targets.forEach((shape) => shape.delete());
  await context.sync();
  const count = slide.shapes.getCount();
  await context.sync();
  return { deleted: args.name, shapes: count.value };
}

async function groupShapes(context, args) {
  if (!Office.context.requirements.isSetSupported("PowerPointApi", "1.8")) {
    throw new Error("Grouping shapes requires PowerPointApi 1.8.");
  }
  const slide = await getSlide(context, args.slide_index);
  const members = args.names.map((name) => slide.shapes.getItem(name));
  const group = slide.shapes.addGroup(members);
  group.name = args.name;
  group.load("id,name,type,left,top,width,height,rotation");
  await context.sync();
  return shapeInfo(group, "");
}

async function clearSlide(context, args) {
  if (!args.confirm) throw new Error("confirm=true is required to clear a slide.");
  const slide = await getSlide(context, args.slide_index);
  slide.shapes.load("items/name");
  await context.sync();
  const removed = slide.shapes.items.length;
  slide.shapes.items.forEach((shape) => shape.delete());
  await context.sync();
  return { removed, slide_index: args.slide_index || 1 };
}

async function runBatch(context, args) {
  const results = [];
  let index = 0;
  for (const operation of args.operations || []) {
    let result;
    if (operation.type === "shape") result = await addShape(context, { ...operation, slide_index: args.slide_index });
    else if (operation.type === "text") result = await addText(context, { ...operation, slide_index: args.slide_index });
    else if (operation.type === "line") result = await addLine(context, { ...operation, slide_index: args.slide_index });
    else if (operation.type === "connector") result = await addConnector(context, { ...operation, slide_index: args.slide_index });
    else if (operation.type === "picture") result = await addPicture(context, { ...operation, slide_index: args.slide_index });
    else if (operation.type === "update") result = await updateShape(context, { ...operation, slide_index: args.slide_index });
    else if (operation.type === "delete") result = await deleteShape(context, { ...operation, slide_index: args.slide_index });
    else if (operation.type === "wait") {
      await delay(Math.max(0, Math.min(10000, Number(operation.ms || 100))));
      result = { waited_ms: Number(operation.ms || 100) };
    } else throw new Error(`Unsupported operation type: ${operation.type}`);
    results.push({ index, type: operation.type, result });
    index += 1;
    if (operation.type !== "wait" && Number(args.step_delay_ms || 0) > 0) {
      await delay(Number(args.step_delay_ms));
    }
  }
  const slide = await getSlide(context, args.slide_index);
  const count = slide.shapes.getCount();
  await context.sync();
  return {
    operations_applied: results.length,
    step_delay_ms: Number(args.step_delay_ms || 0),
    results,
    slide_index: args.slide_index || 1,
    shapes: count.value,
  };
}

async function inspect(context, args) {
  const slide = await getSlide(context, args.slide_index);
  slide.load("id");
  slide.shapes.load("items/id,items/name,items/type,items/left,items/top,items/width,items/height,items/rotation");
  await context.sync();
  const max = Math.max(1, Math.min(5000, Number(args.max_shapes || 500)));
  const selected = slide.shapes.items.slice(0, max);
  const textById = new Map();
  if (args.include_text !== false) {
    for (const shape of selected) {
      if (shape.type === PowerPoint.ShapeType.geometricShape || shape.type === PowerPoint.ShapeType.textBox) {
        shape.textFrame.textRange.load("text");
      }
    }
    await context.sync();
    for (const shape of selected) {
      try { textById.set(shape.id, shape.textFrame.textRange.text || ""); } catch {}
    }
  }
  return {
    presentation: Office.context.document.url || null,
    slide_index: args.slide_index || 1,
    slide_id: slide.id,
    slide_width: 960,
    slide_height: 540,
    total: slide.shapes.items.length,
    truncated: slide.shapes.items.length > max,
    shapes: selected.map((shape) => shapeInfo(shape, textById.get(shape.id) || "")),
  };
}

async function validate(context, args) {
  const inventory = await inspect(context, { ...args, include_text: true, max_shapes: 5000 });
  const issues = [];
  for (const shape of inventory.shapes) {
    if (shape.left < 0 || shape.top < 0
      || shape.left + shape.width > inventory.slide_width
      || shape.top + shape.height > inventory.slide_height) {
      issues.push({
        type: "off_slide",
        shape: shape.name,
        bounds: [shape.left, shape.top, shape.width, shape.height],
      });
    }
  }
  return { ok: issues.length === 0, issues, checked: inventory.total, platform: "macOS Office.js" };
}

async function screenshot(context, args) {
  if (!Office.context.requirements.isSetSupported("PowerPointApi", "1.8")) {
    throw new Error("Slide screenshots require PowerPointApi 1.8.");
  }
  const slide = await getSlide(context, args.slide_index);
  const options = {};
  if (args.width_px) options.width = Number(args.width_px);
  if (args.height_px) options.height = Number(args.height_px);
  const image = slide.getImageAsBase64(options);
  await context.sync();
  const width = Number(args.width_px || 1600);
  return { base64: image.value, width_px: width, height_px: Number(args.height_px || Math.round(width * 9 / 16)) };
}

async function getSlide(context, index) {
  if (index !== undefined) return context.presentation.slides.getItemAt(Math.max(0, Number(index) - 1));
  if (Office.context.requirements.isSetSupported("PowerPointApi", "1.5")) {
    const selected = context.presentation.getSelectedSlides();
    selected.load("items/id");
    await context.sync();
    if (selected.items.length) return selected.items[0];
  }
  return context.presentation.slides.getItemAt(0);
}

async function connectorEndpoints(context, slide, sourceName, targetName) {
  const source = slide.shapes.getItem(sourceName);
  const target = slide.shapes.getItem(targetName);
  source.load("left,top,width,height");
  target.load("left,top,width,height");
  await context.sync();
  return edgeToEdge(source, target);
}

function edgeToEdge(source, target) {
  const sx = source.left + source.width / 2;
  const sy = source.top + source.height / 2;
  const tx = target.left + target.width / 2;
  const ty = target.top + target.height / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x1: source.left + source.width, y1: sy, x2: target.left, y2: ty }
      : { x1: source.left, y1: sy, x2: target.left + target.width, y2: ty };
  }
  return dy >= 0
    ? { x1: sx, y1: source.top + source.height, x2: tx, y2: target.top }
    : { x1: sx, y1: source.top, x2: tx, y2: target.top + target.height };
}

async function rerouteManagedConnectors(context, slide, changedName) {
  slide.shapes.load("items/id,items/name,items/type");
  await context.sync();
  for (const shape of slide.shapes.items) {
    if (shape.type !== PowerPoint.ShapeType.line) continue;
    try {
      const sourceTag = shape.tags.getItemOrNullObject("PPT_CANVAS_SOURCE");
      const targetTag = shape.tags.getItemOrNullObject("PPT_CANVAS_TARGET");
      sourceTag.load("isNullObject,value");
      targetTag.load("isNullObject,value");
      await context.sync();
      if (sourceTag.isNullObject || targetTag.isNullObject) continue;
      if (sourceTag.value !== changedName && targetTag.value !== changedName) continue;
      const endpoints = await connectorEndpoints(context, slide, sourceTag.value, targetTag.value);
      shape.left = endpoints.x1;
      shape.top = endpoints.y1;
      shape.width = endpoints.x2 - endpoints.x1;
      shape.height = endpoints.y2 - endpoints.y1;
      await context.sync();
      await repositionCompanionArrowheads(context, slide, shape, endpoints);
    } catch {}
  }
}

async function repositionCompanionArrowheads(context, slide, line, endpoints) {
  if (!endpoints) {
    endpoints = {
      x1: line.left,
      y1: line.top,
      x2: line.left + line.width,
      y2: line.top + line.height,
    };
  }
  slide.shapes.load("items/name");
  await context.sync();
  const start = slide.shapes.items.find((shape) => shape.name === `${line.name}__start_arrow`);
  const end = slide.shapes.items.find((shape) => shape.name === `${line.name}__end_arrow`);
  if (start) positionArrowhead(start, endpoints, "start", 12);
  if (end) positionArrowhead(end, endpoints, "end", 12);
  if (start || end) await context.sync();
}

function addArrowhead(slide, args, side) {
  const weight = Number(args.width || 1.8);
  const size = Math.max(8, Math.min(24, 8 + weight * 2.5));
  const arrowhead = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.triangle, {
    left: 0,
    top: 0,
    width: size,
    height: size,
  });
  arrowhead.name = `${args.name}__${side}_arrow`;
  arrowhead.fill.setSolidColor(normalizeColor(args.color || "#17345B"));
  arrowhead.lineFormat.visible = false;
  positionArrowhead(arrowhead, args, side, size);
  return arrowhead;
}

function positionArrowhead(shape, endpoints, side, size) {
  const x1 = Number(endpoints.x1);
  const y1 = Number(endpoints.y1);
  const x2 = Number(endpoints.x2);
  const y2 = Number(endpoints.y2);
  const isStart = side === "start";
  const x = isStart ? x1 : x2;
  const y = isStart ? y1 : y2;
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  shape.left = x - size / 2;
  shape.top = y - size / 2;
  shape.width = size;
  shape.height = size;
  shape.rotation = angle + (isStart ? 270 : 90);
}

function applyBoxStyle(shape, args, partial = false) {
  if (args.fill_visible === false) shape.fill.clear();
  else if (!partial || args.fill_color !== undefined || args.fill_visible === true) {
    shape.fill.setSolidColor(normalizeColor(args.fill_color || "#EEF4FC"));
  }
  if (args.fill_transparency !== undefined) shape.fill.transparency = Number(args.fill_transparency);
  if (args.line_visible === false) shape.lineFormat.visible = false;
  else if (!partial || args.line_color !== undefined || args.line_visible === true) {
    shape.lineFormat.visible = true;
    shape.lineFormat.color = normalizeColor(args.line_color || "#17345B");
  }
  if (args.line_width !== undefined) shape.lineFormat.weight = Number(args.line_width);
  if (args.dashed !== undefined) shape.lineFormat.dashStyle = args.dashed
    ? PowerPoint.ShapeLineDashStyle.dash : PowerPoint.ShapeLineDashStyle.solid;
}

function applyLineStyle(shape, args) {
  shape.lineFormat.visible = true;
  shape.lineFormat.color = normalizeColor(args.color || "#17345B");
  shape.lineFormat.weight = Number(args.width || 1.8);
  shape.lineFormat.dashStyle = args.dashed
    ? PowerPoint.ShapeLineDashStyle.dash : PowerPoint.ShapeLineDashStyle.solid;
}

function applyText(shape, args, partial = false) {
  if (args.text !== undefined) shape.textFrame.textRange.text = String(args.text);
  if (!partial || args.font_name !== undefined) shape.textFrame.textRange.font.name = args.font_name || "Aptos";
  if (!partial || args.font_size !== undefined) shape.textFrame.textRange.font.size = Number(args.font_size || 18);
  if (!partial || args.font_color !== undefined) shape.textFrame.textRange.font.color = normalizeColor(args.font_color || "#0B0B0B");
  if (args.bold !== undefined || !partial) shape.textFrame.textRange.font.bold = Boolean(args.bold);
  if (args.italic !== undefined || !partial) shape.textFrame.textRange.font.italic = Boolean(args.italic);
  if (args.align !== undefined || !partial) {
    shape.textFrame.textRange.paragraphFormat.horizontalAlignment = horizontalAlignment(args.align || "center");
  }
  if (args.vertical_align !== undefined || !partial) {
    shape.textFrame.verticalAlignment = verticalAlignment(args.vertical_align || "middle");
  }
  const margin = args.margin;
  if (margin !== undefined) {
    shape.textFrame.marginLeft = Number(margin);
    shape.textFrame.marginRight = Number(margin);
    shape.textFrame.marginTop = Number(margin);
    shape.textFrame.marginBottom = Number(margin);
  }
  if (args.margin_left !== undefined) shape.textFrame.marginLeft = Number(args.margin_left);
  if (args.margin_right !== undefined) shape.textFrame.marginRight = Number(args.margin_right);
  if (args.margin_top !== undefined) shape.textFrame.marginTop = Number(args.margin_top);
  if (args.margin_bottom !== undefined) shape.textFrame.marginBottom = Number(args.margin_bottom);
}

function shapeOptions(args) {
  return {
    left: Number(args.x),
    top: Number(args.y),
    width: Number(args.width),
    height: Number(args.height),
  };
}

function shapeInfo(shape, text) {
  return {
    id: shape.id,
    name: shape.name,
    type: shape.type,
    left: round(shape.left),
    top: round(shape.top),
    width: round(shape.width),
    height: round(shape.height),
    rotation: round(shape.rotation || 0),
    text: text ?? "",
  };
}

function connectorType(value) {
  if (value === "curve") return PowerPoint.ConnectorType.curve;
  if (value === "elbow") return PowerPoint.ConnectorType.elbow;
  return PowerPoint.ConnectorType.straight;
}

function horizontalAlignment(value) {
  if (value === "left") return PowerPoint.ParagraphHorizontalAlignment.left;
  if (value === "right") return PowerPoint.ParagraphHorizontalAlignment.right;
  return PowerPoint.ParagraphHorizontalAlignment.center;
}

function verticalAlignment(value) {
  if (value === "top") return PowerPoint.TextVerticalAlignment.top;
  if (value === "bottom") return PowerPoint.TextVerticalAlignment.bottom;
  return PowerPoint.TextVerticalAlignment.middleCentered;
}

function normalizeColor(value) {
  return String(value || "").replace(/^#/, "#");
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getDocumentFile(fileType) {
  const type = fileType === "pdf" ? Office.FileType.Pdf : Office.FileType.Compressed;
  return new Promise((resolve, reject) => {
    Office.context.document.getFileAsync(type, { sliceSize: 4 * 1024 * 1024 }, (fileResult) => {
      if (fileResult.status !== Office.AsyncResultStatus.Succeeded) {
        reject(new Error(fileResult.error?.message || "Could not read the active presentation."));
        return;
      }
      const file = fileResult.value;
      const chunks = [];
      let index = 0;
      const readNext = () => {
        file.getSliceAsync(index, (sliceResult) => {
          if (sliceResult.status !== Office.AsyncResultStatus.Succeeded) {
            file.closeAsync();
            reject(new Error(sliceResult.error?.message || "Could not read a presentation slice."));
            return;
          }
          chunks.push(new Uint8Array(sliceResult.value.data));
          index += 1;
          if (index < file.sliceCount) {
            readNext();
            return;
          }
          file.closeAsync();
          const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const bytes = new Uint8Array(total);
          let offset = 0;
          chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.length; });
          let binary = "";
          const stride = 0x8000;
          for (let start = 0; start < bytes.length; start += stride) {
            binary += String.fromCharCode(...bytes.subarray(start, start + stride));
          }
          resolve({ base64: btoa(binary), bytes: bytes.length, file_type: fileType });
        });
      };
      readNext();
    });
  });
}

function setStatus(text, className = "") {
  const element = document.getElementById("status");
  element.textContent = text;
  element.className = className;
}

function formatError(error) {
  if (error?.debugInfo) return `${error.message}: ${JSON.stringify(error.debugInfo)}`;
  return error?.stack || error?.message || String(error);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const shapeTypeMap = {
  rectangle: PowerPoint?.GeometricShapeType?.rectangle || "Rectangle",
  rounded: PowerPoint?.GeometricShapeType?.roundRectangle || "RoundRectangle",
  ellipse: PowerPoint?.GeometricShapeType?.ellipse || "Ellipse",
  triangle: PowerPoint?.GeometricShapeType?.triangle || "Triangle",
  diamond: PowerPoint?.GeometricShapeType?.diamond || "Diamond",
  hexagon: PowerPoint?.GeometricShapeType?.hexagon || "Hexagon",
  parallelogram: PowerPoint?.GeometricShapeType?.parallelogram || "Parallelogram",
  cloud: PowerPoint?.GeometricShapeType?.cloud || "Cloud",
};
