import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertStaticWidgetHtml,
  narrativeFromComplexitySnapshot,
  narrativeFromLawSnapshot,
  renderResearchWidget,
} from "../src/research-renderer.mjs";

const law = JSON.parse(fs.readFileSync(new URL("../snapshots/law-packages.json", import.meta.url), "utf8"));
const complexity = JSON.parse(fs.readFileSync(new URL("../snapshots/complexity.json", import.meta.url), "utf8"));

test("law and complexity narratives render all cases without external dependencies", () => {
  const lawHtml = renderResearchWidget(narrativeFromLawSnapshot(law));
  const complexityHtml = renderResearchWidget(narrativeFromComplexitySnapshot(complexity));
  for (const html of [lawHtml, complexityHtml]) assert.deepEqual(assertStaticWidgetHtml(html), []);
  assert.ok(lawHtml.includes("CA2-PAIR-DIRECTION-001"));
  assert.ok(lawHtml.includes("有限支持"));
  assert.ok(complexityHtml.includes("诺顿与形式化"));
  assert.ok(complexityHtml.includes("待独立复核"));
});

test("payload and initial text cannot inject a closing script tag", () => {
  const narrative = narrativeFromComplexitySnapshot(complexity);
  narrative.cases[0].title = '</script><script>alert(1)</script>';
  const html = renderResearchWidget(narrative);
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes("&lt;/script&gt;"));
});

test("static policy rejects credentials and browser network access", () => {
  assert.ok(assertStaticWidgetHtml('<!doctype html><script>fetch("/api")</script>').length > 0);
  assert.ok(assertStaticWidgetHtml('<!doctype html><p>safe</p>', ["secret-token-value"]).length === 0);
  assert.ok(assertStaticWidgetHtml('<!doctype html><p>secret-token-value</p>', ["secret-token-value"]).length > 0);
});
