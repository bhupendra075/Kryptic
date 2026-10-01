import { exportFilename, exportJson, exportMarkdown } from "./exports";

test("plaintext exports preserve entry content and use safe filenames", () => {
  const entry = { id: "one", title: "Quarterly / notes", body: "First line\nSecond line", tags: ["work"] };
  expect(exportFilename(entry, "md")).toBe("Quarterly - notes.md");
  expect(exportMarkdown(entry)).toContain("#work\n\nFirst line\nSecond line");
  expect(JSON.parse(exportJson(entry)).entry).toEqual(entry);
});

