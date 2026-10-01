import { matchesSearch, parseSearch } from "./search";

test("advanced filters combine with ordinary text search", () => {
  const item = { type: "note", title: "Project plan", body: "Release checklist", tags: ["Work"], favorite: true, updatedAt: Date.parse("2026-09-30T12:00:00Z") };
  expect(matchesSearch(item, parseSearch("plan tag:work type:note is:favorite after:2026-09-29 before:2026-10-01"))).toBe(true);
  expect(matchesSearch(item, parseSearch("tag:home"))).toBe(false);
  expect(matchesSearch(item, parseSearch("type:journal"))).toBe(false);
  expect(matchesSearch(item, parseSearch("missing"))).toBe(false);
});
