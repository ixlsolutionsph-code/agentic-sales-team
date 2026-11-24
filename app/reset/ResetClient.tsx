"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { resetPassword, validateResetToken } from "@/lib/auth/actions";
import { callAction } from "@/lib/auth/call-action";
import { MIN_PASSWORD, MSG } from "@/lib/auth/rules";

type State = "checking" | "invalid" | "error" | "form" | "done";

export default function ResetClient({ token }: { token: string }) {
  const [state, setState] = useState<State>(token ? "checking" : "invalid");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    callAction(() => validateResetToken(token)).then((res) => {
      if (!res.ok) setState("error");
      else setState(res.data?.valid ? "form" : "invalid");
    });
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < MIN_PASSWORD) return setError(MSG.shortPassword);
    if (pw !== pw2) return setError(MSG.passwordsDiffer);
    setBusy(true);
    const res = await callAction(() => resetPassword({ token, password: pw }));
    setBusy(false);
    if (!res.ok) {
      if (res.error === "Link expired or invalid") setState("invalid");
      else setError(res.error);
      return;
    }
    setState("done");
  }

  return (
    <main className="auth">
      <div className="card auth-card">
        <Image src="/logo-mark.png" alt="" width={40} height={40} />
        {state === "checking" ? <p className="lp-body">Checking your reset link…</p> : null}
        {state === "invalid" ? (
          <>
            <h1 className="lp-h2" style={{ fontSize: 28 }}>
              Link expired or invalid
            </h1>
            <a className="btn" href="/">
              Go to login
            </a>
          </>
        ) : null}
        {state === "error" ? (
          <>
            <h1 className="lp-h2" style={{ fontSize: 28 }}>
              Couldn&apos;t check your link
            </h1>
            <p className="lp-body lp-muted">{MSG.serverDown}</p>
          </>
        ) : null}
        {state === "form" ? (
          <form onSubmit={submit} style={{ display: "grid", gap: 16 }} noValidate>
            <h1 className="lp-h2" style={{ fontSize: 28 }}>
              Set a new password
            </h1>
            <label className="auth-field">
              <span className="lp-label">New password</span>
              <input className="lp-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <label className="auth-field">
              <span className="lp-label">Confirm password</span>
              <input className="lp-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <button className="btn btn-accent btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? "Working…" : "Update password"}
            </button>
          </form>
        ) : null}
        {state === "done" ? (
          <>
            <h1 className="lp-h2" style={{ fontSize: 28 }}>
              Password updated
            </h1>
            <a className="btn btn-accent" href="/">
              Go to login
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}
