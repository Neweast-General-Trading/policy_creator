import { generateId } from "./utils";
import type { PolicySection, PolicyTemplate } from "./types";

export function buildSectionsFromTemplate(template: Pick<PolicyTemplate, "sections">) {
  return template.sections.map((section) => ({
    id: generateId(),
    title: section.title,
    content: section.content || "<p></p>",
    businessRules: section.businessRules ?? [""],
    applyToApplications: section.applyToApplications ?? [],
  }));
}

export function buildBlankSections(): PolicySection[] {
  return [];
}
