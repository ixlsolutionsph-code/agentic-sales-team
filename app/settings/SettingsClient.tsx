"use client";

import Link from "next/link";
import { useState } from "react";
import { updateSettings } from "@/lib/auth/actions";
import { callAction } from "@/lib/auth/call-action";

// One "Workspace" card: Workspace name and Your name, each saved on blur.
export default function SettingsClient({ workspaceName, name }: { workspaceName: string; name: string }) {
  const [ws, setWs] = useState(workspaceName);
  const [me, setMe] = useState(name);
  const [saved, setSaved] = useState({ ws: workspaceName, me: name });
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  function show(text: string, error = false) {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), error ? 4500 : 2600);
  }

  async function save(field: "ws" | "me") {
    const value = field === "ws" ? ws.trim() : me.trim();
    if (value === saved[field]) return;
    const res = await callAction(() =>
      updateSettings(field === "ws" ? { workspaceName: value } : { name: value }),
    );
    if (!res.ok) {
      show(res.error, true);
      if (field === "ws") setWs(saved.ws);
      else setMe(saved.me);
      return;
    }
    setSaved((s) => ({ ...s, [field]: value }));
    show("Saved");
  }

  return (
    <main className="home">
      <div className="home-inner">
        <Link href="/" className="auth-link">
          ← Back
        </Link>
        <h1 className="lp-h2" style={{ fontSize: 32 }}>
          Settings
        </h1>
        <section className="card" style={{ display: "grid", gap: 16 }}>
          <h2 className="lp-h3">Workspace</h2>
          <label className="auth-field">
            <span className="lp-label">Workspace name</span>
            <input
              className="lp-input"
              value={ws}
              maxLength={80}
              onChange={(e) => setWs(e.target.value)}
              onBlur={() => save("ws")}
            />
          </label>
          <label className="auth-field">
            <span className="lp-label">Your name</span>
            <input className="lp-input" value={me} onChange={(e) => setMe(e.target.value)} onBlur={() => save("me")} />
          </label>
        </section>
      </div>
      {toast ? <div className={`toast${toast.error ? " is-error" : ""}`}>{toast.text}</div> : null}
    </main>
  );
}
