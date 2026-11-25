import type { ReactNode } from "react";
import AppIcon, { type AppIconName } from "./AppIcon";

// The friendly "nothing here yet" block every empty page and list uses.
export default function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: AppIconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <AppIcon name={icon} size={22} />
      </span>
      <h2 className="empty-title">{title}</h2>
      {text ? <p className="empty-text">{text}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}
