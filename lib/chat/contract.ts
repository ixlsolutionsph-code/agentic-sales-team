// Types shared by the chat server actions, the chain and the chat screens
// (Milestone 9). Pure.
import type { ChatMessage } from "@/lib/types";

// A job the browser should follow: kick the runner and poll until it ends.
export type FollowJob = { jobId: string; kind: string };

// What a chat call returns: the messages it stored (the user's and the
// agents'), oldest first, and the jobs that are now queued.
export type ChatResult = { messages: ChatMessage[]; follow: FollowJob[] };

// A step waiting for Proceed (shown on chat home, the team page and in chat).
export type PendingApproval = {
  jobId: string;
  teamId: string;
  teamName: string;
  agentId: string;
  agentName: string;
  kind: string;
  text: string; // the ask, markers stripped
  createdAt: string;
};
