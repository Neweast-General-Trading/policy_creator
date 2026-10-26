import { formatDocumentDate } from "@/lib/policy-document-appendix";
import {
  buildDistributionList,
  buildVersionHistoryRows,
  getDocumentAuthorisers,
} from "@/lib/policy-document-meta";
import type { Policy } from "@/lib/types";

interface PolicyDocumentAppendixProps {
  policy: Policy;
}

function SignatureDisplay({ signature }: { signature?: string }) {
  if (!signature?.trim()) return <span className="text-slate-400">—</span>;
  return (
    <span
      className="text-[13px] leading-tight text-blue-800"
      style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive" }}
    >
      {signature.trim()}
    </span>
  );
}

export default function PolicyDocumentAppendix({ policy }: PolicyDocumentAppendixProps) {
  const authorisers = getDocumentAuthorisers(policy);
  const history = buildVersionHistoryRows(policy);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[140px_1fr] gap-x-4 text-[13px]">
        <div className="font-semibold uppercase tracking-wide text-slate-500">Document name</div>
        <div className="font-medium text-slate-900">{policy.name}</div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-800">
          Authorisation
        </p>
        <table className="doc-table text-[12.5px]">
          <thead>
            <tr>
              <th>Role</th>
              <th>Name</th>
              <th>Title</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            {authorisers.map((item, index) => (
              <tr key={`${item.label}-${item.name}-${index}`}>
                <td className="text-slate-600">{item.label}</td>
                <td className="font-semibold text-slate-900">{item.name}</td>
                <td className="text-slate-600">{item.role}</td>
                <td>
                  <SignatureDisplay signature={item.signature} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[13px] text-slate-700">
        <span className="font-semibold">Distribution list: </span>
        {buildDistributionList(policy)}
      </p>

      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-800">
          Version history
        </p>
        <table className="doc-table text-[12.5px]">
          <thead>
            <tr>
              <th>Version</th>
              <th>Date</th>
              <th>Approved By</th>
              <th>Changes &amp; Reason for Change</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={`${row.version}-${row.date}`}>
                <td className="text-slate-900">{row.version}</td>
                <td className="text-slate-700">{row.date}</td>
                <td className="text-slate-700">{row.approvedBy}</td>
                <td className="text-slate-700">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {policy.publishedAt ? (
        <p className="text-[11px] text-slate-500">
          Effective date: {formatDocumentDate(policy.publishedAt)}
        </p>
      ) : null}
    </div>
  );
}
