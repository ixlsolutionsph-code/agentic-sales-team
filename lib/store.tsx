"use client";

// The client store: one React Context for the whole signed-in app.
// It is filled once per page load in app/layout.tsx (from currentUser() and
// loadWorkspace()). Switching workspace reloads the page, so it never holds
// two workspaces at once. Nothing here is saved in browser storage.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/auth/call-action";
import type { CurrentUser } from "@/lib/auth/actions";
import type { Workspace } from "@/lib/workspaces/actions";
import { callAction } from "@/lib/auth/call-action";
import type { NewAgentInput } from "@/lib/agents/new";
import type { CapSettings } from "@/lib/agents/settings";
import { mergeConfig, restoreKey, withState } from "@/lib/agents/storeOps";
import { AGENTS_BASE, TEAMS_BASE } from "@/lib/data";
import { persistOrRollback } from "@/lib/persist";
import type { NewTeamInput } from "@/lib/teams/new";
import { iconBg } from "@/lib/teams/new";
import {
  deleteTeam as deleteTeamAction,
  editTeam as editTeamAction,
  saveTeam as saveTeamAction,
  saveTeamMembers as saveTeamMembersAction,
  removeAgent as removeAgentAction,
  saveAgent as saveAgentAction,
  saveAgentConfig as saveAgentConfigAction,
  setAgentPaused as setAgentPausedAction,
} from "@/lib/workspace/actions";
import { clearIfCurrent, type ToastMsg } from "@/lib/toast";
import {
  EMPTY_WORKSPACE,
  type Agent,
  type AgentConfig,
  type AgentState,
  type ChatMessage,
  type Team,
  type WorkspaceData,
} from "@/lib/types";

// Fields of the "Add new agent" wizard (filled in Milestone 4).
export type WizardFields = {
  step: number;
  name: string;
  type: string;
  capabilities: string[];
  char: number | null;
  settings: Record<string, Record<string, unknown>>;
  goal: string;
};

// Fields of the global "Create a team" modal (filled in Milestone 5).
export type TeamModalFields = {
  open: boolean;
  name: string;
  icon: string;
  template: string;
  members: string[];
  goal: string;
};

const EMPTY_WIZARD: WizardFields = { step: 0, name: "", type: "", capabilities: [], char: null, settings: {}, goal: "" };
const EMPTY_TEAM_MODAL: TeamModalFields = { open: false, name: "", icon: "", template: "", members: [], goal: "" };

type Lists = {
  agents: Agent[];
  teams: Team[];
  config: Record<string, AgentConfig>;
  states: Record<string, AgentState>;
  teamMembers: Record<string, string[]>;
  chats: Record<string, ChatMessage[]>;
};

export type AppState = Lists & {
  signedIn: boolean;
  user: CurrentUser | null;
  workspaces: Workspace[];
  navCounts: { leads: number; emails: number };
  wizard: WizardFields;
  teamModal: TeamModalFields;
  toast: ToastMsg | null;
  // The team whose chat /chats shows. Held in memory only: a chat has no
  // bookmarkable link (01-prd.md §12).
  activeChatTeam: string | null;
};

type ConfigPatch = { role?: string; goal?: string; settings?: CapSettings };

