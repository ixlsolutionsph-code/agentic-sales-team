"use client";

import { useApp } from "@/lib/store";
import { Btn } from "./primitives";
import Modal from "./Modal";

// The global "Create a team" modal. Milestone 3 mounts it on every page;
// Milestone 5 adds the icon, template, members, coverage and goal, and makes
// Create work.
export default function CreateTeamModal() {
  const { teamModal, setTeamModal, closeTeamModal } = useApp();

  return (
    <Modal
      open={teamModal.open}
      title="Create a team"
      onClose={closeTeamModal}
      footer={
        <>
          <Btn onClick={closeTeamModal}>Cancel</Btn>
          <Btn variant="primary" disabled>
            Create
          </Btn>
        </>
      }
    >
      <label className="auth-field">
        <span className="lp-label">Team name</span>
        <input
          className="lp-input"
          placeholder="e.g. EMEA Enterprise"
          value={teamModal.name}
          maxLength={80}
          onChange={(e) => setTeamModal({ name: e.target.value })}
          data-autofocus
        />
      </label>
    </Modal>
  );
}
