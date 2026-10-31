import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReferenceAudit } from "../scripts/build-reference-audit.mjs";
import { referenceExplorer, renderContentExplorer } from "../src/content-explorers.mjs";
import { assertStaticWidgetHtml } from "../src/research-renderer.mjs";

const audit = buildReferenceAudit({ write: false });

test("reference audit covers all 39 entries with four explicit evidence layers", () => {
  assert.equal(audit.references.length, 39);
  assert.deepEqual(audit.papers.map((paper) => paper.referenceCount), [12, 8, 19]);
  assert.deepEqual(audit.statusCounts, {
    local_evidence_present: 4,
    local_version_matched: 5,
    metadata_matched: 21,
    record_snapshot_matched: 9,
  });
  assert.equal(audit.repair.contextReferencesAdded, 10);
  assert.equal(audit.repair.metadataReferencesCorrected, 3);
  assert.equal(new Set(audit.references.map((item) => item.id)).size, 39);
});

test("metadata corrections and background references preserve registration boundaries", () => {
  const pysindy = audit.references.find((item) => item.id === "03-ref-01");
  assert.ok(pysindy.raw.includes("nonlinear dynamical systems from data"));
  assert.equal(pysindy.metadata.doi, "10.21105/joss.02104");
  assert.equal(pysindy.metadata.year, 2020);
  const acm = audit.references.find((item) => item.id === "03-ref-19");
  assert.equal(acm.metadata.registry, "ACM official policy");
  assert.equal(acm.metadata.year, 2020);
  const roache = audit.references.find((item) => item.id === "03-ref-13");
  assert.equal(roache.metadata.title, "Verification and validation in computational science and engineering");
  assert.ok(!roache.identifiers.includes("1998"));
  assert.ok(audit.references.find((item) => item.id === "01-ref-06").identifiers.includes("3HS4"));
  assert.equal(audit.references.find((item) => item.id === "01-ref-09").url, null);
  assert.ok(audit.references.find((item) => item.id === "01-ref-02").url.includes("ebi.ac.uk"));
  assert.deepEqual(audit.references.filter((item) => item.fullTextVerified).map((item) => item.id), ["01-ref-07", "03-ref-01", "03-ref-02", "03-ref-18"]);
  assert.deepEqual(audit.fullTextCounts, { abstract_checked: 4, full_text_checked: 4, not_obtained: 28, partial_text_checked: 3 });
  assert.ok(!JSON.stringify(audit).includes("Scholar 检索返回"));
});

test("local evidence and explicit citations resolve without missing or invalid references", () => {
  for (const file of audit.references.flatMap((item) => item.localFiles)) {
    assert.equal(file.present, true);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(audit.papers.map((paper) => paper.explicitCitationCount), [9, 12, 18]);
  for (const paper of audit.papers) {
    assert.equal(paper.citedReferenceCount, paper.referenceCount);
    assert.deepEqual(paper.uncitedReferenceNumbers, []);
    assert.deepEqual(paper.invalidCitationNumbers, []);
  }
  assert.ok(audit.references.every((item) => item.linkage === "explicit_number"));
  assert.ok(audit.references.every((item) => item.linkedSections.every((section) => section.citation)));
  assert.ok(audit.references.some((item) => item.inferredSections.some((section) => section.linkage === "author_year")));
  assert.ok(audit.references.some((item) => item.inferredSections.some((section) => section.linkage === "identifier")));
});

test("reference explorer renders original entries and metadata without network or status inflation", () => {
  const explorer = referenceExplorer(audit);
  const html = renderContentExplorer(explorer);
  assert.equal(explorer.kind, "references");
  assert.ok(html.includes("39 条书目"));
  assert.ok(html.includes("仅核对书目，不表示已读全文"));
  assert.ok(html.includes("未发现可靠的自动关联章节"));
  assert.ok(html.includes("10.3389/fninf.2017.00076"));
  assert.ok(html.includes("正文片段已核（非全文）"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});

test("fulltext snapshot separates four complete sources, three snippets and four abstracts", () => {
  const evidence = JSON.parse(fs.readFileSync(new URL("../snapshots/fulltext-evidence.json", import.meta.url), "utf8"));
  assert.equal(evidence.records.length, 11);
  assert.equal(evidence.records.filter((record) => record.status === "full_text_checked").length, 4);
  assert.equal(evidence.records.filter((record) => record.status === "partial_text_checked").length, 3);
  assert.equal(evidence.records.filter((record) => record.status === "abstract_checked").length, 4);
  const claims = evidence.records.flatMap((record) => record.claims);
  assert.equal(claims.length, 17);
  assert.ok(claims.every((claim) => claim.verification === "quote_present" && claim.locator && claim.quote));
  assert.ok(evidence.records.every((record) => /^[a-f0-9]{64}$/.test(record.sourceSha256)));
  assert.ok(evidence.records.find((record) => record.key === "paper1-11").scope.includes("只能由 PDB"));
  assert.ok(evidence.records.find((record) => record.key === "paper2-01").claims[0].quote.includes("published earlier"));
});

test("citation audit reports missing and out-of-range numbers instead of forcing full coverage", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const temporaryRoot = path.join(root, ".tmp");
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(temporaryRoot, "reference-audit-"));
  try {
    fs.mkdirSync(path.join(temporary, "snapshots"));
    for (const name of ["paper-collection.json", "reference-metadata.json", "reference-supplement.json", "validation-records.json", "fulltext-evidence.json"]) {
      fs.copyFileSync(path.join(root, "snapshots", name), path.join(temporary, "snapshots", name));
    }
    const file = path.join(temporary, "snapshots/paper-collection.json");
    const collection = JSON.parse(fs.readFileSync(file, "utf8"));
    collection.papers[0].markdown = collection.papers[0].markdown.replace("仅属于 CHEMBL657848[3]", "仅属于 CHEMBL657848[99]");
    fs.writeFileSync(file, JSON.stringify(collection));
    const damaged = buildReferenceAudit({ rootDir: temporary, write: false });
    assert.deepEqual(damaged.papers[0].uncitedReferenceNumbers, [3]);
    assert.deepEqual(damaged.papers[0].invalidCitationNumbers, [99]);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
