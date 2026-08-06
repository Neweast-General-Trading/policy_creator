import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  Plus,
  Send,
  Save,
} from "lucide-react";
import CompanyMultiSelectContainer from "@/components/shared/CompanyMultiSelectContainer";
import DepartmentSelect from "@/components/shared/DepartmentSelect";
import SubmitApprovalDialog from "@/components/workflow/SubmitApprovalDialog";
import BpmProcessFields from "@/components/wizard/BpmProcessFields";
import SectionContentEditor from "@/components/wizard/SectionContentEditor";
import TemplatePicker from "@/components/wizard/TemplatePicker";
import TopicSortableList from "@/components/wizard/TopicSortableList";
import WizardProgress from "@/components/wizard/WizardProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoSaveDraft } from "@/hooks/useAutoSaveDraft";
import { fetchTemplate, submitPolicyApi } from "@/lib/api";
import {
  countCompletedTopics,
  hasSectionContent,
  loadWizardDraft,
} from "@/lib/draft-storage";
import { downloadPolicyPdf, openPolicyInBrowser } from "@/lib/pdf";
import { buildSectionsFromTemplate } from "@/lib/templates";
import { generateId } from "@/lib/utils";
import { formatPolicyCompaniesLabel, formatPolicyScopeLabel, getPolicyCompanies } from "@/lib/policy-companies";
import type {
  AdditionalApproverDraft,
  CompanyOption,
  Policy,
  PolicyDraft,
  PolicySection,
  PolicyTemplate,
  WizardStep,
} from "@/lib/types";

interface CreatePolicyWizardProps {
  onCancel: () => void;
  onSaved: (policy: Policy) => Promise<Policy> | Policy;
  onSubmitted?: (policy: Policy) => Promise<void> | void;
  initialPolicy?: Policy | null;
  initialTemplate?: PolicyTemplate | null;
  isDuplicate?: boolean;
}

const steps: { id: WizardStep; label: string }[] = [
  { id: "info", label: "Policy Info" },
  { id: "titles", label: "Topics" },
  { id: "content", label: "Topic Content" },
  { id: "review", label: "Review & Save" },
];

function companiesFromPolicy(policy: Policy): CompanyOption[] {
  return getPolicyCompanies(policy);
}

function buildInitialDraft(initialPolicy: Policy | null | undefined): PolicyDraft {
  const selectedCompanies = initialPolicy ? companiesFromPolicy(initialPolicy) : [];
  return {
    name: initialPolicy?.name ?? "",
    companyCode: initialPolicy?.companyCode ?? selectedCompanies[0]?.code ?? "",
    companyName: initialPolicy?.companyName ?? selectedCompanies[0]?.name ?? "",
    selectedCompanies,
    visibilityScope:
      initialPolicy?.visibilityScope === "general" ? "general" : "department",
    departmentCode: initialPolicy?.departmentCode ?? null,
    departmentName: initialPolicy?.departmentName ?? "",
    bpmDepartmentId: initialPolicy?.bpmDepartmentId,
    bpmDepartmentName: initialPolicy?.bpmDepartmentName,
    processId: initialPolicy?.processId,
    processCode: initialPolicy?.processCode,
    processName: initialPolicy?.processName,
    subProcesses: initialPolicy?.subProcesses?.map((item) => ({ ...item })) ?? [],
    linkToBpm: Boolean(initialPolicy?.processId),
    sections: initialPolicy?.sections.map((section) => ({ ...section })) ?? [],
    version: initialPolicy?.version ?? 1,
  };
}

function clearBpmFields(): Pick<
  PolicyDraft,
  | "bpmDepartmentId"
  | "bpmDepartmentName"
  | "processId"
  | "processCode"
  | "processName"
  | "subProcesses"
> {
  return {
    bpmDepartmentId: undefined,
    bpmDepartmentName: undefined,
    processId: undefined,
    processCode: undefined,
    processName: undefined,
    subProcesses: [],
  };
}

