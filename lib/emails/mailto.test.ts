import { describe, expect, it } from "vitest";
import { MAILTO_BODY_MAX, copyText, filterDrafts, mailtoLink, toLine } from "./mailto";

describe("open in mail", () => {
  it("builds a mailto link with the subject and body encoded", () => {
    expect(mailtoLink("ana@x.com", "Hi & bye", "Line 1\nLine 2")).toBe("mailto:ana@x.com?subject=Hi%20%26%20bye&body=Line%201%0ALine%202");
  });

  it("refuses a missing or unsafe address", () => {
    expect(mailtoLink("", "s", "b")).toBeNull();
    expect(mailtoLink("ana@x.com?cc=evil@y.com", "s", "b")).toBeNull();
    expect(mailtoLink("not an email", "s", "b")).toBeNull();
  });

  it("cuts a very long body", () => {
    const link = mailtoLink("a@b.co", "s", "x".repeat(5000))!;
    expect(decodeURIComponent(link.split("body=")[1]).length).toBe(MAILTO_BODY_MAX + 1);
  });
});

describe("draft text", () => {
  it("copies the subject and body, and writes the To line", () => {
    expect(copyText("Hello", "Body")).toBe("Subject: Hello\n\nBody");
    expect(toLine({ leadName: "Ana", company: "Hospital", email: "ana@x.com", platform: null })).toBe("To Ana · Hospital · ana@x.com");
    expect(toLine({ leadName: "Gil", company: "", email: "", platform: "Reddit" })).toBe("To Gil · Reddit DM");
  });

  it("filters by tab, search and agent", () => {
    const list = [
      { status: "draft", agentId: "a", leadName: "Ana", company: "Hospital", subject: "Nurses", body: "x" },
      { status: "sent", agentId: "b", leadName: "Ben", company: "Clinic", subject: "Desk", body: "y" },
    ];
    expect(filterDrafts(list, "to-send", "", "").map((d) => d.leadName)).toEqual(["Ana"]);
    expect(filterDrafts(list, "sent", "", "").map((d) => d.leadName)).toEqual(["Ben"]);
    expect(filterDrafts(list, "all", "clinic", "").map((d) => d.leadName)).toEqual(["Ben"]);
    expect(filterDrafts(list, "all", "", "a").map((d) => d.leadName)).toEqual(["Ana"]);
  });
});
