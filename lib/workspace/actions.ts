"use server";

import { getSession } from "@/lib/auth/session";
import { EMPTY_WORKSPACE, type WorkspaceData } from "@/lib/types";
import { loadWorkspaceData } from "./load";

// The active workspace's data for the client store. Never throws: on any
// failure the app still opens, with empty lists.
export async function loadWorkspace(): Promise<WorkspaceData> {
  try {
    const s = await getSession();
    if (!s) return EMPTY_WORKSPACE;
    return await loadWorkspaceData(s.userId);
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE") throw e;
    console.error("loadWorkspace failed", e);
    return EMPTY_WORKSPACE;
  }
}
