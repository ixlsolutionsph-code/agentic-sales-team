// The full database schema: 19 tables, matching 04-erd.md.
// Every data table's `user_id` holds a WORKSPACE id (workspaces.id), not a users.id.
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------- accounts

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  workspaceName: text("workspace_name").notNull().default("My Workspace"),
  notifications: jsonb("notifications").$type<Record<string, boolean>>().notNull().default({}),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("workspaces_owner_id_idx").on(t.ownerId)],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(), // SHA-256 of the token
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const authRateLimits = pgTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: ts("window_start").notNull().defaultNow(),
});

// The workspace foreign key used by every data table.
const ws = () =>
  uuid("user_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

// ---------------------------------------------------------------- agents and teams

export const agents = pgTable(
  "agents",
  {
    userId: ws(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    role: text("role").notNull(),
    color: text("color").notNull(),
    status: text("status").notNull(),
    task: text("task").notNull(),
    score: integer("score").notNull(),
    goal: text("goal").notNull(),
    char: integer("char"),
    type: text("type").notNull().default("custom"),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const agentConfig = pgTable(
  "agent_config",
  {
    userId: ws(),
    agentId: text("agent_id").notNull(),
    role: text("role"),
    goal: text("goal"),
    permissions: jsonb("permissions").$type<Record<string, boolean>>(),
    settings: jsonb("settings").$type<Record<string, Record<string, unknown>>>(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.agentId] })],
);

export const agentStates = pgTable(
  "agent_states",
  {
    userId: ws(),
    agentId: text("agent_id").notNull(),
    removed: boolean("removed").notNull().default(false),
    paused: boolean("paused").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.agentId] })],
);

export const teams = pgTable(
  "teams",
  {
    userId: ws(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    iconBg: text("icon_bg").notNull(),
    description: text("description").notNull(),
    goal: text("goal").notNull(),
    members: jsonb("members").$type<string[]>().notNull().default([]),
    activity: jsonb("activity").$type<string[]>().notNull().default([]),
    meetings: integer("meetings").notNull().default(0),
    pipeline: text("pipeline").notNull().default("-"),
    leads: integer("leads").notNull().default(0),
    template: text("template").notNull().default("custom"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const teamMembers = pgTable(
  "team_members",
  {
    userId: ws(),
    teamId: text("team_id").notNull(),
    members: jsonb("members").$type<string[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.userId, t.teamId] })],
);

// ---------------------------------------------------------------- chat

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: ws(),
  agentId: text("agent_id").notNull(), // thread key; a team chat holds the team id
  who: text("who").notNull(),
  text: text("text").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- leads and work

export type LeadResearch = { summary: string; priorities: string[]; hooks: string[]; angle: string };

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ws(),
  agentId: text("agent_id").notNull(),
  name: text("name").notNull(),
  title: text("title").notNull().default(""),
  company: text("company").notNull().default(""),
  email: text("email").notNull(),
  status: text("status").notNull().default("new"),
  score: integer("score").notNull().default(0),
  source: text("source").notNull().default("manual"),
  review: text("review").notNull().default("accepted"),
  profileUrl: text("profile_url"),
  platform: text("platform"),
  research: jsonb("research").$type<LeadResearch>(),
  fitReason: text("fit_reason").notNull().default(""),
  qualifiedAt: ts("qualified_at"),
  matchedAt: ts("matched_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const outreachDrafts = pgTable(
  "outreach_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ws(),
    agentId: text("agent_id").notNull(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    rationale: text("rationale").notNull().default(""),
    status: text("status").notNull().default("draft"),
    dismissed: boolean("dismissed").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
  },
  (t) => [
    uniqueIndex("outreach_drafts_live_lead_idx")
      .on(t.leadId)
      .where(sql`${t.status} <> 'sent' AND ${t.dismissed} = false`),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ws(),
    agentId: text("agent_id").notNull(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    products: jsonb("products").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("draft"),
    createdAt: ts("created_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
  },
  (t) => [uniqueIndex("proposals_lead_id_idx").on(t.leadId)],
);

// ---------------------------------------------------------------- catalog

export const productFolders = pgTable("product_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ws(),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// The HNSW index products_embedding_idx is written by hand in a migration.
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ws(),
  folderId: uuid("folder_id").references(() => productFolders.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: text("price").notNull().default(""),
  category: text("category").notNull().default(""),
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ws(),
  agentId: text("agent_id").notNull(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(0),
  reason: text("reason").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ws(),
  agentId: text("agent_id").notNull(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Meeting"),
  whenAt: ts("when_at").notNull(),
  whenLabel: text("when_label").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- work queue and log

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ws(),
  agentId: text("agent_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("queued"),
  params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
  result: jsonb("result").$type<Record<string, unknown>>(),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
});

// Unused (left from an earlier scraper). Created so the schema matches.
export const jobSteps = pgTable("job_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  userId: ws(),
  idx: integer("idx").notNull(),
  caption: text("caption").notNull().default(""),
  url: text("url").notNull().default(""),
  screenshotPath: text("screenshot_path").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ws(),
  agentId: text("agent_id").notNull(),
  type: text("type").notNull(),
  leadId: uuid("lead_id"), // no FK on purpose
  text: text("text").notNull(),
  dismissed: boolean("dismissed").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});
