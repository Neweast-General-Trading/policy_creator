import { useMemo, useState } from "react";
import { ArrowLeft, CopyPlus, FilePlus2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PolicyStatusDot from "@/components/policies/PolicyStatusDot";
import { formatPolicyScopeLabel } from "@/lib/policy-companies";
import type { Policy } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CreatePolicyEntryPageProps {
  policies: Policy[];
  onCancel: () => void;
  onCreateNew: () => void;
  onCreateFromExisting: (policy: Policy) => void;
}

export default function CreatePolicyEntryPage({
  policies,
  onCancel,
  onCreateNew,
  onCreateFromExisting,
}: CreatePolicyEntryPageProps) {
  const [mode, setMode] = useState<"choose" | "pick">("choose");
  const [query, setQuery] = useState("");

  const publishedPolicies = useMemo(
    () =>
      policies
        .filter((policy) => policy.status === "published")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [policies],
  );

  const filteredPolicies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return publishedPolicies;
    return publishedPolicies.filter(
      (policy) =>
        policy.name.toLowerCase().includes(normalized) ||
        policy.departmentName.toLowerCase().includes(normalized) ||
        formatPolicyScopeLabel(policy).toLowerCase().includes(normalized),
    );
  }, [publishedPolicies, query]);

  if (mode === "pick") {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("choose")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Choose base policy</h2>
            <p className="text-sm text-slate-500">
              Select a published policy to create the next version from.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, department, or company..."
            className="pl-9"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filteredPolicies.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No published policies found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPolicies.map((policy) => (
                <button
                  key={policy.id}
                  type="button"
                  onClick={() => onCreateFromExisting(policy)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50"
                >
                  <PolicyStatusDot status={policy.status} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{policy.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        v{policy.version}
                      </span>
                      {policy.isActive === false ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          Inactive
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatPolicyScopeLabel(policy)}
                    </span>
                  </span>
                  <CopyPlus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Create Policy</h2>
          <p className="text-sm text-slate-500">
            Start from scratch or create a new version of an existing published policy.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onCreateNew}
          className={cn(
            "rounded-xl border border-slate-200 bg-white p-6 text-left transition",
            "hover:border-red-200 hover:bg-red-50/40",
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <FilePlus2 className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">New policy</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create a brand-new policy with its own version history starting at v1.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode("pick")}
          className={cn(
            "rounded-xl border border-slate-200 bg-white p-6 text-left transition",
            "hover:border-sky-200 hover:bg-sky-50/40",
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <CopyPlus className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">New version</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pick an existing published policy and create the next sequential version. The old
            version becomes inactive when the new one is published.
          </p>
        </button>
      </div>
    </div>
  );
}
