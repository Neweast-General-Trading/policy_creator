import { randomUUID } from "node:crypto";
import type {
  ApprovalStageConfig,
  ApprovalStageLevelConfig,
  PolicyApprovalSetup,
  SubmitterLevelMode,
} from "./approval-setup-types.js";
import { getApprovalSetupForDepartment } from "./approval-setup-store.js";
import {
  blockUserAndDirectReports,
  getManagerIdsInDepartment,
  resolveLevelPool,
  resolveLevelPoolLabel,
} from "./department-hierarchy.js";
import type { BiUser } from "./bi-users.js";
import {
  buildSameDepartmentManagerChain,
  getBiUserByEmail,
  getUsersInDepartment,
  isHeadOfDepartment,
  normalizeEmail,
} from "./bi-users.js";
import type {
  AdditionalApproverInput,
  ApprovalStep,
  ApprovalStepType,
} from "./workflow-types.js";

function stepFromUser(
  groupOrder: number,
  type: ApprovalStepType,
  user: BiUser,
  meta?: {
    departmentCode?: number;
    departmentName?: string;
    levelLabel?: string;
  },
): ApprovalStep {
  return {
    id: randomUUID(),
    groupOrder,
    type,
    assigneeEmail: normalizeEmail(user.USER_EMAIL),
    assigneeName: user.EMP_FULLNAME || user.USER_NAME,
    assigneeUserId: user.USER_ID,
    status: "pending",
    departmentCode: meta?.departmentCode,
    departmentName: meta?.departmentName,
    levelLabel: meta?.levelLabel,
  };
}

function resolveSubmitterApprovers(
  chain: BiUser[],
  mode: SubmitterLevelMode,
): BiUser[] {
  if (chain.length === 0) return [];
  if (mode === "one") return [chain[0]];
  if (mode === "top") return [chain[chain.length - 1]];
  return chain;
}

async function shouldSkipSubmitterDepartmentApprovals(
  requester: BiUser,
  departmentCode: number,
  companyCode: string,
  setup: PolicyApprovalSetup,
): Promise<boolean> {
  const chain = await buildSameDepartmentManagerChain(
    requester,
    departmentCode,
    companyCode,
  );

  if (chain.length === 0) {
    // No same-dept managers (e.g. dept head reporting outside) — go straight to configured stages.
    return true;
  }

  if (!setup.hodSkipInternalLevels) return false;

  return await isHeadOfDepartment(requester, departmentCode, companyCode);
}

function sortApprovalSteps(steps: ApprovalStep[]): ApprovalStep[] {
  return [...steps].sort((left, right) => {
    if (left.groupOrder !== right.groupOrder) {
      return left.groupOrder - right.groupOrder;
    }
    if (left.type === "requester") return -1;
    if (right.type === "requester") return 1;
    return left.assigneeName.localeCompare(right.assigneeName);
  });
}

function mergeAdditionalApprovers(
  steps: ApprovalStep[],
  additionalApprovers: AdditionalApproverInput[],
  departmentCode: number,
  departmentName: string,
): ApprovalStep[] {
  const merged = [...steps];

  for (const extra of additionalApprovers) {
    if (!extra.assigneeEmail?.trim()) continue;

    const email = normalizeEmail(extra.assigneeEmail);
    const groupOrder = Number(extra.groupOrder);
    if (!Number.isFinite(groupOrder) || groupOrder < 1) continue;

    const alreadyAssigned = merged.some(
      (step) =>
        step.type !== "requester" &&
        step.groupOrder === groupOrder &&
        normalizeEmail(step.assigneeEmail) === email,
    );
    if (alreadyAssigned) continue;

    const anchorStep = merged.find(
      (step) => step.type !== "requester" && step.groupOrder === groupOrder,
    );

    merged.push({
      id: randomUUID(),
      groupOrder,
      type: "additional_approver",
      assigneeEmail: email,
      assigneeName: extra.assigneeName.trim() || extra.assigneeEmail,
      assigneeUserId: extra.assigneeUserId,
      status: "pending",
      departmentCode: anchorStep?.departmentCode ?? departmentCode,
      departmentName: anchorStep?.departmentName ?? departmentName,
      levelLabel: anchorStep?.levelLabel
        ? `${anchorStep.levelLabel} — Additional approver`
        : "Additional approver",
    });
  }

  return sortApprovalSteps(merged);
}

function resolveLevelAssignees(
  tierUsers: BiUser[],
  config: ApprovalStageLevelConfig,
): BiUser[] {
  if (config.assigneeMode === "selected" && config.assignees.length > 0) {
    const selectedIds = new Set(config.assignees.map((item) => item.userId));
    const selectedEmails = new Set(
      config.assignees.map((item) => normalizeEmail(item.email)),
    );
    return tierUsers.filter(
      (user) =>
        selectedIds.has(user.USER_ID) ||
        selectedEmails.has(normalizeEmail(user.USER_EMAIL)),
    );
  }
  return tierUsers;
}

