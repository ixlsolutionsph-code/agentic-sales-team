"use client";

import { useApp } from "@/lib/store";

// A button that opens the global "Create a team" modal.
export default function CreateTeamButton({ label, className = "btn btn-accent" }: { label: string; className?: string }) {
  const { openTeamModal } = useApp();
  return (
    <button type="button" className={className} onClick={() => openTeamModal()}>
      {label}
    </button>
  );
}
