"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { callAction } from "@/lib/auth/call-action";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import { useDismiss } from "@/lib/useDismiss";
import { createWorkspace, switchWorkspace } from "@/lib/workspaces/actions";
import AppIcon from "./AppIcon";

// Sidebar workspace menu: the list (active one ticked), "New workspace" with
// an inline name box, and "Workspace settings". Switching or creating reloads
// the whole page, so nothing from the old workspace stays on screen.
export default function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user, workspaces, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setAdding(false);
    setName("");
  }
  useDismiss(ref, open, close);

  async function onSwitch(id: string, active: boolean) {
    if (active) return close();
    setBusy(true);
    const res = await callAction(() => switchWorkspace({ id }));
    if (!res.ok) {
      setBusy(false);
      return showToast(res.error, true);
    }
    window.location.assign("/");
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await callAction(() => createWorkspace({ name }));
    if (!res.ok) {
      setBusy(false);
      return showToast(res.error, true);
    }
    window.location.assign("/");
  }

  const current = user?.workspaceName ?? "Workspace";

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="side-item ws-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? `Workspace: ${current}` : undefined}
        title={collapsed ? current : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <AppIcon name="briefcase" />
        <span className="side-label side-ellipsis">{current}</span>
        <AppIcon name="chevron-down" size={16} className="side-label side-chevron" />
      </button>

      {open ? (
        <div className="menu menu-up" role="menu" aria-label="Workspaces">
          <div className="menu-heading">Workspaces ({workspaces.length} of 10)</div>
          <ul className="menu-list">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={w.active}
                  className={css("menu-item", w.active && "is-active")}
                  disabled={busy}
                  onClick={() => onSwitch(w.id, w.active)}
                >
                  <span className="side-ellipsis">{w.name}</span>
                  {w.active ? <AppIcon name="check" size={16} className="menu-tick" /> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="menu-sep" />
          {adding ? (
            <form className="menu-form" onSubmit={onCreate}>
              <input
                className="lp-input menu-input"
                placeholder="New workspace name"
                aria-label="New workspace name"
                value={name}
                maxLength={80}
                autoFocus
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setAdding(false);
                    setName("");
                  }
                }}
              />
              <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>
                Create
              </button>
            </form>
          ) : (
            <button type="button" role="menuitem" className="menu-item" onClick={() => setAdding(true)}>
              <AppIcon name="plus" size={16} />
              New workspace
            </button>
          )}
          <Link href="/settings" role="menuitem" className="menu-item" onClick={close}>
            <AppIcon name="settings" size={16} />
            Workspace settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
