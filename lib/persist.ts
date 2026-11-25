// Optimistic saves: change the screen first, then save. If the save fails,
// put the screen back and report the error.
import { callAction, type ActionResult } from "@/lib/auth/call-action";

export async function persistOrRollback<T>(opts: {
  apply: () => void;
  rollback: () => void;
  save: () => Promise<ActionResult<T>>;
  onError?: (message: string) => void;
}): Promise<ActionResult<T>> {
  opts.apply();
  const res = await callAction(opts.save);
  if (!res.ok) {
    opts.rollback();
    opts.onError?.(res.error);
  }
  return res;
}
