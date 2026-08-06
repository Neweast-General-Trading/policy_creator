import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { proposeMatrixChangeApi, searchEmployees } from "@/lib/api";
import type { ApprovalStep, EmployeeOption, Policy } from "@/lib/types";

interface EditMatrixDialogProps {
  open: boolean;
  policy: Policy;
  onClose: () => void;
  onSaved: (policy: Policy) => void;
}

function editableSteps(policy: Policy): ApprovalStep[] {
  return policy.approvalSteps.filter(
    (step) => step.type !== "requester" && step.status === "pending",
  );
}

export default function EditMatrixDialog({
  open,
  policy,
  onClose,
  onSaved,
}: EditMatrixDialogProps) {
  const steps = useMemo(() => editableSteps(policy), [policy]);
  const [stepId, setStepId] = useState(steps[0]?.id ?? "");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedStep = steps.find((step) => step.id === stepId);

  const employeesQuery = useQuery({
    queryKey: ["employees", policy.companyCode, employeeQuery],
    queryFn: () => searchEmployees(policy.companyCode, employeeQuery),
    enabled: open && employeeQuery.trim().length >= 2,
  });

  const handleSubmit = async () => {
    if (!selectedStep || !selectedEmployee) return;

    setIsSaving(true);
    try {
      const updated = await proposeMatrixChangeApi(policy.id, [
        {
          stepId: selectedStep.id,
          assigneeEmail: selectedEmployee.email,
          assigneeName: selectedEmployee.name,
          assigneeUserId: selectedEmployee.userId,
        },
      ]);
      onSaved(updated);
      toast.success("Matrix update sent to department manager for approval");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update matrix");
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
        aria-label="Close edit matrix dialog"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit Approval Matrix</h2>
            <p className="mt-1 text-sm text-slate-500">
              Changes are shown on the matrix immediately and sent to the department manager for
              approval.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {steps.length === 0 ? (
            <p className="text-sm text-slate-500">No pending approvers can be changed.</p>
          ) : (
            <>
              <SelectField
                label="Approver to replace"
                value={stepId}
                onChange={(event) => setStepId(event.target.value)}
              >
                {steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    Level {step.groupOrder} — {step.assigneeName}
                    {step.departmentName ? ` (${step.departmentName})` : ""}
                  </option>
                ))}
              </SelectField>

              {selectedStep ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Current: <span className="font-medium text-slate-900">{selectedStep.assigneeName}</span>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">New approver</label>
                <Input
                  value={employeeQuery}
                  onChange={(event) => {
                    setEmployeeQuery(event.target.value);
                    setSelectedEmployee(null);
                  }}
                  placeholder="Search name or email"
                />
                {employeesQuery.data && employeesQuery.data.length > 0 && !selectedEmployee ? (
                  <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white">
                    {employeesQuery.data.map((employee) => (
                      <button
                        key={employee.userId}
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setEmployeeQuery(employee.name);
                        }}
                      >
                        <span className="font-medium text-slate-900">{employee.name}</span>
                        <span className="text-xs text-slate-500">{employee.email}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !selectedStep || !selectedEmployee || steps.length === 0}
          >
            <ArrowRightLeft className="h-4 w-4" />
            {isSaving ? "Saving..." : "Update Matrix"}
          </Button>
        </div>
      </div>
    </div>
  );
}
