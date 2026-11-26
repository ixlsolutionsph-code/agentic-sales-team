"use client";

import { css } from "@/lib/css";
import { useConfirmClick } from "@/lib/useConfirmClick";

// A two-click button: the first click arms it (showing `armedLabel`), the
// second within 3 seconds runs `onConfirm`. It disarms on its own after that.
export default function ConfirmButton({
  label,
  armedLabel,
  ariaLabel,
  onConfirm,
  disabled,
  className = "btn btn-sm",
}: {
  label: string;
  armedLabel: string;
  ariaLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const c = useConfirmClick();
  return (
    <button
      type="button"
      className={css(className, c.armed && "btn-danger")}
      aria-label={ariaLabel ? (c.armed ? `Confirm: ${ariaLabel}` : ariaLabel) : undefined}
      disabled={disabled}
      onClick={() => c.click(onConfirm)}
    >
      {c.armed ? armedLabel : label}
    </button>
  );
}
