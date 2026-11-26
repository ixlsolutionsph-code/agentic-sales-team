"use client";

import { useEffect } from "react";
import { loadNavCounts } from "@/lib/leads/actions";
import { NAV_COUNTS_EVENT } from "@/lib/navCountsEvent";
import { useApp } from "@/lib/store";

const EVERY_MS = 30_000;

// Keeps the sidebar's Leads (pending review) and Emails (unsent drafts)
// badges fresh: every 30 s, on window focus and on every page change
// (02-sitemap.md §5).
export function useNavCounts(pathname: string): void {
  const { setNavCounts } = useApp();
  useEffect(() => {
    let alive = true;
    const load = () => {
      loadNavCounts()
        .then((c) => {
          if (alive) setNavCounts(c);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, EVERY_MS);
    window.addEventListener("focus", load);
    window.addEventListener(NAV_COUNTS_EVENT, load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener(NAV_COUNTS_EVENT, load);
    };
  }, [pathname, setNavCounts]);
}
