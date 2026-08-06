import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import PolicyListTable from "@/components/policies/PolicyListTable";
import { Button } from "@/components/ui/button";
import { fetchPolicies } from "@/lib/api";
import {
  POLICY_LIST_FILTER_LABELS,
  filterPoliciesByListFilter,
  type PolicyListFilter,
} from "@/lib/policy-list-filters";
import type { Policy } from "@/lib/types";

interface PoliciesListPageProps {
  filter: PolicyListFilter;
  userEmail: string;
  showOwnerDetails?: boolean;
  onBack: () => void;
  onOpenPolicy: (policy: Policy) => void;
}

export default function PoliciesListPage({
  filter,
  userEmail,
  showOwnerDetails = true,
  onBack,
  onOpenPolicy,
}: PoliciesListPageProps) {
  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => fetchPolicies(),
  });

  const filtered = filterPoliciesByListFilter(policies, filter, userEmail).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button type="button" variant="outline" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{POLICY_LIST_FILTER_LABELS[filter]}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isLoading ? "Loading..." : `${filtered.length} polic${filtered.length === 1 ? "y" : "ies"}`}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-red-600" />
        </div>
      ) : (
        <PolicyListTable
          policies={filtered}
          onOpen={onOpenPolicy}
          showOwnerDetails={showOwnerDetails}
          emptyMessage={`No policies in "${POLICY_LIST_FILTER_LABELS[filter]}".`}
        />
      )}
    </div>
  );
}
