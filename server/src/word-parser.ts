import mammoth from "mammoth";

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeContent(html: string) {
  const trimmed = html.trim();
  return trimmed || "<p></p>";
}

export function splitHtmlIntoSections(html: string) {
  const sections: Array<{ title: string; content: string }> = [];
  const parts = html.split(/(?=<h[1-3][^>]*>)/i).filter(Boolean);

  for (const part of parts) {
    const headingMatch = part.match(/^<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (!headingMatch) continue;

    const title = stripHtmlTags(headingMatch[1]);
    const content = normalizeContent(
      part.replace(/^<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/i, ""),
    );
    if (title) sections.push({ title, content });
  }

  if (sections.length === 0 && html.trim()) {
    sections.push({
      title: "Document Content",
      content: normalizeContent(html),
    });
  }

  return sections;
}

export async function parseWordDocument(buffer: Buffer) {
  const result = await mammoth.convertToHtml({ buffer });
  const sections = splitHtmlIntoSections(result.value);
  return {
    sections,
    warnings: result.messages.map((message) => message.message),
  };
}
