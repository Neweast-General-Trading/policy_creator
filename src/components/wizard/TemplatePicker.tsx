import { useQuery } from "@tanstack/react-query";
import { FileStack, Loader2 } from "lucide-react";
import { fetchTemplates } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TemplatePickerProps {
  value: string;
  departmentCode: number | null;
  onChange: (templateId: string) => void;
}

export default function TemplatePicker({
  value,
  departmentCode,
  onChange,
}: TemplatePickerProps) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates", departmentCode],
    queryFn: () => fetchTemplates(departmentCode ?? undefined),
    enabled: departmentCode != null,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <FileStack className="h-4 w-4 text-red-600" />
        Start from a template
      </div>

      {!departmentCode ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
          Select a department first to see available templates.
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => onChange("blank")}
            className={cn(
              "rounded-lg border p-4 text-left transition-all hover:border-red-300 hover:shadow-sm",
              value === "blank"
                ? "border-red-500 bg-red-50 ring-2 ring-red-200"
                : "border-slate-200 bg-white",
            )}
          >
            <div className="font-semibold text-slate-900">Blank Policy</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Start from scratch and add your own topics.
            </p>
          </button>

          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition-all hover:border-red-300 hover:shadow-sm",
                value === template.id
                  ? "border-red-500 bg-red-50 ring-2 ring-red-200"
                  : "border-slate-200 bg-white",
              )}
            >
              <div className="font-semibold text-slate-900">{template.name}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {template.description || template.departmentName}
              </p>
              <p className="mt-2 text-xs font-medium text-red-700">
                {template.sections.length} sections
                {template.source === "word" ? " · Word" : ""}
              </p>
            </button>
          ))}

          {templates.length === 0 && (
            <div className="md:col-span-2 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
              No templates for this department yet. Create one from the Templates page.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
