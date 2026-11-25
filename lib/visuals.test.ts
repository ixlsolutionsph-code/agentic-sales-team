import { describe, expect, it } from "vitest";
import { agentCharIndex, avatarStyle, chip, hashId, statusPill } from "./visuals";

describe("agent visuals", () => {
  it("uses the chosen character, wrapping at 4", () => {
    expect(agentCharIndex({ id: "x1", char: 0 })).toBe(0);
    expect(agentCharIndex({ id: "x1", char: 3 })).toBe(3);
    expect(agentCharIndex({ id: "x1", char: 6 })).toBe(2);
  });

  it("falls back to a stable hash of the id", () => {
    const a = agentCharIndex({ id: "xabc123", char: null });
    expect(a).toBe(hashId("xabc123") % 4);
    expect(agentCharIndex({ id: "xabc123", char: null })).toBe(a);
  });

  it("styles the avatar with a faint colour and the picture at 114%", () => {
    const s = avatarStyle({ id: "x", char: 2, color: "#006AFF" });
    expect(s.backgroundColor).toBe("#006AFF26");
    expect(s.backgroundImage).toBe("url(/agents/maya.jpg)");
    expect(s.backgroundSize).toBe("114%");
  });

  it("labels status pills and soon chips", () => {
    expect(statusPill("waiting").label).toBe("Paused");
    expect(statusPill("idle").label).toBe("Idle");
    expect(statusPill("working").label).toBe("Working");
    expect(chip("follow-up")).toEqual({ label: "Follow-ups", soon: true });
    expect(chip("scrape")).toEqual({ label: "Lead scraping", soon: false });
  });
});
