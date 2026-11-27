"use server";

import { UUID_RE } from "@/lib/auth/rules";
import { getSession } from "@/lib/auth/session";
import { dismissNotices, listNotices, type Notice } from "./store";

export async function loadNotices(): Promise<Notice[]> {
  try {
    const s = await getSession();
    return s ? await listNotices(s.userId) : [];
  } catch (e) {
    console.error("loadNotices failed", e);
    return [];
  }
}

// Dismisses one notice, or every notice when id is null (Clear all).
export async function dismissNotice(id: string | null): Promise<boolean> {
  try {
    const s = await getSession();
    if (!s || (id !== null && (typeof id !== "string" || !UUID_RE.test(id)))) return false;
    await dismissNotices(s.userId, id);
    return true;
  } catch (e) {
    console.error("dismissNotice failed", e);
    return false;
  }
}
