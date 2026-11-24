"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { requestPasswordReset, signIn, signUp } from "@/lib/auth/actions";
import { callAction } from "@/lib/auth/call-action";
import { MIN_PASSWORD, MSG, STRENGTH_LABELS, cleanEmail, isEmail, passwordStrength } from "@/lib/auth/rules";

export type LoginMode = "login" | "signup" | "reset";

const TITLES: Record<LoginMode, [string, string]> = {
  login: ["Welcome back", "Log in to see what your agents did while you were away."],
  signup: ["Create your account", "Set up your workspace and meet your first agent in a few minutes."],
  reset: ["Reset your password", "Enter the work email you signed up with."],
};

export default function Login({
  initialMode,
  initialEmail = "",
  onBack,
}: {
  initialMode: LoginMode;
  initialEmail?: string;
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const strength = passwordStrength(password);

  function go(next: LoginMode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state !== "idle") return;
    setError("");
    setNotice("");

    // Quick checks before calling the server.
    const em = cleanEmail(email);
    if (mode === "signup" && !name.trim()) return setError(MSG.noName);
    if (!isEmail(em)) return setError(MSG.badEmail);
    if (mode === "signup" && password.length < MIN_PASSWORD) return setError(MSG.shortPassword);

    setState("working");
    const res = await callAction(() =>
      mode === "signup"
        ? signUp({ name, email: em, password })
        : mode === "login"
          ? signIn({ email: em, password })
          : requestPasswordReset({ email: em }),
    );
    if (!res.ok) {
      setState("idle");
      setError(res.error);
      return;
    }
    if (mode === "reset") {
      setState("idle");
      setNotice(MSG.resetOff);
      return;
    }
    setState("done");
    try {
      sessionStorage.removeItem("ast.signupEmail");
    } catch {
      // ignore
    }
    window.setTimeout(() => window.location.assign("/"), 350);
  }

  const [title, sub] = TITLES[mode];
  const busy = state !== "idle";
  const buttonText =
    state === "working"
      ? "Working…"
      : state === "done"
        ? "Done"
        : mode === "signup"
          ? "Create account"
          : mode === "login"
            ? "Log in"
            : "Reset password";

  return (
    <main className="auth">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <Image src="/logo-mark.png" alt="" width={40} height={40} />
        <div style={{ display: "grid", gap: 6 }}>
          <h1 className="lp-h2" style={{ fontSize: 32 }}>
            {title}
          </h1>
          <p className="lp-body lp-muted">{sub}</p>
        </div>

        {mode === "signup" ? (
          <label className="auth-field">
            <span className="lp-label">Full name</span>
            <input
              className="lp-input"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>
        ) : null}

        <label className="auth-field">
          <span className="lp-label">Work email</span>
          <input
            className="lp-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>

        {mode !== "reset" ? (
          <label className="auth-field">
            <span className="auth-row">
              <span className="lp-label">Password</span>
              {mode === "login" ? (
                <button type="button" className="auth-link" onClick={() => go("reset")}>
                  Forgot password?
                </button>
              ) : null}
            </span>
            <input
              className="lp-input"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            {mode === "signup" ? (
              <span className="strength" aria-live="polite">
                <span className="strength-bars" aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => (
                    <span key={n} className={n <= strength ? `on s${strength}` : ""} />
                  ))}
                </span>
                <span className="strength-label">{STRENGTH_LABELS[strength] || `At least ${MIN_PASSWORD} characters`}</span>
              </span>
            ) : null}
          </label>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        ) : null}

        <button type="submit" className="btn btn-accent btn-lg btn-block" disabled={busy}>
          {buttonText}
        </button>

        <p className="lp-body lp-muted" style={{ textAlign: "center", fontSize: 15 }}>
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button type="button" className="auth-link" onClick={() => go("login")}>
                Log in
              </button>
            </>
          ) : mode === "login" ? (
            <>
              New here?{" "}
              <button type="button" className="auth-link" onClick={() => go("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <button type="button" className="auth-link" onClick={() => go("login")}>
              Back to log in
            </button>
          )}
        </p>
        {onBack ? (
          <button type="button" className="auth-link" style={{ justifySelf: "center" }} onClick={onBack}>
            Back to the home page
          </button>
        ) : null}
      </form>
    </main>
  );
}
