import { FileText } from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import TopicBusinessRules from "@/components/wizard/TopicBusinessRules";
import { Label } from "@/components/ui/label";
import { hasSectionContent } from "@/lib/draft-storage";
import { sectionHasBusinessRules } from "@/lib/business-rules";
import type { PolicyApplicationLink, PolicySection } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SectionContentEditorProps {
  sections: PolicySection[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onContentChange: (sectionId: string, content: string) => void;
  onBusinessRulesChange: (sectionId: string, rules: string[]) => void;
  onApplyToChange?: (sectionId: string, applications: PolicyApplicationLink[]) => void;
  topicProgress?: { completed: number; total: number };
}

export default function SectionContentEditor({
  sections,
  activeIndex,
  onSelect,
  onContentChange,
  onBusinessRulesChange,
  onApplyToChange,
  topicProgress,
}: SectionContentEditorProps) {
  const activeSection = sections[activeIndex];

  if (!sections.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        Add topics in the previous step first.
      </div>
    );
  }

  return (
    <div className="overflow-visible rounded-lg border border-slate-200">
      <div className="flex min-h-[480px] flex-col md:flex-row">
        <aside className="border-b border-slate-200 bg-slate-50 md:w-72 md:shrink-0 md:border-b-0 md:border-r">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Topics
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Select a topic, write its content, then add business rules
            </p>
            {topicProgress && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>
                    {topicProgress.completed}/{topicProgress.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${(topicProgress.completed / topicProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <nav className="max-h-[400px] overflow-y-auto p-2">
            <ul className="space-y-1">
              {sections.map((section, index) => {
                const isActive = index === activeIndex;
                const isDone =
                  hasSectionContent(section.content) && sectionHasBusinessRules(section);

                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(index)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                        isActive
                          ? "bg-red-600 text-white"
                          : "text-slate-700 hover:bg-white",
                      )}
                    >
                      <FileText
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          isActive ? "text-white" : isDone ? "text-emerald-500" : "text-slate-400",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {index + 1}. {section.title}
                        </span>
                        {!isActive && (
                          <span
                            className={cn(
                              "mt-0.5 block text-xs",
                              isDone ? "text-emerald-600" : "text-slate-400",
                            )}
                          >
                            {isDone ? "Content & rules added" : "Incomplete"}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 md:p-5">
          {activeSection ? (
            <div className="space-y-3">
              <Label className="text-base text-slate-900">
                Content for: {activeSection.title}
              </Label>
              <RichTextEditor
                key={activeSection.id}
                value={activeSection.content}
                onChange={(content) => onContentChange(activeSection.id, content)}
                minHeight="280px"
              />
              <TopicBusinessRules
                rules={activeSection.businessRules ?? [""]}
                onChange={(rules) => onBusinessRulesChange(activeSection.id, rules)}
                applyTo={activeSection.applyToApplications ?? []}
                onApplyToChange={(applications) => onApplyToChange?.(activeSection.id, applications)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
