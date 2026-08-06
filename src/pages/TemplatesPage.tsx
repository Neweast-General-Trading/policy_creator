import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CreateTemplateForm from "@/components/templates/CreateTemplateForm";
import { Button } from "@/components/ui/button";
import { deleteTemplateApi, fetchTemplates } from "@/lib/api";
import type { PolicyTemplate } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type TemplatesView = "list" | "create" | "edit";

interface TemplatesPageProps {
  onUseTemplate?: (template: PolicyTemplate) => void;
}

export default function TemplatesPage({ onUseTemplate }: TemplatesPageProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<TemplatesView>("list");
  const [editingTemplate, setEditingTemplate] = useState<PolicyTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => fetchTemplates(),
  });

  const grouped = templates.reduce<Map<number, PolicyTemplate[]>>((map, template) => {
    const list = map.get(template.departmentCode) ?? [];
    list.push(template);
    map.set(template.departmentCode, list);
    return map;
  }, new Map());

  const handleDelete = async (template: PolicyTemplate) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      await deleteTemplateApi(template.id);
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete template");
    }
  };

  if (view === "create") {
    return (
      <CreateTemplateForm
        onCancel={() => setView("list")}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["templates"] });
          setView("list");
        }}
      />
    );
  }

  if (view === "edit" && editingTemplate) {
    return (
      <CreateTemplateForm
        initialTemplate={editingTemplate}
        onCancel={() => {
          setEditingTemplate(null);
          setView("list");
        }}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["templates"] });
          setEditingTemplate(null);
          setView("list");
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Policy Templates</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create department-specific templates with predefined sections. Import from Word or
            build manually.
          </p>
        </div>
        <Button onClick={() => setView("create")}>
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
          <FileStack className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-600">No templates yet. Create your first template.</p>
          <Button className="mt-4" onClick={() => setView("create")}>
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([departmentCode, items]) => (
            <section key={departmentCode} className="app-surface rounded-xl p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">
                {items[0]?.departmentName ?? `Department ${departmentCode}`}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-red-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{template.name}</div>
                        <p className="mt-1 text-sm text-slate-500">{template.description || "—"}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {template.sections.length} sections · {template.source === "word" ? "Word import" : "Manual"} · Updated {formatDate(template.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          onClick={() => {
                            setEditingTemplate(template);
                            setView("edit");
                          }}
                          aria-label={`Edit ${template.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-red-500 hover:bg-red-50"
                          onClick={() => void handleDelete(template)}
                          aria-label={`Delete ${template.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {template.sections.slice(0, 6).map((section) => (
                        <span
                          key={section.id}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                        >
                          {section.title}
                        </span>
                      ))}
                      {template.sections.length > 6 && (
                        <span className="text-[11px] text-slate-400">
                          +{template.sections.length - 6} more
                        </span>
                      )}
                    </div>
                    {onUseTemplate && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => onUseTemplate(template)}
                      >
                        Use for New Policy
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
