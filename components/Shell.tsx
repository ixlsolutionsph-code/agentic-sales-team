"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";
import { callAction } from "@/lib/auth/call-action";
import { css } from "@/lib/css";
import { activeNav, badgeText, headerTitle, initialsOf, NAV_LINKS, type NavKey } from "@/lib/nav";
import { noMatchesText, searchLocal } from "@/lib/search";
import { useApp } from "@/lib/store";
import { useDismiss, useMediaQuery } from "@/lib/useDismiss";
import { useFocusTrap } from "@/lib/useFocusTrap";
import AppIcon, { type AppIconName } from "./AppIcon";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

const NAV_ICONS: Record<NavKey, AppIconName> = {
  dashboard: "dashboard",
  leads: "leads",
  emails: "mail",
  products: "products",
  calendar: "calendar",
};

// The signed-in app frame: sidebar (272 px, a 64 px rail when collapsed, a
// drawer on phones) and the 60 px header.
export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const mobile = useMediaQuery("(max-width: 767px)");
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const sideRef = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // The drawer closes on every page change and when the screen gets wide.
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!mobile) setDrawer(false);
  }, [mobile]);

  // On phones the closed drawer is off screen: keep it out of Tab order and
  // screen readers. (Set directly: React 18 has no `inert` prop.) This must
  // run before the focus trap below, or focus can't move into the drawer.
  useEffect(() => {
    sideRef.current?.toggleAttribute("inert", mobile && !drawer);
  }, [mobile, drawer]);

  useFocusTrap(sideRef, mobile && drawer, () => setDrawer(false));

  const rail = collapsed && !mobile;
  const title = headerTitle(pathname);

  function focusSearch() {
    setCollapsed(false);
    window.setTimeout(() => searchInput.current?.focus(), 0);
  }

  return (
    <div className={css("shell", rail && "is-rail", drawer && "is-drawer-open")}>
      <aside
        ref={sideRef}
        id="app-sidebar"
        className="sidebar"
        aria-label="Sidebar"
        tabIndex={-1}
      >
        <Sidebar
          pathname={pathname}
          rail={rail}
          mobile={mobile}
          searchInput={searchInput}
          onToggleRail={() => setCollapsed((c) => !c)}
          onCloseDrawer={() => {
            setDrawer(false);
            menuBtn.current?.focus();
          }}
          onRailSearch={focusSearch}
        />
      </aside>
      {mobile && drawer ? <div className="drawer-overlay" aria-hidden="true" onClick={() => setDrawer(false)} /> : null}

      <div className="shell-main">
        <header className="app-header">
          <button
            ref={menuBtn}
            type="button"
            className="icon-btn header-menu"
            aria-label="Open menu"
            aria-controls="app-sidebar"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <AppIcon name="menu" size={20} />
          </button>
          {title ? <h1 className="app-title">{title}</h1> : <span className="app-title-spacer" />}
          <div className="header-actions">
            <NotificationsBell />
            <Link href="/create" className="btn btn-dark btn-sm add-agent" aria-label="Add agent">
              <AppIcon name="plus" size={16} />
              <span>Add agent</span>
            </Link>
          </div>
        </header>
        <main className="app-content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  pathname,
  rail,
  mobile,
  searchInput,
  onToggleRail,
  onCloseDrawer,
  onRailSearch,
}: {
  pathname: string;
  rail: boolean;
  mobile: boolean;
  searchInput: React.RefObject<HTMLInputElement>;
  onToggleRail: () => void;
  onCloseDrawer: () => void;
  onRailSearch: () => void;
}) {
  const { teams, navCounts } = useApp();
  const active = activeNav(pathname);
  const counts: Partial<Record<NavKey, number>> = { leads: navCounts.leads, emails: navCounts.emails };

  return (
    <div className="side-inner">
      <div className="side-top">
        <Link href="/" className="side-brand" aria-label="Agentic Sales Team, home">
          <Image src="/logo-mark.png" alt="" width={28} height={28} />
          <span className="side-label">Agentic Sales Team</span>
        </Link>
        {mobile ? (
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={onCloseDrawer}>
            <AppIcon name="x" />
          </button>
        ) : (
          <button
            type="button"
            className="icon-btn side-collapse"
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            title={rail ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleRail}
          >
            <AppIcon name="panel" />
          </button>
        )}
      </div>

      {rail ? (
        <button type="button" className="side-item" aria-label="Search" title="Search" onClick={onRailSearch}>
          <AppIcon name="search" />
        </button>
      ) : (
        <SidebarSearch inputRef={searchInput} />
      )}

      <nav className="side-nav" aria-label="Main">
        <Link
          href="/"
          className={css("side-item", pathname === "/" && "is-active")}
          aria-current={pathname === "/" ? "page" : undefined}
          title={rail ? "New chat" : undefined}
          aria-label={rail ? "New chat" : undefined}
        >
          <AppIcon name="new-chat" />
          <span className="side-label">New chat</span>
        </Link>
        {NAV_LINKS.map((l) => {
          const badge = badgeText(counts[l.key] ?? 0);
          const on = active === l.key;
          return (
            <Link
              key={l.key}
              href={l.href}
              className={css("side-item", on && "is-active")}
              aria-current={on ? "page" : undefined}
              title={rail ? l.label : undefined}
              aria-label={rail ? (badge ? `${l.label}, ${badge}` : l.label) : undefined}
            >
              <AppIcon name={NAV_ICONS[l.key]} />
              <span className="side-label">{l.label}</span>
              {badge ? <span className="side-badge">{badge}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="side-section">
        <div className="side-heading side-label">Recent chats</div>
        {teams.length ? (
          <ul className="side-chats">
            {teams.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/chats?team=${encodeURIComponent(t.id)}`}
                  className="side-item"
                  title={rail ? t.name : undefined}
                  aria-label={rail ? t.name : undefined}
                >
                  <AppIcon name="chat" />
                  <span className="side-label side-ellipsis">{t.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="side-empty side-label">No chats yet</p>
        )}
      </div>

      <div className="side-bottom">
        <WorkspaceSwitcher collapsed={rail} />
        <AccountMenu rail={rail} />
      </div>
    </div>
  );
}

function SidebarSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const { agents, teams } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const res = searchLocal(q, agents, teams);
  const show = open && q.trim().length > 0;
  const none = res.agents.length === 0 && res.teams.length === 0;

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <div className="side-search" ref={ref} role="search">
      <AppIcon name="search" size={16} className="side-search-icon" />
      <input
        ref={inputRef}
        className="side-search-input"
        type="search"
        placeholder="Search"
        aria-label="Search agents, teams, leads and products"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQ("");
          }
        }}
      />
      {show ? (
        <div className="menu search-results" role="listbox" aria-label="Search results">
          {none ? <p className="menu-empty">{noMatchesText(q)}</p> : null}
          {res.agents.length ? <div className="menu-heading">Agents</div> : null}
          {res.agents.map((a) => (
            <button key={a.id} type="button" role="option" aria-selected={false} className="menu-item" onClick={() => go(`/agents/${encodeURIComponent(a.id)}`)}>
              <AppIcon name="bot" size={16} />
              <span className="side-ellipsis">{a.name}</span>
              <span className="menu-meta">{a.role}</span>
            </button>
          ))}
          {res.teams.length ? <div className="menu-heading">Teams</div> : null}
          {res.teams.map((t) => (
            <button key={t.id} type="button" role="option" aria-selected={false} className="menu-item" onClick={() => go(`/teams/${encodeURIComponent(t.id)}`)}>
              <AppIcon name="team" size={16} />
              <span className="side-ellipsis">{t.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AccountMenu({ rail }: { rail: boolean }) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const name = user?.name ?? "";

  async function onLogOut() {
    setBusy(true);
    await callAction(() => signOut());
    window.location.assign("/");
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="side-item account-row"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        title={rail ? name : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {initialsOf(name)}
        </span>
        <span className="side-label account-text">
          <span className="side-ellipsis account-name">{name}</span>
          <span className="side-ellipsis account-email">{user?.email}</span>
        </span>
      </button>
      {open ? (
        <div className="menu menu-up" role="menu" aria-label="Account">
          <Link href="/settings" role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
            <AppIcon name="settings" size={16} />
            Settings
          </Link>
          <Link href="/agents" role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
            <AppIcon name="bot" size={16} />
            Agents
          </Link>
          <button type="button" role="menuitem" className="menu-item" disabled={busy} onClick={onLogOut}>
            <AppIcon name="log-out" size={16} />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

// The bell. Activity comes in Milestone 10; until then the panel is empty.
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <AppIcon name="bell" size={20} />
      </button>
      {open ? (
        <div className="menu menu-right bell-panel" role="dialog" aria-label="Notifications">
          <div className="menu-heading">Notifications</div>
          <p className="menu-empty">No recent activity.</p>
        </div>
      ) : null}
    </div>
  );
}
