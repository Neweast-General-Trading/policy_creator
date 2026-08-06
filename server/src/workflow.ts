import { randomUUID } from "node:crypto";
import { buildApprovalChainFromSetup, getDefaultSubmitterLevelMode } from "./approval-chain-builder.js";
import type { SubmitterLevelMode } from "./approval-setup-types.js";
import { getApprovalSetupForDepartment } from "./approval-setup-store.js";
import {
  buildSameDepartmentManagerChain,
  getBiUserByEmail,
  getDirectReportingManager,
  normalizeEmail,
} from "./bi-users.js";
import type {
  AdditionalApproverInput,
  ApprovalStep,
  ApprovalStepType,
  PolicyComment,
  StoredPolicy,
} from "./workflow-types.js";
import { buildPolicyApprovalTeamsMessage, sendTeamsNotification } from "./teams-notify.js";

function stepFromUser(
  groupOrder: number,
  type: ApprovalStepType,
  user: { USER_ID: string; USER_EMAIL: string; EMP_FULLNAME?: string; USER_NAME: string },
  meta?: Partial<ApprovalStep>,
): ApprovalStep {
  return {
    id: randomUUID(),
    groupOrder,
    type,
    assigneeEmail: normalizeEmail(user.USER_EMAIL),
    assigneeName: user.EMP_FULLNAME || user.USER_NAME,
    assigneeUserId: user.USER_ID,
    status: "pending",
    ...meta,
  };
}

export async function escalatePolicyStep(
  policy: StoredPolicy,
  email: string,
  name: string,
  input: {
    targetEmail: string;
    targetName: string;
    targetUserId?: string;
    reason: string;
  },
) {
  const normalized = normalizeEmail(email);
  const activeOrder = getActiveGroupOrder(policy.approvalSteps);
  if (activeOrder == null) throw new Error("No pending approval step");

  const step = policy.approvalSteps.find(
    (item) =>
      item.groupOrder === activeOrder &&
      item.status === "pending" &&
      normalizeEmail(item.assigneeEmail) === normalized,
  );
  if (!step) throw new Error("You are not the current approver");

  const reason = input.reason.trim();
  if (!reason) throw new Error("Escalation reason is required");
  if (!input.targetEmail.trim()) throw new Error("Escalation target is required");

  const actedAt = new Date().toISOString();
  const newStepId = randomUUID();

  const newStep: ApprovalStep = {
    id: newStepId,
    groupOrder: step.groupOrder,
    type: "escalated_approver",
    assigneeEmail: normalizeEmail(input.targetEmail),
    assigneeName: input.targetName.trim() || input.targetEmail,
    assigneeUserId: input.targetUserId,
    status: "pending",
    departmentCode: step.departmentCode,
    departmentName: step.departmentName,
    levelLabel: step.levelLabel,
    designation: step.designation,
    escalatedFromStepId: step.id,
  };

  const comments: PolicyComment[] = [
    ...policy.comments,
    {
      id: randomUUID(),
      authorEmail: normalized,
      authorName: name,
      text: reason,
      createdAt: actedAt,
      stepId: step.id,
      type: "escalation",
      targetEmail: normalizeEmail(input.targetEmail),
      targetName: input.targetName.trim(),
    },
  ];

  const approvalSteps = policy.approvalSteps.map((item) => {
    if (item.id === step.id) {
      return {
        ...item,
        status: "escalated" as const,
        comment: reason,
        actedAt,
        escalatedToStepId: newStepId,
      };
    }
    return item;
  });
  approvalSteps.push(newStep);

  return {
    ...policy,
    approvalSteps,
    comments,
    updatedAt: actedAt,
  };
}

export async function getEscalationTargetsForUser(email: string, companyCode: string) {
  const user = await getBiUserByEmail(email, companyCode);
  if (!user) return [];

  const manager = await getDirectReportingManager(user, companyCode);
  if (!manager) return [];

  return [
    {
      userId: manager.USER_ID,
      email: manager.USER_EMAIL,
      name: manager.EMP_FULLNAME || manager.USER_NAME,
      department: manager.DEPARTMENT,
      designation: manager.DESIGNATION?.trim() || "",
      targetKind: "manager" as const,
    },
  ];
}

export interface EscalationTargetOption {
  userId: string;
  email: string;
  name: string;
  department?: string;
  designation?: string;
  targetKind: "manager" | "next_stage";
}

