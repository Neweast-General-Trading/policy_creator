import type { PolicySection } from "@/lib/types";
import { normalizeBusinessRules } from "@/lib/business-rules";
import { normalizeApplyToApplications } from "@/lib/policy-applications";

interface PolicyReviewTreeProps {
  policyName: string;
  sections: PolicySection[];
}

export default function PolicyReviewTree({ policyName, sections }: PolicyReviewTreeProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Policy tree
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{policyName || "Untitled policy"}</p>
      </div>
      <ul className="space-y-3 p-4">
        {sections.map((section, index) => {
          const rules = normalizeBusinessRules(section.businessRules);
          const applications = normalizeApplyToApplications(section.applyToApplications);
          return (
            <li key={section.id} className="border-s-2 border-slate-200 ps-4">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-xs font-semibold tabular-nums text-red-600">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{section.title}</h3>
                  <div
                    className="policy-content mt-2 text-sm text-slate-700"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Business Rules
                    </p>
                    {rules.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-400">No business rules added</p>
                    ) : (
                      <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm text-slate-700">
                        {rules.map((rule, ruleIndex) => (
                          <li key={`${section.id}-rule-${ruleIndex}`}>{rule}</li>
                        ))}
                      </ol>
                    )}
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Apply to
                      </p>
                      {applications.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {applications.map((application) => (
                            <li
                              key={application.id}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                            >
                              {application.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400">No applications selected</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
