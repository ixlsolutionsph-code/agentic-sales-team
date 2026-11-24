"use client";

import Image from "next/image";
import { useState } from "react";
import Icon from "./Icon";
import { NAV_LINKS } from "./content";

export default function Nav({ onAuth }: { onAuth: (mode: "login" | "signup") => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="lp-nav">
      <div className="lp-wrap lp-nav-row">
        <a className="lp-brand" href="#top" aria-label="Agentic Sales Team, back to top">
          <Image src="/logo-mark.png" alt="" width={28} height={28} />
          <span>Agentic Sales Team</span>
        </a>
        <nav className="lp-nav-links" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a key={l.href} className="lp-nav-link" href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-actions">
          <button className="btn lp-hide-sm" onClick={() => onAuth("login")}>
            Log in
          </button>
          <button className="btn btn-dark" onClick={() => onAuth("signup")}>
            Get started
          </button>
          <button
            className="btn lp-menu-btn"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "x" : "menu"} size={16} />
          </button>
        </div>
      </div>
      <div className={`lp-mobile-menu${open ? " is-open" : ""}`}>
        {NAV_LINKS.map((l) => (
          <a key={l.href} className="lp-nav-link" href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <button className="btn" onClick={() => onAuth("login")}>
          Log in
        </button>
      </div>
    </header>
  );
}
