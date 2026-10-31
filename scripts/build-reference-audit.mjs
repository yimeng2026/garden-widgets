import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const pad = (value) => String(value).padStart(2, "0");
const CONTEXT_KEYS = [
  "context-barba-2018", "context-plesser-2018", "context-nasem-2019", "context-roache-1998",
  "context-oberkampf-2002", "context-brunton-2016", "context-demoura-2008", "context-ong-2013",
  "context-wilkinson-2016", "context-acm-2020",
];
const ALIASES = {
  "paper3-01": ["de Silva", "PySINDy"], "paper3-02": ["Kaptanoglu", "PySINDy"], "paper3-07": ["Jain", "Materials Project"],
  "context-barba-2018": ["Barba"], "context-plesser-2018": ["Plesser"], "context-nasem-2019": ["National Academies"],
  "context-roache-1998": ["Roache"], "context-oberkampf-2002": ["Oberkampf", "Trucano"],
  "context-brunton-2016": ["Brunton"], "context-demoura-2008": ["de Moura", "Bjørner", "Z3"],
  "context-ong-2013": ["Ong", "PyMatGen"], "context-wilkinson-2016": ["Wilkinson", "FAIR"],
  "context-acm-2020": ["ACM", "artifact review"],
};

function identifiers(raw) {
  const patterns = [/CHEMBL\d+/gi, /\b(?=[A-Z0-9]*[A-Z])[1-9][A-Z0-9]{3}\b/g, /\bP\d{5}\b/g, /\b\d{5,6}\b/g, /\b(?:HBB_HUMAN|CAH2_HUMAN)\b/g, /CID\s+\d+/gi];
  return [...new Set(patterns.flatMap((pattern) => raw.match(pattern) || []))];
}

function citationGroups(text) {
  return [...text.matchAll(/\[((?:\d+\s*,\s*)*\d+)\]/g)].map((match) => ({
    raw: match[0],
    numbers: match[1].split(/\s*,\s*/).map(Number),
  }));
}

function sectionsOf(markdown) {
  const body = markdown.split(/^## 参考文献$/m)[0];
  const lines = body.split(/\r?\n/);
  const sections = [];
  let current = { title: "题名与摘要", text: "" };
  for (const line of lines) {
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      if (current.text.trim()) sections.push(current);
      current = { title: heading[1], text: "" };
    } else current.text += `${line}\n`;
  }
  if (current.text.trim()) sections.push(current);
  return { body, sections };
}

