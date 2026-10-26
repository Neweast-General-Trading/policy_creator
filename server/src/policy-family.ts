import { randomUUID } from "node:crypto";
import type { StoredPolicy } from "./workflow-types.js";
import { normalizeEmail } from "./bi-users.js";
import { canManageApprovalSetup } from "./approval-setup-access.js";

export type PolicyDeactivationReason = "superseded" | "manual" | "retired";

export function resolvePolicyFamilyId(policy: Pick<StoredPolicy, "id" | "policyFamilyId">) {
  return policy.policyFamilyId?.trim() || policy.id;
}

export function getNextFamilyVersion(policies: StoredPolicy[], familyId: string) {
  const versions = policies
    .filter((item) => resolvePolicyFamilyId(item) === familyId)
    .map((item) => Number(item.version) || 1);
  if (versions.length === 0) return 1;
  return Math.max(...versions) + 1;
}

export function clonePolicyForNewVersion(
  source: StoredPolicy,
  nextVersion: number,
  createdByEmail: string,
  createdByName: string,
): StoredPolicy {
  const now = new Date().toISOString();
  const familyId = resolvePolicyFamilyId(source);

  return {
    ...source,
    id: randomUUID(),
    policyFamilyId: familyId,
    parentPolicyId: source.id,
    version: nextVersion,
    status: "draft",
    isActive: true,
    approvalSteps: [],
    comments: [],
    sharedWith: [...source.sharedWith],
    pendingMatrixChange: null,
    pendingSetupRefresh: null,
    createdByEmail,
    createdByName,
    createdAt: now,
    updatedAt: now,
    submittedAt: undefined,
    approvedAt: undefined,
    publishedAt: undefined,
    deactivatedAt: undefined,
    deactivatedReason: undefined,
    sections: source.sections.map((section) => ({
      ...section,
      id: randomUUID(),
    })),
    subProcesses: source.subProcesses?.map((item) => ({ ...item })) ?? [],
  };
}

export function deactivatePolicyRecord(
  policy: StoredPolicy,
  reason: PolicyDeactivationReason,
): StoredPolicy {
  const now = new Date().toISOString();
  return {
    ...policy,
    isActive: false,
    deactivatedAt: now,
    deactivatedReason: reason,
    updatedAt: now,
  };
}

export function activatePolicyRecord(policy: StoredPolicy): StoredPolicy {
  const now = new Date().toISOString();
  return {
    ...policy,
    isActive: true,
    deactivatedAt: undefined,
    deactivatedReason: undefined,
    updatedAt: now,
  };
}

export function canCreateNewVersionFrom(source: StoredPolicy) {
  return source.status === "published";
}

export async function canDeactivatePolicy(policy: StoredPolicy, email: string) {
  if (policy.status !== "published") return false;
  if (policy.isActive === false) return false;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (normalizeEmail(policy.createdByEmail) === normalized) return true;
  return canManageApprovalSetup(normalized);
}

export async function canActivatePolicy(policy: StoredPolicy, email: string) {
  if (policy.status !== "published") return false;
  if (policy.isActive !== false) return false;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (normalizeEmail(policy.createdByEmail) === normalized) return true;
  return canManageApprovalSetup(normalized);
}
