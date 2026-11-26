"use server";

import { getSession } from "@/lib/auth/session";
import { cleanField } from "@/lib/ai/untrusted";
import { MIN_SERVER_CHARS } from "./local";
import { searchServerRows, type LeadHit, type ProductHit } from "./store";

// Leads and products for the sidebar search. Never throws: no results on
// any failure, or for a query under 2 characters.
export async function searchServer(q: string): Promise<{ leads: LeadHit[]; products: ProductHit[] }> {
  const none = { leads: [], products: [] };
  try {
    const query = cleanField(q, 100);
    if (query.length < MIN_SERVER_CHARS) return none;
    const s = await getSession();
    return s ? await searchServerRows(s.userId, query) : none;
  } catch (e) {
    console.error("searchServer failed", e);
    return none;
  }
}
