import fs from "node:fs";
import { Marked } from "marked";
import { escapeHtml } from "./contracts.mjs";

function inlineText(markdown) {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/[\\`*_>#|[\]]/g, " ").replace(/\s+/g, " ").trim();
}

function paperSections(paper) {
  const parser = new Marked({
    gfm: true,
    renderer: {
      html({ text }) { return escapeHtml(text); },
      link({ href, text }) {
        if (!/^https?:\/\//i.test(href)) return text;
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${text}</a>`;
      },
      image({ href, text }) {
        if (!paper.figureFiles.includes(href)) throw new Error(`Unregistered or unsafe image path: ${href}`);
        const src = `../../assets/papers/${paper.folder}/${href}`;
        return `<img class="paper-image" src="${escapeHtml(src)}" alt="${escapeHtml(text)}" loading="lazy">`;
      },
    },
  });
  const lines = paper.markdown.split(/\r?\n/);
  const sections = [];
  let current = { title: paper.title, level: 1, lines: [] };
  const push = () => {
    const markdown = current.lines.join("\n").trim();
    if (!markdown) return;
    sections.push({
      id: `${paper.id}-section-${sections.length}`,
      title: current.title,
      level: current.level,
      text: inlineText(markdown),
      html: parser.parse(markdown, { async: false }),
    });
  };
  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      push();
      current = { title: heading[2], level: heading[1].length, lines: [] };
    } else current.lines.push(line);
  }
  push();
  return sections;
}

export function paperExplorer(snapshot) {
  return {
    kind: "papers",
    title: "论文与图件阅览室",
    subtitle: "三篇完整研究简报 · 章节检索 · 13 幅原始图件 · 未同行评议",
    data: {
      status: snapshot.status,
      papers: snapshot.papers.map(({ markdown, ...paper }) => ({
        ...paper,
        sections: paperSections({ ...paper, markdown }),
        figures: paper.figureFiles.map((filename) => ({
          filename,
          src: `../../assets/papers/${paper.folder}/${filename}`,
          alt: filename.replace(/\.png$/, "").replaceAll("_", " "),
        })),
      })),
    },
  };
}

export function activityExplorer(stability, selectivity) {
  return {
    kind: "activity",
    title: "CA 表观活性比较",
    subtitle: "六组文档内配对 · 方法信息优先 · 不执行跨文献合并估计",
    data: {
      stability: Object.fromEntries(Object.entries(stability).filter(([key]) => key !== "exploratory_median_ratio_not_a_selectivity_estimate")),
      selectivity,
    },
  };
}

export function structureExplorer(structure) {
  return {
    kind: "structure",
    title: "结构—序列构建对照",
    subtitle: "3HS4 与 2H4N · 不同构建的结构对照，不是独立野生型重复",
    data: structure,
  };
}

export function referenceExplorer(snapshot) {
  return {
    kind: "references",
    title: "来源与引用核验",
    subtitle: `${snapshot.references.length} 条书目 · DOI／目录 · 本地版本 · 数据库快照 · 引用关联`,
    data: snapshot,
  };
}

export function projectExplorer(snapshot) {
  return {
    kind: "projects",
    title: "全球前沿项目协作图谱",
    subtitle: `${snapshot.projects.length} 个公开项目 · 协作优先 · 本地状态与外部能力分账`,
    data: snapshot,
  };
}

function validationDomain(id) {
  if (/sindy|z3/.test(id)) return "math";
  if (/materials|pymatgen/.test(id)) return "physics";
  if (/pdb|uniprot|structural/.test(id)) return "biology";
  if (/chembl|pubchem|rdkit|ca2|drug|selectivity/.test(id)) return "chemistry";
  return "cross";
}

export function validationExplorer(snapshot) {
  return {
    kind: "validation",
    title: "验证与重放工作台",
    subtitle: `${snapshot.records.length} 份真实快照 · 已执行复核与上游原始记录分开呈现`,
    data: {
      note: snapshot.note,
      records: snapshot.records.map((record) => {
        const executed = record.data.status === "verified";
        return {
          id: record.id,
          file: record.file,
          sha256: record.sha256,
          script: record.script,
          domain: validationDomain(record.id),
          evidenceKind: executed ? "executed" : "upstream",
          engine: record.data.engine || "上游数据库原始快照",
          version: record.data.version || "未单列版本",
          status: record.data.status || "snapshot",
          scope: record.data.scope || "原始上游响应快照；不能脱离对应核验脚本和实体上下文单独构成独立复核。",
          fields: Object.entries(record.data).filter(([key, value]) =>
            key !== "python" && ["string", "number", "boolean"].includes(typeof value),
          ).slice(0, 36),
        };
      }),
    },
  };
}

export function generationBudgetExplorer() {
  return {
    kind: "budget",
    title: "长文预算与恢复规划器",
    subtitle: "花园真实生成机制的只读规划界面 · 不在浏览器调用模型",
    data: {
      maxTotalOutputBudget: 100000000,
      defaultSegmentMaxTokens: 12288,
      defaultTargetTokens: 12288,
      minTimeoutMs: 1000,
      maxTimeoutMs: 3600000,
      defaultTimeoutMs: 300000,
      maxRetries: 10,
      checkpointPattern: "data/manuscript-checkpoints/<pipelineId>/<stageId>.json",
      source: "bloombloomgarden/src/lib/manuscript-generation.ts",
      boundaries: [
        "1 亿 token 是应用层累计预算上限，不是单次返回能力或免费额度。",
        "段落上限仍必须服从模型和上游限制；本页面不声称任何模型支持单次 1 亿 token。",
        "实际正文可短于目标；不得为凑长度填充文本。",
        "真实检查点按证据与计划指纹恢复；本页面仅演示分段计算，不保存稿件。",
      ],
    },
  };
}

export function renderContentExplorer(explorer) {
  const template = fs.readFileSync(new URL("./content-explorer-template.html", import.meta.url), "utf8");
  const replacements = {
    "__TITLE__": escapeHtml(explorer.title),
    "__SUBTITLE__": escapeHtml(explorer.subtitle),
    "__PAYLOAD__": JSON.stringify({ kind: explorer.kind, data: explorer.data }).replaceAll("</", "<\\/"),
  };
  return Object.entries(replacements).reduce((html, [key, value]) => html.replaceAll(key, value), template);
}
