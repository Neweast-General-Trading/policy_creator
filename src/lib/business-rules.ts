import type { PolicySection } from "./types";

export function normalizeBusinessRules(rules?: string[] | null) {
  if (!Array.isArray(rules)) return [];
  return rules.map((rule) => String(rule ?? "").trim()).filter(Boolean);
}

export function sectionHasBusinessRules(section: Pick<PolicySection, "businessRules">) {
  return normalizeBusinessRules(section.businessRules).length > 0;
}
