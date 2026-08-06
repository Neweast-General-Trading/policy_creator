import { CheckCircle2, Circle, Clock3, XCircle } from "lucide-react";
import {
  APPROVAL_STEP_LABELS,
  type ApprovalStep,
  type Policy,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function stepIcon(status: ApprovalStep["status"]) {
  if (status === "approved") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "rejected") return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === "pending") return <Clock3 className="h-4 w-4 text-amber-500" />;
  return <Circle className="h-4 w-4 text-slate-400" />;
}

export default function ApprovalMatrix({
  policy,
  preview = false,
}: {
  policy: Policy;
  preview?: boolean;
}) {
  const grouped = [...policy.approvalSteps]
    .filter((step) => step.type !== "requester")
    .reduce<Map<number, ApprovalStep[]>>((map, step) => {
      const list = map.get(step.groupOrder) ?? [];
      list.push(step);
      map.set(step.groupOrder, list);
      return map;
    }, new Map());

  if (grouped.size === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
        Approval chain will be generated when the policy is submitted.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Approval Matrix</h3>
        {policy.currentApprovers.length > 0 && !preview && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            Waiting: {policy.currentApprovers.map((item) => item.assigneeName).join(", ")}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Approver</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Signature / Comment</th>
            </tr>
          </thead>
          <tbody>
            {[...grouped.entries()]
              .sort(([a], [b]) => a - b)
              .flatMap(([, steps]) => steps)
              .map((step) => {
                const isCurrent = policy.currentApprovers.some(
                  (item) => item.id === step.id,
                );
                const pendingChange = policy.pendingMatrixChange?.changes.find(
                  (change) => change.stepId === step.id,
                );
                return (
                  <tr
                    key={step.id}
                    className={cn(
                      "border-t border-slate-100",
                      isCurrent && "bg-amber-50/70",
                      pendingChange && "bg-sky-50/70",
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {APPROVAL_STEP_LABELS[step.type]}
                      {preview && step.groupOrder > 0 ? (
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          Level {step.groupOrder}
                        </span>
                      ) : null}
                      {pendingChange ? (
                        <span className="mt-0.5 block text-xs font-normal text-sky-700">
                          Pending manager approval
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {pendingChange ? (
                        <span>
                          <span className="line-through text-slate-400">{pendingChange.fromName}</span>
                          <span className="mx-1 text-sky-700">→</span>
                          {step.assigneeName}
                        </span>
                      ) : (
                        step.assigneeName
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {preview ? (
                        <span className="text-slate-500">Pending</span>
                      ) : (
                        <div className="flex items-center gap-2 capitalize">
                          {stepIcon(step.status)}
                          {step.status.replace("_", " ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {preview ? (
                        "—"
                      ) : step.signatureText ? (
                        <span className="font-medium italic">{step.signatureText}</span>
                      ) : (
                        "—"
                      )}
                      {step.comment ? (
                        <div className="mt-1 text-xs text-slate-500">{step.comment}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
