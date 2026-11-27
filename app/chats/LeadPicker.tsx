"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { jsonMarker, type WritePick } from "@/lib/chat/markers";

// The outreach lead picker (⟦writepick⟧): "Who should I write to?" with a
// tick box per lead and "Write to everyone". Send posts the names with
// ⟦writeanswer:{ids}⟧.
export default function LeadPicker({ pick, disabled, onSend }: { pick: WritePick; disabled?: boolean; onSend: (text: string) => void }) {
  const leads = (pick.leads ?? []).slice(0, 50);
  const [picked, setPicked] = useState<string[]>([]);

  function sendPicked() {
    const chosen = leads.filter((l) => picked.includes(l.id));
    if (!chosen.length || disabled) return;
    onSend(`Write to ${chosen.map((l) => `«${l.name}»`).join(", ")}${jsonMarker("writeanswer", { ids: chosen.map((l) => l.id) })}`);
  }

  return (
    <div className="chat-card" role="group" aria-label="Who should I write to?">
      <p className="chat-q-label">Who should I write to?</p>
      <ul className="chat-pick-list">
        {leads.map((l) => {
          const on = picked.includes(l.id);
          return (
            <li key={l.id}>
              <label className={css("chat-pick", on && "is-on")}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={() => setPicked((cur) => (on ? cur.filter((x) => x !== l.id) : [...cur, l.id]))}
                />
                <span className="chat-pick-name">{l.name}</span>
                {l.company ? <span className="chat-pick-sub">{l.company}</span> : null}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="chat-card-foot">
        <button
          type="button"
          className="btn btn-sm"
          disabled={disabled}
          onClick={() => onSend(`Write to everyone${jsonMarker("writeanswer", { ids: "all" })}`)}
        >
          Write to everyone
        </button>
        <button type="button" className="btn btn-sm btn-accent" disabled={disabled || !picked.length} onClick={sendPicked}>
          {picked.length ? `Send (${picked.length})` : "Send"}
        </button>
      </div>
    </div>
  );
}
