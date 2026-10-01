const fields = (item) => ({ title: item.title, body: item.body, tags: [...(item.tags || [])] });

export function saveRevision(item, id, at = Date.now()) {
  const snapshot = fields(item);
  const latest = item.revisions?.[0];
  if (latest && JSON.stringify(fields(latest)) === JSON.stringify(snapshot)) return item;
  return { ...item, revisions: [{ id, at, ...snapshot }, ...(item.revisions || [])].slice(0, 20) };
}

export function restoreRevision(item, revisionId, snapshotId, at = Date.now()) {
  const revision = item.revisions?.find((entry) => entry.id === revisionId);
  if (!revision) throw new Error("Revision is unavailable.");
  const before = { id: snapshotId, at, ...fields(item) };
  return { ...item, ...fields(revision), revisions: [before, ...item.revisions].slice(0, 20), updatedAt: at };
}
