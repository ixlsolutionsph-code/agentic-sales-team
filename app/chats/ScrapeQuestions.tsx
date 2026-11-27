"use client";

import { useId, useState } from "react";
import { css } from "@/lib/css";
import { jsonMarker, type ScrapeBrief, type ScrapeBriefCard } from "@/lib/chat/markers";

// The search questions card (⟦scrape⟧, 03-user-journey.md J3 step 3): one
// question for each missing field. Send posts a short summary of the choice
// with ⟦answer:{kind:"scrape", brief}⟧.
const WHERE = ["Anywhere", "United States", "United Kingdom", "Europe"];
const COUNTS = [5, 10, 25];

export default function ScrapeQuestions({ card, disabled, onSend }: { card: ScrapeBriefCard; disabled?: boolean; onSend: (text: string) => void }) {
  const id = useId();
  const missing = card.missing ?? [];
  const [product, setProduct] = useState("");
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [count, setCount] = useState<number | null>(null);

  const need = (f: ScrapeBriefCard["missing"][number]) => missing.includes(f);
  const done =
    (!need("product") || !!product) && (!need("what") || !!what.trim()) && (!need("where") || !!where.trim()) && (!need("count") || count != null);

  function send() {
    if (!done || disabled) return;
    const brief: ScrapeBrief = { ...card.brief };
    const parts: string[] = [];
    if (need("product")) {
      brief.product = product;
      parts.push(`For: ${product}`);
    }
    if (need("what")) {
      brief.what = what.trim();
      parts.push(`Looking for: ${brief.what}`);
    }
    if (need("where")) {
      brief.where = where.trim();
      parts.push(`Where: ${brief.where}`);
    }
    if (need("count") && count != null) {
      brief.count = count;
      parts.push(`How many: ${count} leads`);
    }
    onSend(`${parts.join(" · ")}${jsonMarker("answer", { kind: "scrape", brief })}`);
  }

  return (
    <form
      className="chat-card"
      aria-label="Search questions"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {need("product") ? (
        <fieldset className="chat-q">
          <legend className="chat-q-label">Which product are these leads for?</legend>
          <Pills options={card.products ?? []} value={product} onPick={setProduct} disabled={disabled} />
        </fieldset>
      ) : null}
      {need("what") ? (
        <div className="chat-q">
          <label className="chat-q-label" htmlFor={`${id}-what`}>
            Who should I look for?
          </label>
          <input
            id={`${id}-what`}
            className="lp-input"
            value={what}
            maxLength={200}
            placeholder="For example, HR managers at hospitals"
            disabled={disabled}
            onChange={(e) => setWhat(e.target.value)}
          />
        </div>
      ) : null}
      {need("where") ? (
        <fieldset className="chat-q">
          <legend className="chat-q-label">Where should I look?</legend>
          <Pills options={WHERE} value={WHERE.includes(where) ? where : ""} onPick={setWhere} disabled={disabled} />
          <input
            className="lp-input"
            aria-label="Or type a place"
            placeholder="Or type a place"
            value={WHERE.includes(where) ? "" : where}
            maxLength={120}
            disabled={disabled}
            onChange={(e) => setWhere(e.target.value)}
          />
        </fieldset>
      ) : null}
      {need("count") ? (
        <fieldset className="chat-q">
          <legend className="chat-q-label">How many leads?</legend>
          <Pills
            options={COUNTS.map(String)}
            value={count == null ? "" : String(count)}
            onPick={(v) => setCount(Number(v))}
            disabled={disabled}
          />
        </fieldset>
      ) : null}
      <div className="chat-card-foot">
        <button type="submit" className="btn btn-sm btn-accent" disabled={!done || disabled}>
          Send
        </button>
      </div>
    </form>
  );
}

function Pills({ options, value, onPick, disabled }: { options: string[]; value: string; onPick: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="chat-pills">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={css("chat-pill", value === o && "is-on")}
          aria-pressed={value === o}
          disabled={disabled}
          onClick={() => onPick(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
