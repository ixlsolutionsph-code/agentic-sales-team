// Two-click delete: the first click arms the button, a second click within
// 3 seconds confirms. After 3 seconds it disarms on its own.
export const CONFIRM_WINDOW_MS = 3000;

export type ConfirmStep = { armedAt: number | null; confirmed: boolean };

export function confirmClickStep(armedAt: number | null, now: number): ConfirmStep {
  if (armedAt !== null && now - armedAt < CONFIRM_WINDOW_MS) return { armedAt: null, confirmed: true };
  return { armedAt: now, confirmed: false };
}

export function isArmed(armedAt: number | null, now: number): boolean {
  return armedAt !== null && now - armedAt < CONFIRM_WINDOW_MS;
}
