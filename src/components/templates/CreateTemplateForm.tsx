import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import DepartmentSelect from "@/components/shared/DepartmentSelect";
import SectionContentEditor from "@/components/wizard/SectionContentEditor";
import TopicSortableList from "@/components/wizard/TopicSortableList";
import WordTemplateImport from "@/components/templates/WordTemplateImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchTemplateSectionCatalog, saveTemplateApi } from "@/lib/api";
import type { PolicySection, PolicyTemplate } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { Plus, Save } from "lucide-react";

interface CreateTemplateFormProps {
  initialTemplate?: PolicyTemplate | null;
  onCancel: () => void;
  onSaved: () => void;
}

export default function CreateTemplateForm({
  initialTemplate = null,
  onCancel,
  onSaved,
}: CreateTemplateFormProps) {
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [departmentCode, setDepartmentCode] = useState<number | null>(
    initialTemplate?.departmentCode ?? null,
  );
  const [departmentName, setDepartmentName] = useState(initialTemplate?.departmentName ?? "");
  const [sections, setSections] = useState<PolicySection[]>(
    () => initialTemplate?.sections.map((section) => ({ ...section })) ?? [],
  );
  const [source, setSource] = useState<"manual" | "word">(initialTemplate?.source ?? "manual");
  const [newTitle, setNewTitle] = useState("");
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const { data: catalog = [] } = useQuery({
    queryKey: ["template-section-catalog"],
    queryFn: fetchTemplateSectionCatalog,
  });

  const unusedCatalog = useMemo(
    () =>
      catalog.filter(
        (title) => !sections.some((section) => section.title.toLowerCase() === title.toLowerCase()),
      ),
    [catalog, sections],
  );

  const addTitle = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSections((current) => [
      ...current,
      { id: generateId(), title: trimmed, content: "<p></p>", businessRules: [""], applyToApplications: [] },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!departmentCode || !departmentName.trim()) {
      toast.error("Please select a department");
      return;
    }
    if (sections.length === 0) {
      toast.error("Add at least one section");
      return;
    }

    setIsSaving(true);
    try {
      await saveTemplateApi({
        id: initialTemplate?.id,
        name: name.trim(),
        description: description.trim(),
        departmentCode,
        departmentName,
        sections,
        source,
      });
      toast.success(initialTemplate ? "Template updated" : "Template created");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-surface mx-auto max-w-6xl space-y-6 rounded-xl p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {initialTemplate ? "Edit Template" : "Create Template"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Build reusable policy structures by department. Use them when creating new policies.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. HR Policy Pack"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="template-description">Description</Label>
          <Input
            id="template-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description for this template"
          />
        </div>
        <DepartmentSelect
          value={departmentCode}
          onChange={(department) => {
            setDepartmentCode(department?.code ?? null);
            setDepartmentName(department?.name ?? "");
          }}
        />
      </div>

      <WordTemplateImport
        onParsed={(parsedSections, fileName) => {
          setSections(parsedSections);
          setSource("word");
          setActiveSectionIndex(0);
          if (!name.trim()) {
            setName(fileName.replace(/\.docx$/i, ""));
          }
          toast.info("Review imported sections, then save as template");
        }}
      />

      <div className="space-y-3">
        <Label>Suggested Sections</Label>
        <div className="flex flex-wrap gap-2">
          {unusedCatalog.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => addTitle(title)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              + {title}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Add Custom Section</Label>
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Section title"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTitle(newTitle);
                setNewTitle("");
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              addTitle(newTitle);
              setNewTitle("");
            }}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {sections.length > 0 ? (
        <>
          <TopicSortableList
            sections={sections}
            onReorder={setSections}
            onRemove={(id) => {
              setSections((current) => current.filter((section) => section.id !== id));
            }}
          />
          <SectionContentEditor
            sections={sections}
            activeIndex={activeSectionIndex}
            onSelect={setActiveSectionIndex}
            onContentChange={(id, content) => {
              setSections((current) =>
                current.map((section) => (section.id === id ? { ...section, content } : section)),
              );
            }}
            onBusinessRulesChange={(id, businessRules) => {
              setSections((current) =>
                current.map((section) =>
                  section.id === id ? { ...section, businessRules } : section,
                ),
              );
            }}
            onApplyToChange={(id, applyToApplications) => {
              setSections((current) =>
                current.map((section) =>
                  section.id === id ? { ...section, applyToApplications } : section,
                ),
              );
            }}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          Add sections manually or import a Word document to get started.
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </div>
  );
}
