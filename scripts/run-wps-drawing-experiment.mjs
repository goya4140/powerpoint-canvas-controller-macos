#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADDON = path.join(ROOT, "experiments", "wps-drawing-addon");
const OUTPUT_DIR = path.join(ROOT, "test-output", "wps");
const referenceMode = process.argv.includes("--reference");
const OUTPUT = path.join(
  OUTPUT_DIR,
  referenceMode ? "wps-reference-recreation.pptx" : "wps-native-drawing-test.pptx",
);
const TEMPLATE = referenceMode
  ? path.join(ADDON, "assets", "reference-recreation-base.pptx")
  : path.join(ROOT, "assets", "blank-16x9.pptx");
const WPS_APP = "/Applications/wpsoffice.app";
const CALLBACK_PORT = 43129;
const PUBLISH_XML = path.join(
  os.homedir(),
  "Library",
  "Containers",
  "com.kingsoft.wpsoffice.mac",
  "Data",
  ".kingsoft",
  "wps",
  "jsaddons",
  "publish.xml",
);

if (process.platform !== "darwin") throw new Error("The WPS drawing experiment requires macOS.");
await fs.access(WPS_APP);
await fs.access(TEMPLATE);
await fs.access(path.join(ADDON, "node_modules", "wpsjs"));

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.copyFile(TEMPLATE, OUTPUT);

let publishSnapshot = null;
let publishExisted = false;
try {
  publishSnapshot = await fs.readFile(PUBLISH_XML);
  publishExisted = true;
} catch {}

const wpsPidsBefore = await listWpsPids();
let debugProcess;
const messages = [];
const callback = deferred();
const serverReady = deferred();
const callbackServer = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/wps-result") {
    response.writeHead(404);
    response.end();
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const result = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  response.writeHead(200, { "content-type": "application/json", ...corsHeaders(request) });
  response.end('{"ok":true}');
  callback.resolve(result);
});

await new Promise((resolve, reject) => {
  callbackServer.once("error", reject);
  callbackServer.listen(CALLBACK_PORT, "127.0.0.1", resolve);
});

try {
  debugProcess = spawn("npm", ["run", "debug"], {
    cwd: ADDON,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  debugProcess.stdout.setEncoding("utf8");
  debugProcess.stderr.setEncoding("utf8");
  debugProcess.stdout.on("data", (chunk) => {
    messages.push(chunk);
    if (chunk.includes("启动本地web服务")) serverReady.resolve();
  });
  debugProcess.stderr.on("data", (chunk) => messages.push(chunk));

  await Promise.race([
    serverReady.promise,
    delay(12000).then(() => {
      throw new Error(`WPS add-in server did not start.\n${messages.join("").slice(-5000)}`);
    }),
  ]);
  await execFileAsync("/usr/bin/open", ["-n", "-a", WPS_APP, OUTPUT]);

  const result = await Promise.race([
    callback.promise,
    delay(60000).then(() => {
      throw new Error(`WPS add-in did not report within 60 seconds.\n${messages.join("").slice(-5000)}`);
    }),
  ]);
  if (!result.ok) throw new Error(result.error || "WPS add-in reported a drawing failure.");

  await delay(1200);
  const { stdout: slideXml } = await execFileAsync(
    "/usr/bin/unzip",
    ["-p", OUTPUT, "ppt/slides/slide1.xml"],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const requiredNames = referenceMode
    ? [
        "wps_reference_stage1_title",
        "wps_reference_stage2_title",
        "wps_reference_caption_box",
        "wps_reference_reward_box",
        "wps_reference_cot1_reasoning",
        "wps_reference_cot2_reasoning",
        "wps_reference_bottom_logic",
      ]
    : [
        "wps_canvas_test_title",
        "wps_canvas_test_input",
        "wps_canvas_test_api",
        "wps_canvas_test_output",
        "wps_canvas_test_connector_input_api",
        "wps_canvas_test_connector_api_output",
      ];
  const missing = requiredNames.filter((name) => !slideXml.includes(name));
  if (missing.length) throw new Error(`Saved PPTX is missing WPS-created shapes: ${missing.join(", ")}`);

  const stat = await fs.stat(OUTPUT);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    output: OUTPUT,
    bytes: stat.size,
    wps_result: result,
    verified_shape_names: requiredNames,
  }, null, 2)}\n`);
} finally {
  callbackServer.close();
  if (debugProcess?.pid) {
    try { process.kill(-debugProcess.pid, "SIGTERM"); } catch {}
  }
  const wpsPidsAfter = await listWpsPids();
  for (const pid of wpsPidsAfter) {
    if (!wpsPidsBefore.has(pid)) {
      try { process.kill(pid, "SIGTERM"); } catch {}
    }
  }
  if (publishExisted) {
    await fs.mkdir(path.dirname(PUBLISH_XML), { recursive: true });
    await fs.writeFile(PUBLISH_XML, publishSnapshot);
  } else {
    await fs.unlink(PUBLISH_XML).catch(() => {});
  }
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  return origin ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  } : {};
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listWpsPids() {
  try {
    const { stdout } = await execFileAsync("/usr/bin/pgrep", ["-x", "wpsoffice"]);
    return new Set(
      stdout
        .trim()
        .split(/\s+/)
        .map(Number)
        .filter(Number.isInteger),
    );
  } catch {
    return new Set();
  }
}
