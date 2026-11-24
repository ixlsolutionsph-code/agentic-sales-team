"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { HERO_EMAIL_ERROR, isValidEmail } from "@/lib/landing";
import HeroDemo from "./HeroDemo";
import Icon from "./Icon";
import { HERO_STRIP } from "./content";

export default function Hero({
  onEmail,
  play,
  reduced,
}: {
  onEmail: (email: string) => void;
  play: boolean;
  reduced: boolean;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError(HERO_EMAIL_ERROR);
      return;
    }
    setError("");
    onEmail(email);
  }

  return (
    <section id="top" className="lp-hero">
      <div className="lp-wrap">
        <div className="lp-strip" data-hero>
          {HERO_STRIP.map((s) => (
            <span key={s.label} className="lp-strip-item">
              <span className="icon-box">
                <Icon name={s.icon} />
              </span>
              <span className="lp-label">{s.label}</span>
            </span>
          ))}
        </div>
        <div className="lp-trust" data-hero>
          <span className="lp-faces" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <Image key={n} src={`/landing/face${n}.jpg`} alt="" width={28} height={28} />
            ))}
          </span>
          <span className="badge">Trusted by 1,200+ sales teams</span>
        </div>
        <h1 className="lp-h1" data-hero>
          An AI sales team that works for you in chat
        </h1>
        <p className="lp-sub" data-hero>
          Your agents find leads, check the fit, write the emails and book the meetings. You approve each step and
          send every email yourself.
        </p>
        <form className="lp-hero-form" onSubmit={submit} noValidate data-hero>
          <label htmlFor="hero-email" className="sr-only">
            Work email
          </label>
          <input
            id="hero-email"
            className="lp-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            aria-invalid={error ? true : undefined}
            aria-describedby="hero-email-error"
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
          />
          <button type="submit" className="btn btn-dark btn-lg">
            Get started
          </button>
        </form>
        <p id="hero-email-error" className="lp-form-error" role="alert">
          {error}
        </p>
        <div className="lp-tilt">
          <div className="lp-tilt-inner" data-tilt>
            <HeroDemo play={play} reduced={reduced} />
          </div>
        </div>
      </div>
    </section>
  );
}
