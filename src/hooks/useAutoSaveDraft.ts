import { useEffect, useRef, useState } from "react";
import { clearWizardDraft, saveWizardDraft, type StoredWizardDraft } from "@/lib/draft-storage";

export function useAutoSaveDraft(
  data: StoredWizardDraft | null,
  enabled: boolean,
  delayMs = 800,
) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !data) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveWizardDraft({ ...data, savedAt: new Date().toISOString() });
      setLastSavedAt(new Date());
    }, delayMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [data, enabled, delayMs]);

  return {
    lastSavedAt,
    clearDraft: clearWizardDraft,
  };
}
