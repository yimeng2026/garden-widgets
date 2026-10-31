import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGardenClient, normalizeGardenBaseUrl } from "../src/garden-adapter.mjs";

const seed = JSON.parse(fs.readFileSync(new URL("../snapshots/law-packages.json", import.meta.url), "utf8"));
const token = "test-token-that-is-long-enough-for-the-adapter";

test("base URL validation permits loopback HTTP and rejects insecure or credentialed URLs", () => {
  assert.equal(normalizeGardenBaseUrl("http://localhost:7100"), "http://localhost:7100");
  assert.throws(() => normalizeGardenBaseUrl("http://example.com"), /HTTPS/);
  assert.throws(() => normalizeGardenBaseUrl("https://user:pass@example.com"), /credentials/);
});

test("adapter reads and validates collection and item without exposing the token", async () => {
  const calls = [];
  const client = createGardenClient({
    baseUrl: "https://garden.example",
    token,
    fetchImpl: async (url, options) => {
      calls.push({ url: url.toString(), options });
      const single = url.pathname.endsWith(seed.packages[0].id);
      return new Response(JSON.stringify(single
        ? { success: true, data: seed.packages[0] }
        : { success: true, data: seed.packages, meta: { perspectives: seed.perspectives } }), { status: 200 });
    },
  });
  const collection = await client.listLawPackages({ kind: "empirical" });
  assert.equal(collection.data.length, 4);
  const item = await client.getLawPackage(seed.packages[0].id);
  assert.equal(item.status, "LIMITED_SUPPORT");
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes("kind=empirical"));
  assert.equal(calls[0].options.headers.authorization, `Bearer ${token}`);
  assert.ok(!calls[0].url.includes(token));
});

test("adapter rejects invalid evidence and missing credentials", async () => {
  const invalid = structuredClone(seed.packages[0]);
  invalid.status = "DOMAIN_VALIDATED";
  const client = createGardenClient({
    baseUrl: "https://garden.example",
    token,
    fetchImpl: async () => new Response(JSON.stringify({ success: true, data: [invalid], meta: {} }), { status: 200 }),
  });
  await assert.rejects(() => client.listLawPackages(), /independent_replication/);
  assert.throws(() => createGardenClient({ baseUrl: "https://garden.example", token: "short" }), /missing or too short/);
});
