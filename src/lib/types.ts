export interface PolicySection {
  id: string;
  title: string;
  content: string;
}

export interface Department {
  code: number;
  name: string;
}

export type PolicyStatus = "draft" | "in_approval" | "returned" | "approved" | "published" | "rejected";

export type ApprovalStepType =
  | "requester"
  | "direct_manager"
  | "second_level_manager"
  | "additional_approver"
  | "department_approver"
  | "escalated_approver"
  | "audit_team"
  | "audit_manager";

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

export const GENERAL_POLICY_DEPARTMENT_CODE = 0;
export const GENERAL_POLICY_DEPARTMENT_NAME = "General";

export interface Policy {
  id: string;
  name: string;
  companyCode: string;
  companyName: string;
  companies?: PolicyCompany[];
  visibilityScope?: PolicyVisibilityScope;
  policyFamilyId?: string;
  parentPolicyId?: string;
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
  sections: PolicySection[];
  version: number;
  status: PolicyStatus;
  createdByEmail: string;
  createdByName: string;
  sharedWith: string[];
  approvalSteps: ApprovalStep[];
  pendingMatrixChange?: PendingMatrixChange | null;
  pendingSetupRefresh?: PendingSetupRefresh | null;
  comments: PolicyComment[];
  currentApprovers: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  departmentCode: number;
  departmentName: string;
  sections: PolicySection[];
  source: "manual" | "word";
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedWordTemplate {
  fileName: string;
  sections: Array<{ title: string; content: string }>;
  warnings: string[];
}

export interface DashboardSummary {
  myPolicies: number;
  pendingMyApproval: number;
  inApproval: number;
  approved: number;
  returned: number;
  published: number;
  draft: number;
  rejected: number;
  totalVisible: number;
  viewerScope: {
    isGlobalViewer: boolean;
    label: string;
    departments: Array<{
      companyCode: string;
      companyName: string;
      departmentCode: number;
      departmentName: string;
    }>;
  };
}

export interface CompanyOption {
  code: string;
  name: string;
}

export type WizardStep = "info" | "titles" | "content" | "review";

export interface PolicyDraft {
  name: string;
  companyCode: string;
  companyName: string;
  selectedCompanies: CompanyOption[];
  visibilityScope: PolicyVisibilityScope;
  departmentCode: number | null;
  departmentName: string;
  bpmDepartmentId?: string;
  bpmDepartmentName?: string;
  processId?: string;
  processCode?: string;
  processName?: string;
  subProcesses: PolicySubProcessLink[];
  linkToBpm: boolean;
  sections: PolicySection[];
  version: number;
}

export interface BpmProcessOption {
  id: string;
  code: string;
  name: string;
}

export interface BpmSubProcessOption {
  id: string;
  code: string;
  name: string;
  parentActivityId?: string | null;
}

export interface EmployeeOption {
  userId: string;
  name: string;
  email: string;
  department?: string;
}

export interface EscalationTargetOption extends EmployeeOption {
  designation?: string;
  targetKind?: "manager" | "next_stage";
}

export interface AdditionalApproverDraft {
  groupOrder: number;
  assigneeEmail: string;
  assigneeName: string;
  assigneeUserId?: string;
}

export const SUBMITTER_LEVEL_OPTIONS = [
  { value: "all", label: "Full department hierarchy" },
  { value: "one", label: "Direct manager only" },
  { value: "top", label: "Department head only" },
] as const;

export type SubmitterLevelMode = (typeof SUBMITTER_LEVEL_OPTIONS)[number]["value"];

export interface StageLevelAssignee {
  userId: string;
  email: string;
  name: string;
}

export type StageAssigneeMode = "all" | "selected";

export type StageLevelAudience = "tier" | "managers_only" | "staff_only";

export const LEVEL_AUDIENCE_OPTIONS: Array<{
  value: StageLevelAudience;
  label: string;
  description: string;
}> = [
  {
    value: "tier",
    label: "Hierarchy tier",
    description: "Auto from level order (staff → managers)",
  },
  {
    value: "managers_only",
    label: "Only reporting",
    description: "Managers only — employees with direct reports in this department",
  },
  {
    value: "staff_only",
    label: "Staff only",
    description: "Non-managers — no direct reports in this department",
  },
];

export interface ApprovalStageLevelConfig {
  audience: StageLevelAudience;
  assigneeMode: StageAssigneeMode;
  assignees: StageLevelAssignee[];
}

export interface HierarchyTierPreview {
  tier: number;
  label: string;
  employees: Array<{
    userId: string;
    email: string;
    name: string;
    directReportsInDept: number;
  }>;
}

export interface ApprovalStageConfig {
  departmentCode: number;
  departmentName: string;
  levels: ApprovalStageLevelConfig[];
}

export interface PolicyApprovalSetupCompany {
  companyCode: string;
  companyName: string;
}

export interface PolicyApprovalSetup {
  id?: string;
  companyCode: string;
  companyName: string;
  companies?: PolicyApprovalSetupCompany[];
  sourceDepartmentCode: number;
  sourceDepartmentName: string;
  submitterLevelMode: SubmitterLevelMode;
  hodSkipInternalLevels: boolean;
  stages: ApprovalStageConfig[];
}

export interface PolicyApprovalSetupRecord extends PolicyApprovalSetup {
  id: string;
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export const APPROVAL_LEVEL_OPTIONS = [
  { value: 1, label: "Level 1 — Direct Manager" },
  { value: 2, label: "Level 2 — Second-Level Manager (same dept)" },
  { value: 3, label: "Level 3 — Audit Team" },
  { value: 4, label: "Level 4 — Audit Manager" },
] as const;

export const APPROVAL_STEP_LABELS: Record<ApprovalStepType, string> = {
  requester: "Requester",
  direct_manager: "Direct Manager",
  second_level_manager: "Second-Level Manager",
  additional_approver: "Additional Approver",
  department_approver: "Department Approver",
  escalated_approver: "Escalated Approver",
  audit_team: "Audit Team",
  audit_manager: "Audit Manager",
};

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  draft: "Draft",
  in_approval: "In Approval",
  returned: "Returned",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
};
