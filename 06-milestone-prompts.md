# Milestone prompts

| | |
|---|---|
| **Status** | Build spec, matches `origin/main` at PR #163 (commit `d3c6ff6`) |
| **Last updated** | 2026-11-19 |
| **Use with** | Claude Code, Cursor, or any AI coding tool |

One prompt for each milestone, written the way a non-coder would talk to an AI. Copy them in order.

---

## How to use them

1. Start with the **Getting set up** prompt. Do it once.
2. Then type one milestone prompt at a time, in a new chat each time.
3. When the AI says it is done, open the app and check that it works. The checks for each milestone are in `05-build-guide.md`.
4. If it works, ask the AI to save your progress (commit). Then go to the next one.

---

## Getting set up (do this first)

```text
Hey! I want to build an app called Agentic Sales Team. It's an AI sales team for a small
business: AI agents find leads online, check them, write emails and book meetings, and I
talk to them in a group chat. I'm not a coder, so I need you to handle all the technical
parts and guide me through anything I have to do myself.

Before we start building, can you help me get everything set up on my computer? Walk me
through it one step at a time, in plain English, and wait for me to tell you each step is
done before giving me the next one.
```

---

## The milestones

### M1. The landing page

```text
Let's start with the landing page, the first thing people see before they sign up. It
should say "An AI sales team that works for you in chat" and show a short demo of the
agents at work. Add sections that introduce four agents (Theo, Pat, Maya and Sam), explain
how it works, show that nothing goes out until I approve it, and list three plans. Make it
feel smooth and modern with animations as you scroll. The buttons don't need to work yet.
```

### M2. Accounts and sign-in

```text
Now I need people to be able to sign up and log in with their email and a password. Each
person can have up to 10 workspaces, one for each business they run, and the data in one
workspace should never show up in another. Please set up the database for the whole app
now too. If I need to create an account somewhere, walk me through it step by step.
```

### M3. The app layout

```text
After someone logs in, they should see the main app. Give it a sidebar on the left with
Search, New chat, Dashboard, Leads, Emails, Products and Calendar, a list of recent chats,
and my account at the bottom. Every page can be empty for now, but it should say something
friendly when there's nothing there yet.
```

### M4. The agents

```text
Now let me create my AI agents. I want a simple step-by-step form where I give the agent a
name, pick what kind of agent it is (like a Lead Scout, a Researcher or a Closer), choose
how it looks and write its goal. Each agent should have its own page where I can pause it,
edit it or delete it. For each job an agent can do, let me choose "Ask me first" or "Just
do it."
```

### M5. Teams and the dashboard

```text
I want to put my agents into teams. When I make a team, let me pick a template, and tell me
which kinds of agents the team is still missing so I can add them right there. Each team
should have its own page with its numbers, members and leads. Then make a dashboard where I
can see all my agents and teams at a glance.
```

### M6. Products and leads

```text
Next, I need a place for what I sell. Let me add products by hand or upload a spreadsheet,
and put them into folders. Use Google Gemini for all the AI in this app, and help me get a
Gemini API key. The agents should understand my products well enough to pick the right one
for each customer. I also need a Leads page where I can add people, upload a list,
and accept or reject the leads the agents find.
```

### M7. The agents get to work

```text
Now let's make the agents actually do their jobs. They should be able to research a lead,
score it, check if it's a good fit, match it to my products, write a personal email and
write a proposal. They should never send anything themselves. Put every email on an Emails
page where I can open it in my own email app, send it and mark it as sent. The work should
keep going even when I close the browser, and each account should have a sensible daily
limit.
```

### M8. Finding leads online

```text
I want a Lead Scout that finds new leads on the internet from one simple request, like
"find HR managers at hospitals in Manila." It should look on places like Facebook, Reddit
and LinkedIn, skip people who are selling instead of buying, and tell me in one line why
each lead is a good fit. New leads should wait for my review. While it searches, let me
watch each step as it happens.
```

### M9. The team chat

```text
This is the most important part. I want to talk to each team in a group chat, just like
texting. When I ask for something, the right agent should pick it up, and if it's missing a
detail it should ask me with simple buttons. Before each step, the agent asks me "Proceed or
Cancel?" unless I told it to just do it. When one agent finishes, the next one takes over
on its own, from finding leads all the way to writing emails and proposals. If I press
Cancel, everything stops and I get a short summary. Let's build this one piece at a time.
```

### M10. Meetings, notifications and going live

```text
Last part! Let the agents book meetings when I say something like "tomorrow at 2pm," but
only during my working hours, and show them on a calendar by week or month. Add a
notification bell, little badges when a chat has new messages, and a dot on the browser tab.
When that's done, help me put the app online so other people can use it, and walk me
through anything I need to do myself.
```

---

## When something goes wrong

**The AI adds things you didn't ask for:**

```text
I didn't ask for that. Please take it out and keep only what I asked for.
```

**Something doesn't work:**

```text
Something isn't working. When I <say what you did>, I see <say what happened>. Can you
find out why and fix it? Please explain what went wrong in plain English.
```

**You don't understand what the AI said:**

```text
I'm not a coder. Can you explain that again in simple words and tell me exactly what to do
next?
```
