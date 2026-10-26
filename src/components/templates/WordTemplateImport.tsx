import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseWordTemplateApi } from "@/lib/api";
import type { PolicySection } from "@/lib/types";
import { generateId } from "@/lib/utils";

interface WordTemplateImportProps {
  onParsed: (sections: PolicySection[], fileName: string) => void;
}

async function readFileAsBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

export default function WordTemplateImport({ onParsed }: WordTemplateImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Please upload a .docx Word file");
      return;
    }

    setIsParsing(true);
    try {
      const dataBase64 = await readFileAsBase64(file);
      const parsed = await parseWordTemplateApi(file.name, dataBase64);
      if (parsed.sections.length === 0) {
        toast.error("No sections found in the Word document");
        return;
      }

      onParsed(
        parsed.sections.map((section) => ({
          id: generateId(),
          title: section.title,
          content: section.content || "<p></p>",
          businessRules: [""],
        })),
        file.name,
      );

      if (parsed.warnings.length > 0) {
        toast.warning(`Imported with ${parsed.warnings.length} formatting note(s)`);
      } else {
        toast.success(`Imported ${parsed.sections.length} sections from Word`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse Word file");
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <FileUp className="h-4 w-4 text-blue-600" />
            Import from Word
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Upload a .docx file. Headings become section titles and content is preserved.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isParsing}
            onClick={() => inputRef.current?.click()}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" />
                Upload Word Template
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
