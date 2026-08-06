import { randomUUID } from "node:crypto";
import {
  buildSameDepartmentManagerChain,
  getBiUserByEmail,
  normalizeEmail,
} from "./bi-users.js";
import type { BiUser } from "./bi-users.js";
import { buildPolicyApprovalTeamsMessage, sendTeamsNotification } from "./teams-notify.js";
import type {
  ApprovalStep,
  PendingMatrixChange,
  PolicyComment,
  StoredPolicy,
} from "./workflow-types.js";

export interface MatrixChangeInput {
  stepId: string;
  assigneeEmail: string;
  assigneeName: string;
  assigneeUserId?: string;
}

function formatChangeSummary(change: PendingMatrixChange["changes"][number]) {
  return `${change.fromName} → ${change.toName}`;
}

function buildMatrixChangeComment(
  authorEmail: string,
  authorName: string,
  text: string,
): PolicyComment {
  return {
    id: randomUUID(),
    authorEmail: normalizeEmail(authorEmail),
    authorName,
    text,
    createdAt: new Date().toISOString(),
    type: "matrix_change",
  };
}

export async function resolveMatrixChangeReviewer(
  policy: StoredPolicy,
): Promise<BiUser | null> {
  const requester = await getBiUserByEmail(policy.createdByEmail, policy.companyCode);
  if (!requester) return null;

  const chain = await buildSameDepartmentManagerChain(
    requester,
    policy.departmentCode,
    policy.companyCode,
  );
  if (chain.length > 0) {
    return chain[chain.length - 1];
  }

  return requester;
}

export function canProposeMatrixChange(policy: StoredPolicy, email: string) {
  if (policy.pendingMatrixChange?.status === "pending") return false;
  if (!["in_approval", "returned"].includes(policy.status)) return false;
  if (policy.approvalSteps.length === 0) return false;
  return normalizeEmail(policy.createdByEmail) === normalizeEmail(email);
}

export function canReviewMatrixChange(policy: StoredPolicy, email: string) {
  const pending = policy.pendingMatrixChange;
  if (!pending || pending.status !== "pending") return false;
  return normalizeEmail(pending.reviewerEmail) === normalizeEmail(email);
}

function validateChanges(
  policy: StoredPolicy,
  changes: MatrixChangeInput[],
) {
  if (changes.length === 0) {
    throw new Error("At least one matrix change is required");
  }

  for (const change of changes) {
    if (!change.assigneeEmail?.trim()) {
      throw new Error("New approver email is required");
    }

    const step = policy.approvalSteps.find((item) => item.id === change.stepId);
    if (!step) throw new Error("Approval step not found");
    if (step.type === "requester") {
      throw new Error("The requester step cannot be changed");
    }
    if (step.status !== "pending") {
      throw new Error("Only pending approvers can be changed");
    }

    const nextEmail = normalizeEmail(change.assigneeEmail);
    if (nextEmail === normalizeEmail(step.assigneeEmail)) {
      throw new Error("New approver must be different from the current approver");
    }

    const duplicate = policy.approvalSteps.some(
      (item) =>
        item.groupOrder === step.groupOrder &&
        item.id !== step.id &&
        normalizeEmail(item.assigneeEmail) === nextEmail,
    );
    if (duplicate) {
      throw new Error("This person is already an approver at this level");
    }
  }
}

function applyChangesToSteps(
  steps: ApprovalStep[],
  changes: PendingMatrixChange["changes"],
): ApprovalStep[] {
  return steps.map((step) => {
    const change = changes.find((item) => item.stepId === step.id);
    if (!change) return step;
    return {
      ...step,
      assigneeEmail: normalizeEmail(change.toEmail),
      assigneeName: change.toName.trim() || change.toEmail,
      assigneeUserId: change.toUserId,
      signatureText: undefined,
      comment: undefined,
      actedAt: undefined,
    };
  });
}

async function notifyMatrixChangeReviewer(
  policy: StoredPolicy,
  reviewer: BiUser,
  requesterName: string,
) {
  const appUrl = (process.env.CLIENT_URL || "https://policycreator.neweast.cloud").replace(
    /\/$/,
    "",
  );
  await sendTeamsNotification({
    name: reviewer.EMP_FULLNAME || reviewer.USER_NAME,
    mailId: reviewer.USER_EMAIL,
    desc: `Hi ${reviewer.EMP_FULLNAME || reviewer.USER_NAME},

${requesterName} requested an approval matrix update for "${policy.name}" (v${policy.version}).

Please review and approve the matrix change.

View Policy: ${appUrl}/?policy=${policy.id}

Regards,
Business Systems`,
  });
}

