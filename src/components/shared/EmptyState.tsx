import { FileText, ShieldUser } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onCreateNew: () => void;
}

export default function EmptyState({ onCreateNew }: EmptyStateProps) {
  return (
    <div className="app-surface mx-auto flex w-full max-w-3xl flex-col items-center rounded-lg px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-red-50 p-4">
        <ShieldUser className="h-10 w-10 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Policy Document Editor</h2>
      <p className="mt-2 max-w-lg text-sm text-slate-500">
        Create structured policy documents with section titles and rich HTML content.
        Save, preview in browser, or download as a protected PDF.
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <FileText className="h-4 w-4" />
        Policies → Department → Policy files
      </div>
      <Button className="mt-8" onClick={onCreateNew}>
        Create New Policy
      </Button>
    </div>
  );
}
