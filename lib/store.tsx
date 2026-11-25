"use client";

// The client store: one React Context for the whole signed-in app.
// It is filled once per page load in app/layout.tsx (from currentUser() and
// loadWorkspace()). Switching workspace reloads the page, so it never holds
// two workspaces at once. Nothing here is saved in browser storage.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/auth/call-action";
import type { CurrentUser } from "@/lib/auth/actions";
import type { Workspace } from "@/lib/workspaces/actions";
import { AGENTS_BASE, TEAMS_BASE } from "@/lib/data";
import { persistOrRollback } from "@/lib/persist";
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
};

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
  const toastId = useRef(0);

  const showToast = useCallback((text: string, error = false) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, error });
  }, []);
  const clearToast = useCallback((id: number) => setToast((cur) => clearIfCurrent(cur, id)), []);

  const actions = useMemo<AppActions>(
    () => ({
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
      persist: (opts) => persistOrRollback({ ...opts, onError: (m) => showToast(m, true) }),
    }),
    [showToast, clearToast],
  );

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
      ...actions,
    }),
    [lists, me, wsList, navCounts, wizard, teamModal, toast, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState & AppActions {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
