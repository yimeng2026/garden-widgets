import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGardenClient } from "../src/garden-adapter.mjs";
import { sha256Json } from "../src/contracts.mjs";
import { build } from "./build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.GARDEN_BASE_URL || "http://localhost:7100";
const client = createGardenClient({ baseUrl, token: process.env.GARDEN_AGENT_TOKEN });
const response = await client.listLawPackages();
const payload = {
  schemaVersion: 1,
  packages: response.data,
  perspectives: response.meta.perspectives,
};
const generatedAt = new Date().toISOString();
const snapshot = {
  ...payload,
  snapshot: {
    source: "/api/research/law-packages",
    generatedAt,
    payloadSha256: sha256Json(payload),
    note: "Author-time immutable evidence snapshot; no browser credentials or live update.",
  },
};
const historyName = `law-packages-${generatedAt.replaceAll(":", "").replaceAll(".", "-")}.json`;
const historyDir = path.join(root, "snapshots", "history");
fs.mkdirSync(historyDir, { recursive: true });
fs.writeFileSync(path.join(historyDir, historyName), `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
fs.writeFileSync(path.join(root, "snapshots", "law-packages.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
const result = build({ rootDir: root });
if (!result.ok) throw new Error(result.issues.join("\n"));
console.log(JSON.stringify({ synced: response.data.length, snapshot: `snapshots/history/${historyName}`, built: result.outputs }, null, 2));
