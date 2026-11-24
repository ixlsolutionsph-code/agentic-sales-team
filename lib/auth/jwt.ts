// Session tokens. Edge-safe (used by middleware), so no Node-only imports.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const WS_COOKIE = "ws";
export const SESSION_DAYS = 30;
export const DEV_SECRET = "dev-insecure-secret-change-me";

export type SessionPayload = { userId: string; email: string; name: string; sessionVersion: number };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

// Checks the signature and expiry only. The session version is checked in getSession().
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.sessionVersion !== "number") return null;
    return {
      userId: payload.userId,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}