export async function getEscalationTargetsForPolicy(
  policy: StoredPolicy,
  email: string,
): Promise<EscalationTargetOption[]> {
  const user = await getBiUserByEmail(email, policy.companyCode);
  if (!user) return [];

  const normalized = normalizeEmail(email);
  const activeOrder = getActiveGroupOrder(policy.approvalSteps);
  if (activeOrder == null) return [];

  const currentStep = policy.approvalSteps.find(
    (item) =>
      item.groupOrder === activeOrder &&
      item.status === "pending" &&
      normalizeEmail(item.assigneeEmail) === normalized,
  );
  if (!currentStep) return [];

  const deptCode = currentStep.departmentCode ?? policy.departmentCode;
  const targets: EscalationTargetOption[] = [];
  const seenEmails = new Set<string>();

  const pushTarget = (target: EscalationTargetOption) => {
    const key = normalizeEmail(target.email);
    if (!key || seenEmails.has(key)) return;
    seenEmails.add(key);
    targets.push(target);
  };

  const sameDeptChain = await buildSameDepartmentManagerChain(
    user,
    deptCode,
    policy.companyCode,
  );
  for (const manager of sameDeptChain) {
    pushTarget({
      userId: manager.USER_ID,
      email: manager.USER_EMAIL,
      name: manager.EMP_FULLNAME || manager.USER_NAME,
      department: manager.DEPARTMENT,
      designation: manager.DESIGNATION?.trim() || "",
      targetKind: "manager",
    });
  }

  const orders = [...new Set(policy.approvalSteps.map((step) => step.groupOrder))].sort(
    (left, right) => left - right,
  );
  const nextOrder = orders.find((order) => order > activeOrder);
  if (nextOrder != null) {
    for (const step of policy.approvalSteps) {
      if (step.groupOrder !== nextOrder || step.status !== "pending") continue;
      if (normalizeEmail(step.assigneeEmail) === normalized) continue;
      pushTarget({
        userId: step.assigneeUserId ?? step.assigneeEmail,
        email: step.assigneeEmail,
        name:
          step.departmentName && step.levelLabel
            ? `${step.assigneeName} — ${step.departmentName} (${step.levelLabel})`
            : step.assigneeName,
        department: step.departmentName,
        designation: step.levelLabel,
        targetKind: "next_stage",
      });
    }
  }

  return targets;
}

export async function buildApprovalChain(
  requesterEmail: string,
  requesterName: string,
  companyCode: string,
  departmentCode: number,
  additionalApprovers: AdditionalApproverInput[] = [],
  departmentName = "",
  submitterLevelMode: SubmitterLevelMode = "all",
): Promise<ApprovalStep[]> {
  return buildApprovalChainFromSetup(
    requesterEmail,
    requesterName,
    companyCode,
    departmentCode,
    departmentName,
    additionalApprovers,
    submitterLevelMode,
  );
}

function isGroupComplete(group: ApprovalStep[]) {
  return group.some((step) => step.status === "approved");
}

function getActiveGroupOrder(steps: ApprovalStep[]) {
  const orders = [...new Set(steps.map((step) => step.groupOrder))].sort((a, b) => a - b);
  for (const order of orders) {
    if (order === 0) continue;
    const group = steps.filter((step) => step.groupOrder === order);
    if (!isGroupComplete(group)) return order;
  }
  return null;
}

export function getCurrentApprovers(policy: StoredPolicy) {
  const activeOrder = getActiveGroupOrder(policy.approvalSteps);
  if (activeOrder == null) return [];
  return policy.approvalSteps.filter(
    (step) => step.groupOrder === activeOrder && step.status === "pending",
  );
}

export function canUserViewPolicy(policy: StoredPolicy, email: string) {
  const normalized = normalizeEmail(email);
  if (normalizeEmail(policy.createdByEmail) === normalized) return true;
  if (policy.sharedWith.map(normalizeEmail).includes(normalized)) return true;
  if (
    policy.approvalSteps.some(
      (step) => normalizeEmail(step.assigneeEmail) === normalized,
    )
  ) {
    return true;
  }
  return false;
}

// Legacy sync check (creator / approver / shared only). Prefer policy-access.canUserViewPolicy with context.

export function canUserEditPolicy(policy: StoredPolicy, email: string) {
  const normalized = normalizeEmail(email);
  if (normalizeEmail(policy.createdByEmail) !== normalized) return false;
  if (policy.status === "approved" || policy.status === "published") return false;
  return policy.status === "draft" || policy.status === "returned" || policy.status === "in_approval";
}

