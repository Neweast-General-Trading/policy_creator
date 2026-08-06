import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { POLICY_STATUS_LABELS, type PolicyStatus } from "@/lib/types";
import type { PolicyExplorerFilters } from "@/lib/explorer-filters";
import { cn } from "@/lib/utils";

interface PolicyExplorerFiltersProps {
  filters: PolicyExplorerFilters;
  onChange: (filters: PolicyExplorerFilters) => void;
  companies: Array<{ code: string; name: string }>;
  departments: Array<{ code: number; name: string; companyCode: string }>;
  compact?: boolean;
}

const STATUS_OPTIONS: Array<{ value: PolicyStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  ...(
    Object.entries(POLICY_STATUS_LABELS) as Array<[PolicyStatus, string]>
  ).map(([value, label]) => ({ value, label })),
];

const compactSelectClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-red-300 focus:ring-1 focus:ring-red-500/20";

function CompactSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        className={compactSelectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

export default function PolicyExplorerFiltersPanel({
  filters,
  onChange,
  companies,
  departments,
  compact = false,
}: PolicyExplorerFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleDepartments =
    filters.companyCode === "all"
      ? departments
      : departments.filter((item) => item.companyCode === filters.companyCode);

  const hasActiveFilters = useMemo(
    () =>
      filters.search.trim() !== "" ||
      filters.status !== "all" ||
      filters.companyCode !== "all" ||
      filters.departmentCode !== "all",
    [filters],
  );

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Input
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Search..."
            className="h-8 flex-1 text-xs"
          />
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className={cn(
              "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50",
              (expanded || hasActiveFilters) && "border-red-200 bg-red-50 text-red-700",
            )}
            aria-label={expanded ? "Hide filters" : "Show filters"}
            aria-expanded={expanded}
          >
            <Filter className="h-3.5 w-3.5" />
            {hasActiveFilters ? (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-600" />
            ) : null}
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  search: "",
                  status: "all",
                  companyCode: "all",
                  departmentCode: "all",
                })
              }
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Clear filters"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {expanded ? (
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Filters
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <CompactSelect
                label="Status"
                value={filters.status}
                onChange={(value) =>
                  onChange({
                    ...filters,
                    status: value as PolicyExplorerFilters["status"],
                  })
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CompactSelect>
              <CompactSelect
                label="Company"
                value={filters.companyCode}
                onChange={(value) =>
                  onChange({
                    ...filters,
                    companyCode: value,
                    departmentCode: "all",
                  })
                }
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.code} value={company.code}>
                    {company.name}
                  </option>
                ))}
              </CompactSelect>
              <CompactSelect
                label="Department"
                value={filters.departmentCode}
                onChange={(value) =>
                  onChange({ ...filters, departmentCode: value })
                }
              >
                <option value="all">All departments</option>
                {visibleDepartments.map((department) => (
                  <option
                    key={`${department.companyCode}-${department.code}`}
                    value={String(department.code)}
                  >
                    {department.name}
                  </option>
                ))}
              </CompactSelect>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Filter className="h-3 w-3" />
        Filters
      </div>

      <Input
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
        placeholder="Search policies..."
        className="h-8 text-xs"
      />

      <div className="grid grid-cols-1 gap-2">
        <CompactSelect
          label="Status"
          value={filters.status}
          onChange={(value) =>
            onChange({
              ...filters,
              status: value as PolicyExplorerFilters["status"],
            })
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </CompactSelect>
        <CompactSelect
          label="Company"
          value={filters.companyCode}
          onChange={(value) =>
            onChange({
              ...filters,
              companyCode: value,
              departmentCode: "all",
            })
          }
        >
          <option value="all">All companies</option>
          {companies.map((company) => (
            <option key={company.code} value={company.code}>
              {company.name}
            </option>
          ))}
        </CompactSelect>
        <CompactSelect
          label="Department"
          value={filters.departmentCode}
          onChange={(value) => onChange({ ...filters, departmentCode: value })}
        >
          <option value="all">All departments</option>
          {visibleDepartments.map((department) => (
            <option
              key={`${department.companyCode}-${department.code}`}
              value={String(department.code)}
            >
              {department.name}
            </option>
          ))}
        </CompactSelect>
      </div>
    </div>
  );
}
