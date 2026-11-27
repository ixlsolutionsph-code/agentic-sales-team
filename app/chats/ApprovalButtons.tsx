"use client";

import { useState } from "react";

// Proceed / Cancel for a step waiting for approval (⟦approve:jobId⟧).
export default function ApprovalButtons({
  jobId,
  disabled,
  onDecide,
}: {
  jobId: string;
  disabled?: boolean;
  onDecide: (jobId: string, proceed: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function press(proceed: boolean) {
    setBusy(true);
    try {
      await onDecide(jobId, proceed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="chat-approve" role="group" aria-label="Approve this step">
      <button type="button" className="btn btn-sm btn-accent" disabled={disabled || busy} onClick={() => press(true)}>
        Proceed
      </button>
      <button type="button" className="btn btn-sm" disabled={disabled || busy} onClick={() => press(false)}>
        Cancel
      </button>
    </div>
  );
}
