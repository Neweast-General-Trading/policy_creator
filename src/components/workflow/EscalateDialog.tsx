import { useEffect, useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { fetchEscalationTargets, searchEmployees } from "@/lib/api";
import type { EmployeeOption } from "@/lib/types";

interface EscalateDialogProps {
  open: boolean;
  policyId: string;
  companyCode: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    targetEmail: string;
    targetName: string;
    targetUserId?: string;
    reason: string;
  }) => void;
}

export default function EscalateDialog({
  open,
  policyId,
  companyCode,
  isSubmitting = false,
  onClose,
  onConfirm,
}: EscalateDialogProps) {
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<EmployeeOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [useSearch, setUseSearch] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setTarget(null);
    setSearchQuery("");
    setUseSearch(false);
  }, [open]);

  const targetsQuery = useQuery({
    queryKey: ["escalation-targets", policyId],
    queryFn: () => fetchEscalationTargets(policyId),
    enabled: open && Boolean(policyId),
  });

  const searchQueryResult = useQuery({
    queryKey: ["employees", companyCode, searchQuery],
    queryFn: () => searchEmployees(companyCode, searchQuery),
    enabled: open && useSearch && searchQuery.trim().length >= 2,
  });

  if (!open) return null;

  const managerTargets = targetsQuery.data?.targets ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Escalate Approval</h2>
            <p className="mt-1 text-sm text-slate-500">Raise this policy to another approver.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {!useSearch && managerTargets.length > 0 ? (
            <SelectField
              label="Escalate to"
              value={target?.userId ?? ""}
              onChange={(event) => {
                const picked = managerTargets.find((item) => item.userId === event.target.value);
                setTarget(picked ?? null);
              }}
            >
              <option value="">Select manager</option>
              {managerTargets.map((item) => (
                <option key={item.userId} value={item.userId}>
                  {item.targetKind === "next_stage" ? "Next stage: " : ""}
                  {item.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <div className="space-y-2">
              <Label>Escalate to</Label>
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setUseSearch(true);
                  setTarget(null);
                }}
                placeholder="Search employee"
              />
              {searchQueryResult.data?.map((employee) => (
                <button
                  key={employee.userId}
                  type="button"
                  className="flex w-full rounded border px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => setTarget(employee)}
                >
                  {employee.name} · {employee.email}
                </button>
              ))}
            </div>
          )}

          {managerTargets.length > 0 && !useSearch ? (
            <button
              type="button"
              className="text-xs text-red-600 hover:underline"
              onClick={() => setUseSearch(true)}
            >
              Search another employee
            </button>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="escalate-reason">Reason</Label>
            <textarea
              id="escalate-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Why are you escalating?"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!target || !reason.trim() || isSubmitting}
            onClick={() =>
              target &&
              onConfirm({
                targetEmail: target.email,
                targetName: target.name,
                targetUserId: target.userId,
                reason: reason.trim(),
              })
            }
          >
            <ArrowUpCircle className="h-4 w-4" />
            Escalate
          </Button>
        </div>
      </div>
    </div>
  );
}
