import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assertWidgetId, escapeHtml, validateLawPackage } from "../src/contracts.mjs";

const seed = JSON.parse(fs.readFileSync(new URL("../snapshots/law-packages.json", import.meta.url), "utf8"));

test("all seed law packages satisfy the shared contract", () => {
  assert.equal(seed.packages.length, 4);
  for (const item of seed.packages) assert.deepEqual(validateLawPackage(item), []);
});

test("empirical domain validation requires independent replication", () => {
  const item = structuredClone(seed.packages[0]);
  item.status = "DOMAIN_VALIDATED";
  assert.ok(validateLawPackage(item).includes("empirical DOMAIN_VALIDATED requires independent_replication=PASS"));
  item.validations.push({ level: "independent_replication", label: "独立复核", status: "PASS", evidence: "冻结后复核" });
  assert.deepEqual(validateLawPackage(item), []);
});

test("invalid ids and parameter sources are rejected", () => {
  assert.throws(() => assertWidgetId("../escape"), /id must contain/);
  const item = structuredClone(seed.packages[0]);
  item.parameters[0].sourceType = "IMAGINED";
  assert.ok(validateLawPackage(item).includes("parameters[0].sourceType is invalid"));
});

test("HTML escaping blocks markup injection", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});
