// The live timeline of a run, stored in jobs.result.steps (01-prd.md §7.3).
// Writes are serialised (one at a time, in order) and the writer only updates
// a job that is still running, so a late write never undoes a finished job.

export type StepItem = { title: string; meta?: string; url?: string; kind: "source" | "dropped" | "done" | "failed" };
export type Step = {
  id: string; // plan, search, gate, extract, save (scrape) · pick, work (other stages)
  status: "active" | "done";
  label: string;
  detail?: string;
  items?: StepItem[];
  more?: number; // items not shown
};

export const MAX_ITEMS = 8;
export const MAX_SOURCES = 6;
export const MAX_DROPPED = 3;

// Keeps at most 6 sources, 3 dropped and 8 items in all; counts the rest in `more`.
export function capItems(items: StepItem[]): { items: StepItem[]; more: number } {
  const out: StepItem[] = [];
  let sources = 0;
  let dropped = 0;
  for (const it of items) {
    if (out.length >= MAX_ITEMS) break;
    if (it.kind === "source" && sources >= MAX_SOURCES) continue;
    if (it.kind === "dropped" && dropped >= MAX_DROPPED) continue;
    if (it.kind === "source") sources++;
    if (it.kind === "dropped") dropped++;
    out.push(it);
  }
  return { items: out, more: items.length - out.length };
}

export function createStepLog(write: (steps: Step[]) => Promise<void>) {
  let steps: Step[] = [];
  let chain: Promise<void> = Promise.resolve();

  function queueWrite() {
    const snapshot = steps.map((s) => ({ ...s, items: s.items ? [...s.items] : undefined }));
    chain = chain.then(() => write(snapshot)).catch((e) => console.error("step log write failed", e));
  }

  return {
    // Adds the step, or replaces the one with the same id. Items are capped.
    set(step: Step) {
      const capped = step.items ? capItems(step.items) : null;
      const next: Step = capped ? { ...step, items: capped.items, more: capped.more || undefined } : step;
      const i = steps.findIndex((s) => s.id === step.id);
      steps = i === -1 ? [...steps, next] : steps.map((s, j) => (j === i ? next : s));
      queueWrite();
    },
    steps: () => steps,
    // Waits for every queued write.
    flush: () => chain,
  };
}
