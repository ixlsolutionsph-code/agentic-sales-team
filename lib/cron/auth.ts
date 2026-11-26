import { timingSafeEqual } from "node:crypto";

// Cron routes need the header "Authorization: Bearer <CRON_SECRET>". With no
// CRON_SECRET set, every call is refused. The compare takes the same time
// whatever the input, so the secret can't be guessed from timing.
export function isCronAuthorized(header: string | null | undefined, secret: string | undefined = process.env.CRON_SECRET): boolean {
  const want = secret?.trim();
  if (!want || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${want}`);
  if (a.length !== b.length) {
    timingSafeEqual(b, b); // spend the same time either way
    return false;
  }
  return timingSafeEqual(a, b);
}
