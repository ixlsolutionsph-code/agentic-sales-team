// Small building blocks used across the signed-in app.
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { css } from "@/lib/css";

export { css };

// A plain container with the app's card look when `card` is set.
export function Box({ card, className, ...rest }: HTMLAttributes<HTMLDivElement> & { card?: boolean }) {
  return <div className={css(card && "card", className)} {...rest} />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

// Spectrum pill button: primary is the filled accent, everything else is outlined.
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={css(
        "btn",
        variant === "primary" && "btn-accent",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "btn-sm",
        size === "lg" && "btn-lg",
        className,
      )}
      {...rest}
    />
  );
});