export function canUserApprovePolicy(policy: StoredPolicy, email: string) {
  if (policy.status !== "in_approval") return false;
  const normalized = normalizeEmail(email);
  return getCurrentApprovers(policy).some(
    (step) => normalizeEmail(step.assigneeEmail) === normalized,
  );
}

function hasExternalPendingApprovers(
  approvalSteps: ApprovalStep[],
  requesterEmail: string,
) {
  const normalized = normalizeEmail(requesterEmail);
  return approvalSteps.some(
    (step) =>
      step.type !== "requester" &&
      step.status === "pending" &&
      normalizeEmail(step.assigneeEmail) !== normalized,
  );
}

async function shouldAutoApproveAsTopLevelSubmitter(
  policy: StoredPolicy,
  requesterEmail: string,
  additionalApprovers: AdditionalApproverInput[],
) {
  if (additionalApprovers.length > 0) return false;

  const requester = await getBiUserByEmail(requesterEmail, policy.companyCode);
  if (!requester) return false;

  const managerChain = await buildSameDepartmentManagerChain(
    requester,
    policy.departmentCode,
    policy.companyCode,
  );
  if (managerChain.length > 0) return false;

  const setup = await getApprovalSetupForDepartment(
    policy.companyCode,
    policy.departmentCode,
    policy.departmentName,
  );
  if (!setup || setup.stages.length === 0) return true;

  const lastStage = setup.stages[setup.stages.length - 1];
  const lastStageDept = Number(lastStage.departmentCode);
  const requesterDept = Number(requester.DEPTCODE);
  const policyDept = Number(policy.departmentCode);

  return lastStageDept === requesterDept || lastStageDept === policyDept;
}

