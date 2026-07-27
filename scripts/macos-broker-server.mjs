#!/usr/bin/env node

import http from "node:http";
import https from "node:https";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ADDIN_DIR = path.join(path.dirname(SCRIPT_DIR), "office-addin");
const PORT = Number(process.env.PPT_CANVAS_BROKER_PORT || 43127);
const CONTROL_PORT = Number(process.env.PPT_CANVAS_CONTROL_PORT || PORT + 1);
const HOST = "127.0.0.1";
const clients = new Map();
const queue = [];
const pending = new Map();

const handler = async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (request.method === "GET" && url.pathname === "/health") {
      pruneClients();
      return json(response, 200, {
        ok: true,
        platform: process.platform,
        connected_clients: clients.size,
        queued_commands: queue.length,
        pending_commands: pending.size,
      });
    }
    if (request.method === "POST" && url.pathname === "/api/register") {
      const body = await readJson(request);
      const clientId = String(body.client_id || crypto.randomUUID());
      clients.set(clientId, { ...body, client_id: clientId, last_seen: Date.now() });
      return json(response, 200, { ok: true, client_id: clientId });
    }
    if (request.method === "GET" && url.pathname === "/api/commands/next") {
      const clientId = url.searchParams.get("client_id");
      if (!clientId) return json(response, 400, { error: "client_id is required." });
      const existing = clients.get(clientId) || { client_id: clientId };
      clients.set(clientId, { ...existing, last_seen: Date.now() });
      const index = queue.findIndex((item) => !item.client_id || item.client_id === clientId);
      if (index < 0) return json(response, 200, { command: null });
      const [command] = queue.splice(index, 1);
      command.client_id = clientId;
      return json(response, 200, { command });
    }
    if (request.method === "POST" && url.pathname === "/api/commands/result") {
      const body = await readJson(request, 220 * 1024 * 1024);
      const waiter = pending.get(body.id);
      if (!waiter) return json(response, 404, { error: `Unknown command id: ${body.id}` });
      pending.delete(body.id);
      clearTimeout(waiter.timer);
      if (body.ok) waiter.resolve(body.result);
      else waiter.reject(new Error(body.error || "PowerPoint add-in command failed."));
      return json(response, 200, { ok: true });
    }
    if (request.method === "POST" && url.pathname === "/api/commands/enqueue") {
      pruneClients();
      if (clients.size === 0) {
        return json(response, 409, {
          error: "No PowerPoint Canvas Bridge task pane is connected. Open the add-in in PowerPoint and retry.",
        });
      }
      if (clients.size > 1) {
        return json(response, 409, {
          error: "More than one PowerPoint Canvas Bridge task pane is connected. Keep only the target presentation's pane open and retry.",
        });
      }
      const body = await readJson(request, 220 * 1024 * 1024);
      const id = crypto.randomUUID();
      const timeoutMs = Math.max(1000, Math.min(Number(body.timeout_ms || 120000), 600000));
      const resultPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          const queuedIndex = queue.findIndex((command) => command.id === id);
          if (queuedIndex >= 0) queue.splice(queuedIndex, 1);
          reject(new Error(`PowerPoint command '${body.action}' timed out after ${timeoutMs} ms.`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
      });
      queue.push({ id, action: body.action, args: body.args || {}, created_at: Date.now() });
      try {
        const result = await resultPromise;
        return json(response, 200, { ok: true, result });
      } catch (error) {
        return json(response, 500, { error: error.message });
      }
    }

    if (request.method === "GET") return serveStatic(url.pathname, response);
    return json(response, 404, { error: "Not found." });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
};

const certDir = path.join(os.homedir(), ".office-addin-dev-certs");
const [key, cert, ca] = await Promise.all([
  fs.readFile(path.join(certDir, "localhost.key")),
  fs.readFile(path.join(certDir, "localhost.crt")),
  fs.readFile(path.join(certDir, "ca.crt")),
]);

https.createServer({ key, cert, ca }, handler).listen(PORT, HOST, () => {
  process.stderr.write(`[powerpoint-macos-broker] add-in endpoint https://localhost:${PORT}\n`);
});

http.createServer(handler).listen(CONTROL_PORT, HOST, () => {
  process.stderr.write(`[powerpoint-macos-broker] MCP control endpoint http://${HOST}:${CONTROL_PORT}\n`);
});

async function serveStatic(pathname, response) {
  const relative = pathname === "/" ? "taskpane.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(ADDIN_DIR, relative);
  if (!filePath.startsWith(`${path.resolve(ADDIN_DIR)}${path.sep}`)) {
    return json(response, 403, { error: "Forbidden." });
  }
  let bytes;
  try { bytes = await fs.readFile(filePath); }
  catch { return json(response, 404, { error: "Not found." }); }
  const contentType = filePath.endsWith(".html") ? "text/html; charset=utf-8"
    : filePath.endsWith(".js") ? "text/javascript; charset=utf-8"
      : filePath.endsWith(".css") ? "text/css; charset=utf-8"
        : filePath.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
  response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
  response.end(bytes);
}

function pruneClients() {
  const cutoff = Date.now() - 15000;
  for (const [id, client] of clients) {
    if (client.last_seen < cutoff) clients.delete(id);
  }
}

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request, limit = 4 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error(`Request body exceeds ${limit} bytes.`);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
