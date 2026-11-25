// Shapes shared by the server loader and the client store.

export type Agent = {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
  status: string;
  task: string;
  score: number;
  goal: string;
  char: number | null;
  type: string;
  capabilities: string[];
  createdAt: string;
};

export type Team = {
  id: string;
  name: string;
  icon: string;
  iconBg: string;
  description: string;
  goal: string;
  members: string[];
  activity: string[];
  meetings: number;
  pipeline: string;
  leads: number;
  template: string;
  createdAt: string;
};

export type AgentConfig = {
  role: string | null;
  goal: string | null;
  permissions: Record<string, boolean> | null;
  settings: Record<string, Record<string, unknown>> | null;
};

export type AgentState = { removed: boolean; paused: boolean };

export type ChatMessage = { id: number; who: string; text: string; createdAt: string };

// Everything the client store needs for the active workspace.
export type WorkspaceData = {
  agents: Agent[];
  teams: Team[];
  config: Record<string, AgentConfig>; // by agent id
  states: Record<string, AgentState>; // by agent id
  teamMembers: Record<string, string[]>; // team id -> member override
  messages: Record<string, ChatMessage[]>; // thread key (agent_id column) -> messages, oldest first
};

export const EMPTY_WORKSPACE: WorkspaceData = {
  agents: [],
  teams: [],
  config: {},
  states: {},
  teamMembers: {},
  messages: {},
};
