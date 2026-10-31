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

function frontierMetrics(item) {
  const m = item.metrics;
  const fixed = (value, digits = 6) => Number(value.toFixed(digits)).toString();
  switch (item.id) {
    case "pysindy-linear-system": return [
      { value: m.version, label: "PySINDy 版本", note: "D 盘隔离环境" },
      { value: m.maxAbsError.toExponential(3), label: "最大系数误差", note: "保留数值微分误差" },
      { value: fixed(m.coefficients[0][0]), label: "x 的系数", note: "理论值 −2" },
      { value: fixed(m.coefficients[1][1]), label: "y 的系数", note: "理论值 1" },
    ];
    case "z3-real-constraints": return [
      { value: m.version, label: "Z3 版本", note: "实数约束" },
      { value: "2", label: "已知答案检查", note: "两项均实际执行" },
      { value: "UNSAT", label: "正数蕴含反例", note: "x>0 且 x+1≤0" },
      { value: "UNSAT", label: "负平方检查", note: "x²<0" },
    ];
    case "acetazolamide-pubchem-rdkit": return [
      { value: m.formula, label: "一致分子式", note: `PubChem CID ${m.pubchemCid}` },
      { value: fixed(m.tpsaDefault, 2), label: "默认 TPSA", note: "RDKit N/O 口径" },
      { value: fixed(m.tpsaIncludeSP, 2), label: "计入 S/P", note: `PubChem 显示 ${m.pubchemTpsa}` },
      { value: fixed(m.rdkitMolLogP, 4), label: "RDKit MolLogP", note: `PubChem XLogP ${m.pubchemXLogP}，算法不同` },
    ];
    case "silicon-materials-project-pymatgen": return [
      { value: fixed(m.densityLocal), label: "本地密度", note: "g/cm³，由公开结构重算" },
      { value: m.spaceGroup, label: "空间群", note: `编号 ${m.spaceGroupNumber}` },
      { value: fixed(m.externalBandGapEv, 4), label: "外部带隙", note: "eV，未本地重算" },
      { value: m.materialId, label: "规范材料 ID", note: "保留 ID 迁移" },
    ];
    case "4hhb-hbb-uniprot": return [
      { value: m.pdbId, label: "实验结构", note: `entity ${m.pdbEntity} · 链 ${m.chains}` },
      { value: fixed(m.resolutionA, 2), label: "分辨率", note: "Å · X 射线衍射" },
      { value: m.uniprotAccession, label: "UniProt", note: "reviewed HBB_HUMAN" },
      { value: `${m.uniprotLength}→${m.pdbLength}`, label: "序列长度", note: "去起始 M 后逐字符一致" },
    ];
    case "acetazolamide-chembl-pubchem-pdb": return [
      { value: m.chemblMolecule, label: "ChEMBL 分子", note: `PubChem CID ${m.pubchemCid}` },
      { value: m.targetChemblId, label: "CA II 靶点", note: `${m.targetUniprot} · entity ${m.targetPdbEntity} 链 ${m.targetPdbChain} · ${m.targetSequenceLength} aa 精确一致` },
      { value: `${fixed(m.kiNm, 1)} nM`, label: "单 assay Ki", note: `pChEMBL ${m.pchemblExternal} · 重复标记 ${m.potentialDuplicate}` },
      { value: m.pdbId, label: "实验复合物", note: `${m.ligandCompId} · ${fixed(m.resolutionA, 1)} Å` },
    ];
    default: return [{ value: item.evidenceClass, label: "证据类别", note: `${item.sources.length} 个来源` }];
  }
}

function frontierAnalysisSections(item) {
  const m = item.metrics;
  if (!m.caIiKiRatio) return [];
  return [{
    title: "方法一致的定量对照",
    items: [
      `CA I Ki=${m.caIKiNm} nM；CA II Ki=${m.caIiKiNm} nM；同酯酶方法表观比值 ${Number(m.caIiKiRatio.toFixed(4))}，ΔpChEMBL=${Number(m.caIiPchemblDelta.toFixed(5))}。`,
      `CA IX Ki=${m.caIxKiNm} nM，使用 CO2 hydrase 方法；不与酯酶结果合并计算比值或统一排名。`,
      `${m.selectivityIndependence}；三条记录均保留 potential_duplicate=1。`,
      `六组文档表观比值范围 ${Number(m.ratioMin.toFixed(4))}–${m.ratioMax}，极差 ${m.maxMinFold} 倍；仅 ${m.methodMatchedCount}/6 明确同方法，${m.methodIncompleteCount} 组信息不足，不执行跨文献合并。`,
    ],
  }];
}

export function narrativeFromFrontierSnapshot(snapshot) {
  const labels = { math: "数学", chemistry: "化学", physics: "材料", biology: "生物" };
  return {
    schemaVersion: snapshot.schemaVersion,
    snapshotType: "frontier_evidence",
    title: "跨域证据链",
    subtitle: `${snapshot.asOf} · 上游复用 · 本地复核 · 数据库桥接`,
    cases: snapshot.items.map((item) => ({
      id: item.id,
      label: labels[item.domain] || item.domain,
      status: "已执行复核",
      tone: "accent",
      title: item.title,
      summary: item.scientificClaim,
      metrics: frontierMetrics(item),
      sections: [
        ...frontierAnalysisSections(item),
        { title: "证据边界", items: [item.limitations] },
        { title: "可回馈上游的贡献", items: [item.upstreamContribution] },
        { title: "可重放快照", items: item.snapshotFiles },
      ],
      boundary: item.limitations,
      nextAction: item.upstreamContribution,
      sources: item.sources.map((url) => ({ label: new URL(url).hostname, locator: url.replace("https://", "") })),
    })),
    sharedRules: [snapshot.scope, "证据包只描述已执行检查，不在组件中晋升为新发现或实验验证。"],
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
