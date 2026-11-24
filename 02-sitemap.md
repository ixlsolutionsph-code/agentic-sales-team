# Sitemap: Agentic Sales Team

| | |
|---|---|
| **Status** | Build spec, matches `origin/main` at PR #163 (commit `d3c6ff6`) |
| **Last updated** | 2026-11-17 |
| **Source** | `app/`, `components/`, `middleware.ts` |

Every page, overlay and route, and how they connect. **[F#]** points to the feature table in `01-prd.md` §6. Build exactly these pages. Do not add others.

---

## 1. The map

```
SIGNED OUT
/                     Landing page                                         [F1]
├── (in place)        Log in · Create account · Reset your password       [F1]
/reset?token=…        Set a new password (public)                          [F1]

SIGNED IN  (all inside the App shell, except /create)
┌─ App shell ───────────────────────────────────────────────────────────────────────┐
│ Sidebar: Search · New chat · Dashboard · Leads (n) · Emails (n) · Products ·       │
│          Calendar · Recent chats · Workspace menu · Account menu                   │
│ Header:  page title · Notifications bell · + Add agent                             │
│                                                                                    │
│ /                 ★ CHAT HOME "What should your team work on?"          [F5]      │
│   ├── (in place)  Hire your first agent (no agents)                     [F3]      │
│   └── (carousel)  Approvals waiting / tips                              [F9]      │
│ /chats            ★ TEAM CHAT, one team's thread                        [F5]      │
│   ├── (card)      Search questions (product · who · where · how many)   [F6]      │
│   ├── (card)      Proceed / Cancel                                      [F9]      │
│   ├── (card)      Live timeline of a run                                [F6,F8]   │
│   ├── (card)      New leads ──> (modal) Lead overview                   [F7]      │
│   ├── (card)      Lead picker: who to meet / who to write to            [F11,F12] │
│   ├── (buttons)   Quick replies                                         [F5]      │
│   └── (popup)     @mention list · /lead picker                          [F5]      │
│ /dashboard        Goal ring of agents + team cards                      [F14]     │
│ /teams/[id]       Team: KPIs · coverage · members · leads · approvals   [F4,F9]   │
│   ├── (modal)     Add agents                                            [F4]      │
│   └── (modal)     Edit team                                             [F4]      │
│ /agents           Agent cards                                           [F3]      │
│ /agents/[id]      Agent page: sections, run buttons, Configuration      [F3,F9]   │
│ /leads            Active · Pending                                      [F7,F13]  │
│   ├── (modal)     Add a lead                                            [F13]     │
│   └── (modal)     Lead details · Book a meeting                         [F12,F13] │
│ /emails           To send · Sent · All                                  [F11]     │
│ /products         Folders ──> products                                  [F10]     │
│   ├── (modal)     New folder                                            [F10]     │
│   └── (modal)     Add a product                                         [F10]     │
│ /calendar         Booked meetings, Week or Month                        [F12]     │
│ /settings         Workspace name · your name                            [F2]      │
│                                                                                    │
│ (modal, global)   Create a team                                         [F4]      │
│ (menu)            Workspaces: list · + New workspace · settings         [F2]      │
│ (panel)           Notifications                                         [F14]     │
│ (dropdown)        Search results: agents · teams · leads · products     [F14]     │
│ (toast)           Success / error                                                 │
└────────────────────────────────────────────────────────────────────────────────────┘
/create              Add new agent: 5-step wizard, full screen, no shell   [F3]

API
/api/scrape          POST, session          run one search now
/api/jobs/run        POST, session          run up to 5 queued jobs
/api/cron/jobs       GET, CRON_SECRET        run up to 50 queued jobs, all workspaces
/api/cron/scrape     GET, CRON_SECRET        run 1 queued search, any workspace
```

---

## 2. Access rules

| Rule | Where |
|---|---|
| `/` and `/reset` are public; `/api/cron/jobs` and `/api/cron/scrape` skip the session check and check `CRON_SECRET` themselves | `middleware.ts` |
| Every other path with no valid `session` cookie redirects to `/` | `middleware.ts` |
| Middleware skips `_next/static`, `_next/image`, `favicon.ico` and image/font files | `middleware.ts` matcher |
| Signed out on `/`: Landing, or Login once a Log in / Get started button is pressed (URL stays `/`) | `components/AppFrame.tsx` |
| Signed in on `/`: Chat home | `app/page.tsx` |
| `/create` renders with no shell; every other signed-in page renders inside the shell | `AppFrame.tsx` |
| Every page shows only the active workspace's data | Server code |

---

## 3. How you move between pages

| From | To | When |
|---|---|---|
| Landing | Login (same URL) | Log in, Get started, a plan button, or the hero email form (the email is carried to sign-up) |
| Login | Chat home | Signed in or signed up (full reload after 350 ms) |
| Any app page | Landing | Log out, or the session ends |
| Chat home | `/chats` | A message is sent to an agent that is on a team, or an approval slide is clicked |
| Chat home | Create a team (modal) | The chosen agent is on no team |
| Chat home | `/create` | "Add an agent" with no agents yet |
| Sidebar "New chat" | Chat home | Any time |
| Sidebar "Recent chats" | `/chats` | A team row is clicked |
| Header "+ Add agent" | `/create` | Any app page |
| `/create` | `/agents/[id]` or `/agents` | "View agent →" or "Back to agents" (or ✕) |
| `/dashboard` | `/teams/[id]`, `/agents/[id]` | A team card or an agent on the ring |
| Create a team | `/teams/[id]` | The team is created |
| `/teams/[id]` | `/dashboard` | "← Dashboard", or the team is deleted |
| `/agents/[id]` | `/agents` | "← All agents", or the agent is deleted |
| `/chats` | `/leads`, `/products`, `/emails`, `/calendar` | A linked phrase in an agent message ("the leads", "your catalog", "drafts", "calendar") or "Open in Leads →" |
| Notifications | `/agents/[id]` | A row is clicked |
| Search | `/agents/[id]`, `/teams/[id]`, `/leads`, `/products` | A result is picked (leads and products open the list) |
| Workspace menu | `/` | Switch or create (full reload) |
| Account menu | `/settings`, `/agents`, Landing | Settings, Agents, Log out |

---

## 4. Rules the map follows

| Rule | Why |
|---|---|
| Chat home is the first page after sign-in | The product is run by talking to a team [F5] |
| Chat home and the team chat get the most design time | Searches, approvals, hand-offs and results all happen there |
| The wizard is full screen with no shell | Nothing pulls the user out of creating an agent [F3] |
| Approvals show in the chat, on chat home and on the team page | A waiting step is hard to miss [F9] |
| No page sends anything | The user sends from their own mail app [F11] |
| A run started in chat keeps going with the tab closed | The per-minute cron picks it up [F8] |

---

## 5. The app shell

**Sidebar** (272 px, collapses to a 64 px rail, a drawer on mobile):

| # | Item | Goes to | Badge |
|---|---|---|---|
| 1 | Logo + "Agentic Sales Team" | `/` | |
| 2 | Search | dropdown | |
| 3 | New chat | `/` | |
| 4 | Dashboard | `/dashboard` (also active on `/teams/*` and `/agents/*`) | |
| 5 | Leads | `/leads` | pending-review count |
| 6 | Emails | `/emails` | unsent drafts |
| 7 | Products | `/products` | |
| 8 | Calendar | `/calendar` | |
| 9 | Recent chats | one row per team → `/chats` | unread count (caps at "99+"); hover trash → "Delete history?" |
| 10 | Workspace menu | list (active ticked), "New workspace", "Workspace settings" | |
| 11 | Account row | menu: Settings, Agents, Log out | |

Nav counts refresh every 30 s, on focus and on route change.

**Header** (60 px): title (none on `/` and `/chats`; else Dashboard, Team details, Agent details, Agents, Calendar, Settings, Leads, Emails, Products) · Notifications bell · black "+ Add agent" pill.

**Notifications bell:** last 12 undismissed `activity` rows, polled every 30 s. Pink count badge for rows not seen since the panel was last opened. Panel: "Clear all", per-row ×, rows link to the agent. Empty: "No recent activity."

**Global search:** agents (≤ 5) and teams (≤ 4) filtered in the browser; leads and products (5 each) from the server, debounced 200 ms, at least 2 characters. Empty: "No matches for "q"".

**Browser tab:** a red dot on the favicon when a team other than the open one has unread messages.

---

## 6. Page by page

### `/` Landing (signed out)
| | |
|---|---|
| **Job** | Explain the product and start sign-up |
| **Sections, in order** | Loader (≥ 3 s, 250 ms with reduced motion) · sticky nav (Agents, How it works, Control, Plans, Log in, Get started) · Hero "An AI sales team that works for you in chat" with badge "Trusted by 1,200+ sales teams", work-email form and scripted HeroDemo · Team "Meet the team you just hired" (Theo, Pat, Maya, Sam) · How it works (Research, Qualify, Write, Follow up) · Inbox "Your agents message you when they need you" (Approvals, Replies, Lead reviews, Problems) · Rules "You set the rules. Your agents follow them." · Trust "Your data stays yours" · Plans "Start where you are" (Starter, Growth, Enterprise) · Final CTA "Grow your pipeline without growing headcount" · Footer "© 2026 Agentic Sales Team" |
| **Motion** | GSAP + ScrollTrigger: progress bar, reveal on scroll, hero tilt flattening over 520 px |
| **Errors** | Hero email: "Enter a work email, like you@company.com." |

### `/` Login (signed out, in place)
| | |
|---|---|
| **Modes** | Log in ("Welcome back" / "Log in to see what your agents did while you were away.") · Create account ("Create your account" / "Set up your workspace and meet your first agent in a few minutes.") · Reset ("Reset your password") |
| **Fields** | Sign-up: Full name, Work email, Password + 4-bar strength (Weak, Okay, Good, Strong). Log in: Work email, Password, "Forgot password?" |
| **States** | Working · done · "Incorrect email or password." · refused sign-up (one message) · "Too many attempts. Try again in N minutes." · "Couldn't reach the server…" · reset: "Self-serve password reset isn't available yet…" |

### `/reset` Set a new password
States: "Checking your reset link…" · "Link expired or invalid" · "Couldn't check your link" · form (New, Confirm, ≥ 8, must match: "Passwords don't match.") · "Password updated" + "Go to login".

### `/` Chat home ★
| | |
|---|---|
| **Job** | Get a request to a team |
| **Shows** | H1 "What should your team work on?" · composer "What should {First} do?" with an "Ask an agent" picker · 4 starter cards: "Find 25 finance leads in Texas" (scrape), "Draft emails for my ready leads" (outreach), "Score my newest leads" (qualify), "Book meetings with my hot leads" (book-meeting) · carousel (6 s, pauses on hover) |
| **Carousel** | One slide per team with waiting approvals ("2 approvals waiting in {team}"), or 3 fixed tips |
| **Send** | Sends "@{First} {message}" to the agent's team and opens `/chats` |
| **States** | No agents: "Hire your first agent" / "Agents research leads, write first emails and follow up. Nothing goes out until you approve it." + "Add an agent" · agent on no team: error "{First} isn't on a team yet. Add them to one to chat." then Create a team opens |

### `/chats` Team chat ★
| | |
|---|---|
| **Job** | Talk to one team and approve its work |
| **Header** | Team icon, name, member first names, up to 5 avatars, "Clear chat" (inline Clear / Cancel) |
| **Messages** | Mine right (blue); agents left with avatar and name when the speaker changes; system lines centred with an info icon. `«Lead»` pills, `@mention` pills, linked phrases |
| **Cards** (only under the last message, only when nobody is typing) | Live timeline (`⟦run⟧`) · New leads (`⟦leads⟧`, 5 rows then "Show all N", each with "Why:" / "Not a fit:", platform and review chips) · Search questions · Lead picker ("Who should I meet?" with "When?" pills / "Who should I write to?" with "Write to everyone") · Quick replies (or "Yes, go ahead" / "No, thanks" after an offer) · Proceed / Cancel |
| **Lead overview modal** | Role or what they want, why it fits, contact (mailto or Open profile/post), research summary and angle, "Found {date}", Accept · Dismiss · "Open in Leads →" |
| **Composer** | "Message the team. Use @mention for an agent and /lead to pick leads…" · @ list (≤ 5 members) · /lead list (≤ 6 leads, accepted green, pending amber; Backspace deletes a whole token) |
| **States** | No teams: "No conversations yet" / "Chats happen with a team. Create one to get started." + "Create a team" · typing dots with the agent's name · local error "I'm sorry. I could not process that now." |

### `/dashboard`
| | |
|---|---|
| **Shows** | "{Good morning/afternoon/evening}, {First}!" · "All agents" · "+ New team" · dark hub card: team filter pills, "N live", centre ring "{n} LEADS WORKED {MONTH}" with "⚡ N working · M tasks", up to 8 agents on an ellipse with live task badges, latest 2 activity lines · team cards (Leads, Members, Working) |
| **States** | "No teams yet" + "+ Create your first team" · numbers fall back to 0 if stats fail |

### `/teams/[id]`
| | |
|---|---|
| **Shows** | "← Dashboard" · icon, name, "{template} team · N agents", "{n} members · {w} working now" · Edit · + Add agents · Delete team (Confirm / Cancel) · KPIs Meetings, In pipeline, Leads, Avg lead score · Working now strip · coverage chips ("✓ cap" / "missing cap") · members with lead counts and × · team leads (first 12) · Shared goal · Pending approvals (Approve / Reject) · Recent activity (6) |
| **Modals** | "Add agents to {team}" (empty: "Every agent is already on this team.") · "Edit team" (name, 6 icons, goal) |
| **States** | "Team not found" · "No agents on this team yet. Use "Add agents" to build it out." · "No leads in this team's book yet." |

### `/agents`
Cards: avatar, name, role, live status pill, task, "{n} leads · {m} sent" or "No work yet", Delete (second click "Delete?"), Open. Empty: "No agents yet" + "+ Create your first agent".

### `/agents/[id]`
| | |
|---|---|
| **Header** | "← All agents" · avatar, name, status ("Paused" when paused), role, 🎯 goal · Pause / Resume · Edit (scrolls to Configuration) · Delete (no confirm) |
| **Sections** (sticky tabs that scroll; hidden when the capability is missing) | Overview · Leads (Find leads [scrape], Qualify leads [qualify]) · Research [research] (Research leads) · Emails [outreach] (Run outreach; Open in mail / Copy / Open profile / Mark sent) · Proposals [proposal] (Generate proposals, Mark sent) · Reach Outs [follow-up] · Meetings [book-meeting] · Tasks · Performance (Leads worked, Drafts sent, Reply rate, Researched) · Configuration |
| **Configuration** | Role (select of type labels), Goal, capability chips, Autonomy: Ask / Auto per capability (saves at once), book-meeting: type, length 15/30/45/60, "Book between" 8 AM–6 PM (default 9–17), weekdays only (default on), "Save changes" |
| **Find leads** | Browser prompt "What leads should {First} look for?", target 10, runs at once (no Proceed), then "Found N leads to review. Open the Pending tab in the Leads module." |
| **States** | "Agent not found" / "This agent was deleted or the link is wrong." · busy labels (Finding…, Qualifying…, Researching…, Running…, Drafting…) · "Something went wrong. Please try again." |

### `/create`
Steps: **Identity** ("Name your agent", required: "A name is required.") · **Type** (16 cards, "· soon" chips; Custom shows 10 checkboxes) · **Appearance** (Theo, Pat, Maya, Sam; default Maya) · **Settings** (scrape note; "Coming soon" note; meeting length text, 5 min – 8 h, default 30) · **Goal** (textarea; only the first sentence is saved). Buttons Back / Continue / "Create agent". Success: "Your agent {name} is now live!" + "Back to agents" + "View agent →". Failure: "Couldn't create {name}. Please try again." (stays on step 5).

### Create a team (global modal)
Team name ("e.g. EMEA Enterprise") · Icon (🚀 🌎 🏛 📣 🎯 💎) · Template (10 cards) · Members ("N selected") · coverage chips · "Missing capabilities. Create an agent that has them:" (name + Create per gap) · Shared goal · Cancel / Create.

### `/leads`
| | |
|---|---|
| **Shows** | Active / Pending (count) · agent and stage filters (Active only) · Import CSV · + Add lead |
| **Active table** | Lead, Company, Agent, Stage, Score, Run outreach, Advance, Delete ("Delete?", disarms after 3 s) |
| **Pending table** | "Scraped candidates. Accept the good ones." · Accept all / Dismiss all ("Accept N?" / "Dismiss N?") · rows with "View post ↗", Accept, Dismiss, Delete |
| **Modals** | Add a lead (Name, Title, Company, Email, Assign to agent; name, email and agent required) · Lead details (review chip, "Book a meeting" text box, intent, fit, research, matches ("No matches yet. Ask a Matchmaker…"), emails with Open in mail / Copy, "Clear all") |
| **States** | "No leads yet." · "No candidates awaiting review." · "Importing…" → "Imported N leads for {First}" |

### `/emails`
To send / Sent / All with counts · search "Search lead, company or text" · agent filter · Clear sent. List left, draft right: subject, "To {lead} · company · email or {platform} DM", "Drafted by …", body, "Why this angle". Actions: Open in mail (or Copy message when no email), Copy message, Open profile, Mark sent, Discard. Empty: "No drafts yet. Ask an agent to draft outreach and the emails show here." / "No drafts match."

### `/products`
Folder tiles + "Unfiled" · in a folder: "← All products", table Product (description), Category, Price, Move…, Delete · New folder ("e.g. Subscriptions") · Delete folder · Import CSV · + Add product (Name, Category, Price, Description). Empty: "No products yet".

### `/calendar`
Cards Meetings, Upcoming, This week, Leads · Week / Month toggle, ‹ ›, period label = today · Week: hour rows × 7 days · Month: Monday first, up to 4 dots per day then "+N". No meetings: an empty grid.

### `/settings`
One "Workspace" card: Workspace name, Your name, each saved on blur. No notification toggles, billing or users.

---

## 7. Error pages

| File | Shows |
|---|---|
| `app/error.tsx` | "This page didn't load" + Try again |
| `app/global-error.tsx` | Same, for a root layout failure |
| Unknown team / agent | "Team not found" / "Agent not found" inside the shell |
