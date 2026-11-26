"use client";

import { useState } from "react";
import { Btn } from "@/components/primitives";
import { callAction } from "@/lib/auth/call-action";
import { markSent } from "@/lib/emails/actions";
import { copyText, mailtoLink } from "@/lib/emails/mailto";
import type { Draft } from "@/lib/emails/store";
import { refreshNavCounts } from "@/lib/navCountsEvent";
import { useApp } from "@/lib/store";
import { safeUrl } from "@/lib/url/safeUrl";

// Open in mail (or Copy message when there is no email), Copy message, Open
// profile and Mark sent. Nothing is ever sent by the app.
export default function DraftActions({ draft, onChanged }: { draft: Draft; onChanged: () => void }) {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const mail = mailtoLink(draft.email, draft.subject, draft.body);
  const profile = safeUrl(draft.profileUrl);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText(draft.subject, draft.body));
      showToast("Copied");
    } catch {
      showToast("Couldn't copy. Select the text and copy it by hand.", true);
    }
  }

  async function onMarkSent() {
    setBusy(true);
    const res = await callAction(() => markSent(draft.id));
    setBusy(false);
    if (!res.ok) return showToast(res.error, true);
    showToast(`Marked as sent. ${draft.leadName} is now ${res.data?.leadStatus === "contacted" ? "Contacted" : "unchanged"}.`);
    refreshNavCounts();
    onChanged();
  }

  return (
    <div className="draft-actions">
      {mail ? (
        <a className="btn btn-sm btn-accent" href={mail}>
          Open in mail
        </a>
      ) : null}
      <Btn size="sm" onClick={copy}>
        Copy message
      </Btn>
      {profile ? (
        <a className="btn btn-sm" href={profile} target="_blank" rel="noopener noreferrer nofollow">
          Open profile ↗
        </a>
      ) : null}
      {draft.status !== "sent" ? (
        <Btn size="sm" onClick={onMarkSent} disabled={busy}>
          {busy ? "Saving…" : "Mark sent"}
        </Btn>
      ) : (
        <span className="review-chip is-accepted">Sent</span>
      )}
    </div>
  );
}
