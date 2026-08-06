import type { PolicyStatus } from "./types";
import { POLICY_STATUS_LABELS } from "./types";

/** Background class for status indicator dots */
export const POLICY_STATUS_DOT_CLASS: Record<PolicyStatus, string> = {
  draft: "bg-slate-400",
  in_approval: "bg-violet-500",
  returned: "bg-amber-500",
  approved: "bg-emerald-500",
  published: "bg-sky-500",
  rejected: "bg-red-500",
};

/** Ring/glow for selected or emphasis */
export const POLICY_STATUS_DOT_RING: Record<PolicyStatus, string> = {
  draft: "ring-slate-200",
  in_approval: "ring-violet-200",
  returned: "ring-amber-200",
  approved: "ring-emerald-200",
  published: "ring-sky-200",
  rejected: "ring-red-200",
};

export const POLICY_STATUS_ORDER: PolicyStatus[] = [
  "draft",
  "in_approval",
  "returned",
  "approved",
  "published",
  "rejected",
];

export function getPolicyStatusLabel(status: PolicyStatus) {
  return POLICY_STATUS_LABELS[status];
}
