import { Check } from "lucide-react";
import type { WizardStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  steps: { id: WizardStep; label: string }[];
  currentStep: WizardStep;
  topicProgress?: { completed: number; total: number };
}

export default function WizardProgress({
  steps,
  currentStep,
  topicProgress,
}: WizardProgressProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const progressPercent = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="mb-8 space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-red-600 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((item, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                isCurrent && "border-red-200 bg-red-50 text-red-700",
                isDone && "border-emerald-200 bg-emerald-50 text-emerald-800",
                !isCurrent && !isDone && "border-slate-200 bg-white text-slate-500",
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {isDone ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs">
                    {index + 1}
                  </span>
                )}
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {topicProgress && currentStep === "content" && topicProgress.total > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Topics completed:{" "}
          <span className="font-semibold text-red-700">
            {topicProgress.completed}/{topicProgress.total}
          </span>
        </div>
      )}
    </div>
  );
}
