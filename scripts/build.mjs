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

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function gallery(manifest) {
  const cards = manifest.map((item) => `<article class="widget-card"><div class="widget-status">${escapeHtml(item.status)}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><p class="widget-meta">${escapeHtml(item.snapshot)}</p><p><a href="${escapeHtml(item.entry)}">打开组件</a> · <a href="${escapeHtml(item.snapshot)}">查看快照</a></p></article>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>花园组件库</title><style>
  body{font-family:var(--kimi-font-sans,system-ui);margin:0;color:var(--kimi-color-text-primary,#222);background:var(--kimi-color-surface,#fff)}main{max-width:1040px;margin:0 auto;padding:32px 16px}h1{font-size:28px;font-weight:500}h2{font-size:19px;font-weight:500}.intro{color:var(--kimi-color-text-secondary,#666);line-height:1.7}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:24px}.widget-card{border:1px solid var(--kimi-color-border,#ddd);border-radius:12px;padding:20px}.widget-status{font-size:12px;color:var(--kimi-color-text-secondary,#666)}.widget-meta{font-family:var(--kimi-font-mono,monospace);font-size:12px;color:var(--kimi-color-text-tertiary,#888);overflow-wrap:anywhere}a{color:inherit}a:focus-visible{outline:2px solid currentColor;outline-offset:4px}.contract{margin-top:24px;padding-top:16px;border-top:1px solid var(--kimi-color-border,#ddd);font-size:14px;line-height:1.7}</style></head><body><main><h1>花园组件库</h1><p class="intro">研究 → 证据对象 → 版本化快照 → 静态组件。花园保持无前端；这里只负责展示、适配和复核。</p><section class="gallery">${cards}</section><section class="contract">接口：作者时从 <code>/api/research/law-packages</code 读取证据，服务端令牌只用于同步。静态 HTML 不含令牌、不执行外部脚本、不实时请求花园。<br>文档：<a href="docs/GARDEN_INTERFACE.md">花园接口与新增组件指南</a></section></main></body></html>`;
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
  ];
  const outputs = new Map();
  const issues = [];
  const manifest = [];
  for (const definition of definitions) {
    const ids = definition.narrative.cases.map((item) => item.id);
    if (new Set(ids).size !== ids.length) issues.push(`${definition.id}: duplicate case id`);
    const html = renderResearchWidget(definition.narrative);
    issues.push(...assertStaticWidgetHtml(html, [process.env.GARDEN_AGENT_TOKEN || ""]).map((issue) => `${definition.id}: ${issue}`));
    outputs.set(`widgets/${definition.id}/index.html`, html);
    manifest.push({
      title: definition.narrative.title,
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
