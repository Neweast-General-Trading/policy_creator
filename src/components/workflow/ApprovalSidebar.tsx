import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Minus,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApprovalLevels, type ApprovalLevel } from "@/lib/approval-chain";
import { previewApprovalChain } from "@/lib/api";
import type { ApprovalStep, Policy } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ApprovalSidebarProps {
  policy: Policy;
  userEmail?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function stepDot(step: ApprovalStep, level: ApprovalLevel) {
  if (step.status === "approved") {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
  }
  if (step.status === "rejected") {
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  }
  if (step.status === "skipped") {
    return <Minus className="h-3.5 w-3.5 shrink-0 text-slate-300" />;
  }
  if (level.status === "current") {
    return <Clock3 className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
  }
  return <CircleDashed className="h-3.5 w-3.5 shrink-0 text-slate-300" />;
}

function levelStatusIcon(level: ApprovalLevel) {
  if (level.status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (level.status === "rejected") {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  if (level.status === "current") {
    return <Clock3 className="h-4 w-4 text-amber-500" />;
  }
  return <CircleDashed className="h-4 w-4 text-slate-300" />;
}

function shouldShowSignature(step: ApprovalStep) {
  if (!step.signatureText?.trim()) return false;
  const sig = step.signatureText.trim().toLowerCase();
  const name = step.assigneeName.trim().toLowerCase();
  return sig !== name && !name.startsWith(sig) && !sig.startsWith(name.split(" ")[0] ?? "");
}

function CreatorBlock({ name, submitted }: { name: string; submitted: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/60 px-2 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 text-xs font-semibold text-violet-700">
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[13px] font-medium leading-snug text-slate-800">{name}</p>
        <p className="text-[11px] text-slate-500">{submitted ? "Submitted" : "Draft"}</p>
      </div>
      {submitted && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
    </div>
  );
}

function SinglePersonBlock({
  step,
  level,
  isYou,
}: {
  step: ApprovalStep;
  level: ApprovalLevel;
  isYou: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white/60 px-2.5 py-2",
        isYou && level.status === "current" && "ring-1 ring-amber-300/70",
      )}
    >
      <p className="break-words text-[13px] font-medium leading-snug text-slate-800">
        {step.assigneeName}
      </p>
      {isYou && level.status === "current" && step.status === "pending" && (
        <p className="mt-0.5 text-[11px] font-medium text-amber-700">Your turn</p>
      )}
      {shouldShowSignature(step) && (
        <p
          className="mt-1 break-words text-lg leading-tight text-blue-700"
          style={{
            fontFamily: "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
          }}
        >
          {step.signatureText?.trim()}
        </p>
      )}
    </div>
  );
}

function GroupMembersBlock({
  steps,
  level,
  userEmail,
}: {
  steps: ApprovalStep[];
  level: ApprovalLevel;
  userEmail: string;
}) {
  const showCompact = level.status === "completed";
  const approver = steps.find((step) => step.status === "approved");

  if (showCompact && approver) {
    return (
      <div className="space-y-1.5">
        <div className="rounded-lg bg-white/60 px-2.5 py-2">
          <p className="break-words text-[13px] font-medium leading-snug text-slate-800">
            {approver.assigneeName}
          </p>
          {approver.signatureText?.trim() && (
            <p
              className="mt-1 break-words text-lg leading-tight text-blue-700"
              style={{
                fontFamily: "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
              }}
            >
              {approver.signatureText.trim()}
            </p>
          )}
        </div>
        {steps.length > 1 && (
          <p className="px-1 text-[11px] text-slate-400">
            +{steps.length - 1} team member{steps.length - 1 > 1 ? "s" : ""} not required
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {steps.map((step) => {
        const isYou = step.assigneeEmail.toLowerCase() === userEmail;
        const dimmed = step.status === "skipped";

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-2 rounded-md px-1.5 py-1",
              isYou && level.status === "current" && step.status === "pending" && "bg-amber-50/80",
              dimmed && "opacity-50",
            )}
          >
            {stepDot(step, level)}
            <div className="min-w-0 flex-1">
              <p className="break-words text-[12px] leading-snug text-slate-700">
                {step.assigneeName}
              </p>
              {isYou && level.status === "current" && step.status === "pending" && (
                <p className="text-[10px] font-medium text-amber-700">Your turn</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function flowSummary(policy: Policy, waitingNames: string | null) {
  if (waitingNames) {
    return (
      <>
        Waiting on <span className="font-medium text-amber-700">{waitingNames}</span>
      </>
    );
  }
  if (policy.status === "published") return "Published";
  if (policy.status === "approved") return "Ready to publish";
  if (policy.status === "in_approval") return "In progress";
  return "Not started";
}

function buildPreviewPolicy(policy: Policy, steps: Policy["approvalSteps"]): Policy {
  const pendingOrders = [
    ...new Set(
      steps
        .filter((step) => step.type !== "requester" && step.status === "pending")
        .map((step) => step.groupOrder),
    ),
  ].sort((left, right) => left - right);
  const activeOrder = pendingOrders[0] ?? null;
  return {
    ...policy,
    approvalSteps: steps,
    currentApprovers:
      activeOrder == null
        ? []
        : steps.filter(
            (step) => step.groupOrder === activeOrder && step.status === "pending",
          ),
  };
}

export default function ApprovalSidebar({ policy, userEmail = "" }: ApprovalSidebarProps) {
  const shouldPreview =
    (policy.status === "draft" || policy.status === "returned") &&
    Boolean(policy.companyCode && policy.departmentCode);

  const previewQuery = useQuery({
    queryKey: [
      "approval-preview-sidebar",
      policy.id,
      policy.companyCode,
      policy.departmentCode,
      policy.departmentName,
    ],
    queryFn: () =>
      previewApprovalChain({
        companyCode: policy.companyCode,
        departmentCode: policy.departmentCode,
        departmentName: policy.departmentName,
      }),
    enabled: shouldPreview,
  });

  const displayPolicy = useMemo(() => {
    if (!shouldPreview || !previewQuery.data?.steps?.length) return policy;
    return buildPreviewPolicy(policy, previewQuery.data.steps);
  }, [policy, previewQuery.data?.steps, shouldPreview]);

  const levels = buildApprovalLevels(displayPolicy);
  const normalizedUser = userEmail.toLowerCase();

  const waitingNames =
    displayPolicy.currentApprovers.length > 0
      ? displayPolicy.currentApprovers.map((item) => item.assigneeName).join(", ")
      : null;

  if (shouldPreview && previewQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Approval Flow
          </div>
          <p className="text-xs leading-relaxed text-slate-600">Loading approval matrix…</p>
        </div>
      </div>
    );
  }

  if (shouldPreview && previewQuery.isError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Approval Flow
          </div>
          <p className="text-xs leading-relaxed text-red-700">
            Could not load approval preview. Check that approval setup exists for this department.
          </p>
        </div>
      </div>
    );
  }

  if (levels.length <= 1 && policy.status === "draft" && !shouldPreview) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Approval Flow
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Submit to start the approval chain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-3">
      <div className="border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-900">Approval Flow</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">{flowSummary(displayPolicy, waitingNames)}</p>
      </div>

      {shouldPreview && previewQuery.data?.steps?.length ? (
        <p className="mb-2 rounded-md bg-violet-50 px-2 py-1.5 text-[11px] text-violet-800">
          Preview — actual chain is created when you submit for approval.
        </p>
      ) : null}

      {policy.pendingMatrixChange?.status === "pending" ? (
        <p className="mb-2 rounded-md bg-sky-50 px-2 py-1.5 text-[11px] text-sky-900">
          Matrix update by {policy.pendingMatrixChange.requestedByName} — pending{" "}
          {policy.pendingMatrixChange.reviewerName}.
        </p>
      ) : null}

      <ol className="space-y-0">
        {levels.map((level, index) => {
          const isLast = index === levels.length - 1;
          const isCreator = level.type === "requester";
          const creatorName =
            level.steps[0]?.assigneeName || displayPolicy.createdByName || "—";

          return (
            <li key={`${level.order}-${level.label}`} className="relative flex gap-3 pb-4">
              {!isLast && (
                <span
                  className={cn(
                    "absolute start-[11px] top-7 h-[calc(100%-4px)] w-px",
                    level.status === "completed" ? "bg-emerald-200" : "bg-slate-200",
                  )}
                />
              )}

              <div
                className={cn(
                  "relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                  level.status === "completed"
                    ? "bg-emerald-500"
                    : level.status === "current"
                      ? "bg-amber-500"
                      : level.status === "rejected"
                        ? "bg-red-500"
                        : "bg-slate-300",
                )}
              >
                {index + 1}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {level.label}
                  </p>
                  {levelStatusIcon(level)}
                </div>

                {isCreator ? (
                  <CreatorBlock
                    name={creatorName}
                    submitted={!!displayPolicy.submittedAt || displayPolicy.status !== "draft"}
                  />
                ) : level.isParallel ? (
                  <GroupMembersBlock
                    steps={level.steps}
                    level={level}
                    userEmail={normalizedUser}
                  />
                ) : level.steps[0] ? (
                  <SinglePersonBlock
                    step={level.steps[0]}
                    level={level}
                    isYou={level.steps[0].assigneeEmail.toLowerCase() === normalizedUser}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}
