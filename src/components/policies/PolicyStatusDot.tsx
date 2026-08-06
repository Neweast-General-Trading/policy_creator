import {
  getPolicyStatusLabel,
  POLICY_STATUS_DOT_CLASS,
  POLICY_STATUS_DOT_RING,
} from "@/lib/policy-status";
import type { PolicyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PolicyStatusDotProps {
  status: PolicyStatus;
  size?: "sm" | "md";
  className?: string;
  showRing?: boolean;
}

export default function PolicyStatusDot({
  status,
  size = "sm",
  className,
  showRing = false,
}: PolicyStatusDotProps) {
  const label = getPolicyStatusLabel(status);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-block shrink-0 rounded-full",
        size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
        POLICY_STATUS_DOT_CLASS[status],
        showRing && `ring-2 ring-offset-1 ${POLICY_STATUS_DOT_RING[status]}`,
        className,
      )}
    />
  );
}
