import { ArrowRight, Building2, UserRound } from "lucide-react";
import PolicyStatusDot from "@/components/policies/PolicyStatusDot";
import { getPolicyStatusLabel } from "@/lib/policy-status";
import type { Policy } from "@/lib/types";
import { getCurrentApproverLabel } from "@/lib/policy-list-filters";
import { formatDate } from "@/lib/utils";

interface PolicyListTableProps {
  policies: Policy[];
  onOpen: (policy: Policy) => void;
  showOwnerDetails?: boolean;
  emptyMessage?: string;
}

export default function PolicyListTable({
  policies,
  onOpen,
  showOwnerDetails = true,
  emptyMessage = "No policies found.",
}: PolicyListTableProps) {
  if (policies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Policy
            </th>
            {showOwnerDetails && (
              <>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Department
                </th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Company
                </th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Created By
                </th>
              </>
            )}
            <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Status
            </th>
            {showOwnerDetails && (
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Current Approver
              </th>
            )}
            <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Updated
            </th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr
              key={policy.id}
              className="border-b border-slate-100 transition hover:bg-red-50/30"
            >
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpen(policy)}
                  className="text-left font-semibold text-slate-900 hover:text-red-700"
                >
                  {policy.name}
                  <span className="ms-1 text-xs font-medium text-slate-400">v{policy.version}</span>
                </button>
              </td>
              {showOwnerDetails && (
                <>
                  <td className="px-3 py-2.5 text-xs text-slate-700">{policy.departmentName}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="max-w-[140px] truncate">{policy.companyName}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="max-w-[120px] truncate">{policy.createdByName}</span>
                    </span>
                  </td>
                </>
              )}
              <td className="px-3 py-2.5">
                <span
                  className="inline-flex items-center gap-1.5"
                  title={getPolicyStatusLabel(policy.status)}
                >
                  <PolicyStatusDot status={policy.status} size="md" />
                  <span className="sr-only">{getPolicyStatusLabel(policy.status)}</span>
                </span>
              </td>
              {showOwnerDetails && (
                <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-slate-600">
                  {getCurrentApproverLabel(policy)}
                </td>
              )}
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                {formatDate(policy.updatedAt)}
              </td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpen(policy)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
