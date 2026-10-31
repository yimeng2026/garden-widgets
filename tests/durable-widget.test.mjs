import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { durableWidgetHub, exportDurableWidget } from "../scripts/export-durable-widget.mjs";
import { assertStaticWidgetHtml } from "../src/research-renderer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "widgets/manifest.json"), "utf8"));

test("durable research hub links all ten components without remote dependencies", () => {
  const html = durableWidgetHub(manifest);
  assert.equal((html.match(/<article class="hub-card">/g) || []).length, 10);
  assert.ok(html.includes("论文为未同行评议研究简报"));
  assert.ok(!html.includes("height:100vh"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});

test("durable export contains every component, snapshot and all thirteen figures", () => {
  const temporaryRoot = path.join(root, ".tmp");
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const target = fs.mkdtempSync(path.join(temporaryRoot, "durable-widget-"));
  try {
    const result = exportDurableWidget({ targetDir: target });
    assert.equal(result.ok, true);
    assert.equal(result.widgets, 10);
    for (const widget of manifest.widgets) {
      assert.ok(fs.existsSync(path.join(target, widget.entry)));
      assert.ok(fs.existsSync(path.join(target, widget.snapshot)));
    }
    const figures = fs.readdirSync(path.join(target, "assets/papers"), { recursive: true }).filter((name) => name.endsWith(".png"));
    assert.equal(figures.length, 13);
    assert.equal(fs.readFileSync(path.join(target, "index.html"), "utf8"), result.html);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
