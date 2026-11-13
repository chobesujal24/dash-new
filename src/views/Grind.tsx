import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, Pause, Pickaxe, Play, Plus, Trash2, X } from "lucide-react";
import { blockCategories, fmtAgo, fmtDuration, prettyBlock, type BlockCategoryId } from "../data/model";
import { useConsole } from "../state/store";
import { BlockIcon } from "../ui/art";
import { Bar, Button, Chip, EmptyState, Field, IconButton, Panel, Segmented, Stepper } from "../ui/kit";
import { cn } from "../utils/cn";
import { JobStatusLabel, Stat } from "./shared";

/** `POST /api/grind` rejects a sixth waiting job. */
const QUEUE_LIMIT = 5;

const blocksIn = (id: BlockCategoryId): readonly string[] => blockCategories.find((c) => c.id === id)?.blocks ?? [];

/* ── Active job ────────────────────────────────────────── */

function CurrentGrind() {
  const job = useConsole((s) => s.grind.current);
  const now = useConsole((s) => s.nowTick);
  const togglePause = useConsole((s) => s.grindTogglePause);
  const cancel = useConsole((s) => s.grindCancel);
  const askConfirm = useConsole((s) => s.askConfirm);
  const pausing = useConsole((s) => Boolean(s.pending["grind:pause"]));
  const cancelling = useConsole((s) => (job ? Boolean(s.pending[`grind:${job.id}`]) : false));

  if (!job) {
    return (
      <Panel>
        <EmptyState icon={Pickaxe} title="Nothing in the hopper">
          Queue a job from the planner. It starts as soon as the worker is free.
        </EmptyState>
      </Panel>
    );
  }

  const paused = job.status === "paused" || job.status === "pausing";
  const blocked = job.status === "blocked";
  const stopping = job.status === "cancelling";
  const canPause = job.status === "running" || job.status === "paused";
  const pct = job.requested > 0 ? Math.min(100, Math.round((job.completed / job.requested) * 100)) : 0;
  const remaining = Math.max(0, job.requested - job.completed);
  const startedAt = job.startedAt ?? job.createdAt;
  const minutes = startedAt > 0 ? Math.max(now - startedAt, 1_000) / 60_000 : 0;
  const rate = minutes > 0 ? job.completed / minutes : 0;
  const left = !paused && !blocked && !stopping && rate >= 0.05 ? (remaining / rate) * 60_000 : null;

  const eyebrow = blocked ? "Blocked job" : paused ? "Paused job" : stopping ? "Cancelling job" : "Active job";
  const tone = blocked ? "danger" : paused || stopping ? "warn" : "ok";

  return (
    <Panel
      eyebrow={eyebrow}
      title={prettyBlock(job.target)}
      sub={job.message || `${job.completed} of ${job.requested} collected.`}
      tools={
        <Chip tone={tone} dot>
          {job.status}
        </Chip>
      }
    >
      <div className="flex items-center gap-4">
        <span className="flex size-[60px] shrink-0 items-center justify-center rounded-xl border border-line bg-panel-2">
          <BlockIcon name={job.target} size={40} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <p className="num font-display text-[32px] font-semibold leading-none text-ink">
              {pct}
              <span className="text-[16px] text-faint">%</span>
            </p>
            <p className="num text-[12px] text-mute">
              {job.completed} of {job.requested} blocks
            </p>
            <span className="num ml-auto font-mono text-[11px] text-faint">
              {(job.completed / 64).toFixed(1)} / {(job.requested / 64).toFixed(1)} stacks
            </span>
          </div>
          <Bar value={pct} milestones active={job.status === "running"} tone={blocked ? "danger" : paused ? "warn" : "accent"} className="mt-3" />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
        <Stat label="Rate" value={rate > 0 ? `${rate.toFixed(1)} / min` : "—"} />
        <Stat label="Time left" value={left === null ? "—" : fmtDuration(left)} />
        <Stat label="Remaining" value={`${remaining} blocks`} />
        <Stat label="Elapsed" value={startedAt > 0 ? fmtDuration(Math.max(0, now - startedAt)) : "—"} />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <p className="text-[11px] text-faint">
          {paused
            ? "Resume when the worker is clear."
            : blocked
              ? "The worker reported a blocker. Clear it, then resume or cancel."
              : stopping
                ? "Waiting for ENI1 to acknowledge the cancel."
                : "Pause keeps the job; cancel discards what is left."}
        </p>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            icon={paused ? Play : Pause}
            loading={pausing}
            loadingLabel={paused ? "Resuming" : "Pausing"}
            disabled={!canPause}
            disabledReason={
              blocked
                ? "The worker is blocked. Cancel the job or clear the blocker."
                : stopping
                  ? "The job is already cancelling."
                  : "Wait for the job to start."
            }
            onClick={togglePause}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={X}
            loading={cancelling}
            loadingLabel="Cancelling"
            disabled={stopping}
            disabledReason="The job is already cancelling."
            onClick={() =>
              askConfirm({
                eyebrow: "Grind queue",
                title: "Cancel this job?",
                description: `${remaining} ${prettyBlock(job.target).toLowerCase()} are still to collect. Blocks already gathered stay in the world.`,
                confirmLabel: "Cancel job",
                danger: true,
                action: () => cancel(job.id),
              })
            }
          >
            Cancel
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/* ── Queue ─────────────────────────────────────────────── */

function GrindQueue() {
  const queue = useConsole((s) => s.grind.queue);
  const now = useConsole((s) => s.nowTick);
  const cancel = useConsole((s) => s.grindCancel);

  return (
    <Panel
      eyebrow="Up next"
      title="Queue"
      sub="Jobs run in the order they were queued."
      pad={false}
      tools={
        <span className="num text-[11.5px] font-medium text-mute">
          {queue.length} of {QUEUE_LIMIT} waiting
        </span>
      }
    >
      {queue.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12px] text-mute">The queue is clear.</p>
      ) : (
        <ol className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {queue.map((job, index) => {
              const name = prettyBlock(job.target);
              return (
                <motion.li
                  key={job.id}
                  layout="position"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex items-center gap-3 overflow-hidden py-2.5 pl-4 pr-2.5"
                >
                  <span className="num w-4 shrink-0 text-center text-[11px] text-faint">{index + 1}</span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2">
                    <BlockIcon name={job.target} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {job.requested} × {name}
                    </p>
                    <p className="num truncate text-[10.5px] text-faint">{job.status} · {fmtAgo(job.createdAt, now)}</p>
                  </div>
                  <IconButton size="sm" tone="danger" icon={Trash2} label={`Remove ${name} from the queue`} onClick={() => cancel(job.id)} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </Panel>
  );
}

/* ── Planner ───────────────────────────────────────────── */

const PRESETS = [16, 32, 64, 128];

function GrindPlanner() {
  const enqueue = useConsole((s) => s.grindEnqueue);
  const queue = useConsole((s) => s.grind.queue);
  const queuing = useConsole((s) => Boolean(s.pending["grind:queue"]));
  const [category, setCategory] = useState<BlockCategoryId>("ores");
  const [target, setTarget] = useState("diamond_ore");
  const [count, setCount] = useState(64);

  const full = queue.length >= QUEUE_LIMIT;

  const choose = (block: string) => setTarget(block);

  const switchCategory = (id: BlockCategoryId) => {
    setCategory(id);
    const blocks = blocksIn(id);
    if (!blocks.includes(target) && blocks[0]) choose(blocks[0]);
  };

  return (
    <Panel
      eyebrow="Collection planner"
      title="Queue a grind"
      sub="Pick a block and a count. ENI1 runs the job when the worker is free."
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-ink">Target</p>
        <Segmented label="Resource category" value={category} onChange={switchCategory} options={blockCategories.map((c) => ({ value: c.id, label: c.label }))} />
      </div>

      <div role="radiogroup" aria-label="Grind target" className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
        {blocksIn(category).map((block) => (
          <button
            key={block}
            type="button"
            role="radio"
            aria-checked={target === block}
            aria-label={prettyBlock(block)}
            title={prettyBlock(block)}
            onClick={() => choose(block)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg border transition-colors",
              target === block ? "border-rose/60 bg-rose/10" : "border-line bg-panel-2 hover:border-line-2 hover:bg-panel-3",
            )}
          >
            <BlockIcon name={block} size={28} />
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4 border-t border-line pt-4">
        <Field label="Block count" hint="The server accepts 1 to 128 blocks per job.">
          <div className="flex flex-wrap items-center gap-2">
            <Stepper label="block count" value={count} min={1} max={128} step={8} onChange={setCount} />
            <div className="flex gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={count === preset}
                  onClick={() => setCount(preset)}
                  className={cn(
                    "num h-9 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
                    count === preset ? "border-rose/50 bg-rose/10 text-ink" : "border-line text-mute hover:border-line-2 hover:text-ink",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </Field>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <Button
          variant="primary"
          icon={Plus}
          className="w-full"
          loading={queuing}
          loadingLabel="Queueing"
          disabled={full}
          disabledReason={`The queue holds at most ${QUEUE_LIMIT} waiting jobs. Remove one before adding another.`}
          onClick={() => enqueue({ target, requested: count })}
        >
          Queue {count} × {prettyBlock(target)}
        </Button>
      </div>
    </Panel>
  );
}

/* ── History ───────────────────────────────────────────── */

function GrindHistory() {
  const history = useConsole((s) => s.grind.history);
  const queue = useConsole((s) => s.grind.queue);
  const enqueue = useConsole((s) => s.grindEnqueue);
  const queuing = useConsole((s) => Boolean(s.pending["grind:queue"]));
  const now = useConsole((s) => s.nowTick);
  const full = queue.length >= QUEUE_LIMIT;

  return (
    <Panel eyebrow="Archive" title="Grind history" pad={false}>
      {history.length === 0 ? (
        <EmptyState icon={History} title="No finished jobs yet">
          Completed, failed and cancelled jobs are kept here. The server owns this list; it is read-only.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {history.map((job) => {
            const finished = job.finishedAt ?? job.startedAt ?? job.createdAt;
            const span = Math.max(0, finished - (job.startedAt ?? job.createdAt));
            const name = prettyBlock(job.target);
            return (
              <li key={job.id} className="flex items-center gap-3 py-3 pl-5 pr-3 transition-colors hover:bg-panel-2/35">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2">
                  <BlockIcon name={job.target} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">
                    {job.completed} of {job.requested} × {name}
                  </p>
                  <p className="num truncate text-[10.5px] text-faint">
                    {span > 0 ? `${fmtDuration(span)} · ` : ""}
                    {fmtAgo(finished, now)}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="quiet"
                  icon={Plus}
                  disabled={full || queuing}
                  disabledReason={`The queue holds at most ${QUEUE_LIMIT} waiting jobs.`}
                  onClick={() => enqueue({ target: job.target, requested: job.requested })}
                >
                  Re-run
                </Button>
                <JobStatusLabel status={job.status} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ── View: state on the left, the one action on the right ── */

export function Grind() {
  return (
    <div className="view-in grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="contents min-w-0 xl:block xl:space-y-4">
        <div className="min-w-0 space-y-4">
          <CurrentGrind />
          <GrindQueue />
        </div>
        <div className="order-last min-w-0 xl:order-none"><GrindHistory /></div>
      </div>
      <GrindPlanner />
    </div>
  );
}
