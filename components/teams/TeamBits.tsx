// Small pieces for showing teams: the icon tile, the icon picker and the
// coverage chips.
import { capabilityLabel } from "@/lib/agentTypes";
import { css } from "@/lib/css";
import { TEAM_ICONS, iconBg } from "@/lib/teams/new";

export function TeamIcon({ icon, size = 40 }: { icon: string; size?: number }) {
  return (
    <span className="team-icon" style={{ width: size, height: size, fontSize: Math.round(size * 0.5), background: iconBg(icon) }} aria-hidden="true">
      {icon}
    </span>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <fieldset className="team-fieldset">
      <legend className="lp-label">Icon</legend>
      <div className="icon-picks" role="radiogroup" aria-label="Icon">
        {TEAM_ICONS.map((i) => {
          const on = value === i.icon;
          return (
            <button
              key={i.icon}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Icon ${i.icon}`}
              className={css("icon-pick", on && "is-on")}
              style={{ background: i.bg }}
              onClick={() => onChange(i.icon)}
            >
              <span aria-hidden="true">{i.icon}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// "✓ cap" when a member has the capability, "○ cap" (or "missing cap") when not.
export function CoverageChip({ cap, covered, missingWord = false }: { cap: string; covered: boolean; missingWord?: boolean }) {
  return (
    <span className={css("cov-chip", covered ? "is-covered" : "is-missing")}>
      {covered ? (
        <span aria-hidden="true">✓</span>
      ) : missingWord ? (
        <span>missing</span>
      ) : (
        <span aria-hidden="true">○</span>
      )}
      {!covered && !missingWord ? <span className="sr-only">missing</span> : null}
      <span>{capabilityLabel(cap)}</span>
    </span>
  );
}

export function SoonChip({ cap }: { cap: string }) {
  return (
    <span className="cov-chip is-soon">
      <span>{capabilityLabel(cap)}</span>
      <span className="cap-soon">· soon</span>
    </span>
  );
}
