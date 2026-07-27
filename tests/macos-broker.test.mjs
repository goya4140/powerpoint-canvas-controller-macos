import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BROKER = path.join(ROOT, "scripts", "macos-broker-server.mjs");
const HTTPS_PORT = 45000 + (process.pid % 1000) * 2;
const HTTP_PORT = HTTPS_PORT + 1;
const BASE = `http://127.0.0.1:${HTTP_PORT}`;

let child;

test.before(async () => {
  child = spawn(process.execPath, [BROKER], {
    cwd: ROOT,
    env: {
      ...process.env,
      PPT_CANVAS_BROKER_PORT: String(HTTPS_PORT),
      PPT_CANVAS_CONTROL_PORT: String(HTTP_PORT),
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Broker did not become healthy.\n${stderr}`);
});

test.after(() => {
  child?.kill("SIGTERM");
});

test("serves task-pane assets and rejects commands without a client", async () => {
  const page = await fetch(`${BASE}/taskpane.html`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PowerPoint Canvas Bridge/);

  const response = await fetch(`${BASE}/api/commands/enqueue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "status", args: {} }),
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /No PowerPoint Canvas Bridge task pane/);
});

test("round-trips an MCP command through a simulated PowerPoint task pane", async () => {
  const registration = await fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: "test-client", host: "PowerPoint" }),
  });
  assert.equal(registration.status, 200);

  const resultPromise = fetch(`${BASE}/api/commands/enqueue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "status", args: { slide_index: 1 }, timeout_ms: 5000 }),
  });

  let command;
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && !command) {
    const response = await fetch(`${BASE}/api/commands/next?client_id=test-client`);
    command = (await response.json()).command;
    if (!command) await new Promise((resolve) => setTimeout(resolve, 25));
  }

  assert.equal(command.action, "status");
  assert.deepEqual(command.args, { slide_index: 1 });

  const posted = await fetch(`${BASE}/api/commands/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: command.id,
      ok: true,
      result: { presentation: "integration.pptx", slides: 1, shapes: 0 },
    }),
  });
  assert.equal(posted.status, 200);

  const response = await resultPromise;
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result, {
    presentation: "integration.pptx",
    slides: 1,
    shapes: 0,
  });
});
