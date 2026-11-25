"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { toastDuration } from "@/lib/toast";

// Bottom-centre message. Success shows 2600 ms, errors 4500 ms. Each message
// has its own timer, so an older message's timer never hides a newer one.
export default function Toast() {
  const { toast, clearToast } = useApp();

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => clearToast(toast.id), toastDuration(toast.error));
    return () => window.clearTimeout(id);
  }, [toast, clearToast]);

  return (
    <div className="toast-slot" role={toast?.error ? "alert" : "status"} aria-live={toast?.error ? "assertive" : "polite"}>
      {toast ? (
        <div key={toast.id} className={`toast${toast.error ? " is-error" : ""}`}>
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
