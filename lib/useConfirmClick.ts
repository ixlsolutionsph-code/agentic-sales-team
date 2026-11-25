"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIRM_WINDOW_MS, confirmClickStep } from "./confirmClick";

// Two-click delete. `armed` is true after the first click and turns back to
// false after 3 seconds. `click(fn)` runs fn only on a second click in time.
export function useConfirmClick() {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const click = useCallback(
    (onConfirm: () => void) => {
      const step = confirmClickStep(armedAt, Date.now());
      window.clearTimeout(timer.current);
      setArmedAt(step.armedAt);
      if (step.confirmed) {
        onConfirm();
        return;
      }
      timer.current = window.setTimeout(() => setArmedAt(null), CONFIRM_WINDOW_MS);
    },
    [armedAt],
  );

  return { armed: armedAt !== null, click };
}
