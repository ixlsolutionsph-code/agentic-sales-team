// Who to write to, when outreach is asked for in the chat (J4 "Asking in chat
// instead"). Pure.
import { jsonMarker, type WritePick } from "./markers";

export const OUTREACH_ASK = "Who would you like me to write to? You can name the leads, or tell me to reach everyone in the book.";
export const WRITE_TO_EVERYONE = "Write to everyone";
export const WRITEPICK_MAX = 50;
export const MSG_NO_OPEN_LEADS =
  "Everyone in the book already has an email draft, or there are no accepted leads yet. Find or accept some leads first, then ask me again.";

export type PickLead = { id: string; name: string; company: string };

const tidy = (s: string, max: number) => String(s ?? "").replace(/[⟦⟧«»]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

// The picker question: the ask text and ⟦writepick:{leads ≤ 50}⟧. The card
// has its own "Write to everyone" button.
export function outreachPickMessage(leads: PickLead[]): string {
  const pick: WritePick = {
    leads: leads.slice(0, WRITEPICK_MAX).map((l) => ({ id: l.id, name: tidy(l.name, 120), company: tidy(l.company, 120) })),
  };
  return `${OUTREACH_ASK}${jsonMarker("writepick", pick)}`;
}

// "everyone", "all of them", "the whole book", "all leads".
export function isEveryone(text: string): boolean {
  const s = String(text ?? "").toLowerCase();
  return /\b(everyone|everybody|all of them|all leads|all the leads|all my leads|all our leads|whole book|entire book|the book|every lead|all of the leads)\b/.test(s) || /^\s*all\s*[.!]?\s*$/.test(s);
}

// "«Ana Cruz», «Ben Lee» and «Cy»" for the "Understood…" line.
export function namesSummary(names: string[], max = 4): string {
  const pills = names.map((n) => `«${tidy(n, 120)}»`);
  if (pills.length <= max) {
    if (pills.length <= 1) return pills.join("");
    return `${pills.slice(0, -1).join(", ")} and ${pills[pills.length - 1]}`;
  }
  const more = pills.length - max;
  return `${pills.slice(0, max).join(", ")} and ${more} more`;
}
