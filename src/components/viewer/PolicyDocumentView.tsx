import PolicyDocumentAppendix from "@/components/viewer/PolicyDocumentAppendix";
import type { Policy } from "@/lib/types";
import { assetUrl } from "@/lib/utils";

interface PolicyDocumentViewProps {
  policy: Policy;
}

export default function PolicyDocumentView({ policy }: PolicyDocumentViewProps) {
  return (
    <article className="policy-document-view mx-auto max-w-[680px]">
      <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold leading-snug text-slate-900">{policy.name}</h1>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <dt className="font-medium text-slate-400">Company</dt>
            <dd>{policy.companyName}</dd>
            <dt className="font-medium text-slate-400">Department</dt>
            <dd>{policy.departmentName}</dd>
            <dt className="font-medium text-slate-400">Version</dt>
            <dd>v{policy.version}</dd>
          </dl>
        </div>
        <img
          src={assetUrl("logo.png")}
          alt="NEWEAST"
          className="h-7 w-auto shrink-0 object-contain opacity-90"
        />
      </header>

      <div className="space-y-5">
        {policy.sections.map((section, index) => (
          <section key={section.id}>
            <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-slate-900">
              <span className="text-[11px] font-semibold tabular-nums text-red-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="h-3 w-px bg-slate-300" />
              {section.title}
            </h2>
            <div
              className="policy-content text-[13px] leading-relaxed text-slate-700"
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          </section>
        ))}
      </div>

      <PolicyDocumentAppendix policy={policy} />

      <footer className="mt-5 border-t border-slate-100 pt-3 text-center text-[10px] text-slate-400">
        Confidential Policy Document · © NEWEAST
      </footer>
    </article>
  );
}
