// Keeps keyboard focus inside a pop-up or the mobile drawer.

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Where Tab (or Shift+Tab) should go next. Returns -1 when the browser can
// handle it (focus stays inside without help).
export function nextFocusIndex(current: number, count: number, shift: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift && current === 0) return count - 1;
  if (!shift && current === count - 1) return 0;
  return -1;
}

// Browser-only: call from a keydown handler on the trapped element.
export function trapTab(e: KeyboardEvent, root: HTMLElement): void {
  if (e.key !== "Tab") return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
  const idx = items.indexOf(document.activeElement as HTMLElement);
  const next = nextFocusIndex(idx, items.length, e.shiftKey);
  if (items.length === 0) {
    e.preventDefault();
    root.focus();
    return;
  }
  if (next >= 0) {
    e.preventDefault();
    items[next].focus();
  }
}
