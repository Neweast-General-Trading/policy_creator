import PolicyDocumentAppendix from "@/components/viewer/PolicyDocumentAppendix";
import { normalizeBusinessRules } from "@/lib/business-rules";
import { formatPolicyCompaniesLabel, getPolicyVisibilityScope } from "@/lib/policy-companies";
import { buildPolicyDocumentCode, formatPolicyVersionLabel } from "@/lib/policy-document-meta";
import { normalizeApplyToApplications } from "@/lib/policy-applications";
import { htmlHasText, normalizePolicyHtml } from "@/lib/policy-html";
import type { Policy } from "@/lib/types";
import { assetUrl } from "@/lib/utils";

interface PolicyDocumentViewProps {
  policy: Policy;
  showAppendix?: boolean;
}

export default function PolicyDocumentView({
  policy,
  showAppendix = true,
}: PolicyDocumentViewProps) {
  const toc = [
    { no: 1, title: "Table of Contents" },
    { no: 2, title: "Document Control" },
    ...policy.sections.map((section, index) => ({
      no: index + 3,
      title: section.title,
    })),
  ];
  const visibility =
    getPolicyVisibilityScope(policy) === "general" ? "General" : "Department-specific";

  return (
    <article className="policy-sheet mx-auto w-full max-w-[860px] bg-white text-slate-900">
      <header className="mb-7 border-b border-slate-200 pb-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-600">
              Policy document
            </p>
            <h1 className="mt-1 text-[20px] font-bold leading-snug tracking-tight text-slate-900">
              {buildPolicyDocumentCode(policy)}
            </h1>
          </div>
          <img
            src={assetUrl("logo.png")}
            alt="NEWEAST"
            className="h-9 w-auto shrink-0 object-contain"
          />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-slate-400">Company</dt>
            <dd className="min-w-0 text-slate-800">{formatPolicyCompaniesLabel(policy)}</dd>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-slate-400">Department</dt>
            <dd className="text-slate-800">{policy.departmentName || "—"}</dd>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-slate-400">Visibility</dt>
            <dd className="text-slate-800">{visibility}</dd>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-slate-400">Version</dt>
            <dd className="text-slate-800">v{formatPolicyVersionLabel(policy.version)}</dd>
          </div>
        </dl>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">
          <span className="me-2 text-red-600">1.</span>Table of Contents
        </h2>
        <table className="doc-table text-[13px]">
          <thead>
            <tr>
              <th className="w-14">No.</th>
              <th>Contents</th>
            </tr>
          </thead>
          <tbody>
            {toc.map((item) => (
              <tr key={item.no}>
                <td className="tabular-nums text-slate-500">{item.no}</td>
                <td className="text-slate-800">{item.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {showAppendix ? (
        <section className="mb-8">
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">
            <span className="me-2 text-red-600">2.</span>Document Control
          </h2>
          <PolicyDocumentAppendix policy={policy} />
        </section>
      ) : null}

      {policy.processName ? (
        <p className="mb-6 text-[12.5px] text-slate-600">
          <span className="font-semibold text-slate-800">Linked process: </span>
          {[policy.processCode, policy.processName].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      <div className="space-y-7">
        {policy.sections.map((section, index) => {
          const number = index + 3;
          const rules = normalizeBusinessRules(section.businessRules);
          const content = normalizePolicyHtml(section.content);
          const applications = normalizeApplyToApplications(section.applyToApplications);
          return (
            <section key={section.id} className="break-inside-avoid">
              <h2 className="text-[15px] font-bold leading-snug text-slate-900">
                <span className="me-2 text-red-600">{number}.</span>
                {section.title}
              </h2>
              <div className="ms-5 mt-2 border-s-2 border-slate-200 ps-4">
                {htmlHasText(content) ? (
                  <div
                    className="policy-content text-[13.5px] leading-[1.7] text-slate-700"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                ) : (
                  <p className="text-[13px] italic text-slate-400">No topic content</p>
                )}
                <div className="mt-3">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-slate-800">
                    Business Rules
                  </p>
                  {rules.length > 0 ? (
                    <ol className="mt-2 space-y-2 border-s-2 border-slate-200 ps-4">
                      {rules.map((rule, ruleIndex) => (
                        <li key={`${section.id}-rule-${ruleIndex}`} className="flex gap-3">
                          <span className="w-9 shrink-0 pt-0.5 text-[13px] font-bold tabular-nums text-slate-800">
                            {number}.{ruleIndex + 1}
                          </span>
                          <span className="min-w-0 text-[13.5px] leading-[1.7] text-slate-700">
                            {rule}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1 text-[13px] italic text-slate-400">No business rules added</p>
                  )}
                  <div className="mt-4">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-slate-800">
                      Apply to
                    </p>
                    {applications.length > 0 ? (
                      <table className="doc-table mt-2 text-[12.5px]">
                        <thead>
                          <tr>
                            <th className="w-14">No.</th>
                            <th>Application</th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications.map((application, appIndex) => (
                            <tr key={application.id}>
                              <td className="tabular-nums text-slate-500">{appIndex + 1}</td>
                              <td className="font-medium text-slate-800">{application.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="mt-1 text-[13px] italic text-slate-400">No applications selected</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <footer className="mt-10 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
        Confidential · Internal use only · © NEWEAST · Version {formatPolicyVersionLabel(policy.version)}
      </footer>
    </article>
  );
}
