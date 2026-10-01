const cleanName = (title) => Array.from(title || "untitled", (char) =>
  char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? "-" : char
).join("").trim().slice(0, 80) || "untitled";

export function exportFilename(item, extension) {
  return `${cleanName(item.title)}.${extension}`;
}

export function exportJson(item) {
  return JSON.stringify({ format: "kryptic-entry", version: 1, entry: item }, null, 2);
}

export function exportMarkdown(item) {
  const title = (item.title || "Untitled").replace(/\r?\n/g, " ").trim();
  const tags = (item.tags || []).map((tag) => `#${tag}`).join(" ");
  return `# ${title}\n\n${tags ? `${tags}\n\n` : ""}${item.body || ""}\n`;
}

export async function exportPdf(item) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const maxWidth = 174;
  let y = 20;
  const line = (text, size, height) => {
    pdf.setFontSize(size);
    for (const part of pdf.splitTextToSize(text, maxWidth)) {
      if (y > 275) { pdf.addPage(); y = 20; }
      pdf.text(part, margin, y);
      y += height;
    }
  };
  line(item.title || "Untitled", 18, 9);
  y += 3;
  if (item.tags?.length) { line(item.tags.map((tag) => `#${tag}`).join(" "), 10, 6); y += 3; }
  for (const paragraph of (item.body || "").split(/\r?\n/)) {
    if (paragraph) line(paragraph, 11, 6);
    else y += 5;
  }
  return pdf.output("blob");
}
