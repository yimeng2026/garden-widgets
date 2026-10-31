import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewServer } from "../scripts/dev.mjs";

test("preview serves gallery, components and snapshots, but not arbitrary files", async (context) => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const gallery = await fetch(`${origin}/`);
  assert.equal(gallery.status, 200);
  assert.ok((await gallery.text()).includes("花园组件库"));
  const component = await fetch(`${origin}/widgets/complexity-lab/index.html`);
  assert.equal(component.status, 200);
  assert.ok((await component.text()).includes("复杂性与证据控制"));
  const snapshot = await fetch(`${origin}/snapshots/law-packages.json`);
  assert.equal(snapshot.status, 200);
  const arbitrary = await fetch(`${origin}/package.json`);
  assert.equal(arbitrary.status, 404);
});
