"use client";

// TEMPORARY signed-in page for Milestone 2. Milestone 3 replaces it with the
// app shell and the chat home ("Hire your first agent").
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { CurrentUser } from "@/lib/auth/actions";
import { signOut } from "@/lib/auth/actions";
import { callAction } from "@/lib/auth/call-action";
import { createWorkspace, switchWorkspace, type Workspace } from "@/lib/workspaces/actions";

export default function SignedInHome({ user, workspaces }: { user: CurrentUser; workspaces: Workspace[] }) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  function show(text: string, error = false) {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), error ? 4500 : 2600);
  }

  async function onSwitch(id: string) {
    setBusy(true);
    const res = await callAction(() => switchWorkspace({ id }));
    if (!res.ok) {
      setBusy(false);
      return show(res.error, true);
    }
    window.location.assign("/");
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await callAction(() => createWorkspace({ name: newName }));
    if (!res.ok) {
      setBusy(false);
      return show(res.error, true);
    }
    window.location.assign("/");
  }

  async function onSignOut() {
    setBusy(true);
    await callAction(() => signOut());
    window.location.assign("/");
  }

  return (
    <main className="home">
      <div className="home-inner">
        <div className="row-gap" style={{ justifyContent: "space-between" }}>
          <span className="lp-brand">
            <Image src="/logo-mark.png" alt="" width={28} height={28} />
            <span>Agentic Sales Team</span>
          </span>
          <div className="row-gap">
            <Link className="btn" href="/settings">
              Settings
            </Link>
            <button className="btn" onClick={onSignOut} disabled={busy}>
              Log out
            </button>
          </div>
        </div>

        <section className="card" style={{ display: "grid", gap: 8 }}>
          <span className="lp-label lp-label-accent">You&apos;re signed in</span>
          <h1 className="lp-h2" style={{ fontSize: 32 }}>
            Hi, {user.name}
          </h1>
          <p className="lp-body lp-muted">
            {user.email} · Workspace: <strong>{user.workspaceName}</strong>
          </p>
          <p className="lp-body lp-muted" style={{ fontSize: 14 }}>
            This is a temporary page for testing accounts. The real app layout comes in the next step.
          </p>
        </section>

        <section className="card" style={{ display: "grid", gap: 12 }}>
          <h2 className="lp-h3">Your workspaces ({workspaces.length} of 10)</h2>
          <ul className="ws-list">
            {workspaces.map((w) => (
              <li key={w.id} className={`ws-item${w.active ? " is-active" : ""}`}>
                <span className="lp-body">{w.name}</span>
                {w.first ? <span className="badge">First</span> : null}
                {w.active ? (
                  <span className="badge badge-accent">Active</span>
                ) : (
                  <button className="btn" style={{ minHeight: 32 }} onClick={() => onSwitch(w.id)} disabled={busy}>
                    Switch
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form className="row-gap" onSubmit={onCreate}>
            <input
              className="lp-input"
              placeholder="New workspace name"
              value={newName}
              maxLength={80}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New workspace name"
            />
            <button className="btn btn-accent" type="submit" disabled={busy}>
              New workspace
            </button>
          </form>
        </section>
      </div>
      {toast ? <div className={`toast${toast.error ? " is-error" : ""}`}>{toast.text}</div> : null}
    </main>
  );
}
