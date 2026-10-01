import React, { useEffect, useMemo, useRef, useState } from "react";
import { changeVaultPassword, createEncryptedBackup, createVault, deleteItem, hasVault, loadItems, openVaultDb, restoreEncryptedBackup, saveItem, unlockVault } from "./vault";
import { exportFilename, exportJson, exportMarkdown, exportPdf } from "./exports";
import { restoreRevision, saveRevision } from "./revisions";
import { supportsSemanticSearch } from "./semantic";
import { createSemanticWorker } from "./semanticClient";
import { matchesSearch, parseSearch } from "./search";
import "./App.css";

const sections = ["All entries", "Notes", "Journal", "Snippets", "Favorites", "Trash", "Settings"];
const labels = { note: "Note", journal: "Journal", snippet: "Snippet" };
const semanticFallback = "Semantic search could not load. Check your connection and try again. Ordinary search is active.";

function App() {
  const [db, setDb] = useState(null);
  const [exists, setExists] = useState(false);
  const [key, setKey] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [section, setSection] = useState("All entries");
  const [query, setQuery] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const [semanticIds, setSemanticIds] = useState(null);
  const [semanticMessage, setSemanticMessage] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const itemsRef = useRef([]);
  const saveTimer = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const pending = useRef(new Map());
  const flushRef = useRef(null);
  const lockRef = useRef(null);
  const semanticWorker = useRef(null);
  const semanticRequest = useRef(0);
  const semanticEligible = supportsSemanticSearch(navigator.userAgent, navigator.userAgentData?.mobile);

  function replaceItems(next) { itemsRef.current = next; setItems(next); }

  function writeItem(item) {
    pending.current.set(item.id, item);
    setMessage("Saving…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushPending, 450);
  }

  function flushPending() {
    clearTimeout(saveTimer.current);
    const batch = [...pending.current.values()];
    pending.current.clear();
    if (!batch.length) return saveQueue.current.then((result) => result !== false);
    saveQueue.current = saveQueue.current.then(async () => {
      for (const item of batch) await saveItem(db, key, item);
      setMessage("Saved on this device");
      return true;
    }).catch(() => {
      for (const item of batch) {
        const latest = itemsRef.current.find((entry) => entry.id === item.id);
        if (latest && !pending.current.has(item.id)) pending.current.set(item.id, latest);
      }
      setMessage("Save failed. Retry before closing.");
      return false;
    });
    return saveQueue.current;
  }
  flushRef.current = flushPending;

  useEffect(() => {
    let active = true;
    openVaultDb().then(async (database) => {
      if (!active) { database.close(); return; }
      setDb(database);
      setExists(await hasVault(database));
    }).catch(() => setMessage("Local storage is unavailable in this browser."));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!db || !key) return;
    const flushOnHide = () => { if (document.visibilityState === "hidden") flushRef.current(); };
    document.addEventListener("visibilitychange", flushOnHide);
    return () => document.removeEventListener("visibilitychange", flushOnHide);
  }, [db, key]);

  useEffect(() => {
    if (!key) return;
    const timeoutMs = 10 * 60 * 1000;
    let lastActivity = Date.now();
    let timer;
    const check = async () => {
      clearTimeout(timer);
      if (Date.now() - lastActivity >= timeoutMs) {
        if (!await lockRef.current()) timer = setTimeout(check, 60 * 1000);
      } else timer = setTimeout(check, timeoutMs - (Date.now() - lastActivity));
    };
    const activity = () => { lastActivity = Date.now(); clearTimeout(timer); timer = setTimeout(check, timeoutMs); };
    timer = setTimeout(check, timeoutMs);
    document.addEventListener("pointerdown", activity);
    document.addEventListener("keydown", activity);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", activity);
      document.removeEventListener("keydown", activity);
      document.removeEventListener("visibilitychange", check);
    };
  }, [key]);

  useEffect(() => {
    if (!key || !semanticEnabled || !semanticEligible) return;
    const worker = createSemanticWorker();
    semanticWorker.current = worker;
    worker.onmessage = ({ data }) => {
      if (data.requestId && data.requestId !== semanticRequest.current) return;
      if (data.type === "results") { setSemanticIds(data.ids); setSemanticMessage(`Related results (${data.ids.length})`); }
      if (data.type === "loading") setSemanticMessage("Loading local search model…");
      if (data.type === "indexing") setSemanticMessage(`Indexing on this device: ${data.done}/${data.total}`);
      if (data.type === "error") { setSemanticEnabled(false); setSemanticMessage(semanticFallback); }
    };
    worker.onerror = () => { setSemanticEnabled(false); setSemanticMessage(semanticFallback); };
    return () => { worker.terminate(); semanticWorker.current = null; };
  }, [key, semanticEnabled, semanticEligible]);

  useEffect(() => {
    if (!key) { setPaletteOpen(false); return; }
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setPaletteQuery(""); setPaletteOpen(true);
      } else if (event.key === "Escape") setPaletteOpen(false);
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [key]);

  useEffect(() => {
    const parsed = parseSearch(query);
    const requestId = ++semanticRequest.current;
    if (!key || !semanticEnabled || !parsed.text) { setSemanticIds(null); return; }
    setSemanticIds(null);
    const timer = setTimeout(() => semanticWorker.current?.postMessage({
      requestId, query: parsed.text,
      items: items.filter((item) => !item.deleted).map(({ id, title, body, tags, updatedAt }) => ({ id, title, body, tags, updatedAt })),
    }), 350);
    return () => clearTimeout(timer);
  }, [key, semanticEnabled, query, items]);

  const visible = useMemo(() => items.filter((item) => {
    if (section === "Trash") return item.deleted;
    if (item.deleted) return false;
    if (section === "Favorites" && !item.favorite) return false;
    if (section === "Notes" && item.type !== "note") return false;
    if (section === "Journal" && item.type !== "journal") return false;
    if (section === "Snippets" && item.type !== "snippet") return false;
    const parsed = parseSearch(query);
    if (!matchesSearch(item, parsed, Boolean(semanticEnabled && semanticIds))) return false;
    return !semanticEnabled || !semanticIds || semanticIds.includes(item.id);
  }).sort((a, b) => semanticEnabled && semanticIds ? semanticIds.indexOf(a.id) - semanticIds.indexOf(b.id) : b.updatedAt - a.updatedAt), [items, section, query, semanticEnabled, semanticIds]);

  async function authenticate(event) {
    event.preventDefault();
    if (!db || password.length < 8) { setMessage("Use a password of at least 8 characters."); return; }
    setBusy(true);
    try {
      const vaultKey = exists ? await unlockVault(db, password) : await createVault(db, password);
      const loaded = await loadItems(db, vaultKey);
      setKey(vaultKey); replaceItems(loaded); setExists(true); setPassword(""); setMessage("");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function lock() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!await flushPending()) return false;
    setKey(null); replaceItems([]); setSelected(null); setQuery(""); setSection("All entries"); setOldPassword(""); setNewPassword(""); setPasswordMessage("");
    return true;
  }
  lockRef.current = lock;

  async function changePassword(event) {
    event.preventDefault();
    if (!await flushPending()) { setPasswordMessage("Save entries before changing your password."); return; }
    setBusy(true); setPasswordMessage("");
    try {
      await changeVaultPassword(db, oldPassword, newPassword);
      setOldPassword(""); setNewPassword("");
      setPasswordMessage("Password changed. Use the new password next time you unlock.");
    } catch (error) { setPasswordMessage(error.message); }
    finally { setBusy(false); }
  }

  async function downloadBackup() {
    if (!await flushPending()) { setBackupMessage("Save entries before creating a backup."); return; }
    setBusy(true); setBackupMessage("");
    try {
      const json = await createEncryptedBackup(db, key);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `kryptic-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
      setBackupMessage("Encrypted backup downloaded. Keep the file and password safe.");
    } catch (error) { setBackupMessage(error.message); }
    finally { setBusy(false); }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("Backup file is too large.");
      await restoreEncryptedBackup(db, await file.text(), password);
      setExists(true); setPassword(""); setMessage("Backup restored. Unlock with its password.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function exportEntry(item, format) {
    if (!window.confirm("This export will be unencrypted. Continue?")) return;
    setBusy(true);
    try {
      if (!await flushPending()) throw new Error("Save entries before exporting.");
      const content = format === "pdf" ? await exportPdf(item) : format === "json" ? exportJson(item) : exportMarkdown(item);
      const type = format === "pdf" ? "application/pdf" : format === "json" ? "application/json" : "text/markdown";
      const blob = content instanceof Blob ? content : new Blob([content], { type: `${type};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = exportFilename(item, format === "markdown" ? "md" : format); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
      setMessage(`${format.toUpperCase()} export downloaded (unencrypted).`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function addAttachment(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const itemId = selected;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Attachment limit is 2 MB per file.");
      const item = itemsRef.current.find((entry) => entry.id === itemId);
      if (!item) throw new Error("Select an entry before attaching a file.");
      if ((item.attachments || []).length >= 5) throw new Error("Each entry can hold up to 5 attachments.");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
        reader.onerror = () => reject(new Error("Could not read attachment."));
        reader.readAsDataURL(file);
      });
      const latest = itemsRef.current.find((entry) => entry.id === itemId);
      if (!latest) throw new Error("Entry is no longer available.");
      const attachment = { id: crypto.randomUUID(), name: file.name.slice(0, 160), type: file.type || "application/octet-stream", size: file.size, data };
      persist({ ...latest, attachments: [...(latest.attachments || []), attachment], updatedAt: Date.now() });
      await flushPending();
    } catch (error) { setMessage(error.message); }
    finally { event.target.value = ""; }
  }

  function downloadAttachment(attachment) {
    try {
      const binary = atob(attachment.data);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: attachment.type }));
      const link = document.createElement("a");
      link.href = url; link.download = attachment.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    } catch { setMessage("Attachment is damaged and cannot be downloaded."); }
  }

  function removeAttachment(attachmentId) {
    if (!window.confirm("Remove this attachment from the entry?")) return;
    const item = itemsRef.current.find((entry) => entry.id === selected);
    if (item) persist({ ...item, attachments: (item.attachments || []).filter((attachment) => attachment.id !== attachmentId), updatedAt: Date.now() });
  }

  async function checkpointRevision() {
    if (!await flushPending()) return;
    const item = itemsRef.current.find((entry) => entry.id === selected);
    if (!item) return;
    const next = saveRevision(item, crypto.randomUUID());
    if (next === item) { setMessage("Current version is already saved."); return; }
    persist(next);
    await flushPending();
  }

  async function restoreSavedRevision(revisionId) {
    if (!window.confirm("Restore this version? Your current text will be saved as a version first.")) return;
    if (!await flushPending()) return;
    const item = itemsRef.current.find((entry) => entry.id === selected);
    if (!item) return;
    try { persist(restoreRevision(item, revisionId, crypto.randomUUID())); await flushPending(); }
    catch (error) { setMessage(error.message); }
  }

  function persist(item) {
    replaceItems([item, ...itemsRef.current.filter((entry) => entry.id !== item.id)]);
    writeItem(item);
  }

  async function add(type) {
    const now = Date.now();
    const item = { id: crypto.randomUUID(), type, title: type === "journal" ? new Date().toLocaleDateString() : "Untitled", body: "", tags: [], favorite: false, deleted: false, createdAt: now, updatedAt: now };
    persist(item); setSelected(item.id); setSection("All entries");
  }

  async function update(patch) {
    const item = itemsRef.current.find((entry) => entry.id === selected);
    if (item) persist({ ...item, ...patch, updatedAt: Date.now() });
  }

  async function remove() {
    const item = itemsRef.current.find((entry) => entry.id === selected);
    if (!item) return;
    if (item.deleted) {
      if (!window.confirm("Permanently delete this entry?")) return;
      try { if (!await flushPending()) return; await deleteItem(db, item.id); }
      catch { setMessage("Delete failed. Retry before closing."); return; }
      replaceItems(itemsRef.current.filter((entry) => entry.id !== item.id));
      setSelected(null);
    } else await update({ deleted: true });
  }

  const current = items.find((item) => item.id === selected);
  const commands = [
    ...["All entries", "Notes", "Journal", "Snippets", "Favorites", "Trash", "Settings"].map((name) => ({ name: `Go to ${name}`, run: () => { setSection(name); setSelected(null); } })),
    ...["note", "journal", "snippet"].map((type) => ({ name: `New ${type}`, run: () => add(type) })),
    { name: "Lock vault", run: lock },
  ];
  const matchingCommands = commands.filter((command) => command.name.toLowerCase().includes(paletteQuery.toLowerCase()));

  if (!key) return <main className="welcome"><div className="welcome-mark">✳</div><p className="eyebrow">PRIVATE BY DESIGN</p><h1>Kryptic</h1><p className="welcome-copy">A quiet place for your notes, journal, and code. Your vault stays encrypted on this device.</p><form onSubmit={authenticate}><label htmlFor="password">{exists ? "Unlock your vault" : "Create a vault password"}</label><input id="password" type="password" autoComplete={exists ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /><button disabled={busy || !db}>{busy ? "Working…" : exists ? "Unlock vault" : "Create vault"}</button></form>{!exists && <label className="restore-field">Restore an encrypted backup <input type="file" accept="application/json,.json" disabled={busy || !db || password.length < 8} onChange={restoreBackup} /></label>}<p className="status" role="status">{message}</p><small>No account. No sync. Keep a copy of your password.</small></main>;

  return <div className="vault-app">{paletteOpen && <div className="palette-backdrop" onClick={() => setPaletteOpen(false)}><div className="palette" role="dialog" aria-label="Command palette" onClick={(event) => event.stopPropagation()}><input autoFocus aria-label="Find a command" placeholder="Search commands…" value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && matchingCommands[0]) { setPaletteOpen(false); matchingCommands[0].run(); } }} />{matchingCommands.map((command) => <button key={command.name} onClick={() => { setPaletteOpen(false); command.run(); }}>{command.name}</button>)}</div></div>}<aside className="sidebar"><div className="brand"><span className="brand-icon">✳</span><span>Kryptic</span></div><p className="nav-heading">WORKSPACE</p><nav aria-label="Vault sections">{sections.map((name) => <button key={name} className={section === name ? "active" : ""} onClick={() => { setSection(name); setSelected(null); }}>{name}</button>)}</nav><div className="sidebar-bottom"><span>Encrypted on this device</span><button onClick={lock}>Lock vault ↗</button></div></aside><main className="workspace"><header className="topbar"><div><span className="eyebrow">YOUR SPACE</span><h1>{section}</h1></div><button className="command-button" onClick={() => { setPaletteQuery(""); setPaletteOpen(true); }}>Ctrl+K Commands</button><button className="lock-mobile" onClick={lock}>Lock</button></header>{section === "Settings" ? <section className="settings"><h2>Change vault password</h2><p>Your entries stay encrypted on this device. Keep your new password safe; it cannot be recovered.</p><form onSubmit={changePassword}><label htmlFor="old-password">Current password</label><input id="old-password" type="password" autoComplete="current-password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required /><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /><button disabled={busy}>Change password</button></form><p role="status">{passwordMessage}</p><h2>Encrypted backup</h2><p>Download a password-protected copy of this vault. Restore it in a browser without a vault.</p><button disabled={busy} onClick={downloadBackup}>Download encrypted backup</button><p role="status">{backupMessage}</p></section> : <><div className="toolbar"><label className="search"><span>⌕</span><input aria-label="Search entries" placeholder="Search your vault…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{semanticEligible && <button className={`semantic-toggle ${semanticEnabled ? "active" : ""}`} onClick={() => { setSemanticEnabled((value) => !value); setSemanticIds(null); setSemanticMessage(""); }} aria-pressed={semanticEnabled}>Semantic search</button>}{semanticMessage && <span className="semantic-status" role="status">{semanticMessage}</span>}<div className="new-actions"><button onClick={() => add("note")}>+ Note</button><button onClick={() => add("journal")}>+ Journal</button><button onClick={() => add("snippet")}>+ Snippet</button></div></div><div className="content"><section className="item-list" aria-label="Entries">{visible.length ? visible.map((item) => <button key={item.id} className={`item-card ${selected === item.id ? "selected" : ""}`} onClick={() => setSelected(item.id)}><span className="item-type">{labels[item.type]}</span><strong>{item.title || "Untitled"}</strong><span className="item-excerpt">{item.body || "Start writing…"}</span>{item.tags?.length > 0 && <span className="item-tags">{item.tags.map((tag) => `#${tag}`).join("  ")}</span>}<time>{new Date(item.updatedAt).toLocaleDateString()}</time></button>) : <div className="empty-list">Nothing here yet.<br />Create an entry to begin.</div>}</section><section className="editor" aria-label="Entry editor">{current ? <><div className="editor-head"><span className="item-type">{labels[current.type]}</span><div><button onClick={() => update({ favorite: !current.favorite })} aria-label={current.favorite ? "Remove favorite" : "Add favorite"}>{current.favorite ? "★" : "☆"}</button>{current.deleted && <button onClick={() => update({ deleted: false })}>Restore</button>}<button onClick={remove}>{current.deleted ? "Delete forever" : "Move to trash"}</button></div></div><input className="title-input" aria-label="Entry title" value={current.title} onChange={(event) => { const value = event.target.value; persist({ ...itemsRef.current.find((item) => item.id === current.id), title: value, updatedAt: Date.now() }); }} onBlur={flushPending} /><label className="tag-field" htmlFor="entry-tags">Tags <input id="entry-tags" key={current.id} aria-label="Entry tags" placeholder="Separate tags with commas" defaultValue={(current.tags || []).join(", ")} onBlur={(event) => { const tags = [...new Set(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20); update({ tags }); event.target.value = tags.join(", "); flushPending(); }} /></label><textarea aria-label="Entry content" placeholder="Start writing…" value={current.body} onChange={(event) => { const value = event.target.value; persist({ ...itemsRef.current.find((item) => item.id === current.id), body: value, updatedAt: Date.now() }); }} onBlur={flushPending} /><div className="attachments"><label>Attachments <input type="file" aria-label="Add attachment" onChange={addAttachment} /></label>{(current.attachments || []).map((attachment) => <div key={attachment.id} className="attachment-row"><button onClick={() => downloadAttachment(attachment)}>{attachment.name} ({Math.ceil(attachment.size / 1024)} KB)</button><button onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`}>Remove</button></div>)}</div><div className="revisions"><div className="revision-heading"><strong>Versions</strong><button onClick={checkpointRevision}>Save version</button></div>{(current.revisions || []).map((revision) => <div key={revision.id} className="revision-row"><span>{new Date(revision.at).toLocaleString()} · {revision.title || "Untitled"}</span><button onClick={() => restoreSavedRevision(revision.id)}>Restore</button></div>)}</div><div className="editor-foot"><span>{new Date(current.updatedAt).toLocaleString()}</span><div className="export-actions" aria-label="Export entry"><button disabled={busy} onClick={() => exportEntry(current, "markdown")}>Markdown</button><button disabled={busy} onClick={() => exportEntry(current, "json")}>JSON</button><button disabled={busy} onClick={() => exportEntry(current, "pdf")}>PDF</button></div><span role="status">{message}</span></div></> : <div className="editor-empty"><span>✳</span><h2>Your thoughts belong here.</h2><p>Choose an entry or create a new one.</p></div>}</section></div></>}</main></div>;
}

export default App;

