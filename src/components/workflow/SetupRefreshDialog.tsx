import { GitBranch, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshApprovalSetupApi } from "@/lib/api";
import type { Policy } from "@/lib/types";

interface SetupRefreshDialogProps {
  open: boolean;
  policy: Policy;
  onClose: () => void;
  onUpdated: (policy: Policy) => void;
}

export default function SetupRefreshDialog({
  open,
  policy,
  onClose,
  onUpdated,
}: SetupRefreshDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const updated = await refreshApprovalSetupApi(policy.id);
      onUpdated(updated);
      toast.success("Approval matrix updated for this policy");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update approval matrix");
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Close approval setup update dialog"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-50 p-2 text-red-600">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Approval matrix updated</h2>
              <p className="mt-1 text-sm text-slate-600">
                IT updated the approval setup for {policy.departmentName}. Do you want to apply the
                new matrix to your current request?
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm text-slate-600">
          <p>
            Policy: <span className="font-medium text-slate-900">{policy.name}</span> (v
            {policy.version})
          </p>
          <p>
            Completed approval steps will be kept. Pending steps will be rebuilt from the latest IT
            approval setup.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Not now
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Updating..." : "Yes, update matrix"}
          </Button>
        </div>
      </div>
    </div>
  );
}
