# Kryptic

Kryptic is a private, browser-based vault for notes, journal entries, and code snippets. It has no account or application backend: entries are encrypted with Web Crypto and stored in the browser's IndexedDB.

**Live app:** [kryptic-5kk.pages.dev](https://kryptic-5kk.pages.dev)  
**Editable UI design:** [Figma](https://www.figma.com/design/33y6LlgbBzbU7D8u75l0eu)  
**Current version:** `2.0.0-rc.1`

## Features

- Password-protected vault with encrypted local storage, autosave, manual lock, and inactivity lock.
- Notes, journal entries, and code snippets with tags, favorites, trash, and ordinary search.
- Search filters for tag, type, favorite status, and date; `Ctrl+K` command palette.
- Local semantic search on desktop Chrome and Edge. The model downloads on first use; inference runs in a browser worker. Mobile retains the core vault and ordinary search.
- Encrypted attachments (up to five per entry, 2 MB each) and up to 20 manual revision snapshots per entry.
- Encrypted JSON backup and restore, password change, and deliberate plaintext Markdown, JSON, or PDF export.
- Installable PWA shell with a service worker that caches the core static files.

## Run locally

Requires Node.js and npm.

```sh
npm ci
npm start
```

Open the local address printed by the development server. To verify and create a deployable static build:

```sh
CI=true npm test -- --watch=false
CI=true npm run build
```

Deploy the generated `build/` directory to a static host. The current deployment uses Cloudflare Pages; its security headers are defined in `public/_headers`.

## Data and recovery

Kryptic cannot recover a forgotten password. Browser storage may be cleared, so download and safely keep an encrypted backup, then test restoration in a separate browser profile. Plaintext exports are unencrypted files. The semantic model requires an initial network download from Hugging Face; vault text stays in the browser during inference.

## Release status

The live `2.0.0-rc.1` build passed 11 Jest tests, a CI production build, and browser checks for core vault flows, advanced search, revisions, persistence, and desktop semantic search. Live HTTPS, security headers, and service-worker assets were checked. Offline app-shell behavior and actual mobile user-agent behavior have not been verified. See [the security review](docs/security-review.md) for dependency findings and the scope of these checks.

The original [v0.1–v2.0 plan](local_vault_project_plan.txt) and [implementation checkpoint](docs/automation-checkpoint.json) remain available as project records.
