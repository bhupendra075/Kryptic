import { restoreRevision, saveRevision } from "./revisions";

test("revision restore keeps the current version available for undo", () => {
  const initial = { id: "one", title: "First", body: "Old", tags: ["a"], attachments: [{ id: "file" }] };
  const saved = saveRevision(initial, "v1", 1);
  const changed = { ...saved, title: "Second", body: "New", tags: ["b"] };
  const restored = restoreRevision(changed, "v1", "undo", 2);
  expect(restored).toMatchObject({ title: "First", body: "Old", tags: ["a"], attachments: [{ id: "file" }] });
  expect(restored.revisions[0]).toMatchObject({ id: "undo", title: "Second", body: "New" });
  expect(saveRevision(saved, "duplicate", 3)).toBe(saved);
});
