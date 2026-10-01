const { spawnSync } = require("child_process");

// Transformers 3.8.1 intentionally reads Object(import.meta) in its Node-only
// branch. CRA's Webpack warns about it even though that branch is unused in
// this browser build. Keep CI strict for every other compilation warning.
const knownWarning = `Critical dependency: 'import.meta' cannot be used as a standalone expression. For static analysis, its properties must be accessed directly (e.g., 'import.meta.url') or through destructuring.

Search for the keywords to learn more about each warning.
To ignore, add // eslint-disable-next-line to the line before.`;
const result = spawnSync(process.execPath, [require.resolve("react-scripts/bin/react-scripts.js"), "build"], {
  env: { ...process.env, CI: "false" },
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.error || result.status !== 0) {
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  process.exit(result.status || 1);
}
const output = (result.stdout || "").replace(/\x1b\[[0-9;]*m/g, "").replace(/\r\n/g, "\n");
const warnings = output.match(/Compiled with warnings\.\s*([\s\S]*?)\s*File sizes after gzip:/)?.[1]?.trim();
if (warnings && warnings !== knownWarning) {
  process.stderr.write("Unexpected production build warning; release build failed.\n");
  process.exit(1);
}
