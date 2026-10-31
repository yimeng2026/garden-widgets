import test from "node:test";
import assert from "node:assert/strict";
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
    metadata_matched: 15,
    record_snapshot_matched: 15,
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
  assert.ok(audit.references.every((item) => item.fullTextVerified === false));
  assert.ok(!JSON.stringify(audit).includes("Scholar 检索返回"));
});

test("local evidence references resolve to present files with hashes and no invented numbered citations", () => {
  for (const file of audit.references.flatMap((item) => item.localFiles)) {
    assert.equal(file.present, true);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(audit.papers.every((paper) => paper.explicitCitationCount === 0));
  assert.ok(audit.references.some((item) => item.linkage === "author_year"));
  assert.ok(audit.references.some((item) => item.linkage === "identifier"));
  assert.ok(audit.references.some((item) => item.linkage === "bibliography_only"));
});

test("reference explorer renders original entries and metadata without network or status inflation", () => {
  const explorer = referenceExplorer(audit);
  const html = renderContentExplorer(explorer);
  assert.equal(explorer.kind, "references");
  assert.ok(html.includes("39 条书目"));
  assert.ok(html.includes("仅核对书目，不表示已读全文"));
  assert.ok(html.includes("未发现可靠的自动关联章节"));
  assert.ok(html.includes("10.3389/fninf.2017.00076"));
  assert.deepEqual(assertStaticWidgetHtml(html), []);
});
