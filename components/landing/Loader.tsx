import Image from "next/image";

export default function Loader({ done, ms }: { done: boolean; ms: number }) {
  return (
    <div
      className={`lp-loader${done ? " is-done" : ""}`}
      style={{ ["--loader-ms" as string]: `${ms}ms` }}
      role="status"
      aria-live="polite"
      aria-hidden={done}
    >
      <div className="lp-loader-inner">
        <Image className="lp-loader-mark" src="/logo-mark.png" alt="" width={56} height={56} priority />
        <span className="lp-label">Your team is getting ready</span>
        <div className="lp-loader-bar">
          <div className="lp-loader-fill" />
        </div>
      </div>
    </div>
  );
}
