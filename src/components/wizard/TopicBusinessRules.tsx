import { Plus, Trash2 } from "lucide-react";
import ApplicationMultiSelect from "@/components/shared/ApplicationMultiSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PolicyApplicationLink } from "@/lib/types";

interface TopicBusinessRulesProps {
  rules: string[];
  onChange: (rules: string[]) => void;
  applyTo?: PolicyApplicationLink[];
  onApplyToChange?: (applications: PolicyApplicationLink[]) => void;
}

export default function TopicBusinessRules({
  rules,
  onChange,
  applyTo = [],
  onApplyToChange,
}: TopicBusinessRulesProps) {
  const items = rules.length > 0 ? rules : [""];

  const updateRule = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const addRule = () => {
    onChange([...items, ""]);
  };

  const removeRule = (index: number) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(next.length > 0 ? next : [""]);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <div>
        <Label>Business Rules</Label>
        <p className="mt-1 text-xs text-slate-500">
          Free Text: Type in the specific rule for the related policy. Recommended to have
          separate rules for each event.
        </p>
      </div>
      <ol className="space-y-2">
        {items.map((rule, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-2 w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-red-600">
              {index + 1}.
            </span>
            <textarea
              rows={2}
              value={rule}
              onChange={(event) => updateRule(index, event.target.value)}
              placeholder="type in unambiguous rule which should be adapted"
              className="min-h-[44px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            <button
              type="button"
              onClick={() => removeRule(index)}
              className="mt-1 rounded-md p-2 text-slate-400 hover:bg-white hover:text-red-600"
              aria-label={`Remove business rule ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" onClick={addRule}>
        <Plus className="h-4 w-4" />
        Add Business Rule
      </Button>
      <ApplicationMultiSelect
        value={applyTo}
        onChange={(applications) => onApplyToChange?.(applications)}
        label="Apply to"
        hint="Select one or more applications from BPM Application Master."
      />
    </div>
  );
}
