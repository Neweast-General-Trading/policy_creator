import { useQuery } from "@tanstack/react-query";
import { SelectField } from "@/components/ui/select-field";
import { fetchBpmProcesses, fetchBpmSubProcesses } from "@/lib/api";
import type { PolicySubProcessLink } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BpmProcessFieldsProps {
  companyCode: string;
  departmentName: string;
  processId?: string;
  processCode?: string;
  processName?: string;
  bpmDepartmentId?: string;
  bpmDepartmentName?: string;
  subProcesses: PolicySubProcessLink[];
  onChange: (value: {
    bpmDepartmentId?: string;
    bpmDepartmentName?: string;
    processId?: string;
    processCode?: string;
    processName?: string;
    subProcesses: PolicySubProcessLink[];
  }) => void;
}

export default function BpmProcessFields({
  companyCode,
  departmentName,
  processId,
  processName,
  bpmDepartmentName,
  subProcesses,
  onChange,
}: BpmProcessFieldsProps) {
  const canLoad = Boolean(companyCode && departmentName.trim());

  const processesQuery = useQuery({
    queryKey: ["bpm-processes", companyCode, departmentName],
    queryFn: () => fetchBpmProcesses(companyCode, departmentName),
    enabled: canLoad,
  });

  const subProcessesQuery = useQuery({
    queryKey: ["bpm-sub-processes", processId],
    queryFn: () => fetchBpmSubProcesses(processId!),
    enabled: Boolean(processId),
  });

  const toggleSubProcess = (item: PolicySubProcessLink) => {
    const exists = subProcesses.some((entry) => entry.id === item.id);
    onChange({
      subProcesses: exists
        ? subProcesses.filter((entry) => entry.id !== item.id)
        : [...subProcesses, item],
    });
  };

  if (!canLoad) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 md:col-span-2">
        Select company and department to load BPM processes.
      </div>
    );
  }

  return (
    <>
      <SelectField
        label="Process"
        value={processId ?? ""}
        disabled={processesQuery.isLoading}
        onChange={(event) => {
          const nextId = event.target.value;
          const process = processesQuery.data?.processes.find((item) => item.id === nextId);
          onChange({
            bpmDepartmentId: processesQuery.data?.processFunction?.id,
            bpmDepartmentName:
              processesQuery.data?.processFunction?.name ?? bpmDepartmentName,
            processId: nextId || undefined,
            processCode: process?.code,
            processName: process?.name,
            subProcesses: [],
          });
        }}
      >
        <option value="">
          {processesQuery.isLoading
            ? "Loading processes..."
            : processesQuery.isError
              ? "Failed to load processes"
              : "Select process"}
        </option>
        {(processesQuery.data?.processes ?? []).map((process) => (
          <option key={process.id} value={process.id}>
            {process.code ? `${process.code} — ${process.name}` : process.name}
          </option>
        ))}
      </SelectField>

      {!processesQuery.isLoading &&
        !processesQuery.isError &&
        (processesQuery.data?.processes ?? []).length === 0 && (
          <p className="text-xs text-amber-700 md:col-span-2">
            {processesQuery.data?.processFunction
              ? `Linked BPM function "${processesQuery.data.processFunction.name}" has no processes yet.`
              : `No BPM process function matched department "${departmentName}".`}
          </p>
        )}

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">Sub-Process (select one or more)</label>
        {!processId ? (
          <div className="rounded-md border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            Select a process first to load sub-processes.
          </div>
        ) : subProcessesQuery.isLoading ? (
          <div className="rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-500">
            Loading sub-processes...
          </div>
        ) : (subProcessesQuery.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            No sub-processes found for this process in BPM.
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
            {(subProcessesQuery.data ?? []).map((item) => {
              const checked = subProcesses.some((entry) => entry.id === item.id);
              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-4 py-3 text-sm transition hover:bg-slate-50",
                    checked && "bg-red-50/60",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500/30"
                    checked={checked}
                    onChange={() =>
                      toggleSubProcess({ id: item.id, code: item.code, name: item.name })
                    }
                  />
                  <span>
                    <span className="font-medium text-slate-900">
                      {item.code ? `${item.code} — ${item.name}` : item.name}
                    </span>
                    {processName ? (
                      <span className="mt-0.5 block text-xs text-slate-500">{processName}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {subProcesses.length > 0 && (
          <p className="text-xs text-slate-500">
            Selected: {subProcesses.map((item) => item.name).join(", ")}
          </p>
        )}
      </div>
    </>
  );
}
