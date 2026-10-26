import type { PolicyApplicationLink } from "@/lib/types";

export function normalizeApplyToApplications(raw: unknown): PolicyApplicationLink[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: PolicyApplicationLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; name?: unknown };
    const id = String(record.id ?? "").trim();
    const name = String(record.name ?? "").trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, name });
  }
  return items;
}

export function formatApplyToLabel(applications: PolicyApplicationLink[] | undefined) {
  const items = normalizeApplyToApplications(applications);
  if (items.length === 0) return "";
  return items.map((item) => item.name).join(", ");
}
