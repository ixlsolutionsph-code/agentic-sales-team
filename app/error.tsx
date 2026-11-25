"use client";

import { useEffect } from "react";
import PageError from "@/components/PageError";

// A page failed: show "This page didn't load" inside the shell.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="page">
      <PageError onRetry={reset} />
    </div>
  );
}
