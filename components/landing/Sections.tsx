import Image from "next/image";
import Icon from "./Icon";
import { AGENTS, AGENT_ORDER, FOOTER_LINKS, INBOX, NEVER, PLANS, RULES, STEPS, TRUST } from "./content";

type AuthFn = (mode: "login" | "signup") => void;

function Head({ label, title, text, center }: { label: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={`lp-head${center ? " lp-head-center" : ""}`} data-reveal>
      <span className="lp-label lp-label-muted">{label}</span>
      <h2 className="lp-h2">{title}</h2>
      {text ? <p className="lp-sub lp-muted">{text}</p> : null}
    </div>
  );
}

export function Team() {
  return (
    <section id="agents" className="lp-section">
      <div className="lp-wrap">
        <Head
          label="The team"
          title="Meet the team you just hired"
          text="Each agent has one job. Put them in a team, and they hand work to each other on their own."
        />
        <div className="lp-grid-4 agents">
          {AGENT_ORDER.map((key) => {
            const a = AGENTS[key];
            return (
              <article key={key} className={`card agent-card ${a.wash}`} data-reveal>
                <Image className="agent-photo" src={`/agents/${key}.jpg`} alt={`${a.name}, the ${a.role}`} width={320} height={320} />
                <div className="agent-meta">
                  <div className="agent-name">
                    <h3 className="lp-h3" style={{ fontWeight: 600 }}>
                      {a.name}
                    </h3>
                    <span className="badge badge-ink">{a.role}</span>
                  </div>
                  <p className="lp-body">{a.line}</p>
                  <div className="agent-skills">
                    {a.skills.map((s) => (
                      <span key={s} className="badge">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="lp-section">
      <div className="lp-wrap">
        <Head
          label="How it works"
          title="From one sentence to a ready email"
          text="Type what you want in plain English. Your team does the rest, one step at a time."
        />
        <div className="lp-grid-4">
          {STEPS.map((s, i) => (
            <article key={s.title} className="card step-card" data-reveal>
              <div className="step-top">
                <span className="icon-box">
                  <Icon name={s.icon} />
                </span>
                <span className="step-num">0{i + 1}</span>
              </div>
              <h3 className="lp-h3" style={{ fontWeight: 600 }}>
                {s.title}
              </h3>
              <p className="lp-body lp-muted">{s.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Inbox() {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <Head
          label="Your inbox"
          title="Your agents message you when they need you"
          text="You don't have to watch them work. They come to you in the chat."
        />
        <div className="lp-grid-2">
          {INBOX.map((m, i) => (
            <article key={m.title} className={`card inbox-card ${["wash-sky", "", "", "wash-peach"][i]}`} data-reveal>
              <span className="icon-box">
                <Icon name={m.icon} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 className="lp-h3" style={{ fontWeight: 600 }}>
                  {m.title}
                </h3>
                <p className="lp-body lp-muted">{m.text}</p>
                <div className="inbox-msg">
                  <Image src={`/agents/${m.agent}.jpg`} alt="" width={24} height={24} />
                  <span>
                    <strong>{AGENTS[m.agent].name}:</strong> {m.msg}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Rules() {
  return (
    <section id="control" className="lp-section">
      <div className="lp-wrap">
        <Head
          label="Control"
          title="You set the rules. Your agents follow them."
          text="Choose which steps ask you first and which run on their own. Ask is the default."
        />
        <div className="rules">
          <div className="card rule-list" data-reveal>
            {RULES.map((r) => (
              <div key={r.label} className="rule-row">
                <p className="lp-body">{r.label}</p>
                <span className="seg" aria-label={`${r.label}: ${r.value}`}>
                  <span className={r.value === "Ask" ? "on" : ""}>Ask</span>
                  <span className={r.value === "Auto" ? "on" : ""}>Auto</span>
                </span>
              </div>
            ))}
          </div>
          <div className="card never-card wash-mint" data-reveal>
            <span className="badge badge-lime" style={{ justifySelf: "start" }}>
              <Icon name="shield-check" /> Nothing goes out until you approve it
            </span>
            <ul className="never-list">
              {NEVER.map((n) => (
                <li key={n}>
                  <Icon name="check" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Trust() {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <Head label="Trust" title="Your data stays yours" />
        <div className="lp-grid-3">
          {TRUST.map((t) => (
            <article key={t.title} className="card trust-card" data-reveal>
              <span className="icon-box">
                <Icon name={t.icon} />
              </span>
              <h3 className="lp-h3" style={{ fontWeight: 600 }}>
                {t.title}
              </h3>
              <p className="lp-body lp-muted">{t.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Plans({ onAuth }: { onAuth: AuthFn }) {
  return (
    <section id="plans" className="lp-section">
      <div className="lp-wrap">
        <Head label="Plans" title="Start where you are" text="Pick a plan that fits the size of your team." center />
        <div className="lp-grid-3">
          {PLANS.map((p) => (
            <article key={p.name} className={`card plan-card ${p.wash}${p.featured ? " is-featured" : ""}`} data-reveal>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <h3 className="lp-h2" style={{ fontSize: 28, letterSpacing: -0.6 }}>
                  {p.name}
                </h3>
                {p.featured ? <span className="badge badge-lime">Popular</span> : null}
              </div>
              <p className="lp-body lp-muted">{p.who}</p>
              <ul className="plan-list">
                {p.items.map((it) => (
                  <li key={it}>
                    <Icon name="check" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <button className={`btn btn-block${p.featured ? " btn-dark" : ""}`} onClick={() => onAuth("signup")}>
                {p.cta}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ onAuth }: { onAuth: AuthFn }) {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <div className="lp-final" data-reveal>
          <span className="badge badge-lime">Ready when you are</span>
          <h2 className="lp-h2" style={{ maxWidth: 720 }}>
            Grow your pipeline without growing headcount
          </h2>
          <p className="lp-sub lp-muted" style={{ maxWidth: 560 }}>
            Hire your first agent in a few minutes. Give it one sentence, and watch it work.
          </p>
          <button className="btn btn-dark btn-lg" onClick={() => onAuth("signup")}>
            Get started <Icon name="arrow-right" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-row">
        <span className="lp-brand">
          <Image src="/logo-a.png" alt="" width={22} height={22} />
          <span style={{ fontSize: 14 }}>© 2026 Agentic Sales Team</span>
        </span>
        <nav className="lp-footer-links" aria-label="Footer">
          {FOOTER_LINKS.map((l) => (
            <a key={l} href="#" onClick={(e) => e.preventDefault()}>
              {l}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