export type AppActions = {
  showToast: (text: string, error?: boolean) => void;
  clearToast: (id: number) => void;
  setUser: (patch: Partial<CurrentUser>) => void;
  setWorkspaces: (list: Workspace[]) => void;
  setLists: (patch: Partial<Lists>) => void;
  setNavCounts: (patch: Partial<AppState["navCounts"]>) => void;
  setWizard: (patch: Partial<WizardFields>) => void;
  resetWizard: () => void;
  openTeamModal: (patch?: Partial<Omit<TeamModalFields, "open">>) => void;
  setTeamModal: (patch: Partial<Omit<TeamModalFields, "open">>) => void;
  closeTeamModal: () => void;
  setActiveChatTeam: (teamId: string | null) => void;
  // Agents. createAgent waits for the save; the others change the screen at
  // once and undo the change (with an error message) if saving fails.
  createAgent: (input: NewAgentInput, settings: CapSettings | null) => Promise<ActionResult<Agent>>;
  setAgentPaused: (agentId: string, paused: boolean) => Promise<ActionResult>;
  removeAgent: (agentId: string) => Promise<ActionResult>;
  saveAgentConfig: (agentId: string, patch: ConfigPatch) => Promise<ActionResult>;
  // Teams. createTeam waits for the save; the others change the screen at once
  // and undo the change if saving fails.
  createTeam: (input: NewTeamInput) => Promise<ActionResult<Team>>;
  editTeam: (teamId: string, patch: { name: string; icon: string; goal: string }) => Promise<ActionResult>;
  setTeamMembers: (teamId: string, members: string[]) => Promise<ActionResult>;
  deleteTeam: (teamId: string) => Promise<ActionResult>;
  // Show a change at once; undo it and show the error if saving fails.
  persist: <T>(opts: {
    apply: () => void;
    rollback: () => void;
    save: () => Promise<ActionResult<T>>;
  }) => Promise<ActionResult<T>>;
};

