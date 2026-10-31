import { escapeHtml } from "./contracts.mjs";

function labelForLaw(item) {
  if (item.id.startsWith("CA2")) return "CA2 留出验证";
  if (item.id.startsWith("MAT")) return "材料对象";
  if (item.id.startsWith("INV")) return "反演反例";
  return "主动判别";
}

function toneForLaw(status) {
  return ({ LIMITED_SUPPORT: "warning", SCREENING: "accent", DEMONSTRATED: "positive", DESIGN_READY: "accent", REFUTED: "danger" })[status] || "accent";
}

export function narrativeFromLawSnapshot(snapshot) {
  const packages = snapshot.packages || snapshot.data?.packages || [];
  return {
    schemaVersion: snapshot.schemaVersion || 1,
    snapshotType: "law_packages",
    title: "规律实验室",
    subtitle: "参数出生证 · 分层验证 · 反例登记 · 下一项判别实验",
    cases: packages.map((item) => ({
      id: item.id,
      label: labelForLaw(item),
      status: ({ LIMITED_SUPPORT: "有限支持", SCREENING: "筛选中", DEMONSTRATED: "反例已复核", DESIGN_READY: "协议就绪", REFUTED: "已反驳" })[item.status] || item.status,
      tone: toneForLaw(item.status),
      title: item.title,
      summary: item.statement,
      metrics: item.metrics,
      sections: [
        { title: "分层验证", items: item.validations.map((entry) => `${entry.label}［${entry.status}］：${entry.evidence}`) },
        { title: "参数出生证", items: item.parameters.map((entry) => `${entry.name} · ${entry.meaning} · ${entry.sourceType} · ${entry.unit}`) },
        { title: "反例与限制", items: [...item.counterexamples, ...item.limitations] },
        { title: "证据历史", items: item.evidenceHistory.map((entry) => `${entry.at} · ${entry.action} · ${entry.detail}`) },
      ],
      boundary: item.summary,
      nextAction: item.nextAction,
      sources: item.sources,
    })),
    sharedRules: [
      "经验规律、有效映射、形式约束和研究协议不共享同一种晋升标准。",
      "主分析、敏感性分析、数据库留出和独立实验复现分别记账。",
      "组件只呈现证据，不在本地提升状态。",
    ],
  };
}

export function narrativeFromComplexitySnapshot(snapshot) {
  return {
    schemaVersion: snapshot.schemaVersion,
    snapshotType: snapshot.snapshotType,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    cases: snapshot.cases,
    sharedRules: snapshot.sharedRules,
  };
}

export function renderResearchWidget(narrative) {
  if (!narrative?.cases?.length) throw new Error("Narrative requires at least one case");
  const fs = process.getBuiltinModule("fs");
  const template = fs.readFileSync(new URL("./research-widget-template.html", import.meta.url), "utf8");
  const replacements = {
    "__TITLE__": escapeHtml(narrative.title),
    "__SUBTITLE__": escapeHtml(narrative.subtitle),
    "__COUNT__": String(narrative.cases.length),
    "__INITIAL_TITLE__": escapeHtml(narrative.cases[0].title),
    "__INITIAL_SUMMARY__": escapeHtml(narrative.cases[0].summary),
    "__PAYLOAD__": JSON.stringify(narrative).replaceAll("</", "<\\/"),
  };
  return Object.entries(replacements).reduce((html, [key, value]) => html.replaceAll(key, value), template);
}

export function assertStaticWidgetHtml(html, secrets = []) {
  const issues = [];
  if (!/^<!doctype html>/i.test(html)) issues.push("missing HTML doctype");
  if (/fetch\s*\(|WebSocket\s*\(|EventSource\s*\(/i.test(html)) issues.push("browser network access is forbidden");
  if (/<script[^>]+src\s*=|<link[^>]+rel=["']?stylesheet|@import\s+/i.test(html)) issues.push("external scripts or styles are forbidden");
  if (/GARDEN_AGENT_TOKEN\s*[:=]\s*["'][^"']+["']/i.test(html)) issues.push("credential assignment found");
  for (const secret of secrets.filter((value) => typeof value === "string" && value.length >= 8)) {
    if (html.includes(secret)) issues.push("secret value found in widget HTML");
  }
  return issues;
}
