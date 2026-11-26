"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";
import ConfirmButton from "@/components/ConfirmButton";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { Btn } from "@/components/primitives";
import { callAction } from "@/lib/auth/call-action";
import {
  addFolder,
  addProduct,
  fillMissingEmbeddings,
  importProducts,
  loadCatalog,
  moveProduct,
  removeFolder,
  removeProduct,
} from "@/lib/products/actions";
import { PRODUCT_CSV_MAX, PRODUCT_LIMITS, type CatalogProduct, type Folder } from "@/lib/products/shape";
import { useApp } from "@/lib/store";

const UNFILED = "unfiled";
type View = "all" | typeof UNFILED | string; // a folder id

// /products (02-sitemap.md §6): folder tiles and Unfiled; inside a folder, the
// product table with Move… and Delete.
export default function ProductsClient() {
  const { showToast } = useApp();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<View>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await callAction(() => loadCatalog());
    if (res.ok && res.data) {
      setFolders(res.data.folders);
      setProducts(res.data.products);
      setState("ready");
      return res.data;
    }
    setState("error");
    return null;
  }, []);

  useEffect(() => {
    let alive = true;
    load().then(async (data) => {
      // Products saved before the AI key was added get their meaning search now.
      if (alive && data && data.products.some((p) => !p.embedded)) {
        const n = await fillMissingEmbeddings().catch(() => 0);
        if (alive && n > 0) load();
      }
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const folder = folders.find((f) => f.id === view);
  // A deleted folder (or one from another tab) sends you back to the tiles.
  useEffect(() => {
    if (view !== "all" && view !== UNFILED && state === "ready" && !folder) setView("all");
  }, [view, folder, state]);

  const inView = view === UNFILED ? products.filter((p) => p.folderId === null) : products.filter((p) => p.folderId === view);
  const targetFolder = view === "all" || view === UNFILED ? null : view;

  async function onDeleteFolder(f: Folder) {
    const res = await callAction(() => removeFolder(f.id));
    if (!res.ok) return showToast(res.error, true);
    setFolders((cur) => cur.filter((x) => x.id !== f.id));
    setProducts((cur) => cur.map((p) => (p.folderId === f.id ? { ...p, folderId: null } : p)));
    setView("all");
    showToast(`Folder ${f.name} deleted. Its products are now Unfiled.`);
  }

  async function onMove(p: CatalogProduct, to: string) {
    const folderId = to === UNFILED ? null : to;
    const prev = p.folderId;
    setProducts((cur) => cur.map((x) => (x.id === p.id ? { ...x, folderId } : x)));
    const res = await callAction(() => moveProduct(p.id, folderId));
    if (!res.ok) {
      setProducts((cur) => cur.map((x) => (x.id === p.id ? { ...x, folderId: prev } : x)));
      showToast(res.error, true);
      return;
    }
    showToast(`${p.name} moved to ${folderId ? folders.find((f) => f.id === folderId)?.name ?? "folder" : "Unfiled"}`);
  }

  async function onDelete(p: CatalogProduct) {
    const before = products;
    setProducts((cur) => cur.filter((x) => x.id !== p.id));
    const res = await callAction(() => removeProduct(p.id));
    if (!res.ok) {
      setProducts(before);
      showToast(res.error, true);
    }
  }

  if (state === "loading") {
    return (
      <div className="page">
        <p className="sub-empty-text">Loading products…</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="page">
        <EmptyState
          icon="alert"
          title="Couldn't load your products"
          text="Check your connection and try again."
          action={
            <Btn onClick={() => { setState("loading"); load(); }}>
              Try again
            </Btn>
          }
        />
      </div>
    );
  }

  const actions = (
    <div className="agent-head-actions">
      {view === "all" ? <NewFolder onCreated={(f) => setFolders((cur) => [...cur, f])} /> : null}
      <Btn size="sm" onClick={() => setImportOpen(true)}>
        Import CSV
      </Btn>
      <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}>
        + Add product
      </Btn>
    </div>
  );

  return (
    <div className="page prod-page">
      {view === "all" ? (
        <>
          <div className="prod-bar">{actions}</div>
          {!products.length && !folders.length ? (
            <EmptyState icon="products" title="No products yet" text="Add what you sell by hand, or import a spreadsheet saved as CSV." />
          ) : (
            <ul className="folder-grid">
              {folders.map((f) => (
                <li key={f.id}>
                  <FolderTile name={f.name} count={products.filter((p) => p.folderId === f.id).length} onOpen={() => setView(f.id)} />
                </li>
              ))}
              <li>
                <FolderTile name="Unfiled" count={products.filter((p) => p.folderId === null).length} onOpen={() => setView(UNFILED)} muted />
              </li>
            </ul>
          )}
        </>
      ) : (
        <>
          <button type="button" className="auth-link back-link link-btn" onClick={() => setView("all")}>
            ← All products
          </button>
          <div className="prod-head">
            <h2 className="agent-head-name">{folder ? folder.name : "Unfiled"}</h2>
            <div className="agent-head-actions">
              {folder ? (
                <ConfirmButton label="Delete folder" armedLabel="Delete folder?" onConfirm={() => onDeleteFolder(folder)} />
              ) : null}
              <Btn size="sm" onClick={() => setImportOpen(true)}>
                Import CSV
              </Btn>
              <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}>
                + Add product
              </Btn>
            </div>
          </div>
          {inView.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">
                      <span className="sr-only">Move</span>
                    </th>
                    <th scope="col">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inView.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-main">{p.name}</div>
                        {p.description ? <div className="cell-sub">{p.description}</div> : null}
                        {Object.keys(p.attributes).length ? (
                          <div className="cell-attrs">
                            {Object.entries(p.attributes).map(([k, v]) => (
                              <span key={k} className="attr-chip">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td>{p.category || <span className="cell-none">-</span>}</td>
                      <td className="cell-nowrap">{p.price || <span className="cell-none">-</span>}</td>
                      <td>
                        <select
                          className="lp-input select-sm"
                          aria-label={`Move ${p.name}`}
                          value=""
                          onChange={(e) => e.target.value && onMove(p, e.target.value)}
                        >
                          <option value="">Move…</option>
                          {folders
                            .filter((f) => f.id !== p.folderId)
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          {p.folderId !== null ? <option value={UNFILED}>Unfiled</option> : null}
                        </select>
                      </td>
                      <td className="cell-end">
                        <ConfirmButton label="Delete" armedLabel="Delete?" ariaLabel={`Delete ${p.name}`} onConfirm={() => onDelete(p)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sub-empty">
              <span className="sub-empty-text">No products in {folder ? "this folder" : "Unfiled"} yet.</span>
            </p>
          )}
        </>
      )}

      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        folders={folders}
        defaultFolder={targetFolder}
        onAdded={(p) => {
          setProducts((cur) => [...cur, p]);
          showToast(`${p.name} added`);
        }}
      />
      <ImportProductsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        folders={folders}
        defaultFolder={targetFolder}
        onImported={(list, skipped) => {
          setProducts((cur) => [...cur, ...list]);
          showToast(
            `Imported ${list.length} ${list.length === 1 ? "product" : "products"}${skipped ? `. Skipped ${skipped} ${skipped === 1 ? "row" : "rows"} with no name.` : ""}`,
          );
        }}
      />
    </div>
  );
}

function FolderTile({ name, count, onOpen, muted }: { name: string; count: number; onOpen: () => void; muted?: boolean }) {
  return (
    <button type="button" className={muted ? "folder-tile is-muted" : "folder-tile"} onClick={onOpen}>
      <span className="folder-icon" aria-hidden="true">
        <AppIcon name="products" size={20} />
      </span>
      <span className="folder-name">{name}</span>
      <span className="folder-count">
        {count} {count === 1 ? "product" : "products"}
      </span>
    </button>
  );
}

function NewFolder({ onCreated }: { onCreated: (f: Folder) => void }) {
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  async function save() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const res = await callAction(() => addFolder(n));
    setBusy(false);
    if (!res.ok || !res.data) return showToast(res.ok ? "Something went wrong. Please try again." : res.error, true);
    onCreated(res.data);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <Btn size="sm" onClick={() => setOpen(true)}>
        New folder
      </Btn>
    );
  }
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        ref={ref}
        className="lp-input input-sm"
        aria-label="Folder name"
        placeholder="e.g. Subscriptions"
        value={name}
        maxLength={PRODUCT_LIMITS.folder}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
      />
      <Btn size="sm" variant="primary" type="submit" disabled={!name.trim() || busy}>
        {busy ? "Saving…" : "Create"}
      </Btn>
      <Btn size="sm" onClick={() => { setOpen(false); setName(""); }}>
        Cancel
      </Btn>
    </form>
  );
}

function FolderSelect({ folders, value, onChange }: { folders: Folder[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="auth-field">
      <span className="lp-label">Folder</span>
      <select className="lp-input" value={value ?? UNFILED} onChange={(e) => onChange(e.target.value === UNFILED ? null : e.target.value)}>
        <option value={UNFILED}>Unfiled</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddProductModal({
  open,
  onClose,
  folders,
  defaultFolder,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  defaultFolder: string | null;
  onAdded: (p: CatalogProduct) => void;
}) {
  const [f, setF] = useState({ name: "", category: "", price: "", description: "" });
  const [folder, setFolder] = useState<string | null>(defaultFolder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setF({ name: "", category: "", price: "", description: "" });
      setFolder(defaultFolder);
      setError("");
      setTouched(false);
    }
  }, [open, defaultFolder]);

  async function save() {
    setTouched(true);
    if (!f.name.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await callAction(() => addProduct({ ...f, attributes: {} }, folder));
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.ok ? "Something went wrong. Please try again." : res.error);
    onAdded(res.data);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Add product"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Add product"}
          </Btn>
        </>
      }
    >
      <form
        className="team-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
      >
        <label className="auth-field">
          <span className="lp-label">Name</span>
          <input
            className="lp-input"
            value={f.name}
            maxLength={PRODUCT_LIMITS.name}
            aria-invalid={touched && !f.name.trim() ? true : undefined}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            data-autofocus
          />
        </label>
        {touched && !f.name.trim() ? (
          <p className="auth-error" role="alert">
            A product name is required.
          </p>
        ) : null}
        <div className="form-row">
          <label className="auth-field">
            <span className="lp-label">Category</span>
            <input className="lp-input" value={f.category} maxLength={PRODUCT_LIMITS.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </label>
          <label className="auth-field">
            <span className="lp-label">Price</span>
            <input
              className="lp-input"
              value={f.price}
              maxLength={PRODUCT_LIMITS.price}
              placeholder="e.g. $99/month"
              onChange={(e) => setF({ ...f, price: e.target.value })}
            />
          </label>
        </div>
        <label className="auth-field">
          <span className="lp-label">Description</span>
          <textarea
            className="lp-input wiz-textarea"
            rows={3}
            value={f.description}
            maxLength={PRODUCT_LIMITS.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </label>
        <FolderSelect folders={folders} value={folder} onChange={setFolder} />
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function ImportProductsModal({
  open,
  onClose,
  folders,
  defaultFolder,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  defaultFolder: string | null;
  onImported: (list: CatalogProduct[], skipped: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState<string | null>(defaultFolder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFile(null);
      setFolder(defaultFolder);
      setError("");
    }
  }, [open, defaultFolder]);

  async function run() {
    if (!file || busy) return;
    if (file.size > 1_000_000) return setError("That file is too large.");
    setBusy(true);
    setError("");
    const text = await file.text();
    const res = await callAction(() => importProducts(text, folder));
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.ok ? "Something went wrong. Please try again." : res.error);
    onImported(res.data.products, res.data.skipped);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Import products"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <Btn onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={!file || busy} onClick={run}>
            {busy ? "Importing…" : "Import"}
          </Btn>
        </>
      }
    >
      <div className="team-form">
        <p className="sub-empty-text">
          A CSV file with up to {PRODUCT_CSV_MAX} products. The first row names the columns: name, description, price, category. Any other
          column, like location, is kept as an extra detail.
        </p>
        <label className="auth-field">
          <span className="lp-label">CSV file</span>
          <input
            className="file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError("");
            }}
            data-autofocus
          />
        </label>
        <FolderSelect folders={folders} value={folder} onChange={setFolder} />
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
