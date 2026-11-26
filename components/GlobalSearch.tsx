"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { visibleAgents } from "@/lib/agents/derive";
import { searchServer } from "@/lib/search/actions";
import { SERVER_DEBOUNCE_MS, noMatchesText, searchLocal, wantsServerSearch } from "@/lib/search/local";
import type { LeadHit, ProductHit } from "@/lib/search/store";
import { useApp } from "@/lib/store";
import { useDismiss } from "@/lib/useDismiss";
import AppIcon from "./AppIcon";

type ServerHits = { q: string; leads: LeadHit[]; products: ProductHit[] };

// The sidebar search (02-sitemap.md §5): agents (≤ 5) and teams (≤ 4) found
// in the browser; leads and products (5 each) from the server, 200 ms after
// the last key press, from 2 characters. Leads and products open their list.
export default function GlobalSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const { agents, teams, states, config } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [server, setServer] = useState<ServerHits>({ q: "", leads: [], products: [] });
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  useEffect(() => {
    const query = q.trim();
    if (!wantsServerSearch(query)) {
      setServer({ q: "", leads: [], products: [] });
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = window.setTimeout(() => {
      searchServer(query)
        .then((r) => alive && setServer({ q: query, ...r }))
        .catch(() => alive && setServer({ q: query, leads: [], products: [] }))
        .finally(() => alive && setSearching(false));
    }, SERVER_DEBOUNCE_MS);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [q]);

  const res = searchLocal(q, visibleAgents(agents, states, config), teams);
  const fresh = server.q === q.trim();
  const leads = fresh ? server.leads : [];
  const products = fresh ? server.products : [];
  const show = open && q.trim().length > 0;
  const none = !res.agents.length && !res.teams.length && !leads.length && !products.length;

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
          {none ? <p className="menu-empty">{searching ? "Searching…" : noMatchesText(q)}</p> : null}
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
          {leads.length ? <div className="menu-heading">Leads</div> : null}
          {leads.map((l) => (
            <button key={l.id} type="button" role="option" aria-selected={false} className="menu-item" onClick={() => go("/leads")}>
              <AppIcon name="leads" size={16} />
              <span className="side-ellipsis">{l.name}</span>
              <span className="menu-meta">{l.company}</span>
            </button>
          ))}
          {products.length ? <div className="menu-heading">Products</div> : null}
          {products.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} className="menu-item" onClick={() => go("/products")}>
              <AppIcon name="products" size={16} />
              <span className="side-ellipsis">{p.name}</span>
              <span className="menu-meta">{p.price || p.category}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
