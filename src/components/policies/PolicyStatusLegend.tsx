import PolicyStatusDot from "@/components/policies/PolicyStatusDot";
import { POLICY_STATUS_ORDER, getPolicyStatusLabel } from "@/lib/policy-status";

interface PolicyStatusLegendProps {
  className?: string;
  title?: string;
}

export default function PolicyStatusLegend({
  className,
  title = "Policy status",
}: PolicyStatusLegendProps) {
  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {POLICY_STATUS_ORDER.map((status) => (
          <div key={status} className="flex min-w-0 items-center gap-2">
            <PolicyStatusDot status={status} size="md" />
            <span className="truncate text-[11px] font-medium text-slate-600">
              {getPolicyStatusLabel(status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
