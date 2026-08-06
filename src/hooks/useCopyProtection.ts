import { useEffect } from "react";

export function useCopyProtection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const block = (event: Event) => {
      event.preventDefault();
      return false;
    };

    const blockKeyboard = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        ["c", "x", "a", "s", "p", "u"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
      }
    };

    const events: Array<keyof DocumentEventMap> = [
      "copy",
      "cut",
      "paste",
      "contextmenu",
      "selectstart",
      "dragstart",
    ];

    events.forEach((name) => document.addEventListener(name, block));
    document.addEventListener("keydown", blockKeyboard);

    return () => {
      events.forEach((name) => document.removeEventListener(name, block));
      document.removeEventListener("keydown", blockKeyboard);
    };
  }, [enabled]);
}
