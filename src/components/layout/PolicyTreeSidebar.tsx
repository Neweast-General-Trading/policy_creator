import { useMemo, useState } from "react";
import {
  ChevronRight,
  Copy,
  Folder,
  Loader2,
  Plus,
  ShieldUser,
  Trash2,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import PolicyExplorerFiltersPanel from "@/components/explorer/PolicyExplorerFilters";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { groupPoliciesTree } from "@/lib/api";
import PolicyStatusDot from "@/components/policies/PolicyStatusDot";
import PolicyStatusLegend from "@/components/policies/PolicyStatusLegend";
import {
  DEFAULT_EXPLORER_FILTERS,
  applyExplorerFilters,
  buildExplorerFilterOptions,
} from "@/lib/explorer-filters";
import type { Policy } from "@/lib/types";
import { assetUrl, cn } from "@/lib/utils";

interface PolicyTreeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  policies: Policy[];
  isLoading?: boolean;
  selectedPolicyId: string | null;
  userEmail?: string;
  canDeleteAnyPolicy?: boolean;
  onSelectPolicy: (policy: Policy) => void;
  onCreateNew: () => void;
  onDeletePolicy: (policyId: string) => void;
  onDuplicatePolicy: (policy: Policy) => void;
}

export default function PolicyTreeSidebar({
  isOpen,
  onClose,
  policies,
  isLoading = false,
  selectedPolicyId,
  userEmail = "",
  canDeleteAnyPolicy = false,
  onSelectPolicy,
  onCreateNew,
  onDeletePolicy,
  onDuplicatePolicy,
}: PolicyTreeSidebarProps) {
  const [filters, setFilters] = useState(DEFAULT_EXPLORER_FILTERS);

  const filterOptions = useMemo(
    () => buildExplorerFilterOptions(policies),
    [policies],
  );

  const filteredPolicies = useMemo(
    () => applyExplorerFilters(policies, filters),
    [policies, filters],
  );

  const tree = groupPoliciesTree(filteredPolicies);

  const canDeletePolicyItem = (policy: Policy) => {
    if (canDeleteAnyPolicy) return true;
    return (
      policy.createdByEmail.toLowerCase() === userEmail.toLowerCase() &&
      policy.status === "draft"
    );
  };

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.companyCode !== "all" ||
    filters.departmentCode !== "all";

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed z-40 flex h-screen w-72 flex-col border-x border-slate-200 bg-white transition-all duration-300 ease-in-out md:static",
          isOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:overflow-hidden md:border-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div>
            <img src={assetUrl("logo.png")} alt="NEWEAST logo" width={150} height={60} />
            <div className="mt-2 text-xs leading-6 text-slate-500">
              Policy Creator (v2.0.0)
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <Button className="w-full" onClick={onCreateNew}>
            <Plus className="h-4 w-4" />
            Create New Policy
          </Button>
          <PolicyExplorerFiltersPanel
            compact
            filters={filters}
            onChange={setFilters}
            companies={filterOptions.companies}
            departments={filterOptions.departments}
          />
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-3 py-4">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold text-slate-800">
            <ShieldUser className="h-4 w-4 text-red-600" />
            Policies
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading policies...
            </div>
          ) : tree.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
              {hasActiveFilters ? "No policies match your filters." : "No policies yet."}
            </div>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={tree.map((company) => company.companyCode)}
              className="rounded-md border border-slate-200"
            >
              {tree.map((company) => (
                <AccordionItem
                  key={company.companyCode}
                  value={company.companyCode}
                  className="px-3"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="truncate text-left">{company.companyName}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Accordion
                      type="multiple"
                      defaultValue={company.departments.map((dept) =>
                        String(dept.departmentCode),
                      )}
                      className="ms-2 border-s border-slate-200 ps-3"
                    >
                      {company.departments.map((department) => (
                        <AccordionItem
                          key={department.departmentCode}
                          value={String(department.departmentCode)}
                          className="border-none"
                        >
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Folder className="h-3.5 w-3.5 shrink-0 text-red-500" />
                              <span className="truncate text-left text-xs">
                                {department.departmentName}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                {department.policies.length}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-col gap-1 ps-2">
                              {department.policies.map((policy) => (
                                <div
                                  key={policy.id}
                                  className="group flex items-center gap-1"
                                >
                                  <button
                                    type="button"
                                    onClick={() => onSelectPolicy(policy)}
                                    className={cn(
                                      "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-slate-100",
                                      selectedPolicyId === policy.id &&
                                        "bg-red-50 text-red-700 hover:bg-red-50",
                                    )}
                                  >
                                    <PolicyStatusDot status={policy.status} />
                                    <span className="min-w-0 flex-1 truncate">
                                      {policy.name}
                                      <span className="ms-1 text-[10px] text-slate-400">v{policy.version}</span>
                                      {policy.isActive === false ? (
                                        <span className="ms-1 text-[10px] text-amber-700">· inactive</span>
                                      ) : null}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDuplicatePolicy(policy)}
                                    className="shrink-0 rounded p-1 text-blue-600 hover:bg-blue-50"
                                    title="Duplicate policy"
                                    aria-label={`Duplicate ${policy.name}`}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  {canDeletePolicyItem(policy) ? (
                                    <button
                                      type="button"
                                      onClick={() => onDeletePolicy(policy.id)}
                                      className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
                                      title="Delete policy"
                                      aria-label={`Delete ${policy.name}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>

        <div className="shrink-0 border-t border-slate-200 p-3">
          <PolicyStatusLegend />
        </div>
      </aside>
    </>
  );
}
