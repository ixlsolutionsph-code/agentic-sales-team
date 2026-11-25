import AppIcon from "./AppIcon";

// Shown when a page fails to load.
export default function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty" role="alert">
      <span className="empty-icon is-error">
        <AppIcon name="alert" size={22} />
      </span>
      <h2 className="empty-title">This page didn&apos;t load</h2>
      <div className="empty-action">
        <button type="button" className="btn btn-accent" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}
