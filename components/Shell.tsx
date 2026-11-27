"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";
import { callAction } from "@/lib/auth/call-action";
import { clearChat } from "@/lib/chat/actions";
import { anyUnread } from "@/lib/chat/thread";
import { css } from "@/lib/css";
import { activeNav, badgeText, headerTitle, initialsOf, NAV_LINKS, type NavKey } from "@/lib/nav";
import { useApp } from "@/lib/store";
import { useDismiss, useMediaQuery } from "@/lib/useDismiss";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useNavCounts } from "@/lib/useNavCounts";
import { CHAT_CLEARED_EVENT, useChatUnread } from "@/lib/useTeamChat";
import type { Team } from "@/lib/types";
import AppIcon, { type AppIconName } from "./AppIcon";
import GlobalSearch from "./GlobalSearch";
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
  useNavCounts(pathname);
  const { activeChatTeam } = useApp();
  const unread = useChatUnread();
  // The open chat is not counted for the dot on the browser tab.
  const openTeam = pathname === "/chats" || pathname.startsWith("/chats/") ? activeChatTeam : null;
  useTabDot(anyUnread(unread, openTeam));

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
          unread={unread}
          openTeam={openTeam}
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
  unread,
  openTeam,
  rail,
  mobile,
  searchInput,
  onToggleRail,
  onCloseDrawer,
  onRailSearch,
}: {
  pathname: string;
  unread: Record<string, number>;
  openTeam: string | null;
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
        <GlobalSearch inputRef={searchInput} />
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
              <ChatRow key={t.id} team={t} rail={rail} count={openTeam === t.id ? 0 : unread[t.id] ?? 0} open={openTeam === t.id} />
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

// One Recent chats row: the team name, its unread count ("99+" cap) and, on
// hover, a trash button that asks "Delete history?" before clearing the chat.
function ChatRow({ team, rail, count, open }: { team: Team; rail: boolean; count: number; open: boolean }) {
  const { setActiveChatTeam, setChatThread, showToast } = useApp();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const badge = badgeText(count);

  async function onDelete() {
    setBusy(true);
    const res = await callAction(() => clearChat(team.id));
    setBusy(false);
    if (!res.ok) return showToast(res.error, true);
    setConfirm(false);
    setChatThread(team.id, null);
    window.dispatchEvent(new CustomEvent(CHAT_CLEARED_EVENT, { detail: team.id }));
    showToast(`${team.name} chat history deleted`);
  }

  if (confirm && !rail) {
    return (
      <li className="side-chat-confirm" role="group" aria-label={`Delete ${team.name} chat history`}>
        <span className="side-chat-confirm-text">Delete history?</span>
        <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setConfirm(false)}>
          Cancel
        </button>
      </li>
    );
  }

  const label = badge ? `${team.name}, ${badge} unread` : team.name;
  return (
    <li className="side-chat">
      {/* The team is held in memory: a chat has no bookmarkable link (01-prd.md §12). */}
      <button
        type="button"
        className={css("side-item", open && "is-active")}
        title={rail ? label : undefined}
        aria-label={rail || badge ? label : undefined}
        aria-current={open ? "page" : undefined}
        onClick={() => {
          setActiveChatTeam(team.id);
          router.push("/chats");
        }}
      >
        <AppIcon name="chat" />
        <span className="side-label side-ellipsis">{team.name}</span>
        {badge ? <span className="side-badge side-chat-badge">{badge}</span> : null}
      </button>
      {rail ? null : (
        <button
          type="button"
          className="icon-btn side-chat-trash"
          aria-label={`Delete ${team.name} chat history`}
          title="Delete history"
          onClick={() => setConfirm(true)}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      )}
    </li>
  );
}

// A red dot on the browser tab's icon while another team has unread messages.
const FAVICON = "/logo-mark.png";
function useTabDot(on: boolean) {
  const dotted = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const links = () => Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
    const setHref = (href: string) => {
      const list = links();
      if (!list.length) {
        const l = document.createElement("link");
        l.rel = "icon";
        document.head.appendChild(l);
        list.push(l);
      }
      for (const l of list) l.href = href;
    };
    if (!on) {
      if (dotted.current) setHref(FAVICON);
      dotted.current = null;
      return;
    }
    const draw = (img: HTMLImageElement | null) => {
      if (cancelled) return;
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      if (img) ctx.drawImage(img, 0, 0, 32, 32);
      ctx.beginPath();
      ctx.arc(24, 8, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#d73220";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      try {
        const url = c.toDataURL("image/png");
        dotted.current = url;
        setHref(url);
      } catch {
        // A blocked canvas: leave the icon as it is.
      }
    };
    const img = new window.Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(null);
    img.src = FAVICON;
    return () => {
      cancelled = true;
    };
  }, [on]);
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
