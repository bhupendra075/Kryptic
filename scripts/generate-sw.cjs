const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const build = path.join(__dirname, "..", "build");
const onnxSource = path.join(__dirname, "..", "node_modules", "@huggingface", "transformers", "dist");
const onnxBuild = path.join(build, "onnx");
const onnxFiles = ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"];
fs.mkdirSync(onnxBuild, { recursive: true });
for (const file of onnxFiles) fs.copyFileSync(path.join(onnxSource, file), path.join(onnxBuild, file));
const manifest = JSON.parse(fs.readFileSync(path.join(build, "asset-manifest.json"), "utf8"));
const files = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png", ...manifest.entrypoints.map((file) => `/${file}`)]
  .filter((value) => typeof value === "string" && value.startsWith("/") && !value.endsWith(".map"));
const assets = [...new Set(files)];
const cacheable = [...new Set([...onnxFiles.map((file) => `/onnx/${file}`), ...Object.values(manifest.files)])]
  .filter((value) => typeof value === "string" && value.startsWith("/") && !value.endsWith(".map"));
const hash = crypto.createHash("sha256").update(JSON.stringify({ assets, cacheable }));
for (const file of onnxFiles) hash.update(fs.readFileSync(path.join(onnxBuild, file)));
const revision = hash.digest("hex").slice(0, 12);
const source = `const CACHE = "kryptic-shell-${revision}";
const ASSETS = ${JSON.stringify(assets)};
const CACHEABLE = ${JSON.stringify(cacheable)};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("kryptic-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }
  if (CACHEABLE.includes(new URL(request.url).pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
  }
});
`;
fs.writeFileSync(path.join(build, "sw.js"), source);
