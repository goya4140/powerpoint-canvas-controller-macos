#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureCertificatesAreInstalled } from "office-addin-dev-certs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = path.join(root, "office-addin", "manifest.xml");
const destinationDir = path.join(
  os.homedir(),
  "Library",
  "Containers",
  "com.microsoft.Powerpoint",
  "Data",
  "Documents",
  "wef",
);
const destination = path.join(destinationDir, "powerpoint-canvas-bridge.xml");
const broker = path.join(root, "scripts", "macos-broker-server.mjs");

if (process.platform !== "darwin") {
  throw new Error("setup-macos.mjs must be run on macOS.");
}

await ensureCertificatesAreInstalled();
await fs.mkdir(destinationDir, { recursive: true });
await fs.copyFile(manifest, destination);

if (!(await brokerHealthy())) {
  const child = spawn(process.execPath, [broker], { detached: true, stdio: "ignore" });
  child.unref();
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  manifest: destination,
  broker: "https://localhost:43127",
  next: "Restart PowerPoint, open a presentation, then choose Home > Add-ins > PowerPoint Canvas Bridge.",
}, null, 2)}\n`);

async function brokerHealthy() {
  try {
    const response = await fetch("http://127.0.0.1:43128/health", { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}
