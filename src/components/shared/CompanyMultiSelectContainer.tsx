import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { fetchCompanies } from "@/lib/api";
import type { CompanyOption } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CompanyMultiSelectContainerProps {
  value: CompanyOption[];
  onChange: (companies: CompanyOption[]) => void;
  label?: string;
  disabled?: boolean;
}

function formatSelectedLabel(companies: CompanyOption[]) {
  if (companies.length === 0) return "Select company";
  if (companies.length === 1) return companies[0].name;
  if (companies.length === 2) return `${companies[0].name}, ${companies[1].name}`;
  return `${companies[0].name} +${companies.length - 1} more`;
}

export default function CompanyMultiSelectContainer({
  value,
  onChange,
  label = "Company",
  disabled = false,
}: CompanyMultiSelectContainerProps) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: companies = [], isLoading, isError, error } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await fetchCompanies();
      return response.result.map((item) => ({
        code: item.BRANCH,
        name: item.COMPANY?.trim() || item.BRANCH,
      }));
    },
    enabled: isAuthenticated && !isBootstrapping,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Failed to load companies");
    }
  }, [isError, error]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const selectedCodes = useMemo(() => new Set(value.map((item) => item.code)), [value]);
  const triggerLabel = formatSelectedLabel(value);

  const toggleCompany = (company: CompanyOption) => {
    if (disabled) return;
    if (selectedCodes.has(company.code)) {
      onChange(value.filter((item) => item.code !== company.code));
      return;
    }
    onChange([...value, company]);
  };

  const removeCompany = (companyCode: string) => {
    if (disabled) return;
    onChange(value.filter((item) => item.code !== companyCode));
  };

  return (
    <div className="space-y-2" ref={rootRef}>
      <label className="text-sm font-medium text-slate-700">{label}</label>

      <div className="relative">
        <button
          type="button"
          disabled={disabled || isLoading || isBootstrapping}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm outline-none transition-colors",
            "focus:border-red-300 focus:ring-2 focus:ring-red-500/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-red-300 ring-2 ring-red-500/20",
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate",
              value.length === 0 ? "text-slate-400" : "text-slate-900",
            )}
          >
            {isLoading || isBootstrapping
              ? "Loading companies..."
              : isError
                ? "Failed to load companies"
                : triggerLabel}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && !isLoading && !isBootstrapping && !isError ? (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {companies.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">No companies available</p>
            ) : (
              companies.map((company) => {
                const checked = selectedCodes.has(company.code);
                return (
                  <button
                    key={company.code}
                    type="button"
                    onClick={() => toggleCompany(company)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50",
                      checked && "bg-red-50/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-slate-300 bg-white",
                      )}
                    >
                      {checked ? "✓" : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {company.name}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((company) => (
            <span
              key={company.code}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800"
            >
              <span className="truncate">{company.name}</span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeCompany(company.code)}
                  className="rounded-full p-0.5 hover:bg-red-100"
                  aria-label={`Remove ${company.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
