"use client";

import { useEffect } from "react";
import PageError from "@/components/PageError";
import "./globals.css";

// The root layout itself failed: same message, with its own page.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <div className="page">
          <PageError onRetry={reset} />
        </div>
      </body>
    </html>
  );
}
