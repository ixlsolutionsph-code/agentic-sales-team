"use client";

import { useEffect, useState } from "react";
import { loadStats } from "@/lib/workspace/actions";
import { EMPTY_WORKSPACE_STATS, type WorkspaceStats } from "@/lib/workspace/statsShape";

// The dashboard and team-page numbers. Loaded when the page opens and when
// the window gets focus again. Until they arrive, or if loading fails, every
// number is 0.
export function useWorkspaceStats(): WorkspaceStats {
  const [stats, setStats] = useState<WorkspaceStats>(EMPTY_WORKSPACE_STATS);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const s = await loadStats(monthStart.toISOString());
        if (alive) setStats(s);
      } catch {
        // Keep the numbers we have (0 on first load).
      }
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  return stats;
}
