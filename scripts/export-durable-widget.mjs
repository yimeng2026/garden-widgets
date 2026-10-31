import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { escapeHtml } from "../src/contracts.mjs";
import { assertStaticWidgetHtml } from "../src/research-renderer.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function durableWidgetHub(manifest) {
  const cards = manifest.widgets.map((item) => {
    const directory = path.basename(path.dirname(item.entry));
    return `<article class="hub-card"><span class="hub-status">${escapeHtml(item.status)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div class="hub-links"><a href="widgets/${escapeHtml(directory)}/index.html">打开组件</a><a href="${escapeHtml(item.snapshot)}">只读快照</a></div></article>`;
  }).join("");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>前沿研究组件集</title><style>
body{margin:0}.hub{width:100%;box-sizing:border-box;padding:var(--kimi-space-4,16px);font-family:var(--kimi-font-sans,sans-serif);color:var(--kimi-color-text-primary,CanvasText)}.hub *{box-sizing:border-box}.hub h1{margin:0;font-size:20px;line-height:28px;font-weight:500}.hub-intro{margin:var(--kimi-space-1,4px) 0 var(--kimi-space-4,16px);font-size:14px;line-height:21px;color:var(--kimi-color-text-secondary,#666)}.hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--kimi-space-3,12px)}.hub-card{display:flex;flex-direction:column;min-width:0;padding:var(--kimi-space-3,12px);border:1px solid var(--kimi-color-border,#ddd);border-radius:var(--kimi-radius-panel,12px)}.hub-status{font-size:12px;line-height:18px;color:var(--kimi-color-text-secondary,#666)}.hub h2{margin:var(--kimi-space-2,8px) 0;font-size:16px;line-height:22px;font-weight:500}.hub-card p{margin:0 0 var(--kimi-space-3,12px);font-size:13px;line-height:20px;color:var(--kimi-color-text-secondary,#666)}.hub-links{display:flex;flex-wrap:wrap;gap:var(--kimi-space-3,12px);margin-block-start:auto;font-size:13px}.hub a{color:inherit;text-underline-offset:3px}.hub a:focus-visible{outline:2px solid currentColor;outline-offset:3px}.hub-note{margin:var(--kimi-space-4,16px) 0 0;padding-block-start:var(--kimi-space-3,12px);border-top:1px solid var(--kimi-color-border,#ddd);font-size:12px;line-height:18px;color:var(--kimi-color-text-secondary,#666)}@media(max-width:680px){.hub-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:380px){.hub-grid{grid-template-columns:1fr}}
</style></head><body><main class="hub"><h1>前沿研究组件集</h1><p class="hub-intro">${manifest.widgets.length} 个独立研究组件 · 3 篇完整论文 · 13 幅图 · 88 个公开项目 · 39 条来源审计。所有内容为本地只读快照，不自动晋升结论。</p><section class="hub-grid" aria-label="研究组件目录">${cards}</section><p class="hub-note">论文为未同行评议研究简报；已执行复核、上游原始记录、项目目录与模型规划分开呈现。页面不调用外部脚本，不向花园写入数据。</p></main></body></html>`;
}

export function exportDurableWidget({ targetDir, rootDir = ROOT, write = true } = {}) {
  if (!targetDir) throw new Error("targetDir is required");
  const target = path.resolve(targetDir);
  if (target === path.resolve(rootDir)) throw new Error("Refusing to overwrite the component source repository");
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "widgets/manifest.json"), "utf8"));
  const html = durableWidgetHub(manifest);
  const issues = assertStaticWidgetHtml(html, [process.env.GARDEN_AGENT_TOKEN || ""]);
  if (issues.length) throw new Error(issues.join("\n"));
  const outputs = ["index.html", "widgets", "assets", "snapshots", "docs"];
  if (write) {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "index.html"), html, "utf8");
    for (const directory of outputs.slice(1)) {
      fs.cpSync(path.join(rootDir, directory), path.join(target, directory), { recursive: true });
    }
  }
  return { ok: true, target, widgets: manifest.widgets.length, outputs, html };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const index = args.indexOf("--target");
  if (index < 0 || !args[index + 1]) throw new Error("Usage: npm run export:widget -- --target <widget-workspace>");
  const result = exportDurableWidget({ targetDir: args[index + 1] });
  console.log(JSON.stringify({ ...result, html: undefined }, null, 2));
}
