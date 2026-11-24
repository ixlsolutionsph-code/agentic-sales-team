import type { IconName } from "./Icon";
import type { AgentKey } from "@/lib/landing";

// All landing page copy lives here so it is easy to find and change.

export const NAV_LINKS = [
  { href: "#agents", label: "Agents" },
  { href: "#how", label: "How it works" },
  { href: "#control", label: "Control" },
  { href: "#plans", label: "Plans" },
];

export const HERO_STRIP: { icon: IconName; label: string }[] = [
  { icon: "search", label: "Finds leads" },
  { icon: "user-check", label: "Checks the fit" },
  { icon: "pen-line", label: "Writes emails" },
  { icon: "calendar", label: "Books meetings" },
];

export const AGENTS: Record<AgentKey, { name: string; role: string; line: string; skills: string[]; wash: string }> = {
  theo: {
    name: "Theo",
    role: "Lead Scout",
    line: "Searches Facebook, Reddit, X and LinkedIn for people who need what you sell.",
    skills: ["Lead scraping"],
    wash: "wash-sky",
  },
  pat: {
    name: "Pat",
    role: "Assessor",
    line: "Checks every new lead against your goal and tells you why it fits, in one line.",
    skills: ["Lead assessment", "Research"],
    wash: "wash-peach",
  },
  maya: {
    name: "Maya",
    role: "Outreach Writer",
    line: "Writes a personal first email for each lead, based on the products you really sell.",
    skills: ["Email drafting", "Proposals"],
    wash: "wash-mint",
  },
  sam: {
    name: "Sam",
    role: "Meeting Booker",
    line: "Books the meeting when you say “tomorrow at 2pm”, inside your working hours.",
    skills: ["Meeting booking"],
    wash: "wash-purple",
  },
};

export const AGENT_ORDER: AgentKey[] = ["theo", "pat", "maya", "sam"];

export const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "search",
    title: "Research",
    text: "Tell your team who you want to reach. Your agents search the public web and learn about each lead.",
  },
  {
    icon: "target",
    title: "Qualify",
    text: "Each lead gets a score and a short reason. Sellers, competitors and job seekers are dropped.",
  },
  {
    icon: "pen-line",
    title: "Write",
    text: "Your agents match each lead to the right product and draft a personal email and proposal.",
  },
  {
    icon: "repeat",
    title: "Follow up",
    text: "Mark an email as sent, book the meeting, and see every lead move through your pipeline.",
  },
];

export const INBOX: { icon: IconName; title: string; text: string; agent: AgentKey; msg: string }[] = [
  {
    icon: "circle-check",
    title: "Approvals",
    text: "Before each step, your agent asks: Proceed or Cancel?",
    agent: "theo",
    msg: "I'm ready to search for HR managers in Manila. Proceed?",
  },
  {
    icon: "message-circle",
    title: "Replies",
    text: "Ask “any updates?” and get a straight answer about real work.",
    agent: "maya",
    msg: "I drafted 9 emails this morning. They're waiting for you.",
  },
  {
    icon: "user-check",
    title: "Lead reviews",
    text: "New leads wait in a queue until you or your Assessor accept them.",
    agent: "pat",
    msg: "12 new leads need a review. 9 look like a good fit.",
  },
  {
    icon: "triangle-alert",
    title: "Problems",
    text: "If a step can't run, your agent stops and tells you why.",
    agent: "sam",
    msg: "Friday 7pm is outside your booking hours. Pick another time?",
  },
];

export const RULES: { label: string; value: "Ask" | "Auto" }[] = [
  { label: "Search for new leads", value: "Ask" },
  { label: "Review new leads", value: "Auto" },
  { label: "Draft outreach emails", value: "Ask" },
  { label: "Book meetings", value: "Ask" },
];

export const NEVER: string[] = [
  "Nothing is sent from the app. Every email is a draft.",
  "You open each draft in your own email app and send it yourself.",
  "Press Cancel at any time. Every waiting step stops, and you get a summary.",
];

export const TRUST: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "building-2",
    title: "One workspace per business",
    text: "Each workspace has its own agents, leads, products and chats. Nothing crosses over.",
  },
  {
    icon: "send",
    title: "You send every email",
    text: "The app can't see your mailbox and never sends on your behalf.",
  },
  {
    icon: "database",
    title: "Only real numbers",
    text: "There is no demo data. Every lead, draft and number comes from work your team really did.",
  },
];

export const PLANS: { name: string; who: string; wash: string; featured?: boolean; cta: string; items: string[] }[] = [
  {
    name: "Starter",
    who: "For solo sellers and small businesses.",
    wash: "",
    cta: "Get started",
    items: ["A team of agents in one chat", "Lead search on the public web", "Email drafts you approve and send"],
  },
  {
    name: "Growth",
    who: "For growing teams with more than one business.",
    wash: "wash-mint",
    featured: true,
    cta: "Get started",
    items: ["Everything in Starter", "Up to 10 workspaces", "Products catalog matching", "Proposals and meeting booking"],
  },
  {
    name: "Enterprise",
    who: "For larger sales teams.",
    wash: "",
    cta: "Talk to us",
    items: ["Everything in Growth", "Help setting up your teams", "Priority support"],
  },
];

export const FOOTER_LINKS = ["Privacy", "Terms", "Contact"];
