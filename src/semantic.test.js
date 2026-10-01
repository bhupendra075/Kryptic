import { rankSemantic, supportsSemanticSearch } from "./semantic";

test("semantic search is desktop Chromium-only and ranks cosine vectors", () => {
  expect(supportsSemanticSearch("Mozilla Chrome/126.0", false)).toBe(true);
  expect(supportsSemanticSearch("Mozilla Edg/126.0", false)).toBe(true);
  expect(supportsSemanticSearch("Mozilla Chrome/126.0 Mobile", true)).toBe(false);
  expect(supportsSemanticSearch("Mozilla Firefox/126.0", false)).toBe(false);
  expect(rankSemantic([1, 0], [{ id: "a", vector: [0, 1] }, { id: "b", vector: [0.9, 0.1] }])[0].id).toBe("b");
});
