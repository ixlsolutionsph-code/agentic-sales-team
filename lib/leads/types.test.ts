import { describe, expect, it } from "vitest";
import {
  LEAD_STAGES,
  MSG_LEAD_CSV_EMPTY,
  MSG_LEAD_CSV_TOO_BIG,
  checkNewLead,
  importedText,
  leadTier,
  leadsFromCSV,
  nameFromEmail,
  nextStage,
} from "./types";

describe("lead stages", () => {
  it("goes new → contacted → engaged → replied → meeting, and stops there", () => {
    expect(LEAD_STAGES).toEqual(["new", "contacted", "engaged", "replied", "meeting"]);
    expect(nextStage("new")).toBe("contacted");
    expect(nextStage("replied")).toBe("meeting");
    expect(nextStage("meeting")).toBeNull();
    expect(nextStage("nope")).toBeNull();
  });

  it("names the tier from the score", () => {
    expect(leadTier(75)).toBe("Hot");
    expect(leadTier(50)).toBe("Warm");
    expect(leadTier(1)).toBe("Cold");
    expect(leadTier(0)).toBeNull();
  });
});

describe("adding a lead", () => {
  it("needs a name and a valid email", () => {
    expect(checkNewLead({ name: "", email: "a@b.co" })).toBe("A name is required.");
    expect(checkNewLead({ name: "Ana", email: "" })).toBe("An email is required.");
    expect(checkNewLead({ name: "Ana", email: "nope" })).toBe("Enter an email like name@company.com.");
    expect(checkNewLead({ name: " Ana​ Cruz ", email: " Ana@X.COM ", title: "HR", company: "St. Luke's" })).toEqual({
      name: "Ana Cruz",
      email: "ana@x.com",
      title: "HR",
      company: "St. Luke's",
    });
  });
});

describe("lead CSV", () => {
  it("reads aliases, fills a missing name from the email, and skips bad and repeated emails", () => {
    const csv = [
      "Full Name,E-mail,Job Title,Organisation,Phone",
      "Ana Cruz,ana@x.com,HR Manager,Hospital A,123",
      ",ben.lee@y.com,,,",
      "Copy,ANA@x.com,,,",
      "No Email,,,,",
      "Bad,not-an-email,,,",
    ].join("\n");
    expect(leadsFromCSV(csv)).toEqual({
      leads: [
        { name: "Ana Cruz", email: "ana@x.com", title: "HR Manager", company: "Hospital A" },
        { name: "ben.lee", email: "ben.lee@y.com", title: "", company: "" },
      ],
      skipped: 3,
    });
    expect(nameFromEmail("ana@x.com")).toBe("ana");
  });

  it("refuses an empty file, an unknown header and more than 500 rows", () => {
    expect(leadsFromCSV("")).toBe(MSG_LEAD_CSV_EMPTY);
    expect(leadsFromCSV("foo,bar\n1,2")).toBe(MSG_LEAD_CSV_EMPTY);
    const rows = (n: number) => "email\n" + Array.from({ length: n }, (_, i) => `p${i}@x.com`).join("\n");
    expect(leadsFromCSV(rows(501))).toBe(MSG_LEAD_CSV_TOO_BIG);
    expect((leadsFromCSV(rows(500)) as { leads: unknown[] }).leads).toHaveLength(500);
  });

  it('says "Imported N leads for {First}"', () => {
    expect(importedText(3, "Maya Santos")).toBe("Imported 3 leads for Maya");
    expect(importedText(1, "Sam")).toBe("Imported 1 lead for Sam");
  });
});
