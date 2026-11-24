# User journey: Agentic Sales Team

| | |
|---|---|
| **Status** | Build spec, matches `origin/main` at PR #163 (commit `d3c6ff6`) |
| **Last updated** | 2026-11-17 |
| **Source** | `01-prd.md`, `02-sitemap.md` and the chat code (`lib/chat/*`, `lib/pod/*`) |

The paths an owner takes through the product, step by step. **[F#]** points to `01-prd.md` §6. Quoted text is the exact text the product shows. Use it word for word.

---

## 1. Who is on the journey

| Who | Wants | Where |
|---|---|---|
| **The business owner** | New buyers for what they sell, without searching and writing by hand | Chat home and the team chat, most visits |
| **The same owner, setting up** | Agents, a team and the catalog | The wizard, the team modal and Products, usually once |
| **The lead** | Nothing. They get one email that the owner sends | Outside the product |

---

## 2. The whole journey

```
Landing ──> Create account ──> Chat home: "Hire your first agent"
                                   │
          Create agents (wizard) ──> Create a team ──> Load the catalog
                                   │
     ┌───────────> Chat home or team chat: "find HR managers at hospitals in Manila"
     │                             │
     │        missing product / who / where / how many? ── yes ──> question card
     │                             │ no
     │        "I'm ready to search … Proceed?" ── Cancel ──> summary, nothing runs
     │                             │ Proceed (or Auto)
     │        live timeline: plan → search → check sources → pick out leads → save
     │                             │
     │        "I found N new leads. @Assessor, please review them." ──> Proceed?
     │                             │
     │        research ──> qualify ──> match ──> outreach ──> proposal  (each hand-off asks Proceed? on Ask)
     │                             │
     │        Emails: Open in mail, send, Mark sent ──> lead becomes "contacted"
     │                             │
     │        "book a meeting" ──> lead picker + time ──> Proceed ──> Calendar
     │                             │
     └────────── "look for more" / next search
                                   │
                  Next day: red tab dot, unread badges, "any updates?"
```

---

## 3. J1: Sign-up

| # | Page | Owner does | Product does |
|---|---|---|---|
| 1 | `/` | Opens the link | Loader (≥ 3 s), then "An AI sales team that works for you in chat" |
| 2 | `/` | Watches the hero demo, scrolls | Scripted demos of agents, approvals and rules |
| 3 | `/` | Types a work email and presses Get started | Opens Create account with the email filled in [F1] |
| 4 | `/` (Create account) | Types a full name and a password | Checks a valid email and ≥ 8 characters, makes the user and the first workspace (same id), sets the session, reloads [F1, F2] |
| 5 | `/` (Chat home) | Sees "Hire your first agent" | No seed data. Every list is empty |

**Errors:** "Enter a valid email address." · "Password must be at least 8 characters." · "We couldn't create an account with these details. If you already have one, sign in instead." · "Too many attempts. Try again in N minutes."

---

## 4. J2: Setting up the team

| # | Page | Owner does | Product does |
|---|---|---|---|
| 1 | `/create` | Names the agent | Holds Continue until the name is filled [F3] |
| 2 | `/create` | Picks a type, for example Lead Scout | Shows its capabilities, flags "soon" ones |
| 3 | `/create` | Picks a look, sets meeting length if it books, writes a goal | Saves only the first sentence of the goal |
| 4 | `/create` | Presses Create agent | "Your agent {name} is now live!" |
| 5 | Create a team | Names the team, picks a template and an icon, ticks members | Shows "✓ cap" or "○ cap" for each required capability [F4] |
| 6 | Create a team | Fills a gap with Create | Makes the suggested agent type in place and ticks it |
| 7 | Create a team | Presses Create | Opens `/teams/[id]` |
| 8 | `/products` | Imports a CSV of what they sell | Saves up to 200 rows, embeds each one, extra columns become attributes [F10] |

**A typical full team:** Scout (scrape), Assessor (assess), Researcher (research), Qualifier (qualify), Matchmaker (match), Writer (outreach), Closer (proposal), Meeting Booker (book-meeting).

**Risk:** a team with no Assessor stops after the search and asks the owner to review every lead.

---

## 5. J3: The first search ★

| # | Page | Owner does | Product does |
|---|---|---|---|
| 1 | `/` | Picks the Scout, types "find HR managers at hospitals in Manila", sends | Posts "@Scout find HR managers…" to the Scout's team and opens `/chats` [F5] |
| 2 | `/chats` | Waits | Typing dots, then the reply **≥ 2 s after sending** |
| 3 | `/chats` | Reads "Before I start, I need one detail." | Question card for each missing field: "Which product are these leads for?" (if > 1 product), "Who should I look for?", "Where should I look?" (Anywhere, United States, United Kingdom, Europe), "How many leads?" (5, 10, 25) [F6] |
| 4 | `/chats` | Picks 10 and presses Send | "I'm ready to search: • For: … • Looking for: … • Where: … • How many: 10 leads. Proceed?" [F9] |
| 5 | `/chats` | Presses Proceed, or types "yes" | "Okay, starting the search now. I will post the results here." |
| 6 | `/chats` | Watches | The live timeline: planning, searching, checking each source (dropped ones struck through), picking out leads, "N new leads saved". **About a minute. The biggest drop-off point** |
| 7 | `/chats` | Reads "I found 8 new leads. @Assessor, please review them." | New leads card with "Why: …" for each, then "I'm ready to review … Proceed?" [F7] |
| 8 | `/chats` | Presses Proceed | The Assessor accepts the fits and dismisses the rest, each with a reason |
| 9 | `/chats` | Opens a lead from the card | Lead overview: role, why it fits, contact, Accept, Dismiss, Open in Leads → |
| 10 | `/chats` | Reads the next hand-off | "{what I did, for example accepted 6 leads} @Researcher, please do the research." and a new Proceed [F8] |

```
Message ──> catalog empty? ── yes ──> "You have no products in your catalog yet…"
               │ no
         product / who / where / count missing? ── yes ──> question card
               │                     (after 2 asks: anywhere, 10, Any product. "Who" is never guessed)
               │ no
         Ask or Auto? ── Ask ──> "Proceed?" ── Cancel ──> "We hadn't done anything yet, so nothing changed."
               │ Auto            │ Proceed
               v                 v
         plan ──> search ──> drop sellers, competitors, job seekers ──> pick out leads ──> save (pending)
               │
         any new leads? ── no ──> "I found no new leads for that search. Try again with more detail…"
               │                  + "Want me to look again with a wider scope? I'll search …" (Proceed / Cancel)
               │ yes
         Assessor on the team? ── no ──> "@You, they are ready for you to review and accept."
               │ yes
         assess ──> research ──> qualify ──> match ──> outreach ──> proposal
```

**A question while a question is open:** if the owner asks "what does the Assessor check?" while the search card is waiting, the agent answers, then posts its question again so the card stays.

---

## 6. J4: From drafts to a sent email

| # | Page | Owner does | Product does |
|---|---|---|---|
| 1 | `/chats` | Reads "@You, the drafts are ready for you to review and send" | Emails badge shows the unsent count [F11] |
| 2 | `/emails` | Opens To send | Each draft: subject, lead, agent, body, "Why this angle" |
| 3 | `/emails` | Presses Open in mail (or Copy message when the lead has no email) | Opens the owner's mail app with subject and body. Nothing is sent by the product |
| 4 | Mail app | Edits and sends | |
| 5 | `/emails` | Presses Mark sent | Draft → sent, lead `new` → `contacted`, activity "Sent "{subject}"" (one transaction) |
| 6 | `/emails` | Discards a draft | Hides it. Counts still include it. The lead can be drafted again |

**Asking in chat instead:** "draft emails" → "Who would you like me to write to? You can name the leads, or tell me to reach everyone in the book." with a picker of up to 50 open leads and "Write to everyone".

---

## 7. J5: Booking a meeting

| # | Owner does | Product does |
|---|---|---|
| 1 | Types "book meetings with my hot leads" | Hands it to the agent with `book-meeting` [F12] |
| 2 | — | "Who should I set the meeting with, and when? Here are your best leads." + picker of up to 10 accepted leads with no meeting (best score first, "Hot N" when ≥ 75) and "When?" pills: Tomorrow 10 AM, Tomorrow 2 PM, Next Monday 10 AM |
| 3 | Ticks Ana, picks "Tomorrow 2 PM", sends | Reads the time in the owner's time zone; checks the booking window, weekdays and not in the past |
| 4 | Reads "I'm ready to book a Discovery call with Ana on Fri, Oct 24 · 2:00–2:30 PM. Proceed?" | |
| 5 | Presses Proceed | Books it, lead → `meeting`, posts that it is on the calendar |
| 6 | Opens Calendar | Sees it in the week view |

- A day with no time → "What time on {day} should I set the meeting with Ana?" + up to 6 hourly slots inside the window (no 12).
- No date at all → "When should I set the meeting with Ana?"
- No accepted leads → "You have no accepted leads to meet yet…"
- From `/leads`: the lead details have a "Book a meeting" box ("tomorrow 2pm").

---

## 8. J6: Stopping a run

| # | Owner does | Product does |
|---|---|---|
| 1 | Presses Cancel, or types "no" / "stop" | This step and every waiting or queued step of the team → dismissed [F9] |
| 2 | Reads the summary | "Okay, stopping now. Here's a summary of what we did:" + "• Sam found 8 leads", "• X's search didn't finish", "• X was still {doing}. That step will finish, but nothing runs after it" |
| 3 | — | A running step finishes but hands nothing on: "…but you stopped the run, so I didn't pass it on." |

Meeting asks: Cancel → "Okay, I won't book it." A "no" to an agent's offer → "Okay. Just ask when you need me." A "no" while the agent's own question is open → "Okay, I stopped. Ask me again when you're ready."

---

## 9. J7: The returning owner

| # | Page | Owner does | Product does |
|---|---|---|---|
| 1 | `/` | Opens the app | Red dot on the tab, unread badges on Recent chats [F14] |
| 2 | `/` | Sees "2 approvals waiting in {team}" | Clicking the slide opens that chat |
| 3 | `/chats` | Asks "any updates?" | The agent describes its latest real job, for example "I've just finished drafting outreach: drafted 3 emails…" [F5] |
| 4 | `/chats` | Asks "how many hot leads do we have?" | Answers from team data (counts, tiers, top leads) |
| 5 | `/chats` | Says "look for more" | Reuses the last who and where, asks only for the count |
| 6 | Bell | Opens Notifications | Recent activity, newest first; Clear all |

---

## 10. J8: Running an agent from its page

| # | Owner does | Product does |
|---|---|---|
| 1 | Opens an agent from the dashboard ring or `/agents` | Agent page with a section for each capability [F3] |
| 2 | Presses Find leads, types what to look for | Runs at once with target 10 (no Proceed): "Found N leads to review. Open the Pending tab in the Leads module." |
| 3 | Presses Research leads, Qualify leads, Run outreach or Generate proposals | Runs on the team's book; the button shows a busy label |
| 4 | Sets a capability to Auto in Configuration | From now on the chat starts that step at once: "Okay, starting now." [F9] |
| 5 | Presses Pause | "{name} paused". The agent gets no new steps |

---

## 11. J9: More than one business

| # | Owner does | Product does |
|---|---|---|
| 1 | Workspace menu → New workspace, types a name | Creates it, switches, reloads to `/` [F2] |
| 2 | — | Empty: no agents, teams, leads, products or chats |
| 3 | Switches back | Reloads into the first workspace with its data |

Daily limits count across all workspaces of the account [F15]. Sign-in always starts in the first workspace.

---

## 12. J10: When things go wrong

| Path | Trigger | What the owner sees |
|---|---|---|
| No buyer named | "find leads" | "Before I start, I need one detail." + card |
| No catalog | Any search | "You have no products in your catalog yet…" |
| Search not set up | No Firecrawl or AI key | "Lead search isn't set up on this server yet…" |
| Nothing found | Search saves 0 leads | "I found no new leads for that search. Try again with more detail, for example the industry, the company size or the location." + wider-search offer |
| No fit | Assessor dismisses all | "I reviewed the new leads, but none of them were a good fit." + wider-search offer |
| Fewer than asked | Search saves less than the target | Save step: "You asked for N. This search found no more new people who fit. Try a wider search for more." |
| Nobody can do it | No agent has the capability | "No agent can {cap} yet. Create an agent with that capability, and I will send requests to it." |
| Not built | Follow-up or enrichment | "{Label} isn't available yet, so I'm unable to run it at the moment." |
| Errors in a stage | Some leads failed | "@You, I couldn't finish N leads because of an error… I stopped the chain here." + "Try again" |
| Run failed | Search or run error | "That search didn't complete. Please try again." / "That run didn't complete. Please check the agent's page." |
| Slow | Run > about 100 s | "Still working on it in the background. The result will appear here when it's done." |
| Timed out | Run passes its time limit | Task: "Timed out: the run was stopped before it finished." |
| Daily limit | 100 runs / 20 searches / 300 messages | "You've reached today's limit of … Try again tomorrow." |
| Too long | Message > 2000 chars | "That message is too long. Keep it under 2000 characters." |
| Nobody answered | No route | "No one picked that up. Try @mentioning an agent on this team." |
| Paused agent | Run on a paused agent | "This agent is paused or no longer exists." |
| Wrong sign-in | Bad email or password | "Incorrect email or password." |
| Forgot password | "Forgot password?" | "Self-serve password reset isn't available yet…" |
| Page error | A page throws | "This page didn't load" + Try again |

---

## 13. What success looks like

| Moment | Check |
|---|---|
| J2 | A team covers scrape, assess and outreach |
| J3 step 6 | The owner stays until the new leads card |
| J3 step 7 | The search saves at least one lead |
| J3 step 8 | More leads accepted than dismissed |
| J4 step 5 | A first draft is marked sent |
| J5 | A first meeting is booked |
| J7 | The owner comes back within 7 days |