const AppContext = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({
  user,
  workspace = EMPTY_WORKSPACE,
  workspaces = [],
  children,
}: {
  user: CurrentUser | null;
  workspace?: WorkspaceData;
  workspaces?: Workspace[];
  children: ReactNode;
}) {
  const [me, setMe] = useState<CurrentUser | null>(user);
  const [wsList, setWsList] = useState<Workspace[]>(workspaces);
  const [lists, setListsState] = useState<Lists>(() => ({
    agents: [...AGENTS_BASE, ...workspace.agents],
    teams: [...TEAMS_BASE, ...workspace.teams],
    config: workspace.config,
    states: workspace.states,
    teamMembers: workspace.teamMembers,
    chats: workspace.messages,
  }));
  const [navCounts, setNavCountsState] = useState({ leads: 0, emails: 0 });
  const [wizard, setWizardState] = useState<WizardFields>(EMPTY_WIZARD);
  const [teamModal, setTeamModalState] = useState<TeamModalFields>(EMPTY_TEAM_MODAL);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [activeChatTeam, setActiveChatTeam] = useState<string | null>(null);
  const toastId = useRef(0);
  // The latest lists, so an undo can put back exactly what was there before.
  const listsRef = useRef(lists);
  listsRef.current = lists;

  const showToast = useCallback((text: string, error = false) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, error });
  }, []);
  const clearToast = useCallback((id: number) => setToast((cur) => clearIfCurrent(cur, id)), []);

  const actions = useMemo<AppActions>(() => {
    const persist: AppActions["persist"] = (opts) => persistOrRollback({ ...opts, onError: (m) => showToast(m, true) });

    // Optimistic change to one agent's state row, undone if saving fails.
    const changeState = (agentId: string, patch: Partial<AgentState>, save: () => Promise<ActionResult>) => {
      const prev = listsRef.current.states[agentId];
      return persist({
        apply: () => setListsState((cur) => ({ ...cur, states: { ...cur.states, [agentId]: withState(cur.states[agentId], patch) } })),
        rollback: () => setListsState((cur) => ({ ...cur, states: restoreKey(cur.states, agentId, prev) })),
        save,
      });
    };

    return {
      showToast,
      clearToast,
      setUser: (patch) => setMe((cur) => (cur ? { ...cur, ...patch } : cur)),
      setWorkspaces: setWsList,
      setLists: (patch) => setListsState((cur) => ({ ...cur, ...patch })),
      setNavCounts: (patch) => setNavCountsState((cur) => ({ ...cur, ...patch })),
      setWizard: (patch) => setWizardState((cur) => ({ ...cur, ...patch })),
      resetWizard: () => setWizardState(EMPTY_WIZARD),
      openTeamModal: (patch) => setTeamModalState({ ...EMPTY_TEAM_MODAL, ...patch, open: true }),
      setTeamModal: (patch) => setTeamModalState((cur) => ({ ...cur, ...patch })),
      closeTeamModal: () => setTeamModalState(EMPTY_TEAM_MODAL),
      setActiveChatTeam,
      createAgent: async (input, settings) => {
        const res = await callAction(() => saveAgentAction({ ...input, settings }));
        if (res.ok && res.data) {
          const agent = res.data;
          setListsState((cur) => ({
            ...cur,
            agents: [...cur.agents, agent],
            config: settings ? { ...cur.config, [agent.id]: mergeConfig(undefined, { settings }) } : cur.config,
          }));
        }
        return res;
      },
      setAgentPaused: (agentId, paused) => changeState(agentId, { paused }, () => setAgentPausedAction(agentId, paused)),
      removeAgent: (agentId) => changeState(agentId, { removed: true }, () => removeAgentAction(agentId)),
      saveAgentConfig: (agentId, patch) => {
        const prev = listsRef.current.config[agentId];
        return persist({
          apply: () => setListsState((cur) => ({ ...cur, config: { ...cur.config, [agentId]: mergeConfig(cur.config[agentId], patch) } })),
          rollback: () => setListsState((cur) => ({ ...cur, config: restoreKey(cur.config, agentId, prev) })),
          save: () => saveAgentConfigAction(agentId, patch),
        });
      },
      createTeam: async (input) => {
        const res = await callAction(() => saveTeamAction(input));
        if (res.ok && res.data) {
          const team = res.data;
          setListsState((cur) => ({ ...cur, teams: [...cur.teams.filter((t) => t.id !== team.id), team] }));
        }
        return res;
      },
      editTeam: (teamId, patch) => {
        const prev = listsRef.current.teams.find((t) => t.id === teamId);
        const next = { name: patch.name.trim(), icon: patch.icon, iconBg: iconBg(patch.icon), goal: patch.goal.trim() };
        return persist({
          apply: () => setListsState((cur) => ({ ...cur, teams: cur.teams.map((t) => (t.id === teamId ? { ...t, ...next } : t)) })),
          rollback: () =>
            setListsState((cur) => ({ ...cur, teams: prev ? cur.teams.map((t) => (t.id === teamId ? prev : t)) : cur.teams })),
          save: () => editTeamAction(teamId, patch),
        });
      },
      setTeamMembers: (teamId, members) => {
        const prev = listsRef.current.teamMembers[teamId];
        return persist({
          apply: () => setListsState((cur) => ({ ...cur, teamMembers: { ...cur.teamMembers, [teamId]: members } })),
          rollback: () => setListsState((cur) => ({ ...cur, teamMembers: restoreKey(cur.teamMembers, teamId, prev) })),
          save: () => saveTeamMembersAction(teamId, members),
        });
      },
      deleteTeam: (teamId) => {
        const before = listsRef.current;
        const prevTeams = before.teams;
        const prevMembers = before.teamMembers[teamId];
        return persist({
          apply: () => {
            setListsState((cur) => ({
              ...cur,
              teams: cur.teams.filter((t) => t.id !== teamId),
              teamMembers: restoreKey(cur.teamMembers, teamId, undefined),
            }));
            setActiveChatTeam((cur) => (cur === teamId ? null : cur));
          },
          rollback: () =>
            setListsState((cur) => ({ ...cur, teams: prevTeams, teamMembers: restoreKey(cur.teamMembers, teamId, prevMembers) })),
          save: () => deleteTeamAction(teamId),
        });
      },
      persist,
    };
  }, [showToast, clearToast]);

  const value = useMemo(
    () => ({
      ...lists,
      signedIn: me !== null,
      user: me,
      workspaces: wsList,
      navCounts,
      wizard,
      teamModal,
      toast,
      activeChatTeam,
      ...actions,
    }),
    [lists, me, wsList, navCounts, wizard, teamModal, toast, activeChatTeam, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState & AppActions {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
