import {
  APPROVAL_STEP_LABELS,
  type ApprovalStep,
  type ApprovalStepType,
  type Policy,
} from "@/lib/types";

export type ApprovalLevelStatus =
  | "completed"
  | "current"
  | "pending"
  | "rejected"
  | "skipped";

export interface ApprovalLevel {
  order: number;
  label: string;
  type: ApprovalStepType | "requester";
  steps: ApprovalStep[];
  status: ApprovalLevelStatus;
  statusLabel: string;
  isParallel: boolean;
}

function compactLevelLabel(steps: ApprovalStep[]) {
  const step = steps[0];
  if (!step) return "Approval";
  if (step.departmentName?.trim()) return step.departmentName.trim();
  if (step.levelLabel?.trim()) return step.levelLabel.trim();
  if (step.designation?.trim()) return step.designation.trim();
  return "Approval";
}

function levelLabel(
  type: ApprovalStepType | "requester",
  isParallel: boolean,
  steps: ApprovalStep[],
) {
  if (type === "requester") return "Creator";
  if (
    type === "department_approver" ||
    type === "escalated_approver" ||
    type === "additional_approver"
  ) {
    return compactLevelLabel(steps);
  }
  if (isParallel) return APPROVAL_STEP_LABELS[type];
  return APPROVAL_STEP_LABELS[type];
}

function resolveLevelStatus(
  steps: ApprovalStep[],
  isActiveGroup: boolean,
): { status: ApprovalLevelStatus; statusLabel: string } {
  if (steps.some((step) => step.status === "rejected")) {
    return { status: "rejected", statusLabel: "Returned" };
  }

  if (steps.some((step) => step.status === "approved")) {
    return { status: "completed", statusLabel: "Approved" };
  }

  if (steps.some((step) => step.status === "escalated")) {
    return { status: "completed", statusLabel: "Escalated" };
  }

  if (isActiveGroup) {
    return { status: "current", statusLabel: "Pending" };
  }

  return { status: "pending", statusLabel: "Waiting" };
}

export function stepStatusLabel(step: ApprovalStep, levelStatus: ApprovalLevelStatus) {
  if (step.status === "approved") return "Approved";
  if (step.status === "rejected") return "Returned";
  if (step.status === "escalated") return "Escalated";
  if (step.status === "skipped") return "Not required";
  if (levelStatus === "current") return "Pending";
  return "Waiting";
}

export function buildApprovalLevels(policy: Policy): ApprovalLevel[] {
  const requester = policy.approvalSteps.find((step) => step.type === "requester");
  const activeOrder = policy.currentApprovers[0]?.groupOrder ?? null;

  const levels: ApprovalLevel[] = [];

  if (requester) {
    levels.push({
      order: 0,
      label: "Creator",
      type: "requester",
      steps: [requester],
      status: "completed",
      statusLabel: policy.submittedAt ? "Submitted" : "Draft",
      isParallel: false,
    });
  } else if (policy.createdByName) {
    levels.push({
      order: 0,
      label: "Creator",
      type: "requester",
      steps: [],
      status: policy.status === "draft" ? "current" : "completed",
      statusLabel: policy.status === "draft" ? "Draft" : "Submitted",
      isParallel: false,
    });
  }

  const grouped = [...policy.approvalSteps]
    .filter((step) => step.type !== "requester")
    .reduce<Map<number, ApprovalStep[]>>((map, step) => {
      const list = map.get(step.groupOrder) ?? [];
      list.push(step);
      map.set(step.groupOrder, list);
      return map;
    }, new Map());

  for (const [order, steps] of [...grouped.entries()].sort(([a], [b]) => a - b)) {
    const type = steps[0]?.type ?? "direct_manager";
    const isParallel = steps.length > 1;
    const isActiveGroup = activeOrder === order;
    const { status, statusLabel } = resolveLevelStatus(steps, isActiveGroup);

    levels.push({
      order,
      label: levelLabel(type, isParallel, steps),
      type,
      steps,
      status,
      statusLabel,
      isParallel,
    });
  }

  return levels;
}

export function compactApprovalStepLabel(step: ApprovalStep) {
  if (step.departmentName?.trim()) return step.departmentName.trim();
  if (step.levelLabel?.trim()) return step.levelLabel.trim();
  return APPROVAL_STEP_LABELS[step.type] ?? "Approval";
}

export function findUserLevel(
  levels: ApprovalLevel[],
  email: string,
): ApprovalLevel | undefined {
  const normalized = email.toLowerCase();
  return levels.find((level) =>
    level.steps.some((step) => step.assigneeEmail.toLowerCase() === normalized),
  );
}
