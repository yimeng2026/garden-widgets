import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  activityExplorer,
  generationBudgetExplorer,
  paperExplorer,
  projectExplorer,
  renderContentExplorer,
  structureExplorer,
  validationExplorer,
} from "../src/content-explorers.mjs";
import { assertStaticWidgetHtml } from "../src/research-renderer.mjs";
import { syncFrontierContent } from "../scripts/sync-frontier-content.mjs";

function snapshot(name) {
  return JSON.parse(fs.readFileSync(new URL(`../snapshots/${name}`, import.meta.url), "utf8"));
}

const papers = snapshot("paper-collection.json");
const stability = snapshot("ca-document-stability.json");
const selectivity = snapshot("ca-selectivity.json");
const structure = snapshot("structural-control.json");
const projects = snapshot("projects.json");
const validations = snapshot("validation-records.json");

test("author-time frontier sync covers all papers, figures, projects and validations", () => {
  const result = syncFrontierContent({ write: false });
  assert.equal(result.ok, true);
  assert.equal(result.papers, 3);
  assert.equal(result.figures, 13);
  assert.equal(result.projects, 88);
  assert.equal(result.validations, 21);
  assert.equal(new Set(projects.projects.map((item) => item.id)).size, 88);
  for (const record of validations.records) assert.match(record.sha256, /^[a-f0-9]{64}$/);
});

test("paper explorer retains complete sections and all thirteen local figures", () => {
  const explorer = paperExplorer(papers);
  const html = renderContentExplorer(explorer);
  assert.equal(explorer.data.papers.length, 3);
  assert.equal(explorer.data.papers.flatMap((paper) => paper.figures).length, 13);
  const renderedFigures = explorer.data.papers.flatMap((paper) => paper.sections).reduce((count, section) => count + (section.html.match(/class="paper-image"/g) || []).length, 0);
  assert.equal(renderedFigures, 13);
  assert.ok(explorer.data.papers.every((paper) => paper.sections.length > 20));
  assert.ok(html.includes("不同构建的结构对照"));
  assert.ok(html.includes("轻量可复现科研引擎的协作方法"));
  assert.ok(html.includes("研究简报／预印本草案，未同行评议"));
  assert.ok(explorer.data.papers.every((paper) => paper.title && paper.sections.every((section) => section.html && !section.html.includes("undefined"))));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});

test("paper renderer escapes raw HTML and rejects unregistered image paths", () => {
  const unsafe = structuredClone(papers);
  unsafe.papers[0].markdown = "# 安全测试\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[不安全链接](javascript:alert(3))";
  const html = renderContentExplorer(paperExplorer(unsafe));
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes("<img src=x onerror=alert(2)>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(2)&gt;"));
  const badImage = structuredClone(papers);
  badImage.papers[0].markdown = "# 图片路径测试\n\n![secret](../../secret.png)";
  assert.throws(() => paperExplorer(badImage), /Unregistered or unsafe image path/);
});

test("activity explorer preserves all within-document ratios without a pooled estimate", () => {
  for (const pair of stability.pairs) {
    assert.ok(Math.abs(pair.ki_ratio - pair.ca_i_ki_nM / pair.ca_ii_ki_nM) < 1e-10);
  }
  const html = renderContentExplorer(activityExplorer(stability, selectivity));
  assert.ok(html.includes("20.833333333333332"));
  assert.ok(html.includes('"ki_ratio":75'));
  assert.ok(html.includes("method_incomplete"));
  assert.ok(html.includes("CO2 hydrase assay method"));
  assert.ok(html.includes("不执行跨文献合并估计"));
  assert.ok(!html.includes("51.785714285714285"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});

test("structure explorer retains three construct differences and metadata discrepancy", () => {
  const html = renderContentExplorer(structureExplorer(structure));
  assert.equal(structure.exact_wildtype_replication, false);
  assert.equal(structure.alignment_difference_event_count, 3);
  assert.deepEqual(structure.sequence_differences.map((item) => item.type), ["terminal_deletion", "substitution", "insertion"]);
  assert.equal(structure.sequence_string_length, 260);
  assert.equal(structure.metadata_sample_sequence_length, 259);
  assert.equal(structure.excluded_candidates.length, 3);
  assert.ok(html.includes("不是独立野生型重复"));
  assert.ok(html.includes("10.1021/bi971296x"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});

test("project explorer includes every project with cooperation and local boundaries", () => {
  const explorer = projectExplorer(projects);
  const html = renderContentExplorer(explorer);
  assert.equal(explorer.data.projects.length, 88);
  for (const project of projects.projects) {
    assert.ok(project.collaboration.length > 0);
    assert.ok(project.notes.length > 0);
    assert.ok(html.includes(project.id));
  }
  assert.equal(projects.projects.filter((project) => project.localStatus === "verified").length, 4);
  assert.ok(html.includes("不声称穷尽全球所有项目"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});

test("validation explorer distinguishes executed checks from upstream snapshots", () => {
  const explorer = validationExplorer(validations);
  const html = renderContentExplorer(explorer);
  assert.equal(explorer.data.records.length, 21);
  assert.ok(explorer.data.records.some((record) => record.evidenceKind === "upstream"));
  assert.ok(explorer.data.records.some((record) => record.evidenceKind === "executed" && record.script === "analyze_structural_control.py"));
  assert.ok(explorer.data.records.every((record) => !record.fields.some(([key]) => key === "python")));
  assert.ok(html.includes("原始上游快照"));
  assert.ok(html.includes("浏览器未执行该脚本"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});

test("generation budget describes an aggregate cap rather than a single-response promise", () => {
  const explorer = generationBudgetExplorer();
  const html = renderContentExplorer(explorer);
  assert.equal(explorer.data.maxTotalOutputBudget, 100000000);
  assert.equal(explorer.data.defaultSegmentMaxTokens, 12288);
  assert.ok(html.includes("不是模型单次返回承诺"));
  assert.ok(html.includes("不调用模型"));
  assert.ok(html.includes("data/manuscript-checkpoints/"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});
