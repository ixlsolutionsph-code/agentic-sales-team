"use client";

import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import { css } from "@/lib/css";

// Active / Pending tabs with their empty states. Milestone 6 adds the tables.
export default function LeadsEmpty() {
  const [tab, setTab] = useState<"active" | "pending">("active");
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Leads">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          className={css("tab", tab === "active" && "is-on")}
          onClick={() => setTab("active")}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pending"}
          className={css("tab", tab === "pending" && "is-on")}
          onClick={() => setTab("pending")}
        >
          Pending <span className="tab-count">0</span>
        </button>
      </div>
      <div role="tabpanel">
        {tab === "active" ? (
          <EmptyState icon="leads" title="No leads yet." />
        ) : (
          <EmptyState icon="leads" title="No candidates awaiting review." />
        )}
      </div>
    </>
  );
}
