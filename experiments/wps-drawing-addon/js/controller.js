/* global Application, fetch */

const RESULT_ENDPOINT = "http://127.0.0.1:43129/wps-result";
const SHAPE_PREFIX = "wps_canvas_test_";
let automaticAttempt = 0;
let automaticFinished = false;

function OnAddinLoad(ribbonUI) {
  globalThis.wpsCanvasRibbon = ribbonUI;
  setTimeout(runAutomaticExperiment, 1200);
  return true;
}

function DrawWpsCanvasTest() {
  return drawCanvas(true);
}

function DrawWpsReferenceDiagram() {
  return globalThis.drawWpsReferenceDiagram(true);
}

async function runAutomaticExperiment() {
  if (automaticFinished) return;
  automaticAttempt += 1;
  try {
    const presentationName = Application.ActivePresentation?.Name;
    const result = presentationName === "wps-reference-recreation.pptx"
      ? globalThis.drawWpsReferenceDiagram(false)
      : drawCanvas(false);
    automaticFinished = true;
    await report({ ok: true, attempt: automaticAttempt, ...result });
  } catch (error) {
    if (automaticAttempt < 20) {
      setTimeout(runAutomaticExperiment, 750);
      return;
    }
    automaticFinished = true;
    await report({
      ok: false,
      attempt: automaticAttempt,
      error: error?.stack || error?.message || String(error),
    });
  }
}

function drawCanvas(allowAnyPresentation) {
  const presentations = Application.Presentations;
  if (!presentations || presentations.Count < 1) {
    throw new Error("WPS 演示中没有打开的文稿。");
  }

  const presentation = Application.ActivePresentation;
  if (!presentation || presentation.Slides.Count < 1) {
    throw new Error("当前 WPS 文稿没有可绘制的幻灯片。");
  }
  if (!allowAnyPresentation && presentation.Name !== "wps-native-drawing-test.pptx") {
    throw new Error(`等待隔离测试文稿，当前为：${presentation.Name}`);
  }

  const slide = presentation.Slides.Item(1);
  const shapes = slide.Shapes;
  removePreviousRun(shapes);

  const navy = rgb(23, 52, 91);
  const teal = rgb(35, 147, 141);
  const orange = rgb(211, 82, 48);
  const paleBlue = rgb(238, 244, 252);
  const paleTeal = rgb(235, 248, 246);
  const paleOrange = rgb(253, 241, 236);
  const white = rgb(255, 255, 255);
  const muted = rgb(79, 98, 120);

  const connector1 = shapes.AddConnector(c("msoConnectorStraight", 1), 290, 270, 380, 270);
  connector1.Name = `${SHAPE_PREFIX}connector_input_api`;
  styleConnector(connector1, navy);

  const connector2 = shapes.AddConnector(c("msoConnectorStraight", 1), 580, 270, 670, 270);
  connector2.Name = `${SHAPE_PREFIX}connector_api_output`;
  styleConnector(connector2, navy);

  const title = shapes.AddTextbox(c("msoTextOrientationHorizontal", 1), 56, 40, 848, 52);
  title.Name = `${SHAPE_PREFIX}title`;
  styleTextBox(title, "WPS 原生绘图验证", 34, navy, true, c("ppAlignLeft", 1));

  const subtitle = shapes.AddTextbox(c("msoTextOrientationHorizontal", 1), 56, 98, 848, 30);
  subtitle.Name = `${SHAPE_PREFIX}subtitle`;
  styleTextBox(
    subtitle,
    "形状、文本与箭头均由 WPS JS API 创建，并保留为可编辑对象",
    17,
    muted,
    false,
    c("ppAlignLeft", 1),
  );

  const input = addNode(shapes, `${SHAPE_PREFIX}input`, 90, 220, 200, 100, paleBlue, navy, "输入", "结构化任务");
  const api = addNode(shapes, `${SHAPE_PREFIX}api`, 380, 220, 200, 100, paleTeal, teal, "WPS JS API", "原生对象模型");
  const output = addNode(shapes, `${SHAPE_PREFIX}output`, 670, 220, 200, 100, paleOrange, orange, "可编辑 PPTX", "形状 · 文本 · 连线");

  try {
    connector1.ConnectorFormat.BeginConnect(input, 4);
    connector1.ConnectorFormat.EndConnect(api, 2);
    connector2.ConnectorFormat.BeginConnect(api, 4);
    connector2.ConnectorFormat.EndConnect(output, 2);
    connector1.RerouteConnections();
    connector2.RerouteConnections();
  } catch {}

  const footer = shapes.AddShape(c("msoShapeRoundedRectangle", 5), 268, 390, 424, 54);
  footer.Name = `${SHAPE_PREFIX}footer`;
  footer.Fill.Solid();
  footer.Fill.ForeColor.RGB = navy;
  footer.Line.Visible = c("msoFalse", 0);
  setShapeText(footer, "WPS macOS 路径：验证成功后即可接入 MCP broker", 18, white, true);

  presentation.Save();

  return {
    presentation: presentation.Name,
    slide_index: 1,
    shape_count: shapes.Count,
    created: [
      connector1.Name,
      connector2.Name,
      title.Name,
      subtitle.Name,
      input.Name,
      api.Name,
      output.Name,
      footer.Name,
    ],
  };
}

