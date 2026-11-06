import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".tmp/browser-qa");
const EDGE = process.env.EDGE_BIN || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function until(check, message, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await check();
    if (result) return result;
    await pause(100);
  }
  throw new Error(`Timed out: ${message}`);
}

function stopTree(child) {
  if (!child || child.exitCode !== null || child.signalCode) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill(), 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      killer.once("error", () => child.kill());
    } else child.kill("SIGTERM");
  });
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.errors = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") this.errors.push(message.params.exceptionDetails);
    });
    await this.call("Page.enable");
    await this.call("Runtime.enable");
  }
  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async navigate(origin, widget = "") {
    await this.call("Page.navigate", { url: `${origin}/${widget}` });
    await until(async () => this.evaluate("document.readyState==='complete' && !!document.querySelector('#explorer-main, #lineage-main, .gallery')"), `load ${widget || "gallery"}`);
    await pause(100);
  }
  async screenshot(name) {
    const result = await this.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(result.data, "base64"));
  }
  close() { this.socket.close(); }
}

async function run() {
  if (!fs.existsSync(EDGE)) throw new Error("Edge not found; set EDGE_BIN to a local Chromium executable");
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(path.join(OUT, "report.json"), { force: true });
  const previewPort = await freePort();
  const profile = path.join(OUT, `profile-${process.pid}`);
  const previewLog = fs.openSync(path.join(OUT, "preview.log"), "w");
  const edgeLog = fs.openSync(path.join(OUT, "edge.log"), "w");
  const preview = spawn(process.execPath, ["scripts/dev.mjs", "--host", "127.0.0.1", "--port", String(previewPort)], { cwd: ROOT, stdio: ["ignore", previewLog, previewLog] });
  let edge;
  let cdp;
  const checks = [];
  const pass = (name, details = true) => { checks.push({ name, status: "passed", details }); };
  try {
    await until(async () => {
      try { return (await fetch(`http://127.0.0.1:${previewPort}/`)).ok; } catch { return false; }
    }, "preview server");
    edge = spawn(EDGE, [
      "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
      "--disable-component-update", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1280,900", "about:blank",
    ], { stdio: ["ignore", edgeLog, edgeLog] });
    const debugPort = await until(() => {
      const file = path.join(profile, "DevToolsActivePort");
      return fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8").split(/\r?\n/)[0]) : false;
    }, "Edge debugging port");
    const target = await until(async () => {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      return list.find((item) => item.type === "page");
    }, "Edge page target");
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    const origin = `http://127.0.0.1:${previewPort}`;
    await cdp.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const assertNoOverflow = async (name) => {
      const dimensions = await cdp.evaluate("({scroll:document.documentElement.scrollWidth,inner:window.innerWidth})");
      assert.ok(dimensions.scroll <= dimensions.inner, `${name} horizontal overflow: ${JSON.stringify(dimensions)}`);
    };
    const assertLocalResources = async () => {
      const resources = await cdp.evaluate("performance.getEntriesByType('resource').map(item=>item.name)");
      assert.ok(resources.every((url) => new URL(url).origin === origin), `Unexpected resource: ${resources.join(", ")}`);
    };

    await cdp.navigate(origin);
    assert.equal(await cdp.evaluate("document.querySelectorAll('.widget-card').length"), 11);
    await assertNoOverflow("gallery");
    await cdp.screenshot("01-gallery");
    pass("画廊显示 11 个组件");

    await cdp.navigate(origin, "widgets/paper-library/index.html");
    await cdp.evaluate("document.querySelector('[data-action=figures]').click()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.figure-card').length"), 5);
    await cdp.evaluate("document.querySelectorAll('.figure-card img').forEach(img=>img.loading='eager')");
    await until(() => cdp.evaluate("[...document.querySelectorAll('.figure-card img')].every(img=>img.complete&&img.naturalWidth>0)"), "paper figures");
    await cdp.screenshot("02-paper-figures");
    await cdp.evaluate("document.querySelector('[data-action=figures]').click();document.querySelector('#paper-query').value='独立重复';document.querySelector('[data-form=paper-search]').requestSubmit()");
    assert.ok(await cdp.evaluate("document.querySelectorAll('.search-result').length>0"));
    await cdp.evaluate("document.querySelector('.search-result').click()");
    assert.ok(await cdp.evaluate("document.querySelector('.paper-content').innerText.includes('独立')"));
    for (const index of [1, 2]) {
      await cdp.evaluate(`document.querySelector('#paper-select').value='${index}';document.querySelector('[data-form=paper-search]').requestSubmit();document.querySelector('[data-action=figures]').click();document.querySelectorAll('.figure-card img').forEach(img=>img.loading='eager')`);
      assert.equal(await cdp.evaluate("document.querySelectorAll('.figure-card').length"), 4);
      await until(() => cdp.evaluate("[...document.querySelectorAll('.figure-card img')].every(img=>img.complete&&img.naturalWidth>0)"), `paper ${index} figures`);
    }
    await assertNoOverflow("papers");
    await assertLocalResources();
    pass("三篇论文章节检索与 13 幅图件加载");

    await cdp.navigate(origin, "widgets/ca-activity/index.html");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.activity-row').length"), 6);
    assert.equal(await cdp.evaluate("document.querySelectorAll('.record-card').length"), 6);
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('水溶性 4-sulfamoylphenylthioureas')"));
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('EMATE—CA II 复合物晶体结构')"));
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('Curated by ChEMBL')"));
    await cdp.screenshot("03-activity");
    await cdp.evaluate("document.querySelector('#matched-only').click()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.activity-row').length"), 1);
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('20.8333')"));
    await assertNoOverflow("activity");
    pass("六组活性比值、同方法筛选与文档方法分层");

    await cdp.navigate(origin, "widgets/method-lineage/index.html");
    assert.equal(await cdp.evaluate("document.querySelectorAll('[data-document]').length"), 6);
    assert.equal(await cdp.evaluate("document.querySelectorAll('[data-evidence]').length"), 8);
    assert.equal(await cdp.evaluate("document.querySelectorAll('.source').length"), 8);
    await cdp.evaluate("document.querySelector('[data-filter=context]').click()");
    assert.ok(await cdp.evaluate("[...document.querySelectorAll('[data-evidence]')].filter(node=>node.getAttribute('opacity')==='0.14').length===6"));
    await cdp.screenshot("03b-method-lineage");
    await cdp.evaluate("document.querySelector('[data-view=matrix]').click()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.data-table tbody tr').length"), 15);
    assert.ok(await cdp.evaluate("document.querySelector('#lineage-main').innerText.includes('信息不足')"));
    await assertNoOverflow("method lineage");
    pass("六篇方法血缘、15 组信息不足与外部上下文筛选");

    await cdp.navigate(origin, "widgets/structure-control/index.html");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.diff-list li').length"), 3);
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('260/259')"));
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('exact_wildtype_replication = false')"));
    await cdp.screenshot("04-structure");
    await assertNoOverflow("structure");
    pass("三类结构差异与 260／259 边界");

    await cdp.navigate(origin, "widgets/project-atlas/index.html");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 12);
    await cdp.evaluate("document.querySelector('#project-query').value='PySINDy';document.querySelector('[data-form=project-filter]').requestSubmit()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 3);
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('PySINDy')"));
    await cdp.evaluate("document.querySelector('#project-query').value='';document.querySelector('#project-status').value='verified';document.querySelector('[data-form=project-filter]').requestSubmit()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 4);
    await cdp.screenshot("05-projects");
    await assertNoOverflow("projects");
    pass("88 项目录的关键词与已验证状态筛选");

    await cdp.navigate(origin, "widgets/validation-workbench/index.html");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.record-button').length"), 22);
    await cdp.evaluate("document.querySelector('[data-record=structural-control]').click()");
    assert.ok(await cdp.evaluate("document.querySelector('.record-detail').innerText.includes('analyze_structural_control.py')"));
    await cdp.screenshot("06-validation");
    await cdp.evaluate("document.querySelector('#record-evidence').value='upstream';document.querySelector('[data-form=record-filter]').requestSubmit()");
    assert.ok(await cdp.evaluate("document.querySelectorAll('.record-button').length>0"));
    assert.ok(await cdp.evaluate("[...document.querySelectorAll('.record-button')].every(button=>button.getAttribute('aria-pressed')==='false'||button.dataset.record)"));
    await assertNoOverflow("validation");
    pass("22 份快照、重放脚本与上游记录筛选");

    await cdp.navigate(origin, "widgets/generation-budget/index.html");
    await cdp.evaluate("document.querySelector('#budget-target').value='100000000';document.querySelector('[data-form=budget]').requestSubmit()");
    const budgetText = await cdp.evaluate("document.querySelector('#explorer-main').innerText");
    assert.ok(budgetText.includes("8,139"), budgetText);
    assert.ok(budgetText.includes("24,417"));
    assert.ok(budgetText.includes("256"));
    await cdp.screenshot("07-budget");
    await cdp.evaluate("document.querySelector('#budget-total').value='1000';document.querySelector('[data-form=budget]').requestSubmit()");
    assert.ok(await cdp.evaluate("document.querySelector('#budget-result').innerText.includes('不能超过累计总预算')"));
    await assertNoOverflow("budget");
    pass("1 亿目标分为 8139 段及非法预算拦截");

    await cdp.navigate(origin, "widgets/reference-audit/index.html");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 12);
    await cdp.evaluate("document.querySelector('#reference-paper').value='03';document.querySelector('#reference-status').value='metadata_matched';document.querySelector('[data-form=reference-filter]').requestSubmit()");
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('匹配 13 条')"));
    await cdp.evaluate("document.querySelector('#reference-status').value='all';document.querySelector('#reference-query').value='Roache';document.querySelector('[data-form=reference-filter]').requestSubmit()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 1);
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('Hermosa')"));
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('正文编号')"));
    await cdp.evaluate("document.querySelector('.details summary').click()");
    assert.ok(await cdp.evaluate("document.querySelector('#explorer-main').innerText.includes('覆盖 19/19')"));
    await cdp.evaluate("document.querySelector('#reference-query').value='FAIR';document.querySelector('#reference-fulltext').value='full_text_checked';document.querySelector('[data-form=reference-filter]').requestSubmit()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 1);
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('R1.2.')"));
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('PDF 第 4 页')"));
    await cdp.screenshot("09-references");
    await cdp.evaluate("document.querySelector('#reference-paper').value='01';document.querySelector('#reference-query').value='';document.querySelector('#reference-fulltext').value='abstract_checked';document.querySelector('[data-form=reference-filter]').requestSubmit()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 1);
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('仅摘要，非全文')"));
    await cdp.evaluate("document.querySelector('#reference-paper').value='02';document.querySelector('#reference-query').value='EMATE';document.querySelector('#reference-fulltext').value='partial_text_checked';document.querySelector('[data-form=reference-filter]').requestSubmit()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('.project-card').length"), 1);
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('正文片段已核（非全文）')"));
    assert.ok(await cdp.evaluate("document.querySelector('.project-card').innerText.includes('Crystallography 片段')"));
    await assertNoOverflow("references");
    pass("39 条来源、全文／片段／摘要分层与引用覆盖");

    await cdp.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    for (const widget of ["paper-library", "ca-activity", "method-lineage", "structure-control", "project-atlas", "validation-workbench", "generation-budget", "reference-audit"]) {
      await cdp.navigate(origin, `widgets/${widget}/index.html`);
      await assertNoOverflow(`${widget} mobile`);
    }
    await cdp.screenshot("08-mobile-budget");
    pass("八个新增组件在 390 px 宽度下无横向溢出");
    assert.deepEqual(cdp.errors, []);
    await assertLocalResources();
    pass("浏览器无脚本异常，资源均为本地来源");
    const report = { ok: true, checks, generatedAt: new Date().toISOString(), previewStopped: false, browserStopped: false };
    fs.writeFileSync(path.join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  } finally {
    if (cdp) cdp.close();
    await stopTree(edge);
    await stopTree(preview);
    fs.closeSync(previewLog);
    fs.closeSync(edgeLog);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    const file = path.join(OUT, "report.json");
    if (fs.existsSync(file)) {
      const report = JSON.parse(fs.readFileSync(file, "utf8"));
      report.previewStopped = preview.exitCode !== null || preview.signalCode !== null;
      report.browserStopped = !edge || edge.exitCode !== null || edge.signalCode !== null;
      fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify(report, null, 2));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
