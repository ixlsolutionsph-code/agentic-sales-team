"use client";

// Quick-reply buttons (⟦replies⟧, or "Yes, go ahead" / "No, thanks" after an
// ⟦offer⟧). A press sends that text to the team.
export default function QuickReplies({ replies, disabled, onSend }: { replies: string[]; disabled?: boolean; onSend: (text: string) => void }) {
  if (!replies.length) return null;
  return (
    <div className="chat-replies" role="group" aria-label="Quick replies">
      {replies.map((r) => (
        <button key={r} type="button" className="btn btn-sm chat-reply" disabled={disabled} onClick={() => onSend(r)}>
          {r}
        </button>
      ))}
    </div>
  );
}
