// The agent page's sections. A section tied to capabilities only shows when
// the agent has at least one of them (02-sitemap.md §6 /agents/[id]).

export type SectionId =
  | "overview"
  | "leads"
  | "research"
  | "emails"
  | "proposals"
  | "reach-outs"
  | "meetings"
  | "tasks"
  | "performance"
  | "configuration";

const SECTIONS: { id: SectionId; label: string; caps?: string[] }[] = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads", caps: ["scrape", "qualify"] },
  { id: "research", label: "Research", caps: ["research"] },
  { id: "emails", label: "Emails", caps: ["outreach"] },
  { id: "proposals", label: "Proposals", caps: ["proposal"] },
  { id: "reach-outs", label: "Reach Outs", caps: ["follow-up"] },
  { id: "meetings", label: "Meetings", caps: ["book-meeting"] },
  { id: "tasks", label: "Tasks" },
  { id: "performance", label: "Performance" },
  { id: "configuration", label: "Configuration" },
];

export function agentSections(capabilities: string[]): { id: SectionId; label: string }[] {
  const have = new Set(capabilities);
  return SECTIONS.filter((s) => !s.caps || s.caps.some((c) => have.has(c))).map(({ id, label }) => ({ id, label }));
}