function classify(raw, metadata) {
  if (raw.includes("本研究")) return "local_evidence";
  if (metadata) return "scholarly";
  if (/github\.com|RDKit|PySINDy contributors|Z3 contributors|PyMatGen/i.test(raw)) return "software";
  return "database_record";
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function buildReferenceAudit({ rootDir = ROOT, write = true } = {}) {
  const collection = read(rootDir, "snapshots/paper-collection.json");
  const registry = read(rootDir, "snapshots/reference-metadata.json");
  const supplement = read(rootDir, "snapshots/reference-supplement.json");
  const validations = read(rootDir, "snapshots/validation-records.json");
  const metadata = new Map([...registry.records, ...supplement.records].map((item) => [item.key, item]));
  const localRecords = new Map(validations.records.map((item) => [item.file, item]));
  const localCorpus = JSON.stringify(validations.records);
  const references = [];
  const papers = [];
  for (const paper of collection.papers) {
    const { body, sections } = sectionsOf(paper.markdown);
    const bibliography = paper.markdown.split(/^## 参考文献$/m)[1]?.split(/^## 附录 A/m)[0] || "";
    const entries = [...bibliography.matchAll(/^\[(\d+)\]\s+(.+)$/gm)];
    const citationGroupsInBody = citationGroups(body);
    const citedNumbers = new Set(citationGroupsInBody.flatMap((group) => group.numbers));
    const referenceNumbers = new Set(entries.map((match) => Number(match[1])));
    const explicitCitationCount = citationGroupsInBody.length;
    papers.push({
      id: paper.id, title: paper.title, referenceCount: entries.length,
      explicitCitationCount,
      citedReferenceCount: [...citedNumbers].filter((number) => referenceNumbers.has(number)).length,
      uncitedReferenceNumbers: [...referenceNumbers].filter((number) => !citedNumbers.has(number)),
      invalidCitationNumbers: [...citedNumbers].filter((number) => !referenceNumbers.has(number)),
      citationStyle: explicitCitationCount ? "numbered_inline" : "bibliography_only_numbers",
    });
    let inheritedUrl = null;
    for (const match of entries) {
      const number = Number(match[1]);
      const raw = match[2].trim();
      const directUrl = raw.match(/https?:\/\/[^\s；]+/)?.[0]?.replace(/[。；，）)]+$/g, "");
      inheritedUrl = safeUrl(directUrl) || (raw.includes("同上") ? inheritedUrl : null);
      const metadataKey = number >= 10 && paper.id === "03" ? CONTEXT_KEYS[number - 10] : `paper${Number(paper.id)}-${pad(number)}`;
      const meta = metadata.get(metadataKey) || null;
      const kind = classify(raw, meta);
      const files = [...new Set(raw.match(/validation\/[\w-]+\.json/g) || [])];
      const localFiles = files.map((file) => {
        const record = localRecords.get(file);
        return { file, present: Boolean(record), sha256: record?.sha256 || null, script: record?.script || null };
      });
      const ids = identifiers(raw);
      let status;
      if (localFiles.length) status = localFiles.every((item) => item.present) ? "local_evidence_present" : "local_evidence_missing";
      else if (meta) status = meta.status;
      else if (kind === "software") {
        const engine = raw.match(/PySINDy|Z3|RDKit|PyMatGen/i)?.[0];
        const record = validations.records.find((item) => item.data.engine?.toLowerCase() === engine?.toLowerCase());
        const version = raw.match(/\d{4}\.\d+\.\d+|\d+\.\d+\.\d+(?:\.\d+)?/)?.[0];
        status = record && version === record.data.version ? "local_version_matched" : "version_mismatch";
      } else if (ids.length) {
        const covered = ids.filter((id) => localCorpus.includes(id.startsWith("CID") ? id.replace(/\D/g, "") : id));
        status = covered.length === ids.length ? "record_snapshot_matched" : "record_snapshot_partial";
      } else status = "source_locator_only";
      const aliases = [...(ALIASES[metadataKey] || []), ...ids];
      const inferredSections = sections.filter((section) => aliases.some((alias) => section.text.toLowerCase().includes(alias.toLowerCase()))).map((section) => ({
        title: section.title,
        linkage: meta?.year && ALIASES[metadataKey]?.some((alias) => section.text.includes(alias) && section.text.includes(String(meta.year))) ? "author_year" : "identifier",
      }));
      const explicitSections = sections.flatMap((section) => citationGroups(section.text).filter((group) => group.numbers.includes(number)).map((group) => ({
        title: section.title,
        linkage: "explicit_number",
        citation: group.raw,
      })));
      const linkedSections = explicitSections.length ? explicitSections : inferredSections;
      references.push({
        id: `${paper.id}-ref-${pad(number)}`,
        paperId: paper.id,
        paperTitle: paper.title,
        number,
        raw,
        kind,
        status,
        url: safeUrl(meta?.url) || inheritedUrl,
        identifiers: ids,
        localFiles,
        metadata: meta ? {
          key: metadataKey, title: meta.title, doi: meta.doi || null, authors: (meta.authors || []).slice(0, 6),
          authorCount: (meta.authors || []).length, year: meta.year, venue: meta.venue, type: meta.type,
          registry: meta.registry, sourceUrl: meta.sourceUrl,
        } : null,
        linkedSections,
        linkage: explicitSections.length ? "explicit_number" : inferredSections.some((item) => item.linkage === "author_year") ? "author_year" : inferredSections.length ? "identifier" : "bibliography_only",
        inferredSections,
        fullTextVerified: false,
      });
    }
  }
  const statusCounts = Object.fromEntries([...new Set(references.map((item) => item.status))].sort().map((status) => [status, references.filter((item) => item.status === status).length]));
  const result = {
    schemaVersion: 1,
    snapshotType: "reference_audit",
    scope: "逐条书目、正文编号、标识符与本地快照审计。DOI／目录元数据匹配不等于全文已读；数据库记录复核不等于独立实验；作者—年份与标识符仅作辅助关联。",
    repair: { contextReferencesAdded: 10, metadataReferencesCorrected: 3, note: "第三篇补入正文已有作者—年份提及的 10 组背景来源，并校正 3 条注册书目信息。" },
    papers,
    statusCounts,
    references,
  };
  if (write) fs.writeFileSync(path.join(rootDir, "snapshots/reference-audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = buildReferenceAudit();
  console.log(JSON.stringify({ references: result.references.length, statusCounts: result.statusCounts, papers: result.papers }, null, 2));
}
