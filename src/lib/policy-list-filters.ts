import type { Policy, PolicyStatus } from "./types";

export type PolicyListFilter = "all" | "mine" | "pending" | PolicyStatus;

export const POLICY_LIST_FILTER_LABELS: Record<PolicyListFilter, string> = {
  all: "All Policies",
  mine: "My Policies",
  pending: "Pending My Approval",
  draft: "Drafts",
  in_approval: "In Approval",
  returned: "Returned",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
};

export function filterPoliciesByListFilter(
  policies: Policy[],
  filter: PolicyListFilter,
  userEmail: string,
) {
  const email = userEmail.toLowerCase();

  switch (filter) {
    case "all":
      return policies;
    case "mine":
      return policies.filter((policy) => policy.createdByEmail.toLowerCase() === email);
    case "pending":
      return policies.filter((policy) =>
        policy.currentApprovers.some(
          (step) => step.assigneeEmail.toLowerCase() === email,
        ),
      );
    default:
      return policies.filter((policy) => policy.status === filter);
  }
}

export function getCurrentApproverLabel(policy: Policy) {
  if (policy.currentApprovers.length === 0) return "—";
  return policy.currentApprovers.map((step) => step.assigneeName).join(", ");
}
