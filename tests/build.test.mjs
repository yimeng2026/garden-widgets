import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("build produces ten widgets, a gallery, and a manifest without writing in inspection mode", () => {
  const result = build({ rootDir: root, write: false });
  assert.equal(result.ok, true);
  const widgets = ["law-lab", "complexity-lab", "frontier-evidence", "paper-library", "ca-activity", "structure-control", "project-atlas", "validation-workbench", "generation-budget", "reference-audit"];
  assert.deepEqual(result.outputs.sort(), ["index.html", "widgets/manifest.json", ...widgets.map((id) => `widgets/${id}/index.html`)].sort());
  assert.equal(result.manifest.length, 10);
});

test("build rejects duplicate case identifiers", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "garden-widgets-build-"));
  try {
    fs.mkdirSync(path.join(temporary, "snapshots"));
    const snapshots = ["law-packages.json", "complexity.json", "frontier-evidence.json", "paper-collection.json", "ca-document-stability.json", "ca-document-methods.json", "ca-selectivity.json", "structural-control.json", "projects.json", "validation-records.json", "reference-audit.json"];
    for (const name of snapshots) {
      fs.copyFileSync(path.join(root, "snapshots", name), path.join(temporary, "snapshots", name));
    }
    const filename = path.join(temporary, "snapshots", "complexity.json");
    const data = JSON.parse(fs.readFileSync(filename, "utf8"));
    data.cases[1].id = data.cases[0].id;
    fs.writeFileSync(filename, JSON.stringify(data));
    const result = build({ rootDir: temporary, write: false });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.includes("duplicate case id")));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
