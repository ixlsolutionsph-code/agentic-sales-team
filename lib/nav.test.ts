import { describe, expect, it } from "vitest";
import { activeNav, badgeText, headerTitle, initialsOf, NAV_LINKS } from "./nav";

describe("sidebar and header", () => {
  it("lists the sidebar pages in order", () => {
    expect(NAV_LINKS.map((l) => l.label)).toEqual(["Dashboard", "Leads", "Emails", "Products", "Calendar"]);
  });

  it("highlights Dashboard on dashboard, team and agent pages", () => {
    expect(activeNav("/dashboard")).toBe("dashboard");
    expect(activeNav("/teams/abc")).toBe("dashboard");
    expect(activeNav("/agents")).toBe("dashboard");
    expect(activeNav("/agents/x1")).toBe("dashboard");
  });

  it("highlights the matching link and nothing on other pages", () => {
    expect(activeNav("/leads")).toBe("leads");
    expect(activeNav("/emails")).toBe("emails");
    expect(activeNav("/products")).toBe("products");
    expect(activeNav("/calendar")).toBe("calendar");
    expect(activeNav("/")).toBeNull();
    expect(activeNav("/chats")).toBeNull();
    expect(activeNav("/settings")).toBeNull();
    expect(activeNav("/leadsx")).toBeNull();
  });

  it("gives each page its header title", () => {
    expect(headerTitle("/")).toBe("");
    expect(headerTitle("/chats")).toBe("");
    expect(headerTitle("/dashboard")).toBe("Dashboard");
    expect(headerTitle("/teams/t1")).toBe("Team details");
    expect(headerTitle("/agents/x1")).toBe("Agent details");
    expect(headerTitle("/agents")).toBe("Agents");
    expect(headerTitle("/calendar")).toBe("Calendar");
    expect(headerTitle("/settings")).toBe("Settings");
    expect(headerTitle("/leads")).toBe("Leads");
    expect(headerTitle("/emails")).toBe("Emails");
    expect(headerTitle("/products")).toBe("Products");
  });

  it("caps badges at 99+ and hides zero", () => {
    expect(badgeText(0)).toBe("");
    expect(badgeText(5)).toBe("5");
    expect(badgeText(99)).toBe("99");
    expect(badgeText(100)).toBe("99+");
  });

  it("makes initials", () => {
    expect(initialsOf("Maya Cruz")).toBe("MC");
    expect(initialsOf("  theo ")).toBe("T");
    expect(initialsOf("Ana de la Cruz")).toBe("AC");
    expect(initialsOf("")).toBe("?");
  });
});
