import "server-only";
import { sql } from "drizzle-orm";
import { aiEmbed, aiEmbedBatch } from "@/lib/ai/gemini";
import { toPgVector } from "@/lib/ai/vector";
import { requireDb } from "@/lib/db";
import { embeddingText, keywordTerms, mergeSearch, type CatalogProduct, type Folder, type ProductInput } from "./shape";

// Every function takes the workspace id explicitly and only touches rows of
// that workspace. A folder id is only used after checking the folder is in
// the same workspace.

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : s(v));

function toProduct(r: Row): CatalogProduct {
  const attrs = r.attributes && typeof r.attributes === "object" && !Array.isArray(r.attributes) ? (r.attributes as Record<string, string>) : {};
  return {
    id: s(r.id),
    folderId: r.folder_id == null ? null : s(r.folder_id),
    name: s(r.name),
    description: s(r.description),
    price: s(r.price),
    category: s(r.category),
    attributes: attrs,
    embedded: r.embedded === true,
    createdAt: iso(r.created_at),
  };
}

const PRODUCT_COLS = sql`id, folder_id, name, description, price, category, attributes, (embedding IS NOT NULL) AS embedded, created_at`;

export async function listCatalog(workspaceId: string): Promise<{ folders: Folder[]; products: CatalogProduct[] }> {
  const db = requireDb();
  const [f, p] = await Promise.all([
    db.execute(sql`SELECT id, name, created_at FROM product_folders WHERE user_id = ${workspaceId}::uuid ORDER BY created_at ASC, id ASC`),
    db.execute(sql`SELECT ${PRODUCT_COLS} FROM products WHERE user_id = ${workspaceId}::uuid ORDER BY created_at ASC, id ASC`),
  ]);
  return {
    folders: (f.rows as Row[]).map((r) => ({ id: s(r.id), name: s(r.name), createdAt: iso(r.created_at) })),
    products: (p.rows as Row[]).map(toProduct),
  };
}

export async function folderExists(workspaceId: string, folderId: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`SELECT 1 FROM product_folders WHERE user_id = ${workspaceId}::uuid AND id = ${folderId}::uuid`);
  return r.rows.length === 1;
}

export async function insertFolder(workspaceId: string, name: string): Promise<Folder> {
  const db = requireDb();
  const r = await db.execute(sql`
    INSERT INTO product_folders (user_id, name) VALUES (${workspaceId}::uuid, ${name}) RETURNING id, name, created_at`);
  const row = r.rows[0] as Row;
  return { id: s(row.id), name: s(row.name), createdAt: iso(row.created_at) };
}

// The folder's products become Unfiled (ON DELETE SET NULL).
export async function deleteFolderRow(workspaceId: string, folderId: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`DELETE FROM product_folders WHERE user_id = ${workspaceId}::uuid AND id = ${folderId}::uuid RETURNING id`);
  return r.rows.length === 1;
}

// Saves products with their embeddings. A product whose embedding failed is
// still saved, with embedding = null (found by keyword).
export async function insertProducts(workspaceId: string, folderId: string | null, list: ProductInput[]): Promise<CatalogProduct[]> {
  if (!list.length) return [];
  const db = requireDb();
  const vectors = await aiEmbedBatch(list.map(embeddingText), "RETRIEVAL_DOCUMENT");
  const values = list.map(
    (p, i) => sql`(${workspaceId}::uuid, ${folderId}::uuid, ${p.name}, ${p.description}, ${p.price}, ${p.category},
                   ${JSON.stringify(p.attributes)}::jsonb, ${vectors[i] ? toPgVector(vectors[i]!) : null}::vector)`,
  );
  const r = await db.execute(sql`
    INSERT INTO products (user_id, folder_id, name, description, price, category, attributes, embedding)
    VALUES ${sql.join(values, sql`, `)}
    RETURNING ${PRODUCT_COLS}`);
  return (r.rows as Row[]).map(toProduct);
}

export async function moveProductRow(workspaceId: string, productId: string, folderId: string | null): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE products SET folder_id = ${folderId}::uuid
    WHERE user_id = ${workspaceId}::uuid AND id = ${productId}::uuid
    RETURNING id`);
  return r.rows.length === 1;
}

export async function deleteProductRow(workspaceId: string, productId: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`DELETE FROM products WHERE user_id = ${workspaceId}::uuid AND id = ${productId}::uuid RETURNING id`);
  return r.rows.length === 1;
}

export type ProductHit = CatalogProduct & { score: number | null };

// The k products closest in meaning to `query` (cosine over embeddings),
// merged with keyword matches (ILIKE). Products with no embedding, or every
// product when there is no AI key, are found by keyword only (01-prd.md §7.6).
export async function searchProducts(workspaceId: string, query: string, k = 8): Promise<ProductHit[]> {
  const db = requireDb();
  const vec = query.trim() ? await aiEmbed(query, "RETRIEVAL_QUERY") : null;
  let byMeaning: ProductHit[] = [];
  if (vec) {
    const r = await db.execute(sql`
      SELECT ${PRODUCT_COLS}, 1 - (embedding <=> ${toPgVector(vec)}::vector) AS score
      FROM products
      WHERE user_id = ${workspaceId}::uuid AND embedding IS NOT NULL
      ORDER BY embedding <=> ${toPgVector(vec)}::vector
      LIMIT ${k}`);
    byMeaning = (r.rows as Row[]).map((row) => ({ ...toProduct(row), score: Number(row.score) }));
  }
  const terms = keywordTerms(query);
  let byKeyword: ProductHit[] = [];
  if (terms.length) {
    const conds = terms.map((t) => {
      const like = `%${t.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      return sql`(name ILIKE ${like} OR category ILIKE ${like} OR description ILIKE ${like} OR attributes::text ILIKE ${like})`;
    });
    // Products that match more of the words come first.
    const hits = sql.join(
      conds.map((c) => sql`(CASE WHEN ${c} THEN 1 ELSE 0 END)`),
      sql` + `,
    );
    const r = await db.execute(sql`
      SELECT * FROM (
        SELECT ${PRODUCT_COLS}, (${hits}) AS hits FROM products
        WHERE user_id = ${workspaceId}::uuid AND (${vec ? sql`embedding IS NULL` : sql`true`})
      ) x
      WHERE hits > 0
      ORDER BY hits DESC, created_at ASC
      LIMIT ${k}`);
    byKeyword = (r.rows as Row[]).map((row) => ({ ...toProduct(row), score: null }));
  }
  return mergeSearch(byMeaning, byKeyword, k);
}

// Fills in missing embeddings (for example after the AI key is added).
// Returns how many products got one.
export async function reembedProducts(workspaceId: string, limit = 200): Promise<number> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT id, name, description, category, attributes FROM products
    WHERE user_id = ${workspaceId}::uuid AND embedding IS NULL
    ORDER BY created_at ASC LIMIT ${limit}`);
  const rows = r.rows as Row[];
  if (!rows.length) return 0;
  const vectors = await aiEmbedBatch(
    rows.map((row) => embeddingText({ name: s(row.name), category: s(row.category), description: s(row.description), attributes: (row.attributes ?? {}) as Record<string, string> })),
    "RETRIEVAL_DOCUMENT",
  );
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    const v = vectors[i];
    if (!v) continue;
    await db.execute(sql`
      UPDATE products SET embedding = ${toPgVector(v)}::vector
      WHERE user_id = ${workspaceId}::uuid AND id = ${s(rows[i].id)}::uuid AND embedding IS NULL`);
    n++;
  }
  return n;
}
