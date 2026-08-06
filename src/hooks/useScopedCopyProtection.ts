import { useEffect, type RefObject } from "react";

export function useScopedCopyProtection(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const element = containerRef.current;
    if (!enabled || !element) return;

    const block = (event: Event) => {
      event.preventDefault();
      return false;
    };

    const blockKeyboard = (event: KeyboardEvent) => {
      if (!element.contains(document.activeElement) && !element.contains(event.target as Node)) {
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        ["c", "x", "a", "s", "p", "u"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
      }
    };

    const events: Array<keyof HTMLElementEventMap> = [
      "copy",
      "cut",
      "paste",
      "contextmenu",
      "selectstart",
      "dragstart",
    ];

    events.forEach((name) => element.addEventListener(name, block));
    document.addEventListener("keydown", blockKeyboard);

    return () => {
      events.forEach((name) => element.removeEventListener(name, block));
      document.removeEventListener("keydown", blockKeyboard);
    };
  }, [containerRef, enabled]);
}
