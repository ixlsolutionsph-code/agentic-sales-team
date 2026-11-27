"use client";

import { useState } from "react";
import { WHEN_CHOICES } from "@/lib/ai/meetingTime";
import { meetAnswerMessage, type MeetPick } from "@/lib/chat/clarify";
import { css } from "@/lib/css";

// The meeting picker (⟦meetpick⟧, 03-user-journey.md J5): "Who should I
// meet?" with up to 10 leads (best score first, "Hot N" when 75+) and
// "When?" pills. Send posts the names and time with ⟦meetanswer⟧.
export default function MeetPicker({ pick, disabled, onSend }: { pick: MeetPick; disabled?: boolean; onSend: (text: string) => void }) {
  const leads = (pick.leads ?? []).slice(0, 10);
  const [picked, setPicked] = useState<string[]>([]);
  const [when, setWhen] = useState("");

  function send() {
    const chosen = leads.filter((l) => picked.includes(l.id));
    if (!chosen.length || disabled) return;
    onSend(meetAnswerMessage(chosen, when));
  }

  return (
    <div className="chat-card" role="group" aria-label="Who should I meet?">
      <p className="chat-q-label">Who should I meet?</p>
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
                {l.score >= 75 ? <span className="review-chip is-accepted">Hot {l.score}</span> : null}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="chat-q-label">When?</p>
      <div className="chat-pills">
        {(pick.when?.length ? pick.when : WHEN_CHOICES).map((w) => (
          <button key={w} type="button" className={css("chat-pill", when === w && "is-on")} disabled={disabled} aria-pressed={when === w} onClick={() => setWhen(when === w ? "" : w)}>
            {w}
          </button>
        ))}
      </div>
      <div className="chat-card-foot">
        <button type="button" className="btn btn-sm btn-accent" disabled={disabled || !picked.length} onClick={send}>
          {picked.length ? `Send (${picked.length})` : "Send"}
        </button>
      </div>
    </div>
  );
}
