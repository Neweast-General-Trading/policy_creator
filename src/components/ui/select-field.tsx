import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function SelectField({ label, className, children, ...props }: SelectFieldProps) {
  return (
    <div className="space-y-2">
      {label ? <label className="text-sm font-medium text-slate-700">{label}</label> : null}
      <select
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-red-300 focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
