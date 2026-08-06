import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileClock,
  FilePenLine,
  Inbox,
  Layers3,
  RotateCcw,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardSummary, fetchPolicies } from "@/lib/api";
import PolicyListTable from "@/components/policies/PolicyListTable";
import type { PolicyListFilter } from "@/lib/policy-list-filters";
import PolicyStatusDot from "@/components/policies/PolicyStatusDot";
import type { Policy } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface DashboardPageProps {
  onCreateNew: () => void;
  onOpenPolicy: (policy: Policy) => void;
  onBrowsePolicies: (filter: PolicyListFilter) => void;
}

function StatCard({
  label,
  value,
  icon,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "min-w-[132px] shrink-0 rounded-xl border bg-white px-3.5 py-3 text-left shadow-sm transition",
        onClick && "cursor-pointer hover:border-red-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200",
        active ? "border-red-300 ring-2 ring-red-100" : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn("rounded-lg p-2", tone)}>{icon}</div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums leading-none text-slate-900">{value}</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] font-semibold leading-snug text-slate-700">{label}</div>
    </Component>
  );
}

function PolicyRow({
  policy,
  onOpen,
  highlight,
  compact,
}: {
  policy: Policy;
  onOpen: () => void;
  highlight?: "amber" | "blue";
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex shrink-0 items-start gap-2.5 rounded-xl border text-left transition",
        compact ? "w-[280px] px-3 py-2.5" : "w-full gap-3 px-4 py-3",
        highlight === "amber"
          ? "border-amber-200 bg-amber-50/40 hover:border-amber-300 hover:bg-amber-50"
          : highlight === "blue"
            ? "border-blue-200 bg-blue-50/30 hover:border-blue-300 hover:bg-blue-50/60"
            : "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30",
      )}
    >
      <div className="mt-1.5 flex shrink-0 flex-col items-center gap-1">
        <PolicyStatusDot status={policy.status} size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className={cn("font-semibold text-slate-900", compact ? "text-xs leading-tight" : "text-sm")}>
            {policy.name}
            <span className="ms-1 font-medium text-slate-500">v{policy.version}</span>
          </span>
        </div>
        <div
          className={cn(
            "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-600",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          <span className="inline-flex items-center gap-0.5">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{policy.companyName}</span>
          </span>
          <span className="truncate">{policy.departmentName}</span>
          {!compact && (
            <span className="inline-flex items-center gap-0.5">
              <UserRound className="h-3 w-3 shrink-0" />
              {policy.createdByName}
            </span>
          )}
        </div>
        <div className={cn("mt-1 text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
          Updated {formatDate(policy.updatedAt)}
        </div>
      </div>
    </button>
  );
}

function PipelineBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="tabular-nums font-medium text-slate-500">
          {value} ({percent}%)
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function HorizontalScrollRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function DashboardPage({ onCreateNew, onOpenPolicy, onBrowsePolicies }: DashboardPageProps) {
  const { user } = useAuth();
  const userEmail = user?.email?.toLowerCase() ?? "";

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => fetchPolicies(),
  });

  const pending = policies.filter((policy) =>
    policy.currentApprovers.some(
      (step) => step.assigneeEmail.toLowerCase() === userEmail,
    ),
  );

  const myPolicies = policies.filter(
    (policy) => policy.createdByEmail.toLowerCase() === userEmail,
  );

  const recent = [...policies]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  const inWorkflow = policies.filter(
    (policy) =>
      policy.status === "in_approval" ||
      policy.status === "returned" ||
      policy.status === "approved",
  );

  const total = summary?.totalVisible ?? policies.length;
  const isGlobalViewer = summary?.viewerScope?.isGlobalViewer ?? false;

  const sortedPolicies = [...policies].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-red-50/60 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-red-600">Welcome back</p>
          <h2 className="mt-0.5 text-2xl font-bold text-slate-900">
            {user?.name?.split(" ")[0] || "Dashboard"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Track policies, approvals, and publishing.
          </p>
        </div>
        <Button className="shrink-0" onClick={onCreateNew}>
          Create New Policy
        </Button>
      </div>

      <HorizontalScrollRow>
        <StatCard
          label="Total Visible"
          value={summary?.totalVisible ?? (summaryLoading ? 0 : policies.length)}
          icon={<Layers3 className="h-4 w-4" />}
          tone="bg-slate-100 text-slate-600"
          onClick={() => onBrowsePolicies("all")}
        />
        <StatCard
          label="My Policies"
          value={summary?.myPolicies ?? 0}
          icon={<FilePenLine className="h-4 w-4" />}
          tone="bg-blue-100 text-blue-700"
          onClick={() => onBrowsePolicies("mine")}
        />
        <StatCard
          label="Pending My Approval"
          value={summary?.pendingMyApproval ?? 0}
          icon={<Inbox className="h-4 w-4" />}
          tone="bg-amber-100 text-amber-700"
          onClick={() => onBrowsePolicies("pending")}
        />
        <StatCard
          label="In Approval"
          value={summary?.inApproval ?? 0}
          icon={<FileClock className="h-4 w-4" />}
          tone="bg-violet-100 text-violet-700"
          onClick={() => onBrowsePolicies("in_approval")}
        />
        <StatCard
          label="Drafts"
          value={summary?.draft ?? 0}
          icon={<FilePenLine className="h-4 w-4" />}
          tone="bg-slate-100 text-slate-600"
          onClick={() => onBrowsePolicies("draft")}
        />
        <StatCard
          label="Approved"
          value={summary?.approved ?? 0}
          icon={<FileCheck2 className="h-4 w-4" />}
          tone="bg-emerald-100 text-emerald-700"
          onClick={() => onBrowsePolicies("approved")}
        />
        <StatCard
          label="Published"
          value={summary?.published ?? 0}
          icon={<Send className="h-4 w-4" />}
          tone="bg-sky-100 text-sky-700"
          onClick={() => onBrowsePolicies("published")}
        />
        <StatCard
          label="Returned"
          value={summary?.returned ?? 0}
          icon={<RotateCcw className="h-4 w-4" />}
          tone="bg-red-100 text-red-700"
          onClick={() => onBrowsePolicies("returned")}
        />
      </HorizontalScrollRow>

      {isGlobalViewer && (
        <section className="app-surface rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">All Organization Policies</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                HR / Audit / IT view — creator, department, company, status, and current approver.
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onBrowsePolicies("all")}>
              View full list
            </Button>
          </div>
          <PolicyListTable
            policies={sortedPolicies.slice(0, 12)}
            onOpen={onOpenPolicy}
            showOwnerDetails
            emptyMessage="No policies found."
          />
        </section>
      )}

      <section className="app-surface rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Workflow Pipeline</h3>
          <span className="text-[11px] font-medium text-slate-500">{total} policies</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <PipelineBar label="Draft" value={summary?.draft ?? 0} total={total} color="bg-slate-400" />
          <PipelineBar
            label="In Approval"
            value={summary?.inApproval ?? 0}
            total={total}
            color="bg-violet-500"
          />
          <PipelineBar
            label="Returned"
            value={summary?.returned ?? 0}
            total={total}
            color="bg-amber-500"
          />
          <PipelineBar
            label="Approved"
            value={summary?.approved ?? 0}
            total={total}
            color="bg-emerald-500"
          />
          <PipelineBar
            label="Published"
            value={summary?.published ?? 0}
            total={total}
            color="bg-sky-500"
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="app-surface rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <FilePenLine className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">My Policies</h3>
            <span className="text-[11px] font-medium text-slate-400">({myPolicies.length})</span>
          </div>
          {myPolicies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
              <p className="text-xs text-slate-500">No policies created yet.</p>
              <Button variant="outline" size="sm" className="mt-2 h-8 text-xs" onClick={onCreateNew}>
                Create policy
              </Button>
            </div>
          ) : (
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {myPolicies.slice(0, 8).map((policy) => (
                <PolicyRow
                  key={policy.id}
                  policy={policy}
                  onOpen={() => onOpenPolicy(policy)}
                  highlight="blue"
                />
              ))}
            </div>
          )}
        </section>

        <section className="app-surface rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">In Workflow</h3>
              <span className="text-[11px] font-medium text-slate-400">({inWorkflow.length})</span>
            </div>
          </div>
          {inWorkflow.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing in approval workflow.</p>
          ) : (
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {inWorkflow.slice(0, 8).map((policy) => (
                <PolicyRow key={policy.id} policy={policy} onOpen={() => onOpenPolicy(policy)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="app-surface rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent Policies</h3>
          <span className="text-[11px] font-medium text-slate-400">{recent.length} latest</span>
        </div>
        {policiesLoading ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
            <XCircle className="mx-auto mb-2 h-7 w-7 text-slate-300" />
            <p className="text-xs text-slate-500">No policies in your scope.</p>
          </div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {recent.map((policy) => (
              <PolicyRow key={policy.id} policy={policy} onOpen={() => onOpenPolicy(policy)} />
            ))}
          </div>
        )}
      </section>

      <section className="app-surface rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Inbox className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-900">Needs My Action</h3>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {pending.length}
            </span>
          )}
        </div>
        {policiesLoading ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : pending.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <p className="text-xs font-medium text-slate-600">All caught up — nothing pending your approval.</p>
          </div>
        ) : (
          <HorizontalScrollRow className="pt-0.5">
            {pending.map((policy) => (
              <PolicyRow
                key={policy.id}
                policy={policy}
                compact
                highlight="amber"
                onOpen={() => onOpenPolicy(policy)}
              />
            ))}
          </HorizontalScrollRow>
        )}
      </section>
    </div>
  );
}