async function appendStageSteps(
  steps: ApprovalStep[],
  groupOrderStart: number,
  companyCode: string,
  stage: ApprovalStageConfig,
) {
  const departmentUsers = await getUsersInDepartment(companyCode, stage.departmentCode);
  let groupOrder = groupOrderStart;
  const blockedUserIds = new Set<string>();
  const managerIds = getManagerIdsInDepartment(departmentUsers);
  let managersOnlyFromHere = false;

  for (const [levelIndex, levelConfig] of stage.levels.entries()) {
    const audience = managersOnlyFromHere
      ? "managers_only"
      : (levelConfig.audience ?? "tier");
    let tierUsers = resolveLevelPool(
      departmentUsers,
      levelIndex,
      stage.levels.length,
      audience,
    ).filter((user) => !blockedUserIds.has(user.USER_ID));
    if (managersOnlyFromHere) {
      tierUsers = tierUsers.filter((user) => managerIds.has(user.USER_ID));
    }
    const assignees = resolveLevelAssignees(tierUsers, levelConfig);
    const levelLabel = resolveLevelPoolLabel(
      levelIndex,
      stage.levels.length,
      departmentUsers,
      audience,
    );

    for (const user of assignees) {
      blockUserAndDirectReports(departmentUsers, user.USER_ID, blockedUserIds);
      steps.push(
        stepFromUser(groupOrder, "department_approver", user, {
          departmentCode: stage.departmentCode,
          departmentName: stage.departmentName,
          levelLabel,
        }),
      );
    }

    if (assignees.some((user) => managerIds.has(user.USER_ID))) {
      managersOnlyFromHere = true;
    }

    groupOrder += 1;
  }

  return groupOrder;
}

function buildLegacyFallbackSetup(
  companyCode: string,
  companyName: string,
  departmentCode: number,
  departmentName: string,
): PolicyApprovalSetup {
  const auditDeptCode = Number(process.env.AUDIT_DEPT_CODE ?? 4);
  const now = new Date().toISOString();
  return {
    id: "legacy-fallback",
    companyCode,
    companyName,
    companies: [{ companyCode, companyName }],
    sourceDepartmentCode: departmentCode,
    sourceDepartmentName: departmentName,
    submitterLevelMode: "all",
    hodSkipInternalLevels: true,
    stages: [
      {
        departmentCode: auditDeptCode,
        departmentName: "Audit",
        levels: [
          { audience: "tier", assigneeMode: "all", assignees: [] },
          { audience: "tier", assigneeMode: "all", assignees: [] },
        ],
      },
    ],
    createdByEmail: "system",
    createdByName: "System",
    createdAt: now,
    updatedAt: now,
  };
}

export async function buildApprovalChainFromSetup(
  requesterEmail: string,
  requesterName: string,
  companyCode: string,
  departmentCode: number,
  departmentName: string,
  additionalApprovers: AdditionalApproverInput[] = [],
  submitterLevelMode?: SubmitterLevelMode,
  setupOverride?: PolicyApprovalSetup | null,
): Promise<ApprovalStep[]> {
  const steps: ApprovalStep[] = [
    {
      id: randomUUID(),
      groupOrder: 0,
      type: "requester",
      assigneeEmail: normalizeEmail(requesterEmail),
      assigneeName: requesterName,
      status: "approved",
      actedAt: new Date().toISOString(),
      departmentCode,
      departmentName,
    },
  ];

  const setup =
    setupOverride ??
    (await getApprovalSetupForDepartment(companyCode, departmentCode, departmentName)) ??
    buildLegacyFallbackSetup(companyCode, "", departmentCode, departmentName);

  const effectiveSubmitterMode =
    submitterLevelMode ?? setup.submitterLevelMode ?? "all";

  const requester = await getBiUserByEmail(requesterEmail, companyCode);
  let groupOrder = 1;

  const skipSubmitter =
    requester != null
      ? await shouldSkipSubmitterDepartmentApprovals(
          requester,
          departmentCode,
          companyCode,
          setup,
        )
      : true;

  if (requester && !skipSubmitter) {
    const chain = await buildSameDepartmentManagerChain(
      requester,
      departmentCode,
      companyCode,
    );
    const approvers = resolveSubmitterApprovers(chain, effectiveSubmitterMode);
    if (approvers.length > 0) {
      const submitterGroupOrder = groupOrder;
      for (const manager of approvers) {
        steps.push(
          stepFromUser(submitterGroupOrder, "department_approver", manager, {
            departmentCode,
            departmentName,
            levelLabel:
              effectiveSubmitterMode === "top"
                ? "Department Head"
                : effectiveSubmitterMode === "one"
                  ? "Direct Manager"
                  : approvers.length > 1
                    ? "Department Approval (parallel)"
                    : "Department Approval",
          }),
        );
      }
      groupOrder += 1;
    }
  }

  for (const stage of setup.stages) {
    groupOrder = await appendStageSteps(steps, groupOrder, companyCode, stage);
  }

  return mergeAdditionalApprovers(
    steps,
    additionalApprovers,
    departmentCode,
    departmentName,
  );
}

export async function getDefaultSubmitterLevelMode(
  companyCode: string,
  sourceDepartmentCode: number,
  sourceDepartmentName = "",
): Promise<SubmitterLevelMode> {
  const setup = await getApprovalSetupForDepartment(
    companyCode,
    sourceDepartmentCode,
    sourceDepartmentName,
  );
  return setup?.submitterLevelMode ?? "all";
}
