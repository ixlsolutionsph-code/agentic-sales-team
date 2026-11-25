// Sidebar links and header titles (02-sitemap.md §5).

export type NavKey = "dashboard" | "leads" | "emails" | "products" | "calendar";

export const NAV_LINKS: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "leads", label: "Leads", href: "/leads" },
  { key: "emails", label: "Emails", href: "/emails" },
  { key: "products", label: "Products", href: "/products" },
  { key: "calendar", label: "Calendar", href: "/calendar" },
];

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

// Which sidebar link is highlighted. Dashboard is also active on team and agent pages.
export function activeNav(pathname: string): NavKey | null {
  if (under(pathname, "/dashboard") || under(pathname, "/teams") || under(pathname, "/agents")) return "dashboard";
  for (const l of NAV_LINKS) if (l.key !== "dashboard" && under(pathname, l.href)) return l.key;
  return null;
}

// The header title. None on chat home ("/") and the team chat ("/chats").
export function headerTitle(pathname: string): string {
  if (pathname === "/" || under(pathname, "/chats")) return "";
  if (under(pathname, "/dashboard")) return "Dashboard";
  if (under(pathname, "/teams")) return "Team details";
  if (/^\/agents\/[^/]+/.test(pathname)) return "Agent details";
  if (under(pathname, "/agents")) return "Agents";
  if (under(pathname, "/calendar")) return "Calendar";
  if (under(pathname, "/settings")) return "Settings";
  if (under(pathname, "/leads")) return "Leads";
  if (under(pathname, "/emails")) return "Emails";
  if (under(pathname, "/products")) return "Products";
  return "";
}

// Badge text for a count: nothing at 0, "99+" above 99.
export function badgeText(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n > 99 ? "99+" : String(Math.floor(n));
}

// Two-letter initials for the account row.
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
