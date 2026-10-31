import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const normalize = (value) => String(value || "").normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const yearOf = (value) => value?.["date-parts"]?.[0]?.[0] || null;

async function fetchJson(url, attempts = 0) {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "garden-widgets-reference-audit/1.0 (https://github.com/yimeng2026/garden-widgets)" },
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429) return { error: "Rate limited; no automatic retry" };
    if (!response.ok) {
      if (response.status >= 500 && attempts < 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchJson(url, attempts + 1);
      }
      return { error: `HTTP ${response.status}` };
    }
    return { data: await response.json() };
  } catch (error) {
    if (attempts < 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchJson(url, attempts + 1);
    }
    return { error: error.message };
  }
}

function crossrefRecord(entry, message, url) {
  return {
    key: entry.key,
    status: "metadata_returned",
    registry: "Crossref",
    sourceUrl: url,
    doi: message.DOI,
    title: message.title?.[0] || null,
    authors: (message.author || []).map((author) => [author.given, author.family].filter(Boolean).join(" ") || author.name || "").filter(Boolean),
    year: yearOf(message.issued),
    venue: message["container-title"]?.[0] || message.publisher || null,
    type: message.type,
    volume: message.volume || null,
    issue: message.issue || null,
    pages: message.page || null,
    publisher: message.publisher || null,
    url: message.URL || null,
  };
}

function dataciteRecord(entry, data, url) {
  return {
    key: entry.key,
    status: "metadata_returned",
    registry: "DataCite",
    sourceUrl: url,
    doi: data.doi,
    title: data.titles?.[0]?.title || null,
    authors: (data.creators || []).map((author) => author.name).filter(Boolean),
    year: data.publicationYear || null,
    venue: data.publisher || null,
    type: data.types?.resourceTypeGeneral || null,
    publisher: data.publisher || null,
    url: data.url || null,
  };
}

export async function verifyReferenceMetadata({ rootDir = ROOT, write = true } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config/reference-metadata.json"), "utf8"));
  const records = [];
  for (const entry of config.records) {
    const source = entry.source || "crossref";
    const url = source === "datacite"
      ? `https://api.datacite.org/dois/${encodeURIComponent(entry.doi)}`
      : `https://api.crossref.org/works/${encodeURIComponent(entry.doi)}`;
    const response = await fetchJson(url);
    let record;
    if (response.error) record = { key: entry.key, status: "metadata_unresolved", registry: source === "datacite" ? "DataCite" : "Crossref", sourceUrl: url, doi: entry.doi, error: response.error };
    else {
      const raw = source === "datacite" ? response.data.data?.attributes : response.data.message;
      if (!raw) record = { key: entry.key, status: "metadata_unresolved", registry: source === "datacite" ? "DataCite" : "Crossref", sourceUrl: url, doi: entry.doi, error: "Missing metadata payload" };
      else {
        record = source === "datacite" ? dataciteRecord(entry, raw, url) : crossrefRecord(entry, raw, url);
        const titleMatches = normalize(record.title) === normalize(entry.expectedTitle);
        const doiMatches = normalize(record.doi) === normalize(entry.doi);
        record.status = titleMatches && doiMatches ? "metadata_matched" : "metadata_mismatch";
        record.expectedTitle = entry.expectedTitle;
        if (record.status !== "metadata_matched") record.error = "Returned title or DOI differs from the audited reference";
      }
    }
    records.push(record);
    console.log(`${record.status}: ${entry.key} · ${record.title || record.error}`);
  }
  const output = {
    schemaVersion: 1,
    snapshotType: "reference_metadata",
    generatedAt: new Date().toISOString(),
    scope: "DOI 注册元数据与题名核对，不等同全文、实验或所有科学主张已核验。",
    records,
  };
  if (write) fs.writeFileSync(path.join(rootDir, "snapshots/reference-metadata.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await verifyReferenceMetadata();
  console.log(JSON.stringify({ matched: result.records.filter((item) => item.status === "metadata_matched").length, total: result.records.length }));
  if (result.records.some((item) => item.status !== "metadata_matched")) process.exitCode = 1;
}
