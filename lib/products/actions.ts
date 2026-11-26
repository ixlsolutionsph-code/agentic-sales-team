"use server";

// Thin server actions for the catalog: read the session, check the input,
// then call ./store.ts with the active workspace id.
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { cleanField } from "@/lib/ai/untrusted";
import {
  PRODUCT_LIMITS,
  UUID_RE,
  cleanProduct,
  productsFromCSV,
  type CatalogProduct,
  type Folder,
} from "./shape";
import {
  deleteFolderRow,
  deleteProductRow,
  folderExists,
  insertFolder,
  insertProducts,
  listCatalog,
  moveProductRow,
  reembedProducts,
} from "./store";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const TRY_AGAIN = "Something went wrong. Please try again.";
const GONE = "That product or folder was deleted. Reload the page.";
const CSV_MAX_CHARS = 1_000_000;

async function workspace(): Promise<string | null> {
  const s = await getSession();
  return s?.userId ?? null;
}

// null = Unfiled. A folder id must be a folder of this workspace.
async function checkFolder(ws: string, folderId: unknown): Promise<string | null | false> {
  if (folderId === null || folderId === undefined || folderId === "") return null;
  if (typeof folderId !== "string" || !UUID_RE.test(folderId)) return false;
  return (await folderExists(ws, folderId)) ? folderId : false;
}

export async function loadCatalog(): Promise<ActionResult<{ folders: Folder[]; products: CatalogProduct[] }>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  try {
    return { ok: true, data: await listCatalog(ws) };
  } catch (e) {
    console.error("loadCatalog failed", e);
    return fail(MSG.serverDown);
  }
}

export async function addFolder(name: string): Promise<ActionResult<Folder>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  const clean = cleanField(name, PRODUCT_LIMITS.folder);
  if (!clean) return fail("A folder name is required.");
  try {
    return { ok: true, data: await insertFolder(ws, clean) };
  } catch (e) {
    console.error("addFolder failed", e);
    return fail(MSG.serverDown);
  }
}

export async function removeFolder(folderId: string): Promise<ActionResult> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (typeof folderId !== "string" || !UUID_RE.test(folderId)) return fail(TRY_AGAIN);
  try {
    return (await deleteFolderRow(ws, folderId)) ? { ok: true } : fail(GONE);
  } catch (e) {
    console.error("removeFolder failed", e);
    return fail(MSG.serverDown);
  }
}

export async function addProduct(input: unknown, folderId: string | null): Promise<ActionResult<CatalogProduct>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  const p = cleanProduct(input);
  if (typeof p === "string") return fail(p);
  try {
    const folder = await checkFolder(ws, folderId);
    if (folder === false) return fail(GONE);
    const [row] = await insertProducts(ws, folder, [p]);
    return row ? { ok: true, data: row } : fail(TRY_AGAIN);
  } catch (e) {
    console.error("addProduct failed", e);
    return fail(MSG.serverDown);
  }
}

// Imports a product CSV (up to 200 rows) into a folder, or Unfiled.
export async function importProducts(
  csv: string,
  folderId: string | null,
): Promise<ActionResult<{ products: CatalogProduct[]; skipped: number }>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (typeof csv !== "string" || csv.length > CSV_MAX_CHARS) return fail("That file is too large.");
  const parsed = productsFromCSV(csv);
  if (typeof parsed === "string") return fail(parsed);
  try {
    const folder = await checkFolder(ws, folderId);
    if (folder === false) return fail(GONE);
    const products = await insertProducts(ws, folder, parsed.products);
    return { ok: true, data: { products, skipped: parsed.skipped } };
  } catch (e) {
    console.error("importProducts failed", e);
    return fail(MSG.serverDown);
  }
}

export async function moveProduct(productId: string, folderId: string | null): Promise<ActionResult> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (typeof productId !== "string" || !UUID_RE.test(productId)) return fail(TRY_AGAIN);
  try {
    const folder = await checkFolder(ws, folderId);
    if (folder === false) return fail(GONE);
    return (await moveProductRow(ws, productId, folder)) ? { ok: true } : fail(GONE);
  } catch (e) {
    console.error("moveProduct failed", e);
    return fail(MSG.serverDown);
  }
}

export async function removeProduct(productId: string): Promise<ActionResult> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (typeof productId !== "string" || !UUID_RE.test(productId)) return fail(TRY_AGAIN);
  try {
    return (await deleteProductRow(ws, productId)) ? { ok: true } : fail(GONE);
  } catch (e) {
    console.error("removeProduct failed", e);
    return fail(MSG.serverDown);
  }
}

// Gives products saved without an embedding one now (for example after the
// AI key was added). Quiet: returns how many were filled, 0 on any failure.
export async function fillMissingEmbeddings(): Promise<number> {
  try {
    const ws = await workspace();
    return ws ? await reembedProducts(ws) : 0;
  } catch (e) {
    console.error("fillMissingEmbeddings failed", e);
    return 0;
  }
}
