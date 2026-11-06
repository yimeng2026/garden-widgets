import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.METHOD_LINEAGE_SOURCE
  ? path.resolve(process.env.METHOD_LINEAGE_SOURCE)
  : path.resolve(root, "../.worktrees/provider-main-integration/data/method-lineage/ca-six-2026.json");
const graph = JSON.parse(fs.readFileSync(source, "utf8"));
if (typeof graph.requestId !== "string" || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.methodFingerprints) || !Array.isArray(graph.comparisons) || !graph.summary) {
  throw new Error("Invalid method-lineage graph");
}
function scan(value) {
  if (Array.isArray(value)) return value.forEach(scan);
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/api_?key|secret|cookie|authorization/i.test(key)) throw new Error(`Sensitive field rejected: ${key}`);
      scan(child);
    }
  }
}
scan(graph);
const canonical = JSON.stringify(graph, null, 2) + "\n";
const sha256 = crypto.createHash("sha256").update(canonical).digest("hex");
const date = graph.generatedAt.slice(0, 10);
const history = `snapshots/history/method-lineage-${date}-${sha256.slice(0, 12)}.json`;
const historyPath = path.join(root, history);
fs.mkdirSync(path.dirname(historyPath), { recursive: true });
if (!fs.existsSync(historyPath)) fs.writeFileSync(historyPath, canonical);
const snapshot = {
  schemaVersion: 1,
  snapshotType: "method_lineage",
  authoringMode: "static_snapshot",
  syncedAt: new Date().toISOString(),
  graph,
  snapshotIntegrity: {
    algorithm: "sha256",
    sha256,
    source: "garden-api:method-lineage/ca-six-2026",
    history,
    note: "哈希由未加封装的真实血缘图计算；不覆盖历史，不表示实时同步。",
  },
};
fs.writeFileSync(path.join(root, "snapshots", "method-lineage-ca-six.json"), JSON.stringify(snapshot, null, 2) + "\n");
console.log(JSON.stringify({ snapshot: "snapshots/method-lineage-ca-six.json", history, sha256, documents: graph.summary.documentCount, completeFingerprints: graph.summary.fingerprintCompleteCount, independentWetExperiments: graph.summary.independentWetExperimentCount }, null, 2));
