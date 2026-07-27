import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMacBridge } from "./macos-bridge.mjs";

export const SUPPORTED_PROTOCOLS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);
export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(SCRIPT_DIR, "powerpoint-bridge.ps1");

export function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

export function toolResult(value, { imageData, mimeType = "image/png", isError = false } = {}) {
  const content = [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }];
  if (imageData) content.push({ type: "image", data: imageData, mimeType });
  return {
    content,
    ...(value && typeof value === "object" ? { structuredContent: value } : {}),
    isError,
  };
}

export function mcpPayload(value, options = {}) {
  return { __mcpPayload: true, value, ...options };
}

export async function runBridge(action, args = {}, { timeoutMs = 120000 } = {}) {
  if (process.platform === "darwin") {
    return runMacBridge(action, args, { timeoutMs });
  }
  if (process.platform !== "win32") {
    throw new Error(`Unsupported platform '${process.platform}'. This plugin currently supports Windows and macOS.`);
  }
  return runWindowsBridge(action, args, { timeoutMs });
}

async function runWindowsBridge(action, args = {}, { timeoutMs = 120000 } = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ppt-canvas-mcp-"));
  const requestPath = path.join(tempRoot, "request.json");
  await fs.writeFile(requestPath, JSON.stringify({ action, args }), "utf8");
  try {
    const { stdout, stderr, code } = await spawnCapture(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", BRIDGE, "-RequestPath", requestPath],
      timeoutMs,
    );
    const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (code !== 0) {
      try {
        const failure = JSON.parse(lines.at(-1));
        throw new Error(failure.error || stderr.trim() || `PowerShell bridge exited with code ${code}.`);
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error(stderr.trim() || stdout.trim() || `PowerShell bridge exited with code ${code}.`);
        throw error;
      }
    }
    if (!lines.length) throw new Error("PowerPoint bridge returned no JSON response.");
    let parsed;
    try { parsed = JSON.parse(lines.at(-1)); }
    catch { throw new Error(`PowerPoint bridge returned invalid JSON: ${lines.at(-1)}`); }
    if (!parsed.ok) throw new Error(parsed.error || "PowerPoint bridge operation failed.");
    return parsed.result;
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

function spawnCapture(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`PowerPoint bridge timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
  });
}

export function serve({ name, version, instructions, tools, handleTool }) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); }
    catch (error) {
      process.stdout.write(`${JSON.stringify(rpcError(null, -32700, "Parse error", error.message))}\n`);
      return;
    }
    try {
      const { id, method, params } = message;
      let response;
      if (method === "initialize") {
        const requested = params?.protocolVersion;
        response = rpcResult(id, {
          protocolVersion: SUPPORTED_PROTOCOLS.has(requested) ? requested : "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name, version },
          instructions,
        });
      } else if (method === "ping") response = rpcResult(id, {});
      else if (method === "tools/list") response = rpcResult(id, { tools });
      else if (method === "tools/call") {
        try {
          const raw = await handleTool(params?.name, params?.arguments || {});
          response = raw?.__mcpPayload
            ? rpcResult(id, toolResult(raw.value, { imageData: raw.imageData, mimeType: raw.mimeType }))
            : rpcResult(id, toolResult(raw));
        }
        catch (error) { response = rpcResult(id, toolResult({ error: error.message, tool: params?.name }, { isError: true })); }
      } else if (method?.startsWith("notifications/")) response = null;
      else response = rpcError(id, -32601, `Method not found: ${method}`);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      process.stdout.write(`${JSON.stringify(rpcError(message.id, -32603, "Internal error", error.message))}\n`);
    }
  });
  process.on("uncaughtException", (error) => process.stderr.write(`[${name}] ${error.stack || error.message}\n`));
  process.on("unhandledRejection", (error) => process.stderr.write(`[${name}] ${error?.stack || error}\n`));
}

export const number = (description, extras = {}) => ({ type: "number", description, ...extras });
export const integer = (description, extras = {}) => ({ type: "integer", description, ...extras });
export const string = (description, extras = {}) => ({ type: "string", description, ...extras });
export const boolean = (description, extras = {}) => ({ type: "boolean", description, ...extras });
