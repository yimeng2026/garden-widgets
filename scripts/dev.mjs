import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

export function resolvePreviewPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://preview.local").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Path escapes preview root");
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return path.join(resolved, "index.html");
  return resolved;
}

export function createPreviewServer() {
  return http.createServer((request, response) => {
    try {
      const filename = resolvePreviewPath(request.url);
      const allowed = filename.endsWith("index.html") || filename.includes(`${path.sep}docs${path.sep}`) || filename.includes(`${path.sep}snapshots${path.sep}`) || filename.endsWith("widgets/manifest.json");
      if (!allowed || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "content-type": types[path.extname(filename)] || "application/octet-stream", "x-content-type-options": "nosniff" });
      fs.createReadStream(filename).pipe(response);
    } catch {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Bad request");
    }
  });
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const host = option(args, "--host", "127.0.0.1");
  const port = Number(option(args, "--port", "7100"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid --port");
  const server = createPreviewServer();
  server.listen(port, host, () => console.log(`Garden widgets preview: http://${host}:${port}/`));
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
