// Small pieces for showing agents: avatar, status pill and capability chips.
import { css } from "@/lib/css";
import { avatarStyle, chip, statusPill, type AgentStatus } from "@/lib/visuals";

export function AgentAvatar({
  agent,
  size = 40,
}: {
  agent: { id: string; char: number | null; color: string; name?: string };
  size?: number;
}) {
  return <span className="agent-avatar" style={{ ...avatarStyle(agent), width: size, height: size }} aria-hidden="true" />;
}

export function StatusPill({ status }: { status: AgentStatus }) {
  const p = statusPill(status);
  return <span className={css("pill", `pill-${p.tone}`)}>{p.label}</span>;
}

// A capability chip. "Soon" capabilities are flagged.
export function CapChip({ cap }: { cap: string }) {
  const c = chip(cap);
  return (
    <span className={css("cap-chip", c.soon && "is-soon")}>
      {c.label}
      {c.soon ? <span className="cap-soon"> · soon</span> : null}
    </span>
  );
}

export function CapChips({ caps, empty = "No capabilities" }: { caps: string[]; empty?: string }) {
  if (!caps.length) return <span className="cap-none">{empty}</span>;
  return (
    <span className="cap-chips">
      {caps.map((c) => (
        <CapChip key={c} cap={c} />
      ))}
    </span>
  );
}