export default function CreatePolicyWizard({
  onCancel,
  onSaved,
  onSubmitted,
  initialPolicy = null,
  initialTemplate = null,
  isDuplicate = false,
}: CreatePolicyWizardProps) {
  const editingId = initialPolicy?.id && !isDuplicate ? initialPolicy.id : undefined;
  const isVersionDraft = Boolean(initialPolicy?.parentPolicyId && !isDuplicate);
  const canEditScope =
    !isVersionDraft &&
    (!initialPolicy ||
      isDuplicate ||
      initialPolicy.status === "draft" ||
      initialPolicy.status === "returned");
  const storedDraft = !initialPolicy ? loadWizardDraft() : loadWizardDraft(editingId);

  const [step, setStep] = useState<WizardStep>(storedDraft?.step ?? "info");
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "blank");
  const [savedPolicy, setSavedPolicy] = useState<Policy | null>(
    initialPolicy && !isDuplicate ? initialPolicy : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<PolicyDraft>(() => {
    const base = storedDraft?.draft ?? buildInitialDraft(initialPolicy);
    if (base.selectedCompanies?.length) return base;
    if (base.companyCode) {
      return {
        ...base,
        selectedCompanies: [{ code: base.companyCode, name: base.companyName }],
        visibilityScope: base.visibilityScope ?? "department",
      };
    }
    return { ...base, selectedCompanies: [], visibilityScope: base.visibilityScope ?? "department" };
  });
  const [activeSectionIndex, setActiveSectionIndex] = useState(
    storedDraft?.activeSectionIndex ?? 0,
  );
  const [newTitle, setNewTitle] = useState("");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [pendingSubmitPolicy, setPendingSubmitPolicy] = useState<Policy | null>(null);

  const { lastSavedAt, clearDraft } = useAutoSaveDraft(
    {
      draft,
      step,
      activeSectionIndex,
      editingPolicyId: editingId,
      savedAt: new Date().toISOString(),
    },
    true,
  );

  useEffect(() => {
    if (storedDraft) {
      toast.info("Restored your unsaved draft");
    }
  }, []);

  useEffect(() => {
    if (!initialTemplate || initialPolicy) return;
    setTemplateId(initialTemplate.id);
    setDraft((current) => ({
      ...current,
      departmentCode: initialTemplate.departmentCode,
      departmentName: initialTemplate.departmentName,
      sections: buildSectionsFromTemplate(initialTemplate),
    }));
  }, [initialTemplate, initialPolicy]);

  const currentStepIndex = steps.findIndex((item) => item.id === step);
  const primaryCompanyCode = draft.selectedCompanies[0]?.code ?? draft.companyCode;
  const activeCompanyName =
    draft.selectedCompanies.length > 0
      ? formatPolicyCompaniesLabel({
          companyCode: draft.companyCode,
          companyName: draft.companyName,
          companies: draft.selectedCompanies.map((item) => ({
            companyCode: item.code,
            companyName: item.name,
          })),
        } as Policy)
      : "—";
  const topicProgress = {
    completed: countCompletedTopics(draft.sections),
    total: draft.sections.length,
  };

  const canGoNext = useMemo(() => {
    if (step === "info") {
      const bpmValid =
        !draft.linkToBpm || (!!draft.processId && draft.subProcesses.length > 0);
      return (
        draft.name.trim().length > 0 &&
        draft.selectedCompanies.length > 0 &&
        !!draft.departmentCode &&
        draft.departmentName.trim().length > 0 &&
        bpmValid
      );
    }
    if (step === "titles") return draft.sections.length > 0;
    if (step === "content") {
      return draft.sections.every(
        (section) =>
          section.title.trim().length > 0 && hasSectionContent(section.content),
      );
    }
    return true;
  }, [draft, step]);

  const applyTemplate = async (id: string) => {
    setTemplateId(id);
    if (id === "blank") {
      setDraft((current) => ({ ...current, sections: [] }));
      return;
    }

    try {
      const template = await fetchTemplate(id);
      setDraft((current) => ({
        ...current,
        sections: buildSectionsFromTemplate(template),
      }));
      toast.success(`Template "${template.name}" loaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load template");
    }
  };

  const addTitle = () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Please enter a topic title");
      return;
    }
    setDraft((current) => ({
      ...current,
      sections: [...current.sections, { id: generateId(), title, content: "<p></p>" }],
    }));
    setNewTitle("");
  };

  const removeSection = (id: string) => {
    const index = draft.sections.findIndex((section) => section.id === id);
    setDraft((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== id),
    }));
    if (index >= 0 && index <= activeSectionIndex) {
      setActiveSectionIndex(Math.max(0, activeSectionIndex - 1));
    }
  };

  const reorderSections = (sections: PolicySection[]) => {
    setDraft((current) => ({ ...current, sections }));
  };

  const updateSectionContent = (id: string, content: string) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, content } : section,
      ),
    }));
  };

  const persistDraft = async (): Promise<Policy | null> => {
    if (draft.selectedCompanies.length === 0) {
      toast.error("Please select at least one company");
      return null;
    }
    if (!draft.departmentCode) {
      toast.error("Please select a department");
      return null;
    }

    const primary = draft.selectedCompanies[0];
    const saved = await onSaved({
      id: savedPolicy?.id ?? "",
      name: draft.name.trim(),
      companyCode: primary?.code ?? draft.companyCode,
      companyName: primary?.name ?? draft.companyName,
      companies: draft.selectedCompanies.map((item) => ({
        companyCode: item.code,
        companyName: item.name,
      })),
      visibilityScope: draft.visibilityScope,
      departmentCode: draft.departmentCode,
      departmentName: draft.departmentName,
      bpmDepartmentId: draft.linkToBpm ? draft.bpmDepartmentId : undefined,
      bpmDepartmentName: draft.linkToBpm ? draft.bpmDepartmentName : undefined,
      processId: draft.linkToBpm ? draft.processId : undefined,
      processCode: draft.linkToBpm ? draft.processCode : undefined,
      processName: draft.linkToBpm ? draft.processName : undefined,
      subProcesses: draft.linkToBpm ? draft.subProcesses : [],
      sections: draft.sections,
      version: draft.version,
    } as Policy);
    setSavedPolicy(saved);
    return saved;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await persistDraft();
      if (!saved) return;
      clearDraft();
      toast.success("Draft saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const saved = await persistDraft();
      if (!saved?.id) return;
      setPendingSubmitPolicy(saved);
      setSubmitDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSubmit = async (payload: {
    additionalApprovers: AdditionalApproverDraft[];
    submitterLevelMode: import("@/lib/types").SubmitterLevelMode;
  }) => {
    if (!pendingSubmitPolicy?.id) return;
    setIsSaving(true);
    try {
      const submitted = await submitPolicyApi(
        pendingSubmitPolicy.id,
        payload.additionalApprovers,
        payload.submitterLevelMode,
      );
      clearDraft();
      setSavedPolicy(submitted);
      setSubmitDialogOpen(false);
      setPendingSubmitPolicy(null);
      toast.success(
        submitted.status === "approved"
          ? "Policy approved automatically — no further approvers were required"
          : "Policy submitted for approval",
      );
      await onSubmitted?.(submitted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit policy");
    } finally {
      setIsSaving(false);
    }
  };

  const goNext = () => {
    if (!canGoNext) {
      toast.error("Please complete the required fields before continuing");
      return;
    }
    const next = steps[currentStepIndex + 1];
    if (next?.id === "content") setActiveSectionIndex(0);
    if (next) setStep(next.id);
  };

  const goBack = () => {
    const prev = steps[currentStepIndex - 1];
    if (prev) setStep(prev.id);
  };

  return (
    <div
      className={`app-surface mx-auto w-full rounded-lg p-4 md:p-6 ${
        step === "content" ? "max-w-6xl" : "max-w-5xl"
      }`}
    >
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isVersionDraft
              ? `New Version (v${draft.version})`
              : initialPolicy && !isDuplicate
                ? "Edit Policy"
                : isDuplicate
                  ? "Duplicate Policy"
                  : "Create New Policy"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isVersionDraft
              ? "Update the content for this version. Name, companies, and scope stay the same."
              : "Select companies, visibility scope, and department, then add topics and content."}
          </p>
        </div>
        {lastSavedAt && (
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Draft saved {lastSavedAt.toLocaleTimeString()}
          </div>
        )}
      </div>

      <WizardProgress steps={steps} currentStep={step} topicProgress={topicProgress} />

      {step === "info" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="policy-name">Policy Name</Label>
              {isVersionDraft ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                  {draft.name}
                </div>
              ) : (
                <Input
                  id="policy-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="e.g. Information Security Policy"
                />
              )}
            </div>

            {canEditScope ? (
              <CompanyMultiSelectContainer
                value={draft.selectedCompanies}
                onChange={(selectedCompanies) =>
                  setDraft((current) => {
                    const nextPrimary = selectedCompanies[0]?.code ?? "";
                    const primaryChanged =
                      nextPrimary !== (current.selectedCompanies[0]?.code ?? "");
                    return {
                      ...current,
                      selectedCompanies,
                      companyCode: selectedCompanies[0]?.code ?? "",
                      companyName: selectedCompanies[0]?.name ?? "",
                      ...(primaryChanged
                        ? {
                            departmentCode: null,
                            departmentName: "",
                            sections: templateId !== "blank" ? [] : current.sections,
                            ...clearBpmFields(),
                          }
                        : {}),
                    };
                  })
                }
              />
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Companies</div>
                <div className="mt-1 font-semibold text-slate-900">{activeCompanyName}</div>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Visibility when published</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                    draft.visibilityScope === "general"
                      ? "border-red-300 bg-red-50/60"
                      : "border-slate-200 bg-white"
                  } ${canEditScope ? "" : "cursor-default opacity-80"}`}
                >
                  <input
                    type="radio"
                    name="visibility-scope"
                    className="mt-0.5 h-4 w-4 border-slate-300 text-red-600"
                    checked={draft.visibilityScope === "general"}
                    disabled={!canEditScope}
                    onChange={() =>
                      setDraft((current) => ({ ...current, visibilityScope: "general" }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">General</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Visible to all departments in the selected companies.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                    draft.visibilityScope === "department"
                      ? "border-red-300 bg-red-50/60"
                      : "border-slate-200 bg-white"
                  } ${canEditScope ? "" : "cursor-default opacity-80"}`}
                >
                  <input
                    type="radio"
                    name="visibility-scope"
                    className="mt-0.5 h-4 w-4 border-slate-300 text-red-600"
                    checked={draft.visibilityScope === "department"}
                    disabled={!canEditScope}
                    onChange={() =>
                      setDraft((current) => ({ ...current, visibilityScope: "department" }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      Department-specific
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Visible only to the selected department.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <DepartmentSelect
              companyCode={primaryCompanyCode}
              value={draft.departmentCode}
              label={
                draft.visibilityScope === "general"
                  ? "Owning department (approval workflow)"
                  : "Target department"
              }
              disabled={!primaryCompanyCode || !canEditScope}
              onChange={(department) => {
                setTemplateId("blank");
                setDraft((current) => ({
                  ...current,
                  departmentCode: department?.code ?? null,
                  departmentName: department?.name ?? "",
                  sections: templateId !== "blank" ? [] : current.sections,
                  ...clearBpmFields(),
                }));
              }}
            />

            {isVersionDraft ? (
              <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 md:col-span-2">
                You are editing a new version draft. Metadata stays the same; update topics and
                content, then submit and publish. The previous published version will become
                inactive automatically when this version is published.
              </p>
            ) : null}
            {!isVersionDraft && draft.selectedCompanies.length > 1 ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 md:col-span-2">
                This policy will apply to{" "}
                <span className="font-semibold">{draft.selectedCompanies.length} companies</span>
                {draft.visibilityScope === "general"
                  ? " and be visible to all departments when published."
                  : ` for ${draft.departmentName || "the selected department"} when published.`}
              </p>
            ) : null}

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500/30"
                checked={draft.linkToBpm}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    linkToBpm: event.target.checked,
                    ...(event.target.checked ? {} : clearBpmFields()),
                  }))
                }
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Link to BPM process (optional)
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Enable only when the business process is already configured in BPM. Policies can
                  be created without a linked process.
                </span>
              </span>
            </label>

            {draft.linkToBpm ? (
              <BpmProcessFields
                companyCode={primaryCompanyCode}
                departmentName={draft.departmentName}
                processId={draft.processId}
                processCode={draft.processCode}
                processName={draft.processName}
                bpmDepartmentId={draft.bpmDepartmentId}
                bpmDepartmentName={draft.bpmDepartmentName}
                subProcesses={draft.subProcesses}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    ...value,
                  }))
                }
              />
            ) : null}

            {!initialPolicy && (
              <div className="md:col-span-2">
                <TemplatePicker
                  value={templateId}
                  departmentCode={draft.departmentCode}
                  onChange={(id) => void applyTemplate(id)}
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>Policy Version</Label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                v{draft.version}
                {isVersionDraft ? (
                  <span className="ms-2 text-xs font-normal text-slate-500">
                    Sequential version in this policy family
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "titles" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Enter topic title (e.g. Purpose, Scope, Responsibilities)"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTitle();
                }
              }}
            />
            <Button type="button" onClick={addTitle}>
              <Plus className="h-4 w-4" />
              Add Topic
            </Button>
          </div>

          {draft.sections.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Add at least one topic, or choose a template in step 1.
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">Drag topics to reorder</p>
              <TopicSortableList
                sections={draft.sections}
                onReorder={reorderSections}
                onRemove={removeSection}
              />
            </>
          )}
        </div>
      )}

      {step === "content" && (
        <SectionContentEditor
          sections={draft.sections}
          activeIndex={activeSectionIndex}
          onSelect={setActiveSectionIndex}
          onContentChange={updateSectionContent}
          topicProgress={topicProgress}
        />
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Ready to save — all {topicProgress.total} topics completed
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Policy</div>
              <div className="mt-1 font-semibold text-slate-900">{draft.name}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Scope</div>
              <div className="mt-1 font-semibold text-slate-900">
                {formatPolicyScopeLabel({
                  companyCode: draft.companyCode,
                  companyName: draft.companyName,
                  companies: draft.selectedCompanies.map((item) => ({
                    companyCode: item.code,
                    companyName: item.name,
                  })),
                  visibilityScope: draft.visibilityScope,
                  departmentCode: draft.departmentCode ?? 0,
                  departmentName: draft.departmentName,
                } as Policy)}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Visibility</div>
              <div className="mt-1 font-semibold text-slate-900">
                {draft.visibilityScope === "general" ? "General" : "Department-specific"}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Process</div>
              <div className="mt-1 font-semibold text-slate-900">{draft.processName || "—"}</div>
              {draft.subProcesses.length > 0 && (
                <div className="mt-2 text-xs text-slate-500">
                  Sub-processes: {draft.subProcesses.map((item) => item.name).join(", ")}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {draft.sections.map((section) => (
              <div key={section.id} className="rounded-md border border-slate-200 p-4">
                <h3 className="mb-2 font-semibold text-slate-900">{section.title}</h3>
                <div
                  className="policy-content text-sm text-slate-700"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
              <Send className="h-4 w-4" />
              {isSaving ? "Submitting..." : "Submit for Approval"}
            </Button>

            {savedPolicy?.id && (
              <>
                <Button
                  type="button"
                  variant="blue"
                  onClick={async () => {
                    try {
                      await downloadPolicyPdf(savedPolicy);
                      toast.success("PDF downloaded");
                    } catch {
                      toast.error("Failed to generate PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download as PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    openPolicyInBrowser(savedPolicy);
                    toast.info("Policy opened in new tab (copy disabled)");
                  }}
                >
                  <Eye className="h-4 w-4" />
                  View on Browser
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {currentStepIndex > 0 && (
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {step !== "review" && (
            <Button type="button" onClick={goNext} disabled={!canGoNext}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {pendingSubmitPolicy && (
        <SubmitApprovalDialog
          open={submitDialogOpen}
          policy={pendingSubmitPolicy}
          isSubmitting={isSaving}
          onClose={() => {
            if (isSaving) return;
            setSubmitDialogOpen(false);
          }}
          onConfirm={confirmSubmit}
        />
      )}
    </div>
  );
}
