const DB_NAME = "kryptic-vault";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openVaultDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("config", { keyPath: "id" });
      req.result.createObjectStore("items", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const get = (db, store, id) => request(db.transaction(store).objectStore(store).get(id));
function writeTransaction(db, store, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Vault write failed."));
    tx.onabort = () => reject(tx.error || new Error("Vault write failed."));
    operation(tx.objectStore(store));
  });
}
const put = (db, store, value) => writeTransaction(db, store, (objectStore) => objectStore.put(value));

export async function hasVault(db) {
  return Boolean(await get(db, "config", "vault"));
}

async function wrappingKey(password, salt) {
  const source = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    source, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

export async function createVault(db, password) {
  if (await hasVault(db)) throw new Error("A vault already exists in this browser.");
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await wrappingKey(password, salt), raw);
  await put(db, "config", { id: "vault", version: 1, salt, iv, wrapped });
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function unlockVault(db, password) {
  const config = await get(db, "config", "vault");
  if (!config || config.version !== 1) throw new Error("Unsupported vault format.");
  try {
    const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: config.iv }, await wrappingKey(password, config.salt), config.wrapped);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } catch { throw new Error("Incorrect password or damaged vault."); }
}

export async function changeVaultPassword(db, oldPassword, newPassword) {
  if (newPassword.length < 8) throw new Error("Use a password of at least 8 characters.");
  const config = await get(db, "config", "vault");
  if (!config || config.version !== 1) throw new Error("Unsupported vault format.");
  let raw;
  try {
    raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: config.iv },
      await wrappingKey(oldPassword, config.salt),
      config.wrapped
    );
  } catch { throw new Error("Current password is incorrect or vault is damaged."); }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await wrappingKey(newPassword, salt),
    raw
  );
  await put(db, "config", { id: "vault", version: 1, salt, iv, wrapped });
}

export async function saveItem(db, key, item) {
  if (!item || typeof item.id !== "string" || !item.id) throw new Error("Invalid item.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(item)));
  await put(db, "items", { id: item.id, version: 1, iv, ciphertext });
}

export async function loadItems(db, key) {
  const rows = await request(db.transaction("items").objectStore("items").getAll());
  return Promise.all(rows.map(async (row) => {
    if (row.version !== 1) throw new Error("Unsupported item format.");
    const item = JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv }, key, row.ciphertext)));
    if (!item || item.id !== row.id) throw new Error("Vault item integrity check failed.");
    return item;
  }));
}

export async function deleteItem(db, id) {
  await writeTransaction(db, "items", (objectStore) => objectStore.delete(id));
}

const bytes = (value) => Array.from(new Uint8Array(value));
const byteArray = (value, length, field) => {
  if (!Array.isArray(value) || (length && value.length !== length) || value.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid backup ${field}.`);
  }
  return new Uint8Array(value);
};

export async function createEncryptedBackup(db, key) {
  const config = await get(db, "config", "vault");
  if (!config || config.version !== 1) throw new Error("Unsupported vault format.");
  // Verify every record before offering a backup; ciphertext alone could hide corruption.
  await loadItems(db, key);
  const rows = await request(db.transaction("items").objectStore("items").getAll());
  return JSON.stringify({
    format: "kryptic-encrypted-backup",
    version: 1,
    config: { version: 1, salt: bytes(config.salt), iv: bytes(config.iv), wrapped: bytes(config.wrapped) },
    items: rows.map((row) => ({ id: row.id, version: row.version, iv: bytes(row.iv), ciphertext: bytes(row.ciphertext) })),
  });
}

export async function restoreEncryptedBackup(db, json, password) {
  if (await hasVault(db)) throw new Error("Restore requires an empty browser vault.");
  if (typeof json !== "string" || json.length > 100 * 1024 * 1024) throw new Error("Invalid backup size.");
  let backup;
  try { backup = JSON.parse(json); } catch { throw new Error("Invalid backup file."); }
  if (backup?.format !== "kryptic-encrypted-backup" || backup.version !== 1 || !backup.config || !Array.isArray(backup.items)) {
    throw new Error("Unsupported backup format.");
  }
  const config = {
    id: "vault", version: 1,
    salt: byteArray(backup.config.salt, 16, "salt"),
    iv: byteArray(backup.config.iv, 12, "IV"),
    wrapped: byteArray(backup.config.wrapped, 48, "key"),
  };
  let raw;
  try {
    raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: config.iv }, await wrappingKey(password, config.salt), config.wrapped);
  } catch { throw new Error("Incorrect password or damaged backup."); }
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  if (backup.items.length > 100000) throw new Error("Backup has too many entries.");
  const seen = new Set();
  const rows = await Promise.all(backup.items.map(async (entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id || seen.has(entry.id) || entry.version !== 1) throw new Error("Invalid backup entry.");
    seen.add(entry.id);
    const row = { id: entry.id, version: 1, iv: byteArray(entry.iv, 12, "entry IV"), ciphertext: byteArray(entry.ciphertext, null, "entry ciphertext") };
    try {
      const item = JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv }, key, row.ciphertext)));
      if (!item || item.id !== row.id) throw new Error("Invalid entry identity.");
    } catch { throw new Error("Backup contains a damaged entry."); }
    return row;
  }));
  // One transaction prevents a partial restore if the browser rejects any write.
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["config", "items"], "readwrite");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Restore failed."));
    tx.onabort = () => reject(tx.error || new Error("Restore failed."));
    tx.objectStore("config").put(config);
    for (const row of rows) tx.objectStore("items").put(row);
  });
}
