# Kryptic v2.0 release security review

Checked 1 October 2026 against the `2.0.0-rc.1` static Cloudflare Pages build.

## Data and hosting boundary

The Pages deployment contains only the `build/` directory. Vault entries stay in browser IndexedDB, encrypted with Web Crypto. The Pages project has no Functions or environment variables. The ONNX loader and WASM binary are served from Kryptic's own origin; model files still require an initial fetch from Hugging Face and are cached by the browser. The CSP permits scripts from the site itself and WebAssembly evaluation, and permits network fetches from Hugging Face and its file hosts.

## Dependency audit

`npm audit --omit=dev` reports two high findings through `sharp@0.34.5`, a Node dependency of `@huggingface/transformers@3.8.1`. The reported libvips and libheif vulnerabilities concern server-side image processing. Kryptic's static Pages deployment has no Node runtime, accepts no images on a server, and neither `sharp`, `libvips`, nor `onnxruntime-node` appears in shipped JavaScript. The archive uploaded to Pages contains only `build/` assets. This is a deployment-scope assessment, not a claim that the package is fixed. Reassess before adding server-side image processing or upgrading Transformers.

The `fflate` finding was resolved by pinning the transitive package to `0.8.3`. Build and test dependencies are classified as development dependencies; their advisories do not represent browser runtime code, but remain a maintenance task. `react-scripts` still emits an upstream `import.meta` warning from Transformers. The build wrapper permits only that exact warning and fails on any other compilation warning, including under `CI=true`. Updating the build toolchain or upstream package should clear the warning itself.

## Observed checks

- Eleven Jest tests pass, including encryption, tamper rejection, backup restore, revisions, search filters, the command palette, and stale semantic results.
- Production build and postbuild service worker generation succeed with source maps disabled.
- Live HTTPS root, service worker, ONNX module, and WASM responses return 200 with expected MIME types. CSP, HSTS, no-referrer, and nosniff headers are present.
- On an isolated deployment origin, note save, tags, favorites, advanced search, command palette, revision restore, and reload/unlock persistence pass. A desktop semantic query returns a related note that ordinary search excludes.
- At a 390 px viewport, the page has no horizontal overflow; the navigation row scrolls within itself.
- Offline app-shell behavior and actual mobile user-agent behavior remain release checks.
