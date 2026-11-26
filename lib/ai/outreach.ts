// Outreach: a first email (or a DM when there is no email) for one lead
// (01-prd.md §7.6). Temperature 0.6, 700 tokens, up to 3 catalog products.
// Formal, 90–140 words, plain text, "Dear {First},", signed with the agent's
// name, no slang, emojis, exclamation marks or placeholders, and a
// low-pressure call to action. It never changes the lead's stage.
import {
  SYSTEM_BASE,
  agentBlock,
  clampScore,
  firstNameOf,
  leadBlock,
  productsBlock,
  str,
  type AIJson,
  type EngineAgent,
  type EngineLead,
  type EngineProduct,
} from "./engine";

export type OutreachResult = { score: number; subject: string; body: string; rationale: string };
export const OUTREACH_PRODUCTS = 3;
export const TEMPLATE_MARK = "[Template draft: AI was not available. Please edit before sending.]";

const SCHEMA = {
  type: "object",
  properties: { score: { type: "integer" }, subject: { type: "string" }, body: { type: "string" }, rationale: { type: "string" } },
  required: ["score", "subject", "body", "rationale"],
};

// Emoji and pictographs.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

// Applies the house rules the model may have missed: no "!", no emoji, no
// [placeholders], the greeting and the signature.
export function tidyBody(body: string, lead: EngineLead, agent: EngineAgent, isEmail: boolean): string {
  let b = body.replace(EMOJI, "").replace(/!+/g, ".").replace(/\[[^\]\n]{1,40}\]/g, "").replace(/[ \t]+\n/g, "\n").trim();
  const first = firstNameOf(lead.name);
  if (isEmail) {
    // Greeting and sign-off on their own lines, even when the model wrote one block.
    b = b.replace(/^(Dear [^,\n]{1,60},)[ \t]*(?=\S)/i, "$1\n\n");
    b = b.replace(/(?<=\S)\s+(Sincerely|Kind regards|Best regards|Warm regards|Regards|Respectfully),[ \t]*(?=\S)/, "\n\n$1,\n");
    if (!/^dear\b/i.test(b)) b = `Dear ${first || "there"},\n\n${b}`;
    if (!b.slice(-120).includes(agent.name)) b = `${b}\n\nKind regards,\n${agent.name}`;
  }
  return b.replace(/\n{3,}/g, "\n\n").trim();
}

export function outreachFallback(lead: EngineLead, agent: EngineAgent, products: EngineProduct[]): OutreachResult {
  const first = firstNameOf(lead.name) || "there";
  const offer = products[0] ? ` such as ${products[0].name}` : "";
  const where = lead.company ? ` at ${lead.company}` : "";
  const body = lead.email
    ? `${TEMPLATE_MARK}\n\nDear ${first},\n\nI am reaching out because we help teams${where} with services${offer}. If it would be useful, I would be glad to share a short overview and answer any questions.\n\nWould you be open to a brief conversation in the coming weeks?\n\nKind regards,\n${agent.name}`
    : `${TEMPLATE_MARK}\n\nHi ${first}, I came across your post and thought our services${offer} might help. Would you be open to a short chat about it?`;
  return { score: lead.email ? 50 : 40, subject: lead.company ? `A quick idea for ${lead.company}` : "A quick idea for you", body, rationale: "Template used because AI was not available." };
}

export async function draftOutreach(lead: EngineLead, agent: EngineAgent, products: EngineProduct[], ai: AIJson | null): Promise<OutreachResult> {
  const offered = products.slice(0, OUTREACH_PRODUCTS);
  if (!ai) return outreachFallback(lead, agent, offered);
  const isEmail = Boolean(lead.email);
  const first = firstNameOf(lead.name);
  const rules = isEmail
    ? [
        `Write a first email to ${first || "the lead"}. Formal and warm, 90 to 140 words, plain text only.`,
        `Start with "Dear ${first || "Sir or Madam"}," and sign off with your name, ${agent.name}.`,
        "No slang, no emojis, no exclamation marks, and no placeholders such as [Company].",
        "Use the research if there is any. Mention at most the products below that really help them, by name. Never invent products, prices or facts.",
        "Layout: the greeting on its own line, then 2 or 3 short paragraphs separated by blank lines, then the sign-off and your name on their own lines.",
        "End with a low-pressure call to action, such as asking whether a short call would be useful.",
      ]
    : [
        `There is no email, so write a direct message of 2 to 4 sentences to ${first || "the lead"} on ${lead.platform || "their platform"}.`,
        "Friendly and professional. No emojis, no exclamation marks, no placeholders. Never invent products, prices or facts.",
      ];
  const prompt = [
    agentBlock(agent),
    ...rules,
    "subject: a short subject line. rationale: one sentence on why this angle. score: 1–100 how promising this lead looks.",
    "Lead:",
    leadBlock(lead),
    "Products you may mention:",
    productsBlock(offered),
  ].join("\n\n");
  const r = await ai<Record<string, unknown>>(SYSTEM_BASE, prompt, SCHEMA, { temperature: 0.6, maxTokens: 700 });
  const raw = str(r?.body, 3000);
  if (!raw) throw new Error("outreach: empty body");
  return {
    score: clampScore(r?.score, 1, 100),
    subject: (str(r?.subject, 160) || (lead.company ? `A quick idea for ${lead.company}` : "A quick idea for you")).replace(/!+/g, ""),
    body: tidyBody(raw, lead, agent, isEmail),
    rationale: str(r?.rationale, 400),
  };
}
