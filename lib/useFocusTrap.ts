"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FOCUSABLE, trapTab } from "./focusTrap";

// While `active`: Tab stays inside `ref`, Esc calls onEscape, focus moves in
// on open, and goes back to where it was when it closes.
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, onEscape: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const before = document.activeElement as HTMLElement | null;

    const first = root.querySelector<HTMLElement>("[data-autofocus]") ?? root.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        escape.current();
        return;
      }
      if (root) trapTab(e, root);
    }
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (before && document.contains(before)) before.focus();
    };
  }, [active, ref]);
}
