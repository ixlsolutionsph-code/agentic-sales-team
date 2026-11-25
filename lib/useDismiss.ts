"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// Closes a menu on a click outside `ref` or on Esc. Esc returns focus to the
// menu's own button (the first button inside `ref`).
export function useDismiss(ref: RefObject<HTMLElement>, open: boolean, close: () => void) {
  const onClose = useRef(close);
  onClose.current = close;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose.current();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose.current();
      ref.current?.querySelector<HTMLElement>("button")?.focus();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref]);
}

// True while the media query matches. False on the server and first render.
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return match;
}
