export type SubmitterLevelMode = "all" | "one" | "top";

export type StageAssigneeMode = "all" | "selected";

/** Who can approve at this level — independent of level number. */
export type StageLevelAudience = "tier" | "managers_only" | "staff_only";

export interface StageLevelAssignee {
  userId: string;
  email: string;
  name: string;
}

/** One approval step in a downstream department — tier is derived from level order (1 = bottom / staff). */
export interface ApprovalStageLevelConfig {
  /** tier = hierarchy slot · managers_only = only reporting · staff_only = non-managers */
  audience: StageLevelAudience;
  assigneeMode: StageAssigneeMode;
  assignees: StageLevelAssignee[];
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

/** One setup per source (creator) department — can apply to multiple companies */
export interface PolicyApprovalSetup {
  id: string;
  /** Primary company (first selected) — kept for backward compatibility */
  companyCode: string;
  companyName: string;
  /** All companies this matrix applies to */
  companies: PolicyApprovalSetupCompany[];
  sourceDepartmentCode: number;
  sourceDepartmentName: string;
  /** Default internal chain for this source department */
  submitterLevelMode: SubmitterLevelMode;
  hodSkipInternalLevels: boolean;
  /** Ordered downstream departments (Marketing → Management → Audit …) */
  stages: ApprovalStageConfig[];
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
