export function parseSearch(query) {
  const filters = { tags: [], type: null, favorite: false, after: null, before: null };
  const words = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const [name, raw] = token.split(":", 2);
    const value = raw?.toLowerCase();
    if (name === "tag" && value) filters.tags.push(value);
    else if (name === "type" && ["note", "journal", "snippet"].includes(value)) filters.type = value;
    else if (name === "is" && value === "favorite") filters.favorite = true;
    else if ((name === "after" || name === "before") && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) filters[name] = Date.parse(value);
    else words.push(token);
  }
  return { text: words.join(" ").toLowerCase(), filters };
}

export function matchesSearch(item, parsed, skipText = false) {
  const { filters, text } = parsed;
  if (filters.type && item.type !== filters.type) return false;
  if (filters.favorite && !item.favorite) return false;
  if (filters.tags.some((tag) => !(item.tags || []).some((value) => value.toLowerCase() === tag))) return false;
  if (filters.after !== null && item.updatedAt < filters.after) return false;
  if (filters.before !== null && item.updatedAt >= filters.before + 24 * 60 * 60 * 1000) return false;
  return skipText || !text || `${item.title} ${item.body} ${(item.tags || []).join(" ")}`.toLowerCase().includes(text);
}
