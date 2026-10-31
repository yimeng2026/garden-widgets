import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = path.resolve(ROOT, "../frontier-breakthrough");
const SCRIPT_BY_RECORD = {
  "ca2-sequence.json": "verify_ca2_sequence.py",
  "drug-target-structure.json": "verify_drug_target_structure.py",
  "pdb-uniprot.json": "verify_pdb_uniprot.py",
  "pymatgen.json": "verify_pymatgen.py",
  "rdkit.json": "verify_rdkit.py",
  "pysindy.json": "verify_pysindy.py",
  "z3.json": "verify_z3.py",
  "ca-selectivity.json": "analyze_ca_selectivity.py",
  "ca-document-stability.json": "analyze_ca_document_stability.py",
  "ca-document-methods.json": "audit_ca_document_methods.py",
  "structural-control.json": "analyze_structural_control.py",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safeName(value) {
  if (typeof value !== "string" || !value.length || path.basename(value) !== value || value.includes("..")) {
    throw new Error(`Unsafe source filename: ${value}`);
  }
  return value;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function syncFrontierContent({ rootDir = ROOT, sourceDir = DEFAULT_SOURCE, write = true } = {}) {
  const source = path.resolve(sourceDir);
  const manifest = readJson(path.join(source, "papers/manifest.json"));
  if (!Array.isArray(manifest.papers) || !manifest.papers.length) throw new Error("Paper manifest is empty");
  const papers = [];
  const assets = new Map();
  const ids = new Set();
  for (const entry of manifest.papers) {
    const folder = safeName(entry.folder);
    const filename = safeName(entry.file);
    const file = path.join(source, "papers", folder, filename);
    const markdown = fs.readFileSync(file, "utf8");
    const title = markdown.match(/^#\s+(.+)$/m)?.[1];
    if (!title) throw new Error(`Missing paper title: ${filename}`);
    const id = folder.split("_")[0];
    if (ids.has(id)) throw new Error(`Duplicate paper id: ${id}`);
    ids.add(id);
    if (!Array.isArray(entry.figureFiles) || !entry.figureFiles.length) throw new Error(`Missing figures: ${folder}`);
    const figureFiles = entry.figureFiles.map(safeName);
    if (new Set(figureFiles).size !== figureFiles.length) throw new Error(`Duplicate figure: ${folder}`);
    for (const figure of figureFiles) {
      const asset = path.join(source, "papers", folder, figure);
      if (!fs.statSync(asset).isFile()) throw new Error(`Missing figure: ${figure}`);
      assets.set(`assets/papers/${folder}/${figure}`, fs.readFileSync(asset));
      if (!markdown.includes(figure)) throw new Error(`Figure is not referenced by paper: ${figure}`);
    }
    papers.push({
      id, folder, file: filename, title,
      status: entry.status,
      characters: entry.characters,
      figures: entry.figures,
      figureFiles,
      pipelineId: entry.pipelineId,
      sha256: digest(markdown),
      markdown,
    });
  }

  const projects = readJson(path.join(source, "data/projects.json"));
  const projectIds = projects.projects?.map((item) => item.id) || [];
  if (!projectIds.length || new Set(projectIds).size !== projectIds.length) throw new Error("Invalid or duplicate project IDs");
  const validationDir = path.join(source, "validation");
  const records = fs.readdirSync(validationDir).filter((name) => name.endsWith(".json")).sort().map((filename) => {
    const buffer = fs.readFileSync(path.join(validationDir, filename));
    const data = JSON.parse(buffer.toString("utf8"));
    return {
      id: filename.replace(/\.json$/, ""),
      file: `validation/${filename}`,
      sha256: digest(buffer),
      script: SCRIPT_BY_RECORD[filename] || null,
      data,
    };
  });
  if (!records.length) throw new Error("No validation snapshots found");
  const snapshots = {
    "snapshots/paper-collection.json": {
      schemaVersion: 1,
      snapshotType: "paper_collection",
      source: "frontier-breakthrough/papers",
      status: "研究简报／预印本草案，未同行评议",
      papers,
    },
    "snapshots/projects.json": projects,
    "snapshots/validation-records.json": {
      schemaVersion: 1,
      snapshotType: "validation_records",
      source: "frontier-breakthrough/validation",
      note: "verified 仅指记录所述的指定复核，不代表整个模型、数据库或科学结论已独立验证。",
      records,
    },
    "snapshots/structural-control.json": records.find((item) => item.id === "structural-control")?.data,
    "snapshots/ca-document-stability.json": records.find((item) => item.id === "ca-document-stability")?.data,
    "snapshots/ca-document-methods.json": records.find((item) => item.id === "ca-document-methods")?.data,
    "snapshots/ca-selectivity.json": records.find((item) => item.id === "ca-selectivity")?.data,
  };
  for (const [name, value] of Object.entries(snapshots)) if (!value) throw new Error(`Missing required snapshot: ${name}`);
  const outputs = [...Object.keys(snapshots), ...assets.keys()];
  if (write) {
    for (const [name, data] of Object.entries(snapshots)) writeJson(path.join(rootDir, name), data);
    for (const [name, buffer] of assets) {
      const target = path.join(rootDir, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buffer);
    }
  }
  return {
    ok: true,
    outputs,
    papers: papers.length,
    figures: assets.size,
    projects: projects.projects.length,
    validations: records.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const index = args.indexOf("--source");
  const sourceDir = index >= 0 && args[index + 1] ? path.resolve(args[index + 1]) : DEFAULT_SOURCE;
  const result = syncFrontierContent({ sourceDir });
  console.log(JSON.stringify(result, null, 2));
}