async function notifyNewApprover(
  policy: StoredPolicy,
  approver: ApprovalStep,
  requesterName: string,
) {
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

export async function proposeMatrixChange(
  policy: StoredPolicy,
  editorEmail: string,
  editorName: string,
  changes: MatrixChangeInput[],
): Promise<StoredPolicy> {
  if (!canProposeMatrixChange(policy, editorEmail)) {
    throw new Error("You cannot update the approval matrix for this policy");
  }

  validateChanges(policy, changes);

  const reviewer = await resolveMatrixChangeReviewer(policy);
  if (!reviewer) {
    throw new Error("Could not resolve the department manager for matrix approval");
  }

  const mappedChanges = changes.map((change) => {
    const step = policy.approvalSteps.find((item) => item.id === change.stepId)!;
    return {
      stepId: change.stepId,
      groupOrder: step.groupOrder,
      fromEmail: step.assigneeEmail,
      fromName: step.assigneeName,
      toEmail: normalizeEmail(change.assigneeEmail),
      toName: change.assigneeName.trim() || change.assigneeEmail,
      toUserId: change.assigneeUserId,
    };
  });

  const summary = mappedChanges.map(formatChangeSummary).join("; ");
  const actedAt = new Date().toISOString();

  if (normalizeEmail(reviewer.USER_EMAIL) === normalizeEmail(editorEmail)) {
    const approvalSteps = applyChangesToSteps(policy.approvalSteps, mappedChanges);
    const comments: PolicyComment[] = [
      ...policy.comments,
      buildMatrixChangeComment(
        editorEmail,
        editorName,
        `Approval matrix updated by ${editorName}: ${summary}`,
      ),
    ];

    const updated: StoredPolicy = {
      ...policy,
      approvalSteps,
      comments,
      pendingMatrixChange: null,
      updatedAt: actedAt,
    };

    const { getCurrentApprovers } = await import("./workflow.js");
    for (const approver of getCurrentApprovers(updated)) {
      if (mappedChanges.some((change) => change.toEmail === normalizeEmail(approver.assigneeEmail))) {
        await notifyNewApprover(updated, approver, policy.createdByName);
      }
    }

    return updated;
  }

  const pending: PendingMatrixChange = {
    id: randomUUID(),
    status: "pending",
    requestedByEmail: normalizeEmail(editorEmail),
    requestedByName: editorName,
    requestedAt: actedAt,
    reviewerEmail: normalizeEmail(reviewer.USER_EMAIL),
    reviewerName: reviewer.EMP_FULLNAME || reviewer.USER_NAME,
    changes: mappedChanges,
  };

  await notifyMatrixChangeReviewer(policy, reviewer, editorName);

  return {
    ...policy,
    pendingMatrixChange: pending,
    comments: [
      ...policy.comments,
      buildMatrixChangeComment(
        editorEmail,
        editorName,
        `Approval matrix update requested by ${editorName}: ${summary}. Waiting for department manager (${pending.reviewerName}).`,
      ),
    ],
    updatedAt: actedAt,
  };
}

export async function approveMatrixChange(
  policy: StoredPolicy,
  reviewerEmail: string,
  reviewerName: string,
): Promise<StoredPolicy> {
  if (!canReviewMatrixChange(policy, reviewerEmail)) {
    throw new Error("You are not allowed to approve this matrix change");
  }

  const pending = policy.pendingMatrixChange!;
  const actedAt = new Date().toISOString();
  const summary = pending.changes.map(formatChangeSummary).join("; ");
  const approvalSteps = applyChangesToSteps(policy.approvalSteps, pending.changes);

  const updated: StoredPolicy = {
    ...policy,
    approvalSteps,
    pendingMatrixChange: {
      ...pending,
      status: "approved",
      reviewedByEmail: normalizeEmail(reviewerEmail),
      reviewedByName: reviewerName,
      reviewedAt: actedAt,
    },
    comments: [
      ...policy.comments,
      buildMatrixChangeComment(
        reviewerEmail,
        reviewerName,
        `Approval matrix update approved by ${reviewerName}: ${summary}`,
      ),
    ],
    updatedAt: actedAt,
  };

  updated.pendingMatrixChange = null;

  const { getCurrentApprovers } = await import("./workflow.js");
  for (const approver of getCurrentApprovers(updated)) {
    if (
      pending.changes.some(
        (change) => change.toEmail === normalizeEmail(approver.assigneeEmail),
      )
    ) {
      await notifyNewApprover(updated, approver, policy.createdByName);
    }
  }

  return updated;
}

export function rejectMatrixChange(
  policy: StoredPolicy,
  reviewerEmail: string,
  reviewerName: string,
  reason?: string,
): StoredPolicy {
  if (!canReviewMatrixChange(policy, reviewerEmail)) {
    throw new Error("You are not allowed to reject this matrix change");
  }

  const pending = policy.pendingMatrixChange!;
  const actedAt = new Date().toISOString();
  const summary = pending.changes.map(formatChangeSummary).join("; ");
  const reasonText = reason?.trim() ? ` Reason: ${reason.trim()}` : "";

  return {
    ...policy,
    pendingMatrixChange: null,
    comments: [
      ...policy.comments,
      buildMatrixChangeComment(
        reviewerEmail,
        reviewerName,
        `Approval matrix update rejected by ${reviewerName}: ${summary}.${reasonText}`,
      ),
    ],
    updatedAt: actedAt,
  };
}

export function applyPendingMatrixPreview(steps: ApprovalStep[], pending?: PendingMatrixChange | null) {
  if (!pending || pending.status !== "pending") return steps;
  return applyChangesToSteps(steps, pending.changes);
}