export async function submitPolicyForApproval(
  policy: StoredPolicy,
  requesterEmail: string,
  requesterName: string,
  additionalApprovers: AdditionalApproverInput[] = [],
  submitterLevelMode: SubmitterLevelMode = "all",
) {
  const approvalSteps = await buildApprovalChainFromSetup(
    requesterEmail,
    requesterName,
    policy.companyCode,
    policy.departmentCode,
    policy.departmentName,
    additionalApprovers,
    submitterLevelMode,
  );

  const autoEligible = await shouldAutoApproveAsTopLevelSubmitter(
    policy,
    requesterEmail,
    additionalApprovers,
  );
  const actedAt = new Date().toISOString();

  if (autoEligible && !hasExternalPendingApprovers(approvalSteps, requesterEmail)) {
    const finalizedSteps = approvalSteps.map((step) =>
      step.status === "pending"
        ? { ...step, status: "skipped" as const, actedAt }
        : step,
    );

    return {
      ...policy,
      status: "approved" as const,
      approvalSteps: finalizedSteps,
      submittedAt: actedAt,
      approvedAt: actedAt,
      updatedAt: actedAt,
      comments: [
        ...policy.comments,
        {
          id: randomUUID(),
          authorEmail: normalizeEmail(requesterEmail),
          authorName: requesterName,
          text: "Policy auto-approved: submitter is at the top level in the department with no internal reporting manager, and no other approvers were required.",
          createdAt: actedAt,
          type: "system" as const,
        },
      ],
    };
  }

  const updated: StoredPolicy = {
    ...policy,
    status: "in_approval",
    approvalSteps,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const approvers = getCurrentApprovers(updated);
  for (const approver of approvers) {
    await sendTeamsNotification({
      name: approver.assigneeName,
      mailId: approver.assigneeEmail,
      desc: buildPolicyApprovalTeamsMessage({
        approverName: approver.assigneeName,
        requesterName,
        policyName: policy.name,
        policyId: policy.id,
        version: policy.version,
      }),
    });
  }

  return updated;
}

export function approvePolicyStep(
  policy: StoredPolicy,
  email: string,
  input: { signatureText: string; comment?: string },
) {
  const normalized = normalizeEmail(email);
  const activeOrder = getActiveGroupOrder(policy.approvalSteps);
  if (activeOrder == null) {
    throw new Error("No pending approval step");
  }

  const step = policy.approvalSteps.find(
    (item) =>
      item.groupOrder === activeOrder &&
      item.status === "pending" &&
      normalizeEmail(item.assigneeEmail) === normalized,
  );
  if (!step) {
    throw new Error("You are not the current approver");
  }
  if (!input.signatureText.trim()) {
    throw new Error("Signature is required");
  }

  const actedAt = new Date().toISOString();
  const comments: PolicyComment[] = [...policy.comments];
  if (input.comment?.trim()) {
    comments.push({
      id: randomUUID(),
      authorEmail: normalized,
      authorName: step.assigneeName,
      text: input.comment.trim(),
      createdAt: actedAt,
      stepId: step.id,
    });
  }

  const approvalSteps = policy.approvalSteps.map((item) => {
    if (item.id === step.id) {
      return {
        ...item,
        status: "approved" as const,
        signatureText: input.signatureText.trim(),
        comment: input.comment?.trim(),
        actedAt,
      };
    }
    if (item.groupOrder === activeOrder && item.status === "pending") {
      return { ...item, status: "skipped" as const, actedAt };
    }
    return item;
  });

  const interim: StoredPolicy = {
    ...policy,
    approvalSteps,
    comments,
    updatedAt: actedAt,
  };

  const nextApprovers = getCurrentApprovers(interim);
  if (nextApprovers.length === 0 && getActiveGroupOrder(approvalSteps) == null) {
    return {
      ...interim,
      status: "approved" as const,
      approvedAt: actedAt,
    };
  }

  return interim;
}

export function rejectPolicyStep(
  policy: StoredPolicy,
  email: string,
  comment: string,
) {
  const normalized = normalizeEmail(email);
  const activeOrder = getActiveGroupOrder(policy.approvalSteps);
  if (activeOrder == null) throw new Error("No pending approval step");

  const step = policy.approvalSteps.find(
    (item) =>
      item.groupOrder === activeOrder &&
      item.status === "pending" &&
      normalizeEmail(item.assigneeEmail) === normalized,
  );
  if (!step) throw new Error("You are not the current approver");

  const actedAt = new Date().toISOString();
  const comments: PolicyComment[] = [
    ...policy.comments,
    {
      id: randomUUID(),
      authorEmail: normalized,
      authorName: step.assigneeName,
      text: comment.trim() || "Rejected",
      createdAt: actedAt,
      stepId: step.id,
    },
  ];

  return {
    ...policy,
    status: "returned" as const,
    approvalSteps: policy.approvalSteps.map((item) =>
      item.id === step.id
        ? { ...item, status: "rejected" as const, comment, actedAt }
        : item,
    ),
    comments,
    updatedAt: actedAt,
  };
}

export function addPolicyComment(
  policy: StoredPolicy,
  email: string,
  name: string,
  text: string,
) {
  if (!text.trim()) throw new Error("Comment is required");
  return {
    ...policy,
    comments: [
      ...policy.comments,
      {
        id: randomUUID(),
        authorEmail: normalizeEmail(email),
        authorName: name,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function grantPolicyAccess(policy: StoredPolicy, email: string) {
  const normalized = normalizeEmail(email);
  if (policy.sharedWith.map(normalizeEmail).includes(normalized)) return policy;
  return {
    ...policy,
    sharedWith: [...policy.sharedWith, normalized],
    updatedAt: new Date().toISOString(),
  };
}

export function canUserPublishPolicy(policy: StoredPolicy, email: string) {
  if (policy.status !== "approved") return false;
  return normalizeEmail(policy.createdByEmail) === normalizeEmail(email);
}

export function publishPolicy(policy: StoredPolicy, email: string) {
  if (!canUserPublishPolicy(policy, email)) {
    throw new Error("Only the requester can publish a fully approved policy");
  }

  const publishedAt = new Date().toISOString();
  return {
    ...policy,
    status: "published" as const,
    isActive: true,
    publishedAt,
    updatedAt: publishedAt,
    deactivatedAt: undefined,
    deactivatedReason: undefined,
  };
}

export async function notifyNextApprovers(
  policy: StoredPolicy,
  requesterName: string,
) {
  const approvers = getCurrentApprovers(policy);
  for (const approver of approvers) {
    await sendTeamsNotification({
      name: approver.assigneeName,
      mailId: approver.assigneeEmail,
      desc: buildPolicyApprovalTeamsMessage({
        approverName: approver.assigneeName,
        requesterName,
        policyName: policy.name,
        policyId: policy.id,
        version: policy.version,
      }),
    });
  }
}

function isApprovalGroupComplete(steps: ApprovalStep[], groupOrder: number) {
  const group = steps.filter((step) => step.groupOrder === groupOrder);
  if (group.length === 0) return false;
  return group.some((step) => step.status === "approved");
}

function extractAdditionalApproversFromSteps(steps: ApprovalStep[]): AdditionalApproverInput[] {
  const seen = new Set<string>();
  const result: AdditionalApproverInput[] = [];
  for (const step of steps) {
    if (step.type !== "additional_approver") continue;
    const key = `${step.groupOrder}:${normalizeEmail(step.assigneeEmail)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      groupOrder: step.groupOrder,
      assigneeEmail: step.assigneeEmail,
      assigneeName: step.assigneeName,
      assigneeUserId: step.assigneeUserId,
    });
  }
  return result;
}

function mergeCompletedPolicyChain(
  policy: StoredPolicy,
  newChain: ApprovalStep[],
  actedAt: string,
): ApprovalStep[] {
  return newChain.map((step) => {
    if (step.groupOrder === 0) return step;
    const oldMatch = policy.approvalSteps.find(
      (item) =>
        item.groupOrder === step.groupOrder &&
        normalizeEmail(item.assigneeEmail) === normalizeEmail(step.assigneeEmail),
    );
    if (oldMatch && oldMatch.status !== "pending") {
      return {
        ...step,
        status: oldMatch.status,
        signatureText: oldMatch.signatureText,
        comment: oldMatch.comment,
        actedAt: oldMatch.actedAt,
      };
    }
    return {
      ...step,
      status: "approved" as const,
      actedAt: policy.approvedAt ?? policy.publishedAt ?? actedAt,
      signatureText: step.signatureText ?? "—",
    };
  });
}

export function canRefreshPolicyFromSetup(policy: StoredPolicy, email: string) {
  if (!policy.pendingSetupRefresh) return false;
  return normalizeEmail(policy.createdByEmail) === normalizeEmail(email);
}

export async function refreshPolicyApprovalFromSetup(
  policy: StoredPolicy,
): Promise<StoredPolicy> {
  const refreshable = ["in_approval", "returned", "approved", "published"];
  if (!refreshable.includes(policy.status)) {
    throw new Error("This policy cannot be updated from the new approval setup");
  }

  const submitterLevelMode = await getDefaultSubmitterLevelMode(
    policy.companyCode,
    policy.departmentCode,
    policy.departmentName,
  );
  const additionalApprovers = extractAdditionalApproversFromSteps(policy.approvalSteps);
  const newChain = await buildApprovalChainFromSetup(
    policy.createdByEmail,
    policy.createdByName,
    policy.companyCode,
    policy.departmentCode,
    policy.departmentName,
    additionalApprovers,
    submitterLevelMode,
  );

  const actedAt = new Date().toISOString();
  const activeOrder = getActiveGroupOrder(policy.approvalSteps);
  let approvalSteps: ApprovalStep[];

  if (activeOrder == null) {
    approvalSteps = mergeCompletedPolicyChain(policy, newChain, actedAt);
  } else {
    const groupOrders = [...new Set(newChain.map((step) => step.groupOrder))].sort(
      (left, right) => left - right,
    );
    approvalSteps = [];
    for (const order of groupOrders) {
      if (isApprovalGroupComplete(policy.approvalSteps, order)) {
        approvalSteps.push(...policy.approvalSteps.filter((step) => step.groupOrder === order));
        continue;
      }
      approvalSteps.push(...newChain.filter((step) => step.groupOrder === order));
      approvalSteps.push(
        ...policy.approvalSteps.filter(
          (step) =>
            step.groupOrder === order &&
            (step.status === "escalated" || step.type === "escalated_approver"),
        ),
      );
    }
  }

  let status = policy.status;
  if (status === "returned") {
    status = "in_approval";
  }

  const refreshed: StoredPolicy = {
    ...policy,
    status,
    approvalSteps,
    pendingMatrixChange: null,
    pendingSetupRefresh: null,
    comments: [
      ...policy.comments,
      {
        id: randomUUID(),
        authorEmail: normalizeEmail(policy.createdByEmail),
        authorName: policy.createdByName,
        text: "Approval matrix updated to match the latest IT approval setup.",
        createdAt: actedAt,
        type: "system",
      },
    ],
    updatedAt: actedAt,
  };

  if (status === "in_approval") {
    await notifyNextApprovers(refreshed, policy.createdByName);
  }

  return refreshed;
}
