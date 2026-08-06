import type { StoredPolicy } from "./workflow-types.js";
import { applyPendingMatrixPreview } from "./matrix-change.js";
import { getCurrentApprovers } from "./workflow.js";

export function mapPolicy(row: StoredPolicy) {
  const currentApprovers = getCurrentApprovers(row);
  const approvalSteps = applyPendingMatrixPreview(
    row.approvalSteps,
    row.pendingMatrixChange,
  );
  return {
    id: row.id,
    name: row.name,
    companyCode: row.companyCode,
    companyName: row.companyName,
    companies: row.companies ?? [],
    visibilityScope: row.visibilityScope === "general" ? "general" : "department",
    policyFamilyId: row.policyFamilyId ?? row.id,
    parentPolicyId: row.parentPolicyId,
    isActive: row.isActive !== false,
    deactivatedAt: row.deactivatedAt,
    deactivatedReason: row.deactivatedReason,
    departmentCode: row.departmentCode,
    departmentName: row.departmentName,
    bpmDepartmentId: row.bpmDepartmentId,
    bpmDepartmentName: row.bpmDepartmentName,
    processId: row.processId,
    processCode: row.processCode,
    processName: row.processName,
    subProcesses: row.subProcesses ?? [],
    sections: row.sections,
    version: row.version,
    status: row.status,
    createdByEmail: row.createdByEmail,
    createdByName: row.createdByName,
    sharedWith: row.sharedWith,
    approvalSteps,
    pendingMatrixChange: row.pendingMatrixChange ?? null,
    pendingSetupRefresh: row.pendingSetupRefresh ?? null,
    comments: row.comments,
    currentApprovers,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    publishedAt: row.publishedAt,
  };
}
