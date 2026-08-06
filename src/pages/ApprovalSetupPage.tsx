import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GitBranch, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import CompanyMultiSelectContainer from "@/components/shared/CompanyMultiSelectContainer";
import DepartmentSelect from "@/components/shared/DepartmentSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import {
  deleteApprovalSetupApi,
  fetchApprovalSetups,
  fetchDepartmentEmployees,
  saveApprovalSetupApi,
} from "@/lib/api";
import {
  LEVEL_AUDIENCE_OPTIONS,
  SUBMITTER_LEVEL_OPTIONS,
  type ApprovalStageConfig,
  type ApprovalStageLevelConfig,
  type PolicyApprovalSetup,
  type PolicyApprovalSetupRecord,
  type CompanyOption,
  type HierarchyTierPreview,
  type StageLevelAudience,
  type SubmitterLevelMode,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type View = "list" | "create" | "edit";

type ApprovalSetupFormState = PolicyApprovalSetup & {
  selectedCompanies: CompanyOption[];
};

function emptySetup(): ApprovalSetupFormState {
  return {
    companyCode: "",
    companyName: "",
    selectedCompanies: [],
    sourceDepartmentCode: 0,
    sourceDepartmentName: "",
    submitterLevelMode: "all",
    hodSkipInternalLevels: true,
    stages: [],
  };
}

function companiesFromSetup(setup: PolicyApprovalSetupRecord): CompanyOption[] {
  if (setup.companies?.length) {
    return setup.companies.map((item) => ({
      code: item.companyCode,
      name: item.companyName,
    }));
  }
  if (setup.companyCode) {
    return [{ code: setup.companyCode, name: setup.companyName }];
  }
  return [];
}

function formatCompaniesLabel(setup: PolicyApprovalSetupRecord) {
  const companies = companiesFromSetup(setup);
  if (companies.length === 0) return setup.companyName || "—";
  if (companies.length <= 3) return companies.map((item) => item.name).join(", ");
  return `${companies.slice(0, 2).map((item) => item.name).join(", ")} +${companies.length - 2} more`;
}

function emptyLevel(): ApprovalStageLevelConfig {
  return { audience: "tier", assigneeMode: "all", assignees: [] };
}

function resolveLevelPreview(
  levelIndex: number,
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: Array<{
    userId: string;
    email: string;
    name: string;
    directReportsInDept?: number;
  }>,
  audience: StageLevelAudience = "tier",
): HierarchyTierPreview | undefined {
  const mapEmployee = (item: (typeof employees)[number]) => ({
    userId: item.userId,
    email: item.email,
    name: item.name,
    directReportsInDept: item.directReportsInDept ?? 0,
  });

  if (audience === "managers_only") {
    const managers = employees.filter((item) => (item.directReportsInDept ?? 0) > 0);
    return {
      tier: levelIndex + 1,
      label: "Only reporting — managers with direct reports in department",
      employees: managers.map(mapEmployee),
    };
  }

  if (audience === "staff_only") {
    const staff = employees.filter((item) => !(item.directReportsInDept ?? 0));
    return {
      tier: levelIndex + 1,
      label: "Staff only — no direct reports in department",
      employees: staff.map(mapEmployee),
    };
  }

  if (totalLevels === 2) {
    const staff = employees.filter((item) => !(item.directReportsInDept ?? 0));
    const managers = employees.filter((item) => (item.directReportsInDept ?? 0) > 0);
    const list = levelIndex === 0 ? staff : managers;
    return {
      tier: levelIndex + 1,
      label:
        levelIndex === 0
          ? "Staff — no direct reports in department"
          : "Managers — employees with direct reports in department",
      employees: list.map(mapEmployee),
    };
  }

  return hierarchyTiers[levelIndex];
}

type DeptEmployee = {
  userId: string;
  email: string;
  name: string;
  reportingToId?: string;
  directReportsInDept?: number;
};

function getAssignedUserIds(
  levels: ApprovalStageLevelConfig[],
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: DeptEmployee[],
  upToExclusive: number,
): Set<string> {
  const assigned = new Set<string>();
  for (let index = 0; index < upToExclusive; index += 1) {
    const priorLevel = levels[index];
    const pool =
      resolveLevelPreview(
        index,
        totalLevels,
        hierarchyTiers,
        employees,
        priorLevel.audience ?? "tier",
      )?.employees ?? [];
    if (priorLevel.assigneeMode === "all") {
      for (const employee of pool) assigned.add(employee.userId);
    } else {
      for (const assignee of priorLevel.assignees) assigned.add(assignee.userId);
    }
  }
  return assigned;
}

function getBlockedUserIds(
  levels: ApprovalStageLevelConfig[],
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: DeptEmployee[],
  upToExclusive: number,
): Set<string> {
  const assigned = getAssignedUserIds(
    levels,
    totalLevels,
    hierarchyTiers,
    employees,
    upToExclusive,
  );
  const blocked = new Set(assigned);
  for (const employee of employees) {
    const managerId = employee.reportingToId?.trim();
    if (managerId && assigned.has(managerId)) {
      blocked.add(employee.userId);
    }
  }
  return blocked;
}

function isManagerEmployee(employees: DeptEmployee[], userId: string) {
  const employee = employees.find((item) => item.userId === userId);
  return (employee?.directReportsInDept ?? 0) > 0;
}

function levelInvolvesManager(
  level: ApprovalStageLevelConfig,
  levelIndex: number,
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: DeptEmployee[],
): boolean {
  const pool =
    resolveLevelPreview(
      levelIndex,
      totalLevels,
      hierarchyTiers,
      employees,
      level.audience ?? "tier",
    )?.employees ?? [];

  if (level.assigneeMode === "all") {
    if (level.audience === "staff_only") return false;
    if (level.audience === "managers_only") return pool.length > 0;
    return pool.some((employee) => (employee.directReportsInDept ?? 0) > 0);
  }

  if (level.assignees.length === 0) return false;
  return level.assignees.some((assignee) => isManagerEmployee(employees, assignee.userId));
}

function priorLevelsInvolveManager(
  levels: ApprovalStageLevelConfig[],
  levelIndex: number,
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: DeptEmployee[],
): boolean {
  for (let index = 0; index < levelIndex; index += 1) {
    if (levelInvolvesManager(levels[index], index, totalLevels, hierarchyTiers, employees)) {
      return true;
    }
  }
  return false;
}

function enforceManagerOnlyBelow(
  levels: ApprovalStageLevelConfig[],
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: DeptEmployee[],
): ApprovalStageLevelConfig[] {
  let managerSeen = false;
  return levels.map((level, index) => {
    let next: ApprovalStageLevelConfig = {
      ...level,
      assignees: [...level.assignees],
    };

    if (managerSeen) {
      next = {
        ...next,
        audience: "managers_only",
        assignees: next.assignees.filter((assignee) =>
          isManagerEmployee(employees, assignee.userId),
        ),
      };
    }

    if (!managerSeen && levelInvolvesManager(next, index, totalLevels, hierarchyTiers, employees)) {
      managerSeen = true;
    }

    return next;
  });
}

function hasInvertedAudienceOrder(
  levels: ApprovalStageLevelConfig[],
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: DeptEmployee[],
): boolean {
  for (let index = 0; index < levels.length; index += 1) {
    if (!levelInvolvesManager(levels[index], index, totalLevels, hierarchyTiers, employees)) {
      continue;
    }
    for (let later = index + 1; later < levels.length; later += 1) {
      if (levels[later].audience === "staff_only") return true;
    }
  }
  return false;
}

function stripCrossLevelDuplicates(
  levels: ApprovalStageLevelConfig[],
  totalLevels: number,
  hierarchyTiers: HierarchyTierPreview[],
  employees: DeptEmployee[],
): ApprovalStageLevelConfig[] {
  const enforced = enforceManagerOnlyBelow(levels, totalLevels, hierarchyTiers, employees);
  return enforced.map((level, index) => {
    const blocked = getBlockedUserIds(
      enforced,
      enforced.length,
      hierarchyTiers,
      employees,
      index,
    );
    if (blocked.size === 0) return level;
    return {
      ...level,
      assignees: level.assignees.filter((assignee) => !blocked.has(assignee.userId)),
    };
  });
}

interface LevelEditorProps {
  levelIndex: number;
  totalLevels: number;
  level: ApprovalStageLevelConfig;
  allLevels: ApprovalStageLevelConfig[];
  hierarchyTiers: HierarchyTierPreview[];
  employees: DeptEmployee[];
  onChange: (level: ApprovalStageLevelConfig) => void;
  onRemove: () => void;
}

function LevelEditor({
  levelIndex,
  totalLevels,
  level,
  allLevels,
  hierarchyTiers,
  employees,
  onChange,
  onRemove,
}: LevelEditorProps) {
  const managersOnlyRequired = priorLevelsInvolveManager(
    allLevels,
    levelIndex,
    totalLevels,
    hierarchyTiers,
    employees,
  );
  const effectiveAudience: StageLevelAudience = managersOnlyRequired
    ? "managers_only"
    : (level.audience ?? "tier");
  const tier = resolveLevelPreview(
    levelIndex,
    totalLevels,
    hierarchyTiers,
    employees,
    effectiveAudience,
  );
  const blockedIds = getBlockedUserIds(
    allLevels,
    totalLevels,
    hierarchyTiers,
    employees,
    levelIndex,
  );
  const assignedAboveIds = getAssignedUserIds(
    allLevels,
    totalLevels,
    hierarchyTiers,
    employees,
    levelIndex,
  );
  const tierEmployees = (tier?.employees ?? [])
    .filter((employee) => !blockedIds.has(employee.userId))
    .filter((employee) => !managersOnlyRequired || (employee.directReportsInDept ?? 0) > 0);
  const audienceOptions = LEVEL_AUDIENCE_OPTIONS.filter(
    (option) => !managersOnlyRequired || option.value === "managers_only",
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Level {levelIndex + 1}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            {managersOnlyRequired
              ? "Only reporting — managers only (a manager already approves above)"
              : tier?.label}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-3">
        <SelectField
          label="Who approves at this level"
          value={effectiveAudience}
          disabled={managersOnlyRequired}
          onChange={(event) =>
            onChange({
              ...level,
              audience: event.target.value as StageLevelAudience,
              assignees: [],
              assigneeMode: "all",
            })
          }
        >
          {audienceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <p className="mt-1 text-[11px] text-slate-500">
          {managersOnlyRequired
            ? "After a manager approves above, only other managers can approve at this level."
            : LEVEL_AUDIENCE_OPTIONS.find((item) => item.value === (level.audience ?? "tier"))
                ?.description}
        </p>
      </div>

      {tierEmployees.length === 0 ? (
        <p className="mb-2 rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {assignedAboveIds.size > 0
            ? "No remaining approvers — earlier levels already cover this pool or their direct reports."
            : "No employees resolved for this hierarchy tier. Add another level or verify reporting lines in BI."}
        </p>
      ) : (
        <>
          <div className="mb-2 flex gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={level.assigneeMode === "all"}
                onChange={() => onChange({ ...level, assigneeMode: "all", assignees: [] })}
              />
              All in pool
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={level.assigneeMode === "selected"}
                onChange={() => onChange({ ...level, assigneeMode: "selected" })}
              />
              Selected only
            </label>
          </div>

          {level.assigneeMode === "selected" ? (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded border bg-white p-2">
              {tierEmployees.map((employee) => {
                const checked = level.assignees.some((item) => item.userId === employee.userId);
                return (
                  <label
                    key={employee.userId}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({
                          ...level,
                          assignees: checked
                            ? level.assignees.filter((item) => item.userId !== employee.userId)
                            : [
                                ...level.assignees,
                                {
                                  userId: employee.userId,
                                  email: employee.email,
                                  name: employee.name,
                                },
                              ],
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      {employee.name}
                      {employee.directReportsInDept > 0 ? (
                        <span className="ms-2 text-xs text-slate-500">
                          {employee.directReportsInDept} report(s)
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-medium text-slate-700">
                {tierEmployees.length} approver(s) · parallel approval (any one advances)
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                {tierEmployees.map((item) => item.name).join(", ")}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface StageEditorProps {
  stage: ApprovalStageConfig;
  companyCode: string;
  onChange: (stage: ApprovalStageConfig) => void;
  onRemove: () => void;
}

function StageEditor({ stage, companyCode, onChange, onRemove }: StageEditorProps) {
  const employeesQuery = useQuery({
    queryKey: ["dept-employees", companyCode, stage.departmentCode],
    queryFn: () => fetchDepartmentEmployees(companyCode, stage.departmentCode),
    enabled: Boolean(companyCode && stage.departmentCode),
  });

  const hierarchyTiers = employeesQuery.data?.hierarchyTiers ?? [];
  const employees = employeesQuery.data?.employees ?? [];
  const maxLevels =
    stage.levels.length === 2 ? 2 : Math.max(hierarchyTiers.length, stage.levels.length);

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <DepartmentSelect
            companyCode={companyCode}
            value={stage.departmentCode || null}
            label="Department"
            onChange={(department) =>
              onChange({
                departmentCode: department?.code ?? 0,
                departmentName: department?.name ?? "",
                levels: [],
              })
            }
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
          Remove
        </Button>
      </div>

      {stage.departmentCode > 0 ? (
        <>
          {employeesQuery.isLoading ? (
            <p className="mb-3 text-xs text-slate-500">Loading org hierarchy from BI…</p>
          ) : hierarchyTiers.length > 0 ? (
            <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
              <p className="font-semibold">Org hierarchy detected ({hierarchyTiers.length} tier(s))</p>
              <p className="mt-1 text-violet-800/90">
                With 2 levels: staff first, then all managers. With 3+ levels: full org tiers from BI
                REPORTINGTOID.
              </p>
            </div>
          ) : (
            <p className="mb-3 text-xs text-amber-700">No hierarchy tiers found for this department.</p>
          )}

          {hasInvertedAudienceOrder(stage.levels, stage.levels.length, hierarchyTiers, employees) ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">Approval order looks reversed</p>
              <p className="mt-1 text-amber-800/90">
                Levels run top to bottom. Put <strong>Staff only</strong> before{" "}
                <strong>Only reporting</strong> so employees approve before their manager — not
                the other way around.
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            {stage.levels.map((level, index) => (
              <LevelEditor
                key={`${stage.departmentCode}-level-${index}`}
                levelIndex={index}
                totalLevels={stage.levels.length}
                level={level}
                allLevels={stage.levels}
                hierarchyTiers={hierarchyTiers}
                employees={employees}
                onChange={(nextLevel) => {
                  const nextLevels = stage.levels.map((item, i) =>
                    i === index ? nextLevel : item,
                  );
                  onChange({
                    ...stage,
                    levels: stripCrossLevelDuplicates(
                      nextLevels,
                      nextLevels.length,
                      hierarchyTiers,
                      employees,
                    ),
                  });
                }}
                onRemove={() =>
                  onChange({
                    ...stage,
                    levels: stage.levels.filter((_, i) => i !== index),
                  })
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={hierarchyTiers.length > 0 && stage.levels.length >= maxLevels}
              onClick={() => onChange({ ...stage, levels: [...stage.levels, emptyLevel()] })}
            >
              <Plus className="h-4 w-4" />
              Add level
            </Button>
            {hierarchyTiers.length > 0 && stage.levels.length >= maxLevels ? (
              <p className="text-xs text-slate-500">
                {stage.levels.length === 2
                  ? "Two-level mode: staff + managers."
                  : `Maximum ${hierarchyTiers.length} hierarchy tier(s) for this department.`}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ApprovalSetupForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: PolicyApprovalSetupRecord | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ApprovalSetupFormState>(() =>
    initial
      ? {
          companyCode: initial.companyCode,
          companyName: initial.companyName,
          selectedCompanies: companiesFromSetup(initial),
          sourceDepartmentCode: initial.sourceDepartmentCode,
          sourceDepartmentName: initial.sourceDepartmentName,
          submitterLevelMode: initial.submitterLevelMode,
          hodSkipInternalLevels: initial.hodSkipInternalLevels,
          stages: initial.stages.map((stage) => ({
            ...stage,
            levels: stage.levels.map((level) => ({ ...level, assignees: [...level.assignees] })),
          })),
        }
      : emptySetup(),
  );
  const [isSaving, setIsSaving] = useState(false);

  const primaryCompanyCode = form.selectedCompanies[0]?.code ?? form.companyCode;

  const canSave =
    form.selectedCompanies.length > 0 &&
    form.sourceDepartmentCode > 0 &&
    form.sourceDepartmentName.trim() &&
    form.stages.length > 0 &&
    form.stages.every(
      (stage) =>
        stage.departmentCode > 0 &&
        stage.levels.length > 0 &&
        stage.levels.every(
          (level) => level.assigneeMode === "all" || level.assignees.length > 0,
        ),
    );

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Complete all required fields");
      return;
    }
    setIsSaving(true);
    try {
      const primary = form.selectedCompanies[0];
      const saved = await saveApprovalSetupApi(
        {
          companyCode: primary?.code ?? form.companyCode,
          companyName: primary?.name ?? form.companyName,
          companies: form.selectedCompanies.map((item) => ({
            companyCode: item.code,
            companyName: item.name,
          })),
          sourceDepartmentCode: form.sourceDepartmentCode,
          sourceDepartmentName: form.sourceDepartmentName,
          submitterLevelMode: form.submitterLevelMode,
          hodSkipInternalLevels: form.hodSkipInternalLevels,
          stages: form.stages,
        },
        initial?.id,
      );
      await queryClient.invalidateQueries({ queryKey: ["approval-setups"] });
      toast.success(
        `Saved for ${formatCompaniesLabel(saved)} · ${saved.sourceDepartmentName}`,
      );
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold text-slate-900">
          {initial ? "Edit Setup" : "New Setup"}
        </h2>
      </div>

      <div className="app-surface space-y-4 rounded-xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <CompanyMultiSelectContainer
            value={form.selectedCompanies}
            onChange={(selectedCompanies) =>
              setForm((current) => {
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
                        sourceDepartmentCode: 0,
                        sourceDepartmentName: "",
                        stages: [],
                      }
                    : {}),
                };
              })
            }
          />
          <DepartmentSelect
            companyCode={primaryCompanyCode}
            value={form.sourceDepartmentCode || null}
            label="Source department (policy creator)"
            disabled={!primaryCompanyCode}
            onChange={(department) =>
              setForm((current) => ({
                ...current,
                sourceDepartmentCode: department?.code ?? 0,
                sourceDepartmentName: department?.name ?? "",
              }))
            }
          />
        </div>
        {form.selectedCompanies.length > 1 ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            This matrix will apply to{" "}
            <span className="font-semibold">{form.selectedCompanies.length} companies</span> for{" "}
            <span className="font-semibold">{form.sourceDepartmentName || "the selected department"}</span>.
            Department and approver names should match across those companies.
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Internal approvals (source dept)"
            value={form.submitterLevelMode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                submitterLevelMode: event.target.value as SubmitterLevelMode,
              }))
            }
          >
            {SUBMITTER_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-red-600"
              checked={form.hodSkipInternalLevels}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hodSkipInternalLevels: event.target.checked,
                }))
              }
            />
            HOD skips internal approvals
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Downstream departments (in order)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!primaryCompanyCode}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  stages: [
                    ...current.stages,
                    { departmentCode: 0, departmentName: "", levels: [] },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add department
            </Button>
          </div>

          {form.stages.map((stage, index) => (
            <StageEditor
              key={`stage-${index}`}
              stage={stage}
              companyCode={primaryCompanyCode}
              onChange={(nextStage) =>
                setForm((current) => ({
                  ...current,
                  stages: current.stages.map((item, i) => (i === index ? nextStage : item)),
                }))
              }
              onRemove={() =>
                setForm((current) => ({
                  ...current,
                  stages: current.stages.filter((_, i) => i !== index),
                }))
              }
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave || isSaving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalSetupPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("list");
  const [editingSetup, setEditingSetup] = useState<PolicyApprovalSetupRecord | null>(null);

  const { data: setups = [], isLoading } = useQuery({
    queryKey: ["approval-setups"],
    queryFn: () => fetchApprovalSetups(),
  });

  const handleDelete = async (setup: PolicyApprovalSetupRecord) => {
    if (!window.confirm(`Delete setup for ${setup.sourceDepartmentName}?`)) return;
    try {
      await deleteApprovalSetupApi(setup.id);
      await queryClient.invalidateQueries({ queryKey: ["approval-setups"] });
      toast.success("Deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  if (view === "create") {
    return (
      <ApprovalSetupForm
        onCancel={() => setView("list")}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["approval-setups"] });
          setView("list");
        }}
      />
    );
  }

  if (view === "edit" && editingSetup) {
    return (
      <ApprovalSetupForm
        initial={editingSetup}
        onCancel={() => {
          setEditingSetup(null);
          setView("list");
        }}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["approval-setups"] });
          setEditingSetup(null);
          setView("list");
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Approval Setup</h2>
          <p className="text-sm text-slate-500">
            Per source department · apply one matrix to multiple companies
          </p>
        </div>
        <Button onClick={() => setView("create")}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : setups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <GitBranch className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-600">No setup yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">Companies</th>
                <th className="px-4 py-3 text-start font-semibold">Source dept</th>
                <th className="px-4 py-3 text-start font-semibold">Route</th>
                <th className="px-4 py-3 text-start font-semibold">Updated</th>
                <th className="px-4 py-3 text-end font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {setups.map((setup) => (
                <tr key={setup.id}>
                  <td className="px-4 py-3">{formatCompaniesLabel(setup)}</td>
                  <td className="px-4 py-3">{setup.sourceDepartmentName}</td>
                  <td className="px-4 py-3">
                    {setup.stages.map((stage) => stage.departmentName).join(" → ")}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(setup.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingSetup(setup);
                          setView("edit");
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDelete(setup)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
