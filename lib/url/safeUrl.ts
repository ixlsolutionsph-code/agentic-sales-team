// Only http(s) links are ever shown or saved (no javascript:, data: …).
export function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > 2048) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// The platform name for a profile or post link (04-erd.md `leads.platform`).
export function platformOf(url: string | null): string | null {
  const safe = safeUrl(url);
  if (!safe) return null;
  const host = new URL(safe).hostname.toLowerCase().replace(/^www\./, "");
  const is = (d: string) => host === d || host.endsWith(`.${d}`);
  if (is("facebook.com") || is("fb.com")) return "Facebook";
  if (is("reddit.com")) return "Reddit";
  if (is("linkedin.com")) return "LinkedIn";
  if (is("x.com") || is("twitter.com")) return "X";
  return "web";
}
