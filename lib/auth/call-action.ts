// Client helper: runs a server action and turns a thrown error into the fixed message.
import { MSG } from "./rules";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function callAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch {
    return { ok: false, error: MSG.serverDown };
  }
}
