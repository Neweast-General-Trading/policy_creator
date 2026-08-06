import type { PolicyDraft, WizardStep } from "./types";

const DRAFT_KEY = "policy_creator_wizard_draft";

export interface StoredWizardDraft {
  draft: PolicyDraft;
  step: WizardStep;
  activeSectionIndex: number;
  editingPolicyId?: string;
  savedAt: string;
}

export function loadWizardDraft(editingPolicyId?: string): StoredWizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWizardDraft;
    if (editingPolicyId && parsed.editingPolicyId !== editingPolicyId) return null;
    if (!editingPolicyId && parsed.editingPolicyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWizardDraft(data: StoredWizardDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function clearWizardDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function hasSectionContent(content: string) {
  return content.replace(/<[^>]+>/g, "").trim().length > 0;
}

export function countCompletedTopics(sections: PolicyDraft["sections"]) {
  return sections.filter((section) => hasSectionContent(section.content)).length;
}
