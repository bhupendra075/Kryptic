export function createSemanticWorker() {
  return new Worker(new URL("./semantic.worker.js", import.meta.url));
}
