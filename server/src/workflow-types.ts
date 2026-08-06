export type PolicyStatus =
  | "draft"
  | "in_approval"
  | "returned"
  | "approved"
  | "published"
  | "rejected";

export type ApprovalStepType =
  | "requester"
  | "direct_manager"
  | "second_level_manager"
  | "additional_approver"
  | "department_approver"
  | "escalated_approver"
  | "audit_team"
  | "audit_manager";

export interface AdditionalApproverInput {
  groupOrder: number;
  assigneeEmail: string;
  assigneeName: string;
  assigneeUserId?: string;
}

export type ApprovalStepStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "skipped"
  | "escalated";

export interface ApprovalStep {
  id: string;
  groupOrder: number;
  type: ApprovalStepType;
  assigneeEmail: string;
  assigneeName: string;
  assigneeUserId?: string;
  status: ApprovalStepStatus;
  signatureText?: string;
  comment?: string;
  actedAt?: string;
  departmentCode?: number;
  departmentName?: string;
  levelLabel?: string;
  designation?: string;
  escalatedToStepId?: string;
  escalatedFromStepId?: string;
}

export interface PolicyComment {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string;
  stepId?: string;
  type?: "comment" | "escalation" | "system" | "matrix_change";
  targetEmail?: string;
  targetName?: string;
}

export interface MatrixChangeItem {
  stepId: string;
  groupOrder: number;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  toUserId?: string;
}

export interface PendingMatrixChange {
  id: string;
  status: "pending" | "approved" | "rejected";
  requestedByEmail: string;
  requestedByName: string;
  requestedAt: string;
  reviewerEmail: string;
  reviewerName: string;
  reviewedByEmail?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  changes: MatrixChangeItem[];
}

export interface PendingSetupRefresh {
  setupId: string;
  setupUpdatedAt: string;
  notifiedAt: string;
}

export interface PolicySubProcessLink {
  id: string;
  code: string;
  name: string;
}

export interface PolicyCompany {
  companyCode: string;
  companyName: string;
}

export type PolicyVisibilityScope = "general" | "department";

export type PolicyDeactivationReason = "superseded" | "manual" | "retired";

export interface StoredPolicy {
  id: string;
  name: string;
  companyCode: string;
  companyName: string;
  /** All companies this policy applies to when published */
  companies?: PolicyCompany[];
  /** general = all departments · department = selected department only */
  visibilityScope?: PolicyVisibilityScope;
  /** Stable id across all versions of the same policy */
  policyFamilyId?: string;
  /** Previous published version this draft/version was created from */
  parentPolicyId?: string;
  /** false = hidden from viewer (superseded or manually deactivated) */
  isActive?: boolean;
  deactivatedAt?: string;
  deactivatedReason?: PolicyDeactivationReason;
  departmentCode: number;
  departmentName: string;
  bpmDepartmentId?: string;
  bpmDepartmentName?: string;
  processId?: string;
  processCode?: string;
  processName?: string;
  subProcesses?: PolicySubProcessLink[];
  sections: Array<{ id: string; title: string; content: string }>;
  version: number;
  status: PolicyStatus;
  createdByEmail: string;
  createdByName: string;
  sharedWith: string[];
  approvalSteps: ApprovalStep[];
  comments: PolicyComment[];
  pendingMatrixChange?: PendingMatrixChange | null;
  pendingSetupRefresh?: PendingSetupRefresh | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
}
