"use client";

import Image from "next/image";
import Icon from "./Icon";

// A stand-in for the real log in and sign-up screen. Milestone 2 replaces it.
export default function AuthPlaceholder({
  mode,
  email,
  onBack,
}: {
  mode: "login" | "signup";
  email: string;
  onBack: () => void;
}) {
  const signup = mode === "signup";
  return (
    <main className="auth">
      <div className="card auth-card">
        <Image src="/logo-mark.png" alt="" width={40} height={40} />
        <h1 className="lp-h2" style={{ fontSize: 32, letterSpacing: -0.7 }}>
          {signup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="lp-body lp-muted">
          {signup
            ? "Set up your workspace and meet your first agent in a few minutes."
            : "Log in to see what your agents did while you were away."}
        </p>
        {email ? (
          <div className="auth-field">
            <span className="lp-label lp-label-muted">Work email</span>
            <input className="lp-input" value={email} readOnly aria-label="Work email" />
          </div>
        ) : null}
        <p className="badge" style={{ justifySelf: "start", margin: 0 }}>
          <Icon name="clock" /> Sign-up is coming soon
        </p>
        <button className="btn" onClick={onBack}>
          Back to the home page
        </button>
      </div>
    </main>
  );
}
