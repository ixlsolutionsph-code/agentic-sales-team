// Toast timings: success 2600 ms, error 4500 ms.
export const TOAST_MS = { success: 2600, error: 4500 } as const;

export type ToastMsg = { id: number; text: string; error: boolean };

export function toastDuration(error: boolean): number {
  return error ? TOAST_MS.error : TOAST_MS.success;
}

// A timer may only clear the toast it was started for. This stops an older
// toast's timer from hiding a newer one early.
export function clearIfCurrent(current: ToastMsg | null, id: number): ToastMsg | null {
  return current && current.id === id ? null : current;
}
