import { useEffect, useMemo, useState } from "react";
import { Plus, Send, Trash2, UserPlus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import ApprovalMatrix from "@/components/workflow/ApprovalMatrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { previewApprovalChain, searchEmployees } from "@/lib/api";
import {
  APPROVAL_STEP_LABELS,
  SUBMITTER_LEVEL_OPTIONS,
  type AdditionalApproverDraft,
  type ApprovalStep,
  type EmployeeOption,
  type Policy,
  type SubmitterLevelMode,
} from "@/lib/types";

interface SubmitApprovalDialogProps {
  open: boolean;
  policy: Pick<Policy, "companyCode" | "departmentCode" | "departmentName">;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    additionalApprovers: AdditionalApproverDraft[];
    submitterLevelMode: SubmitterLevelMode;
  }) => void;
}

export default function SubmitApprovalDialog({
  open,
  policy,
  isSubmitting = false,
  onClose,
  onConfirm,
}: SubmitApprovalDialogProps) {
  const [submitterLevelMode, setSubmitterLevelMode] = useState<SubmitterLevelMode>("all");
  const [additionalApprovers, setAdditionalApprovers] = useState<AdditionalApproverDraft[]>([]);
  const [level, setLevel] = useState<number>(1);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);

  const previewQuery = useQuery({
    queryKey: [
      "approval-preview",
      policy.companyCode,
      policy.departmentCode,
      policy.departmentName,
      submitterLevelMode,
      additionalApprovers,
    ],
    queryFn: () =>
      previewApprovalChain({
        companyCode: policy.companyCode,
        departmentCode: policy.departmentCode,
        departmentName: policy.departmentName,
        submitterLevelMode,
        additionalApprovers,
      }),
    enabled: open && Boolean(policy.companyCode && policy.departmentCode),
  });

  const levelOptions = useMemo(() => {
    const steps = previewQuery.data?.steps ?? [];
    const orders = [
      ...new Set(
        steps.filter((step) => step.type !== "requester").map((step) => step.groupOrder),
      ),
    ].sort((a, b) => a - b);

    return orders.map((order) => {
      const groupSteps = steps.filter((step) => step.groupOrder === order);
      const first = groupSteps[0];
      let label = APPROVAL_STEP_LABELS[first?.type ?? "direct_manager"];
      if (
        first?.type === "department_approver" ||
        first?.type === "escalated_approver" ||
        first?.type === "additional_approver"
      ) {
        label = first.departmentName?.trim() || first.levelLabel?.trim() || label;
      }
      const parallelCount = groupSteps.length;
      if (parallelCount > 1) {
        label = `${label} (${parallelCount} approvers, any one)`;
      }
      return { value: order, label: `Level ${order} — ${label}` };
    });
  }, [previewQuery.data?.steps]);

  useEffect(() => {
    if (!open) return;
    setAdditionalApprovers([]);
    setEmployeeQuery("");
    setSelectedEmployee(null);
  }, [open]);

  useEffect(() => {
    if (!open || !previewQuery.data?.defaultSubmitterLevelMode) return;
    setSubmitterLevelMode(previewQuery.data.defaultSubmitterLevelMode);
  }, [open, previewQuery.data?.defaultSubmitterLevelMode]);

  useEffect(() => {
    if (levelOptions.length > 0 && !levelOptions.some((item) => item.value === level)) {
      setLevel(levelOptions[0]?.value ?? 1);
    }
  }, [level, levelOptions]);

  const employeesQuery = useQuery({
    queryKey: ["employees", policy.companyCode, employeeQuery],
    queryFn: () => searchEmployees(policy.companyCode, employeeQuery),
    enabled: open && employeeQuery.trim().length >= 2,
  });

  const previewPolicy = useMemo<Policy | null>(() => {
    const steps = previewQuery.data?.steps ?? [];
    if (steps.length === 0) return null;

    const pendingOrders = [
      ...new Set(
        steps
          .filter((step) => step.type !== "requester" && step.status === "pending")
          .map((step) => step.groupOrder),
      ),
    ].sort((left, right) => left - right);
    const activeOrder = pendingOrders[0] ?? null;

    return {
      id: "preview",
      name: "",
      companyCode: policy.companyCode,
      companyName: "",
      departmentCode: policy.departmentCode,
      departmentName: policy.departmentName,
      sections: [],
      version: 1,
      status: "draft",
      createdByEmail: "",
      createdByName: "",
      sharedWith: [],
      approvalSteps: steps,
      comments: [],
      currentApprovers:
        activeOrder == null
          ? []
          : steps.filter(
              (step: ApprovalStep) =>
                step.groupOrder === activeOrder && step.status === "pending",
            ),
      createdAt: "",
      updatedAt: "",
    };
  }, [policy.companyCode, policy.departmentCode, policy.departmentName, previewQuery.data?.steps]);

  const addApprover = () => {
    if (!selectedEmployee) return;
    const steps = previewQuery.data?.steps ?? [];
    const normalizedEmail = selectedEmployee.email.toLowerCase();
    const duplicateAtLevel =
      additionalApprovers.some(
        (item) =>
          item.groupOrder === level &&
          item.assigneeEmail.toLowerCase() === normalizedEmail,
      ) ||
      steps.some(
        (step) =>
          step.type !== "requester" &&
          step.groupOrder === level &&
          step.assigneeEmail.toLowerCase() === normalizedEmail,
      );
    if (duplicateAtLevel) {
      toast.error("This person is already an approver at this level");
      return;
    }

    setAdditionalApprovers((current) => [
      ...current,
      {
        groupOrder: level,
        assigneeEmail: selectedEmployee.email,
        assigneeName: selectedEmployee.name,
        assigneeUserId: selectedEmployee.userId,
      },
    ]);
    setSelectedEmployee(null);
    setEmployeeQuery("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Close submit dialog"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-approval-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <h2 id="submit-approval-title" className="text-lg font-semibold text-slate-900">
            Approval Matrix
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {previewQuery.data?.guruOnly ? null : (
            <SelectField
              label="Your department approvals"
              value={submitterLevelMode}
              onChange={(event) =>
                setSubmitterLevelMode(event.target.value as SubmitterLevelMode)
              }
            >
              {SUBMITTER_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          )}

          {previewQuery.isLoading ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">
              Loading…
            </div>
          ) : previewQuery.isError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Preview unavailable — you can still submit; the server will build the approval chain.
            </div>
          ) : previewPolicy ? (
            <ApprovalMatrix policy={previewPolicy} preview />
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">
              No approval setup found for this department.
            </div>
          )}

          {previewQuery.data?.guruOnly ? null : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UserPlus className="h-4 w-4 text-red-600" />
              Extra approver
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Add someone at the same level as an existing approver (parallel — any one approval
              advances the level).
            </p>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
              <SelectField
                label="Level"
                value={String(level)}
                onChange={(event) => setLevel(Number(event.target.value))}
              >
                {levelOptions.length === 0 ? (
                  <option value="1">Level 1</option>
                ) : (
                  levelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </SelectField>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Employee</label>
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

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addApprover}
                  disabled={!selectedEmployee}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            {additionalApprovers.length > 0 && (
              <div className="mt-4 space-y-2">
                {additionalApprovers.map((item, index) => (
                  <div
                    key={`${item.assigneeEmail}-${item.groupOrder}-${index}`}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-slate-900">{item.assigneeName}</span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-slate-600">
                        {levelOptions.find((option) => option.value === item.groupOrder)?.label ??
                          `Level ${item.groupOrder}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      onClick={() =>
                        setAdditionalApprovers((current) =>
                          current.filter((_, entryIndex) => entryIndex !== index),
                        )
                      }
                      aria-label="Remove approver"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm({ additionalApprovers, submitterLevelMode })}
            disabled={isSubmitting || previewQuery.isLoading}
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
