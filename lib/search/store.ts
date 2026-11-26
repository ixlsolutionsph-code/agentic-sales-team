import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";

// Global search, the server part: leads and products of one workspace whose
// text contains the query (ILIKE), 5 of each.

export const SERVER_SEARCH_LIMIT = 5;

export type LeadHit = { id: string; name: string; company: string; title: string };
export type ProductHit = { id: string; name: string; category: string; price: string };

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function searchServerRows(workspaceId: string, q: string): Promise<{ leads: LeadHit[]; products: ProductHit[] }> {
  const db = requireDb();
  const like = likePattern(q);
  const [l, p] = await Promise.all([
    db.execute(sql`
      SELECT id, name, company, title FROM leads
      WHERE user_id = ${workspaceId}::uuid AND review <> 'dismissed'
        AND (name ILIKE ${like} OR company ILIKE ${like} OR email ILIKE ${like} OR title ILIKE ${like})
      ORDER BY created_at DESC LIMIT ${SERVER_SEARCH_LIMIT}`),
    db.execute(sql`
      SELECT id, name, category, price FROM products
      WHERE user_id = ${workspaceId}::uuid
        AND (name ILIKE ${like} OR category ILIKE ${like} OR description ILIKE ${like})
      ORDER BY created_at DESC LIMIT ${SERVER_SEARCH_LIMIT}`),
  ]);
  const str = (v: unknown) => (v == null ? "" : String(v));
  return {
    leads: (l.rows as Record<string, unknown>[]).map((r) => ({ id: str(r.id), name: str(r.name), company: str(r.company), title: str(r.title) })),
    products: (p.rows as Record<string, unknown>[]).map((r) => ({ id: str(r.id), name: str(r.name), category: str(r.category), price: str(r.price) })),
  };
}
