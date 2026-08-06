import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveMatrixChangeApi, rejectMatrixChangeApi } from "@/lib/api";
import type { Policy } from "@/lib/types";

interface MatrixChangeReviewPanelProps {
  policy: Policy;
  onUpdated: (policy: Policy) => void;
}

export default function MatrixChangeReviewPanel({
  policy,
  onUpdated,
}: MatrixChangeReviewPanelProps) {
  const pending = policy.pendingMatrixChange;
  const [reason, setReason] = useState("");
  const [isActing, setIsActing] = useState(false);

  if (!pending || pending.status !== "pending") return null;

  return (
    <div className="app-surface space-y-4 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/40 p-4 md:p-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Matrix Update Approval</h3>
        <p className="mt-1 text-sm text-slate-600">
          {pending.requestedByName} requested an approval matrix update. Review the changes below.
        </p>
      </div>

      <div className="space-y-2">
        {pending.changes.map((change) => (
          <div
            key={change.stepId}
            className="rounded-lg border border-sky-200 bg-white/80 px-4 py-3 text-sm"
          >
            <p className="font-medium text-slate-800">Level {change.groupOrder}</p>
            <p className="mt-1 text-slate-600">
              <span className="line-through">{change.fromName}</span>
              <span className="mx-2 text-sky-700">→</span>
              <span className="font-semibold text-sky-900">{change.toName}</span>
            </p>
          </div>
        ))}
      </div>

      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Optional rejection reason"
        rows={2}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isActing}
          onClick={async () => {
            setIsActing(true);
            try {
              const updated = await approveMatrixChangeApi(policy.id);
              onUpdated(updated);
              toast.success("Matrix update approved");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to approve matrix update");
            } finally {
              setIsActing(false);
            }
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          Approve Matrix Update
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isActing}
          onClick={async () => {
            setIsActing(true);
            try {
              const updated = await rejectMatrixChangeApi(policy.id, reason);
              onUpdated(updated);
              toast.success("Matrix update rejected");
              setReason("");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to reject matrix update");
            } finally {
              setIsActing(false);
            }
          }}
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
