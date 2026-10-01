/* eslint-disable no-restricted-globals */
import { env, pipeline } from "@huggingface/transformers";
import { rankSemantic } from "./semantic";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/onnx/`;
env.backends.onnx.wasm.numThreads = 1;

let extractorPromise;
let latestRequest = 0;
let queue = Promise.resolve();
const vectors = new Map();

async function extractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "q8",
      progress_callback: (progress) => {
        if (progress.status === "progress" && Number.isFinite(progress.progress)) {
          self.postMessage({ type: "progress", percent: Math.round(progress.progress) });
        }
      },
    });
  }
  return extractorPromise;
}

async function embed(model, texts) {
  const tensor = await model(texts, { pooling: "mean", normalize: true });
  const width = tensor.dims[tensor.dims.length - 1];
  return texts.map((_, index) => Array.from(tensor.data.slice(index * width, (index + 1) * width)));
}

async function search({ requestId, query, items }) {
  self.postMessage({ type: "loading", requestId });
  const model = await extractor();
  if (requestId !== latestRequest) return;
  const active = new Set(items.map((item) => item.id));
  for (const id of vectors.keys()) if (!active.has(id)) vectors.delete(id);
  const fresh = items.filter((item) => vectors.get(item.id)?.updatedAt !== item.updatedAt);
  for (let offset = 0; offset < fresh.length; offset += 8) {
    if (requestId !== latestRequest) return;
    const batch = fresh.slice(offset, offset + 8);
    const encoded = await embed(model, batch.map((item) => `${item.title || ""}. ${(item.tags || []).join(" ")}. ${item.body || ""}`.slice(0, 2000)));
    batch.forEach((item, index) => vectors.set(item.id, { updatedAt: item.updatedAt, vector: encoded[index] }));
    self.postMessage({ type: "indexing", requestId, done: Math.min(offset + batch.length, fresh.length), total: fresh.length });
  }
  if (requestId !== latestRequest) return;
  const [queryVector] = await embed(model, [query]);
  const ranked = rankSemantic(queryVector, items.map((item) => ({ id: item.id, vector: vectors.get(item.id).vector })));
  self.postMessage({ type: "results", requestId, ids: ranked.slice(0, 50).map((row) => row.id) });
}

self.onmessage = ({ data }) => {
  latestRequest = data.requestId;
  queue = queue.then(() => search(data)).catch((error) => {
    self.postMessage({ type: "error", requestId: data.requestId, message: error?.message || "Semantic search unavailable." });
  });
};
