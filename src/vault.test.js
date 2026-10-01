import { TextDecoder, TextEncoder } from "util";
import { webcrypto } from "crypto";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
Object.defineProperty(global, "crypto", { configurable: true, value: webcrypto });
const { changeVaultPassword, createEncryptedBackup, createVault, hasVault, loadItems, restoreEncryptedBackup, saveItem, unlockVault } = require("./vault");

function memoryDb() {
  const stores = { config: new Map(), items: new Map() };
  const result = (value) => {
    const request = {};
    queueMicrotask(() => { request.result = value; request.onsuccess?.(); });
    return request;
  };
  return {
    stores,
    transaction(name) {
      const tx = { objectStore(storeName) {
        const target = stores[storeName || name];
        return {
          get: (id) => result(target.get(id)),
          getAll: () => result([...target.values()]),
          put: (value) => { target.set(value.id, value); return result(value.id); },
          delete: (id) => { target.delete(id); return result(undefined); },
        };
      } };
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
  };
}

test("encrypted items survive unlock without exposing plaintext", async () => {
  const db = memoryDb();
  const key = await createVault(db, "test-password-123");
  const item = { id: "one", title: "Private title", body: "Secret body" };
  await saveItem(db, key, item);
  expect(await hasVault(db)).toBe(true);
  expect(JSON.stringify([...db.stores.items.values()])).not.toContain("Private title");
  expect(await loadItems(db, await unlockVault(db, "test-password-123"))).toEqual([item]);
  await expect(unlockVault(db, "wrong-password")).rejects.toThrow("Incorrect password");
});

test("encrypted backup restores entries and rejects damaged input before writes", async () => {
  const source = memoryDb();
  const key = await createVault(source, "backup-password-123");
  const item = { id: "one", title: "Private title", tags: ["personal"], attachments: [{ id: "file-one", name: "secret.txt", type: "text/plain", size: 6, data: "c2VjcmV0" }] };
  await saveItem(source, key, item);
  expect(JSON.stringify([...source.stores.items.values()])).not.toContain("secret.txt");
  const json = await createEncryptedBackup(source, key);
  expect(json).not.toContain("Private title");
  const destination = memoryDb();
  await expect(restoreEncryptedBackup(destination, json, "wrong-password")).rejects.toThrow("Incorrect password");
  expect(await hasVault(destination)).toBe(false);
  const damaged = JSON.parse(json);
  damaged.items[0].ciphertext[0] ^= 1;
  await expect(restoreEncryptedBackup(destination, JSON.stringify(damaged), "backup-password-123")).rejects.toThrow("damaged entry");
  expect(await hasVault(destination)).toBe(false);
  await restoreEncryptedBackup(destination, json, "backup-password-123");
  expect(await loadItems(destination, await unlockVault(destination, "backup-password-123"))).toEqual([item]);
  await expect(restoreEncryptedBackup(destination, json, "backup-password-123")).rejects.toThrow("empty browser vault");
});

test("rejects tampered ciphertext and record identity", async () => {
  const db = memoryDb();
  const key = await createVault(db, "test-password-123");
  await saveItem(db, key, { id: "one", body: "Secret" });
  const record = db.stores.items.get("one");
  db.stores.items.set("two", { ...record, id: "two" });
  await expect(loadItems(db, key)).rejects.toThrow("integrity check failed");
  db.stores.items.delete("two");
  const bytes = new Uint8Array(record.ciphertext.slice(0));
  bytes[0] ^= 1;
  db.stores.items.set("one", { ...record, ciphertext: bytes.buffer });
  await expect(loadItems(db, key)).rejects.toThrow();
});

test("password change preserves encrypted entries and invalidates the old password", async () => {
  const db = memoryDb();
  const key = await createVault(db, "old-password-123");
  const item = { id: "one", title: "Still private" };
  await saveItem(db, key, item);
  const before = db.stores.items.get("one").ciphertext;
  await expect(changeVaultPassword(db, "wrong-password", "new-password-123")).rejects.toThrow("Current password");
  expect(await loadItems(db, await unlockVault(db, "old-password-123"))).toEqual([item]);
  await changeVaultPassword(db, "old-password-123", "new-password-123");
  await expect(unlockVault(db, "old-password-123")).rejects.toThrow("Incorrect password");
  expect(await loadItems(db, await unlockVault(db, "new-password-123"))).toEqual([item]);
  expect(db.stores.items.get("one").ciphertext).toBe(before);
});
