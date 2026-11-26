// A one-line "why it fits" for a lead, only where it is empty (under 20 words).
import { cleanField } from "@/lib/ai/untrusted";

export const FIT_MAX_WORDS = 19;

export function oneLineFit(text: string): string {
  const words = cleanField(text, 300).split(" ").filter(Boolean);
  return words.slice(0, FIT_MAX_WORDS).join(" ");
}

// The new fit reason to save, or null to keep the current one.
export function ensureFitReason(current: string, candidate: string | null | undefined): string | null {
  if (current.trim()) return null;
  const line = candidate ? oneLineFit(candidate) : "";
  return line || null;
}
