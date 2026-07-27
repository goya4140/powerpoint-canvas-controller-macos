import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.dirname(SCRIPT_DIR);
const BROKER_SCRIPT = path.join(SCRIPT_DIR, "macos-broker-server.mjs");
const BLANK_TEMPLATE = path.join(ROOT_DIR, "assets", "blank-16x9.pptx");
const BROKER_PORT = Number(process.env.PPT_CANVAS_BROKER_PORT || 43127);
const CONTROL_PORT = Number(process.env.PPT_CANVAS_CONTROL_PORT || BROKER_PORT + 1);
const BROKER_URL = `http://127.0.0.1:${CONTROL_PORT}`;

export async function runMacBridge(action, args = {}, { timeoutMs = 120000 } = {}) {
  await ensureBroker();

  if (action === "launch") {
    if (args.file_path) await openPresentation(path.resolve(args.file_path));
    else await activatePowerPoint();
    return await enqueue("status", args, timeoutMs);
  }

  if (action === "new_presentation") {
    if (!(await exists(BLANK_TEMPLATE))) {
      throw new Error(`Blank presentation template is missing: ${BLANK_TEMPLATE}`);
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppt-canvas-macos-"));
    const target = path.join(root, "powerpoint-canvas-untitled.pptx");
    await fs.copyFile(BLANK_TEMPLATE, target);
    await openPresentation(target);
    await waitForClient(20000);
    if ((args.slides || 1) > 1) {
      for (let index = 1; index < args.slides; index += 1) {
        await enqueue("add_slide", {}, timeoutMs);
      }
    }
    return await enqueue("status", {}, timeoutMs);
  }

  if (action === "close_presentation") {
    if (!args.confirm) throw new Error("confirm=true is required to close a presentation.");
    const before = await activePresentationInfo();
    await closeActivePresentation(Boolean(args.save));
    return { closed: true, path: before.path, saved: Boolean(args.save) };
  }

  if (action === "save") {
    if (!args.output_path) {
      await saveActivePresentation();
      return activePresentationInfo();
    }
    const full = await prepareOutput(args.output_path, args.overwrite, ".pptx");
    const file = await enqueue("get_file", { file_type: "compressed" }, timeoutMs);
    await fs.writeFile(full, Buffer.from(file.base64, "base64"));
    return { path: full, saved: true, bytes: (await fs.stat(full)).size };
  }

  if (action === "export_pdf") {
    const full = await prepareOutput(args.output_path, args.overwrite, ".pdf");
    const file = await enqueue("get_file", { file_type: "pdf" }, timeoutMs);
    await fs.writeFile(full, Buffer.from(file.base64, "base64"));
    return { path: full, format: "PDF", bytes: (await fs.stat(full)).size };
  }

  if (action === "export_slide") {
    const format = String(args.format || path.extname(args.output_path).slice(1) || "PNG").toUpperCase();
    if (format !== "PNG") throw new Error("The macOS bridge currently exports slide previews as PNG only.");
    const full = await prepareOutput(args.output_path, args.overwrite, ".png");
    const image = await enqueue("screenshot", {
      slide_index: args.slide_index,
      width_px: args.width_px,
      height_px: args.height_px,
    }, timeoutMs);
    await fs.writeFile(full, Buffer.from(image.base64, "base64"));
    return {
      path: full,
      format: "PNG",
      width_px: image.width_px,
      height_px: image.height_px,
      bytes: (await fs.stat(full)).size,
    };
  }

  const normalizedArgs = { ...args };
  if (action === "add_picture" && args.path) {
    const full = path.resolve(args.path);
    const bytes = await fs.readFile(full);
    const extension = path.extname(full).toLowerCase();
    const mimeType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
      : extension === ".svg" ? "image/svg+xml" : "image/png";
    normalizedArgs.base64 = bytes.toString("base64");
    normalizedArgs.mime_type = mimeType;
    delete normalizedArgs.path;
  }

  return enqueue(action, normalizedArgs, timeoutMs);
}

async function ensureBroker() {
  if (await brokerHealthy()) return;
  const child = spawn(process.execPath, [BROKER_SCRIPT], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PPT_CANVAS_BROKER_PORT: String(BROKER_PORT),
      PPT_CANVAS_CONTROL_PORT: String(CONTROL_PORT),
    },
  });
  child.unref();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await brokerHealthy()) return;
    await delay(100);
  }
  throw new Error(`Could not start the macOS PowerPoint bridge at ${BROKER_URL}.`);
}

async function brokerHealthy() {
  try {
    const response = await fetch(`${BROKER_URL}/health`, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForClient(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BROKER_URL}/health`);
      const health = await response.json();
      if (health.connected_clients > 0) return;
    } catch {}
    await delay(250);
  }
  throw new Error(
    "PowerPoint opened, but the Canvas Bridge task pane is not connected. "
    + "Open Home > Add-ins > PowerPoint Canvas Bridge, then retry.",
  );
}

async function enqueue(action, args, timeoutMs) {
  const response = await fetch(`${BROKER_URL}/api/commands/enqueue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args, timeout_ms: timeoutMs }),
    signal: AbortSignal.timeout(timeoutMs + 2000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `macOS bridge failed with HTTP ${response.status}.`);
  return result.result;
}

async function activatePowerPoint() {
  await runOsascript([
    'tell application "Microsoft PowerPoint"',
    "activate",
    "end tell",
  ]);
}

async function openPresentation(filePath) {
  if (!(await exists(filePath))) throw new Error(`Presentation not found: ${filePath}`);
  await runOsascript([
    'tell application "Microsoft PowerPoint"',
    "activate",
    `open POSIX file ${appleString(filePath)}`,
    "end tell",
  ]);
}

async function activePresentationInfo() {
  const output = await runOsascript([
    'tell application "Microsoft PowerPoint"',
    "if (count of presentations) is 0 then return \"\"",
    "set p to active presentation",
    'return (name of p) & linefeed & (full name of p)',
    "end tell",
  ]);
  const [name = "", fullPath = ""] = output.split(/\r?\n/);
  return { presentation: name || null, path: fullPath || null };
}

async function saveActivePresentation() {
  await runOsascript([
    'tell application "Microsoft PowerPoint"',
    'if (count of presentations) is 0 then error "No active presentation."',
    "save active presentation",
    "end tell",
  ]);
}

async function closeActivePresentation(save) {
  await runOsascript([
    'tell application "Microsoft PowerPoint"',
    'if (count of presentations) is 0 then error "No active presentation."',
    `close active presentation saving ${save ? "yes" : "no"}`,
    "end tell",
  ]);
}

async function runOsascript(lines) {
  return new Promise((resolve, reject) => {
    const args = lines.flatMap((line) => ["-e", line]);
    const child = spawn("/usr/bin/osascript", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `osascript exited with code ${code}.`));
    });
  });
}

async function prepareOutput(outputPath, overwrite, extension) {
  if (!outputPath) throw new Error("output_path is required.");
  const full = path.resolve(outputPath);
  if (path.extname(full).toLowerCase() !== extension) throw new Error(`Output path must end with ${extension}`);
  if (await exists(full)) {
    if (!overwrite) throw new Error(`Output exists; pass overwrite=true: ${full}`);
    await fs.unlink(full);
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  return full;
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function appleString(value) {
  return JSON.stringify(String(value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
