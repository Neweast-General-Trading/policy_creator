import {
  buildRevisionRows,
  formatDocumentDate,
  getApprovalColumns,
  shouldShowPolicyAppendix,
} from "@/lib/policy-document-appendix";
import type { Policy } from "@/lib/types";

interface PolicyDocumentAppendixProps {
  policy: Policy;
}

function SignatureDisplay({ signature }: { signature?: string }) {
  if (!signature?.trim()) {
    return <span className="text-xs text-slate-400">Pending</span>;
  }
  return (
    <p
      className="text-sm leading-tight text-blue-700"
      style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive" }}
    >
      {signature.trim()}
    </p>
  );
}

export default function PolicyDocumentAppendix({ policy }: PolicyDocumentAppendixProps) {
  if (!shouldShowPolicyAppendix(policy)) return null;

  const columns = getApprovalColumns(policy);
  const revisions = buildRevisionRows(policy);
  const approvalDate = formatDocumentDate(
    policy.publishedAt ?? policy.approvedAt ?? policy.submittedAt,
  );

  return (
    <div className="mt-6 space-y-6 border-t border-slate-200 pt-5">
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-600">Approval</h2>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[560px] border-collapse text-xs text-slate-900">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase">
                  Date
                </th>
                <th className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase">
                  Department
                </th>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-slate-100 px-2 py-1.5">{approvalDate}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 font-medium">
                  {policy.departmentName}
                </td>
                {columns.map((column) => (
                  <td
                    key={`name-${column.label}`}
                    className="border-b border-slate-100 px-2 py-1.5 font-medium"
                  >
                    {column.assigneeName}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5" />
                {columns.map((column) => (
                  <td key={`sig-${column.label}`} className="px-2 py-1.5">
                    <SignatureDisplay signature={column.step?.signatureText} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-600">
          Document Revision History
        </h2>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[560px] border-collapse text-xs text-slate-900">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase">
                  Rev
                </th>
                <th className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase">
                  Date
                </th>
                <th className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase">
                  Description
                </th>
                <th className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase">
                  Page
                </th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((row, index) => (
                <tr key={`${row.revisionNo}-${index}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5">{row.revisionNo}</td>
                  <td className="px-2 py-1.5">{row.revisionDate}</td>
                  <td className="px-2 py-1.5">{row.description}</td>
                  <td className="px-2 py-1.5">{row.pageNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
