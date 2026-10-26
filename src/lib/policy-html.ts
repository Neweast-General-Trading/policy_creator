export function htmlHasText(html: string | undefined) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim().length > 0;
}

export function normalizePolicyHtml(html: string | undefined) {
  const raw = String(html ?? "").trim();
  if (!htmlHasText(raw)) return "";
  return raw
    .replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "")
    .replace(/<p>\s*[\u2022\u00b7\*]\s+/gi, "<p class=\"policy-bullet\">")
    .replace(/<(li|p)[^>]*>\s*[\u2022\u00b7\*]\s+/gi, "<$1>")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />");
}
