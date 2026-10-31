import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
import { escapeHtml } from "../src/contracts.mjs";
import {
  assertStaticWidgetHtml,
  narrativeFromComplexitySnapshot,
  narrativeFromFrontierSnapshot,
  narrativeFromLawSnapshot,
  renderResearchWidget,
} from "../src/research-renderer.mjs";
import {
  activityExplorer,
  generationBudgetExplorer,
  paperExplorer,
  projectExplorer,
  referenceExplorer,
  renderContentExplorer,
  structureExplorer,
  validationExplorer,
} from "../src/content-explorers.mjs";

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function gallery(manifest) {
  const cards = manifest.map((item) => `<article class="widget-card"><div class="widget-status">${escapeHtml(item.status)}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><p class="widget-meta">${escapeHtml(item.snapshot)}</p><p><a href="${escapeHtml(item.entry)}">打开组件</a> · <a href="${escapeHtml(item.snapshot)}">查看快照</a></p></article>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>花园组件库</title><style>
  body{font-family:var(--kimi-font-sans,sans-serif);margin:0;color:var(--kimi-color-text-primary,CanvasText)}main{max-width:1200px;margin:0 auto;padding:32px 16px}h1{font-size:28px;font-weight:500}h2{font-size:19px;font-weight:500}.intro{color:var(--kimi-color-text-secondary,#666);line-height:1.7}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:24px}.widget-card{border:1px solid var(--kimi-color-border,#ddd);border-radius:12px;padding:20px}.widget-status{font-size:12px;color:var(--kimi-color-text-secondary,#666)}.widget-meta{font-family:var(--kimi-font-mono,monospace);font-size:12px;color:var(--kimi-color-text-tertiary,#888);overflow-wrap:anywhere}a{color:inherit}a:focus-visible{outline:2px solid currentColor;outline-offset:4px}.contract{margin-top:24px;padding-top:16px;border-top:1px solid var(--kimi-color-border,#ddd);font-size:14px;line-height:1.7}</style></head><body><main><h1>花园组件库</h1><p class="intro">${manifest.length} 个独立组件，覆盖规律、复杂性、跨域证据、论文图件、活性比较、结构序列、全球项目、验证重放与长文规划。花园保持无前端；这里只负责展示、适配和复核。</p><section class="gallery">${cards}</section><section class="contract">接口：作者时同步真实研究证据与项目快照，服务端令牌只用于同步。静态 HTML 不含令牌、不执行外部脚本、不实时请求花园。<br>文档：<a href="docs/GARDEN_INTERFACE.md">花园接口与新增组件指南</a> · <a href="docs/CONTENT_COVERAGE.md">仓库内容覆盖图</a></section></main></body></html>`;
}

export function build({ rootDir = DEFAULT_ROOT, write = true } = {}) {
  const law = readJson(rootDir, "snapshots/law-packages.json");
  const complexity = readJson(rootDir, "snapshots/complexity.json");
  const frontier = readJson(rootDir, "snapshots/frontier-evidence.json");
  const definitions = [
    {
      id: "law-lab",
      narrative: narrativeFromLawSnapshot(law),
      status: "四类规律包",
      description: "CA2 留出验证、材料对象、反演反例与主动判别协议。",
      snapshot: "snapshots/law-packages.json",
    },
    {
      id: "complexity-lab",
      narrative: narrativeFromComplexitySnapshot(complexity),
      status: "控制 · 形式化 · 复杂性",
      description: "智能体控制论、诺顿穹顶、2025 数学突破与公开理论框架审查。",
      snapshot: "snapshots/complexity.json",
    },
    {
      id: "frontier-evidence",
      narrative: narrativeFromFrontierSnapshot(frontier),
      status: "六项跨域复核",
      description: "数学、化学、材料和生物的上游复用、独立重算与跨库桥接。",
      snapshot: "snapshots/frontier-evidence.json",
    },
    {
      id: "paper-library",
      explorer: paperExplorer(readJson(rootDir, "snapshots/paper-collection.json")),
      status: "3 篇完整论文 · 13 幅图",
      description: "全文分章、篇内检索、原始图件放大与未同行评议边界。",
      snapshot: "snapshots/paper-collection.json",
    },
    {
      id: "ca-activity",
      explorer: activityExplorer(readJson(rootDir, "snapshots/ca-document-stability.json"), readJson(rootDir, "snapshots/ca-selectivity.json"), readJson(rootDir, "snapshots/ca-document-methods.json")),
      status: "6 组配对 · 方法敏感",
      description: "表观 Ki 比值、方法筛选、重复标记和 CA IX 单列边界。",
      snapshot: "snapshots/ca-document-stability.json",
    },
    {
      id: "structure-control",
      explorer: structureExplorer(readJson(rootDir, "snapshots/structural-control.json")),
      status: "3 类差异 · 长度待核",
      description: "3HS4 与 2H4N 的构建差异、完整对齐区间和排除候选。",
      snapshot: "snapshots/structural-control.json",
    },
    {
      id: "project-atlas",
      explorer: projectExplorer(readJson(rootDir, "snapshots/projects.json")),
      status: "88 个项目 · 协作优先",
      description: "按领域、采用层级、本地状态与关键词检索全球公开项目。",
      snapshot: "snapshots/projects.json",
    },
    {
      id: "validation-workbench",
      explorer: validationExplorer(readJson(rootDir, "snapshots/validation-records.json")),
      status: "真实快照 · 重放路径",
      description: "区分已执行复核与上游原始快照，关联脚本、边界和哈希。",
      snapshot: "snapshots/validation-records.json",
    },
    {
      id: "generation-budget",
      explorer: generationBudgetExplorer(),
      status: "最高 1 亿累计 token",
      description: "计算分段、重试和尾段预算；只读规划，不调用模型。",
      snapshot: "docs/CONTENT_COVERAGE.md",
    },
    {
      id: "reference-audit",
      explorer: referenceExplorer(readJson(rootDir, "snapshots/reference-audit.json")),
      status: "39 条书目 · 分层核验",
      description: "逐条显示原始书目、DOI／目录、软件版本、数据库快照与正文关联。",
      snapshot: "snapshots/reference-audit.json",
    },
  ];
  const outputs = new Map();
  const issues = [];
  const manifest = [];
  for (const definition of definitions) {
    if (definition.narrative) {
      const ids = definition.narrative.cases.map((item) => item.id);
      if (new Set(ids).size !== ids.length) issues.push(`${definition.id}: duplicate case id`);
    }
    const html = definition.explorer ? renderContentExplorer(definition.explorer) : renderResearchWidget(definition.narrative);
    issues.push(...assertStaticWidgetHtml(html, [process.env.GARDEN_AGENT_TOKEN || ""]).map((issue) => `${definition.id}: ${issue}`));
    outputs.set(`widgets/${definition.id}/index.html`, html);
    manifest.push({
      title: definition.explorer?.title || definition.narrative.title,
      status: definition.status,
      description: definition.description,
      entry: `widgets/${definition.id}/index.html`,
      snapshot: definition.snapshot,
    });
  }
  outputs.set("index.html", gallery(manifest));
  outputs.set("widgets/manifest.json", `${JSON.stringify({ schemaVersion: 1, widgets: manifest }, null, 2)}\n`);
  if (issues.length) return { ok: false, issues, outputs: [] };
  if (write) {
    for (const [relative, content] of outputs) {
      const target = path.join(rootDir, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, "utf8");
    }
  }
  return { ok: true, issues: [], outputs: [...outputs.keys()], manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = build();
  if (!result.ok) {
    console.error(result.issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Built ${result.outputs.length} widget artifacts: ${result.outputs.join(", ")}`);
  }
}
