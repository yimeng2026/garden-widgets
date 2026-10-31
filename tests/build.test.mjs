import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("build produces three widgets, a gallery, and a manifest without writing in inspection mode", () => {
  const result = build({ rootDir: root, write: false });
  assert.equal(result.ok, true);
  assert.deepEqual(result.outputs.sort(), ["index.html", "widgets/complexity-lab/index.html", "widgets/frontier-evidence/index.html", "widgets/law-lab/index.html", "widgets/manifest.json"].sort());
  assert.equal(result.manifest.length, 3);
});

test("build rejects duplicate case identifiers", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "garden-widgets-build-"));
  try {
    fs.mkdirSync(path.join(temporary, "snapshots"));
    for (const name of ["law-packages.json", "complexity.json", "frontier-evidence.json"]) {
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
