import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { fetchBpmApplications } from "@/lib/api";
import type { PolicyApplicationLink } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ApplicationMultiSelectProps {
  value: PolicyApplicationLink[];
  onChange: (applications: PolicyApplicationLink[]) => void;
  label?: string;
  hint?: string;
}

function formatSelectedLabel(applications: PolicyApplicationLink[]) {
  if (applications.length === 0) return "Select applications";
  if (applications.length === 1) return applications[0].name;
  if (applications.length === 2) return `${applications[0].name}, ${applications[1].name}`;
  return `${applications[0].name} +${applications.length - 1} more`;
}

export default function ApplicationMultiSelect({
  value,
  onChange,
  label = "Apply to",
  hint,
}: ApplicationMultiSelectProps) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: applications = [], isLoading, isError, error } = useQuery({
    queryKey: ["bpm-applications"],
    queryFn: fetchBpmApplications,
    enabled: isAuthenticated && !isBootstrapping,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Failed to load applications");
    }
  }, [isError, error]);

  const updateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = 280;
    const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 280),
      zIndex: 80,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const selectedIds = useMemo(() => new Set(value.map((item) => item.id)), [value]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter((item) => item.name.toLowerCase().includes(term));
  }, [applications, query]);

  const toggleApplication = (application: PolicyApplicationLink) => {
    if (selectedIds.has(application.id)) {
      onChange(value.filter((item) => item.id !== application.id));
      return;
    }
    onChange([...value, { id: application.id, name: application.name }]);
  };

  const menu = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
    >
      <div className="border-b border-slate-100 p-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search applications..."
          className="h-8 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-red-300"
        />
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {isLoading || isBootstrapping ? (
          <p className="px-3 py-2 text-sm text-slate-500">Loading applications...</p>
        ) : isError ? (
          <p className="px-3 py-2 text-sm text-red-600">Failed to load applications</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">No applications found</p>
        ) : (
          filtered.map((application) => {
            const checked = selectedIds.has(application.id);
            return (
              <button
                key={application.id}
                type="button"
                onClick={() => toggleApplication(application)}
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
                    {application.name}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-2" ref={rootRef}>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm outline-none transition-colors",
            "focus:border-red-300 focus:ring-2 focus:ring-red-500/20",
            open && "border-red-300 ring-2 ring-red-500/20",
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate",
              value.length === 0 ? "text-slate-400" : "text-slate-900",
            )}
          >
            {formatSelectedLabel(value)}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {open ? createPortal(menu, document.body) : null}

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((application) => (
            <span
              key={application.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800"
            >
              <span className="truncate">{application.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item.id !== application.id))}
                className="rounded-full p-0.5 hover:bg-sky-100"
                aria-label={`Remove ${application.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