function removePreviousRun(shapes) {
  for (let index = shapes.Count; index >= 1; index -= 1) {
    const shape = shapes.Item(index);
    if (String(shape.Name || "").startsWith(SHAPE_PREFIX)) shape.Delete();
  }
}

function addNode(shapes, name, left, top, width, height, fillColor, lineColor, heading, detail) {
  const shape = shapes.AddShape(c("msoShapeRoundedRectangle", 5), left, top, width, height);
  shape.Name = name;
  shape.Fill.Solid();
  shape.Fill.ForeColor.RGB = fillColor;
  shape.Line.Visible = c("msoTrue", -1);
  shape.Line.ForeColor.RGB = lineColor;
  shape.Line.Weight = 2.2;
  setShapeText(shape, `${heading}\r${detail}`, 19, lineColor, true);
  return shape;
}

function styleConnector(shape, color) {
  shape.Line.Visible = c("msoTrue", -1);
  shape.Line.ForeColor.RGB = color;
  shape.Line.Weight = 2.5;
  shape.Line.EndArrowheadStyle = c("msoArrowheadTriangle", 3);
}

function styleTextBox(shape, text, size, color, bold, alignment) {
  shape.Fill.Visible = c("msoFalse", 0);
  shape.Line.Visible = c("msoFalse", 0);
  setShapeText(shape, text, size, color, bold, alignment);
}

function setShapeText(shape, text, size, color, bold, alignment = c("ppAlignCenter", 2)) {
  const frame = shape.TextFrame;
  frame.MarginLeft = 8;
  frame.MarginRight = 8;
  frame.MarginTop = 5;
  frame.MarginBottom = 5;
  frame.VerticalAnchor = c("msoAnchorMiddle", 3);
  const range = frame.TextRange;
  range.Text = text;
  range.Font.Name = "Aptos";
  range.Font.Size = size;
  range.Font.Bold = bold ? c("msoTrue", -1) : c("msoFalse", 0);
  range.Font.Color.RGB = color;
  range.ParagraphFormat.Alignment = alignment;
}

function c(name, fallback) {
  return typeof globalThis[name] === "number" ? globalThis[name] : fallback;
}

function rgb(red, green, blue) {
  if (typeof globalThis.RGB === "function") return globalThis.RGB(red, green, blue);
  return red + green * 256 + blue * 65536;
}

async function report(value) {
  try {
    await fetch(RESULT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch {}
}

globalThis.OnAddinLoad = OnAddinLoad;
globalThis.DrawWpsCanvasTest = DrawWpsCanvasTest;
globalThis.DrawWpsReferenceDiagram = DrawWpsReferenceDiagram;
