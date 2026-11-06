import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { build } from "../scripts/build.mjs";
import { assertStaticWidgetHtml } from "../src/research-renderer.mjs";

test("method lineage widget uses the real six-document snapshot and static security contract", () => {
  const result = build({ write: true });
  assert.equal(result.ok, true, result.issues?.join("\n"));
  assert.ok(result.manifest.some((item) => item.entry === "widgets/method-lineage/index.html"));
  const html = fs.readFileSync("widgets/method-lineage/index.html", "utf8");
  assert.deepEqual(assertStaticWidgetHtml(html, [process.env.GARDEN_AGENT_TOKEN || ""]), []);
  assert.ok(html.includes('data-document-count="6"'));
  assert.ok(html.includes('data-context-excluded="2"'));
  assert.ok(html.includes('data-comparison-count="15"'));
  assert.ok(html.includes('data-complete-fingerprints="0"'));
  assert.ok(html.includes("外部上下文"));
  assert.ok(html.includes("完整方法指纹"));
  assert.ok(html.includes("DERIVED_FROM"));
  assert.ok(!/fetch\s*\(|WebSocket|EventSource/.test(html));
  const snapshot = JSON.parse(fs.readFileSync("snapshots/method-lineage-ca-six.json", "utf8"));
  assert.equal(snapshot.graph.summary.documentCount, 6);
  assert.equal(snapshot.graph.summary.externalContextExcluded, 2);
  assert.equal(snapshot.graph.summary.comparisonCounts.insufficient, 15);
  assert.equal(snapshot.graph.summary.independentWetExperimentCount, 0);
  assert.match(snapshot.snapshotIntegrity.sha256, /^[a-f0-9]{64}$/);
});
