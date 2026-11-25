"use client";

import { useState } from "react";
import { updateSettings } from "@/lib/auth/actions";
import { callAction } from "@/lib/auth/call-action";
import { useApp } from "@/lib/store";

// One "Workspace" card: Workspace name and Your name, each saved on blur.
// Messages use the shared toast, so a newer "Saved" is never hidden early.
export default function SettingsClient({ workspaceName, name }: { workspaceName: string; name: string }) {
  const { showToast, setUser, setWorkspaces, workspaces, user } = useApp();
  const [ws, setWs] = useState(workspaceName);
  const [me, setMe] = useState(name);
  const [saved, setSaved] = useState({ ws: workspaceName, me: name });

  async function save(field: "ws" | "me") {
    const value = field === "ws" ? ws.trim() : me.trim();
    if (value === saved[field]) return;
    const res = await callAction(() =>
      updateSettings(field === "ws" ? { workspaceName: value } : { name: value }),
    );
    if (!res.ok) {
      showToast(res.error, true);
      if (field === "ws") setWs(saved.ws);
      else setMe(saved.me);
      return;
    }
    setSaved((s) => ({ ...s, [field]: value }));
    if (field === "ws") {
      setWs(value);
      setUser({ workspaceName: value });
      setWorkspaces(workspaces.map((w) => (w.id === user?.workspaceId ? { ...w, name: value } : w)));
    } else {
      setMe(value);
      setUser({ name: value });
    }
    showToast("Saved");
  }

  return (
    <div className="page page-narrow">
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
  );
}
