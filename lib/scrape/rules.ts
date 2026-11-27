// Extraction rules for the lead search (01-prd.md §7.3).

// A business hiring for the very role the user's product replaces is a buyer.
export const JOB_AD_RULE =
  "A business's own job post for the role the product replaces (for example a clinic hiring a receptionist when we sell virtual receptionists) counts as a buyer. " +
  "A person looking for a job is not a buyer.";

// When the user sells staff, other staffing firms are competitors, not buyers.
export const AGENCY_RULE =
  "When we sell staff or outsourced work, staffing agencies, virtual assistant agencies and BPOs are sellers, not buyers.";

export const EXTRACT_RULES = [
  "Only pick people or businesses on the buying side of the request: they need what we sell. Never pick people who sell it.",
  JOB_AD_RULE,
  AGENCY_RULE,
  "Skip posts that look older than about a month.",
  "Place: skip people who are clearly somewhere else. When a post does not say where the person is, keep them.",
  "Never invent an email. Give an email only when it is written in that source; otherwise leave it empty.",
  "A LinkedIn person needs a real employer. Skip people whose employer is missing or is a platform or a placeholder such as Shopify, Amazon, Etsy, Self-employed, Freelance or Confidential.",
  "Exclude recruiters, directories, lists, articles, news, job boards and ads.",
  "fitReason: one line under 20 words on why they fit, from what the source says.",
] as const;
