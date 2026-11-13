import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Compass,
  FileBox,
  Hammer,
  History,
  Layers,
  Pause,
  Pickaxe,
  Play,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import {
  fmtAgo,
  fmtBytes,
  fmtDuration,
  fmtInt,
  layerOf,
  prettyBlock,
} from "../data/model";
import { useConsole } from "../state/store";
import { BUILD_SANCTUARY_ART, BlockIcon, Blueprint, BuildHeroArt } from "../ui/art";
import { Bar, Button, Chip, EmptyState, Field, IconButton, Panel, Segmented, Switch, TextInput } from "../ui/kit";
import { Dialog } from "../ui/overlay";
import { cn } from "../utils/cn";
import { JobStatusLabel, Stat } from "./shared";

/* ── Build Hero (uses /assets/aistudio/image_b04824af.png) ── */

function BuildHeroStat({
  label,
  value,
  unit,
  note,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 border-line px-4 py-3.5 max-xl:[&:nth-child(n+3)]:border-t max-xl:[&:nth-child(odd)]:border-r sm:px-5 xl:px-6">
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0">
        <span className="num mt-1 block font-display text-[22px] font-medium leading-none text-ink">
          {value}
          {unit && <span className="ml-1 font-sans text-[11px] font-medium text-faint">{unit}</span>}
        </span>
        {note && (
          <span
            className={cn(
              "num mt-1.5 block truncate text-[10.5px] leading-snug",
              warn ? "text-warn" : "text-faint",
            )}
          >
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

function BuildHero() {
  const job = useConsole((s) => s.build.current);
  const history = useConsole((s) => s.build.history);
  const now = useConsole((s) => s.nowTick);
  const stageSample = useConsole((s) => s.buildStageSample);
  const uploading = useConsole((s) => s.buildUploadProgress !== null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const pct = job && job.totalBlocks > 0 ? Math.min(100, Math.round((job.placed / job.totalBlocks) * 100)) : 0;
  const layer = job ? layerOf(job) : 0;
  const missing = job ? job.materials.filter((m) => m.missing) : [];
  const readyCount = job ? job.materials.length - missing.length : 0;

  const startedAt = job ? (job.startedAt ?? job.createdAt) : 0;
  const minutes = job && startedAt > 0 ? Math.max(now - startedAt, 1_000) / 60_000 : 0;
  const rate = job && minutes > 0 ? job.placed / minutes : 0;
  const paused = job?.status === "paused" || job?.status === "pausing";
  const blocked = job?.status === "blocked";
  const stopping = job?.status === "cancelling";
  const left =
    job && !paused && !blocked && !stopping && rate >= 0.5
      ? ((job.totalBlocks - job.placed) / rate) * 60_000
      : null;

  const headline = !job
    ? "Ready to place a schematic"
    : blocked
      ? `${job.name} needs materials`
      : paused
        ? `${job.name} is paused at ${pct}%`
        : `Building ${job.name}`;

  const lead = !job
    ? "Drop a Sponge .schem file into the planner below. ENI1 validates its bounding box, checks inventory for required blocks, and places it layer by layer."
    : job.message
      ? `${job.message} ${fmtInt(job.placed)} of ${fmtInt(job.totalBlocks)} blocks are in place.`
      : `Placing layer ${layer} of ${job.layers} (${fmtInt(job.placed)} of ${fmtInt(job.totalBlocks)} blocks).`;

  return (
    <>
      <section className="hero-summary relative overflow-hidden rounded-[14px] border border-line" aria-label="Builder summary">
        <BuildHeroArt />
        <div className="relative px-5 py-6 sm:px-6 lg:px-7">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="eyebrow">Schematic builder</p>
            {job && (
              <>
                <span aria-hidden="true" className="text-line-2">·</span>
                <span className="font-mono text-[11px] text-mute">{job.fileName}</span>
                {job.size[0] > 0 && (
                  <>
                    <span aria-hidden="true" className="hidden text-line-2 sm:inline">·</span>
                    <span className="num hidden font-mono text-[11px] text-faint sm:inline">
                      {job.size[0]}×{job.size[1]}×{job.size[2]}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <h2 className="mt-2.5 max-w-[28ch] text-balance font-display text-[clamp(24px,2.4vw,31px)] font-semibold leading-[1.12] tracking-[-0.015em] text-ink">
            {headline}
          </h2>

          <p className="mt-2 max-w-[59ch] text-[12.5px] leading-relaxed text-mute">
            {lead}{" "}
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 rounded font-semibold text-rose transition-colors hover:text-rose-2"
            >
              View reference render <ArrowUpRight size={12} />
            </button>
          </p>
        </div>

        <dl className="glass relative grid grid-cols-2 border-t border-line xl:grid-cols-4 xl:divide-x xl:divide-line">
          <BuildHeroStat
            label="Placement progress"
            value={job ? `${pct}` : "—"}
            unit={job ? "%" : undefined}
            note={job ? `${fmtInt(job.placed)} of ${fmtInt(job.totalBlocks)} blocks` : "no active schematic"}
          />
          <BuildHeroStat
            label="Elevation layer"
            value={job && job.layers > 0 ? `${layer}/${job.layers}` : "—"}
            unit={job && job.layers > 0 ? "layers" : undefined}
            note={
              job?.origin
                ? `origin ${job.origin.x} · ${job.origin.y} · ${job.origin.z}`
                : "relative to builder"
            }
          />
          <BuildHeroStat
            label="Placement cadence"
            value={job && rate > 0 ? rate.toFixed(0) : "—"}
            unit={job && rate > 0 ? "blk/min" : undefined}
            note={
              left !== null
                ? `${fmtDuration(left)} remaining`
                : job
                  ? `status: ${job.status}`
                  : `${history.length} completed in archive`
            }
          />
          <BuildHeroStat
            label="Material manifest"
            value={job && job.materials.length > 0 ? `${readyCount}/${job.materials.length}` : "—"}
            unit={job && job.materials.length > 0 ? "ready" : undefined}
            note={
              !job || job.materials.length === 0
                ? "reported after validation"
                : missing.length > 0
                  ? `${missing.length} block type${missing.length === 1 ? "" : "s"} short`
                  : "all required blocks staged"
            }
            warn={missing.length > 0}
          />
        </dl>
      </section>

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        eyebrow="Schematic reference"
        title="Hanami Pavilion sanctuary"
        width="lg"
        footer={
          <>
            <Button variant="quiet" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              icon={Sparkles}
              loading={uploading}
              loadingLabel="Staging"
              onClick={() => {
                stageSample({ fileName: "hanami_pavilion.schem" });
                setPreviewOpen(false);
              }}
            >
              Stage Hanami Pavilion
            </Button>
          </>
        }
      >
        <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
          <img
            src={BUILD_SANCTUARY_ART}
            alt="Moonlit cherry-blossom sanctuary with lakeside timber pavilion and arched bridge"
            referrerPolicy="no-referrer"
            className="max-h-[62vh] w-full object-cover"
          />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-mute">
          Lakeside shoji pavilion (`hanami_pavilion.schem`, 24×12×18 m, 2,496 blocks) in the Yozakura basin.
        </p>
      </Dialog>
    </>
  );
}

/* ── Active build ──────────────────────────────────────── */

function CurrentBuild() {
  const job = useConsole((s) => s.build.current);
  const now = useConsole((s) => s.nowTick);
  const togglePause = useConsole((s) => s.buildTogglePause);
  const cancel = useConsole((s) => s.buildCancel);
  const stageSample = useConsole((s) => s.buildStageSample);
  const askConfirm = useConsole((s) => s.askConfirm);
  const setView = useConsole((s) => s.setView);
  const grindEnqueue = useConsole((s) => s.grindEnqueue);
  const pausing = useConsole((s) => Boolean(s.pending["build:pause"]));
  const cancelling = useConsole((s) => Boolean(s.pending["build:cancel"]));
  const queuingGrind = useConsole((s) => Boolean(s.pending["grind:queue"]));

  if (!job) {
    return (
      <Panel>
        <EmptyState
          icon={Hammer}
          title="No active schematic"
          action={
            <Button
              size="sm"
              variant="primary"
              icon={Sparkles}
              onClick={() => stageSample({ fileName: "hanami_pavilion.schem" })}
            >
              Stage sample schematic
            </Button>
          }
        >
          Upload a Sponge .schem from the planner. ENI1 validates it, stages materials, then places it layer by layer.
        </EmptyState>
      </Panel>
    );
  }

  const paused = job.status === "paused" || job.status === "pausing";
  const blocked = job.status === "blocked";
  const stopping = job.status === "cancelling";
  const running = job.status === "running";
  const canPause = running || job.status === "paused";
  const pct = job.totalBlocks > 0 ? Math.min(100, Math.round((job.placed / job.totalBlocks) * 100)) : 0;
  const layer = layerOf(job);
  const missing = job.materials.filter((m) => m.missing);

  const startedAt = job.startedAt ?? job.createdAt;
  const minutes = startedAt > 0 ? Math.max(now - startedAt, 1_000) / 60_000 : 0;
  const rate = minutes > 0 ? job.placed / minutes : 0;
  const left = !paused && !blocked && !stopping && rate >= 0.5 ? ((job.totalBlocks - job.placed) / rate) * 60_000 : null;

  const eyebrow = blocked ? "Builder · blocked" : paused ? "Builder · paused" : stopping ? "Builder · stopping" : "Builder · active placement";
  const tone = blocked ? "danger" : paused || stopping ? "warn" : "ok";

  return (
    <Panel
      eyebrow={eyebrow}
      title={job.name}
      sub={
        <>
          <span className="font-mono text-[11px]">{job.fileName}</span>
          {job.message ? ` · ${job.message}` : ""}
        </>
      }
      tools={
        <>
          {job.replaceBlocks && (
            <Chip tone="warn" className="max-sm:hidden">
              replacing
            </Chip>
          )}
          <Chip tone={tone} dot>
            {job.status}
          </Chip>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_268px]">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <span className="flex size-[64px] shrink-0 items-center justify-center rounded-xl border border-line bg-panel-2">
              <Blueprint dims={job.size} rotation={job.rotation} size={46} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="num font-display text-[32px] font-semibold leading-none text-ink">
                  {pct}
                  <span className="text-[16px] text-faint">%</span>
                </p>
                <p className="num text-[12px] text-mute">
                  {fmtInt(job.placed)} of {fmtInt(job.totalBlocks)} blocks
                </p>
                {job.layers > 0 && (
                  <p className="num ml-auto flex items-center gap-1.5 text-[12px] font-medium text-gold">
                    <Layers size={12} />
                    layer {layer} of {job.layers}
                  </p>
                )}
              </div>
              <Bar value={pct} milestones active={running} tone={blocked ? "danger" : paused ? "warn" : "accent"} className="mt-3" />
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
            <Stat label="Rate" value={rate > 0 ? `${rate.toFixed(0)} / min` : "—"} />
            <Stat label="Time left" value={left === null ? "—" : fmtDuration(left)} />
            <Stat label="Skipped" value={fmtInt(job.skipped)} tone={job.skipped > 100 ? "warn" : undefined} />
            <Stat label="Origin" value={job.origin ? `${job.origin.x} · ${job.origin.y} · ${job.origin.z}` : "at builder"} />
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <p className="text-[11px] text-faint">
              {blocked
                ? "The builder reported a blocker. Clear it, then resume or stop the build."
                : stopping
                  ? "Waiting for ENI1 to acknowledge the stop."
                  : "Pause keeps the job; stop leaves placed blocks in the world."}
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
                    ? "The builder is blocked. Clear the blocker or stop the build."
                    : stopping
                      ? "The build is already stopping."
                      : "Wait for the build to start."
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
                loadingLabel="Stopping"
                disabled={stopping}
                disabledReason="The build is already stopping."
                onClick={() =>
                  askConfirm({
                    eyebrow: "Schematic builder",
                    title: "Stop this build?",
                    description: `${fmtInt(Math.max(0, job.totalBlocks - job.placed))} blocks are still to place. What is already built stays in the world.`,
                    confirmLabel: "Stop build",
                    danger: true,
                    action: () => cancel(job.id),
                  })
                }
              >
                Stop build
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-line bg-panel-2/60 p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Bill of materials</p>
              {missing.length > 0 ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-warn">
                  <TriangleAlert size={11} />
                  {missing.length} missing
                </span>
              ) : (
                <span className="text-[11px] font-medium text-mute">All staged</span>
              )}
            </div>

            {job.materials.length === 0 ? (
              <p className="mt-3 text-[11.5px] leading-snug text-mute">
                No manifest yet. ENI1 reports block counts and missing materials after it validates the schematic.
              </p>
            ) : (
              <ul className="mt-2.5 max-h-[210px] space-y-2 overflow-y-auto pr-1">
                {job.materials.map((m) => (
                  <li key={m.block} className={cn("flex items-center gap-2", m.missing && "text-warn")}>
                    <BlockIcon name={m.block} size={18} />
                    <span className="truncate text-[11.5px] text-ink">{prettyBlock(m.block)}</span>
                    {m.missing && <span className="shrink-0 text-[10px] font-semibold text-warn">missing</span>}
                    <span className="num ml-auto shrink-0 font-mono text-[10.5px] text-faint">× {fmtInt(m.need)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {missing.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[11px] leading-snug text-mute">
                The builder pauses on missing blocks. Queue a grind job directly or open the grind planner.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="xs"
                  icon={Pickaxe}
                  loading={queuingGrind}
                  onClick={() => grindEnqueue({ target: missing[0].block, requested: Math.min(128, Math.max(16, missing[0].need)) })}
                >
                  Queue {prettyBlock(missing[0].block)}
                </Button>
                <Button size="xs" variant="quiet" onClick={() => setView("grind")}>
                  Open grind planner
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ── Planner ───────────────────────────────────────────── */

const ROTATIONS = ["0", "90", "180", "270"] as const;
const AXES = [
  ["x", -29_999_984, 29_999_984],
  ["y", -64, 320],
  ["z", -29_999_984, 29_999_984],
] as const;

const inRange = (value: string, min: number, max: number) => {
  const text = value.trim();
  return text === "" || (/^-?\d+$/.test(text) && Number(text) >= min && Number(text) <= max);
};

function BuildPlanner() {
  const stage = useConsole((s) => s.buildStage);
  const progress = useConsole((s) => s.buildUploadProgress);
  const toast = useConsole((s) => s.toast);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [origin, setOrigin] = useState({ x: "", y: "", z: "" });
  const [rotation, setRotation] = useState<(typeof ROTATIONS)[number]>("0");
  const [replace, setReplace] = useState(false);

  const filled = [origin.x, origin.y, origin.z].filter((v) => v.trim() !== "").length;
  const coordsOk = AXES.every(([axis, min, max]) => inRange(origin[axis], min, max)) && (filled === 0 || filled === 3);
  const uploading = progress !== null;

  const accept = (picked: File) => {
    if (!/\.schem$/i.test(picked.name)) {
      setError(
        /\.litematic$/i.test(picked.name)
          ? "Litematica .litematic files are not supported. Export a Sponge .schem instead."
          : "Choose a Sponge .schem file.",
      );
      return;
    }
    if (picked.size > 8 * 1024 * 1024) {
      setError("That file is larger than the 8 MB limit.");
      return;
    }
    if (picked.size === 0) {
      setError("That file is empty.");
      return;
    }
    setError(null);
    setFile(picked);
  };

  const useForemanPosition = () => {
    const eni = useConsole.getState().bots[0];
    if (!eni || eni.x === null || eni.y === null || eni.z === null) {
      toast({ title: "No position yet", detail: "ENI1 has not reported its position. Enter the origin manually.", tone: "info" });
      return;
    }
    setOrigin({ x: String(Math.round(eni.x)), y: String(Math.round(eni.y)), z: String(Math.round(eni.z)) });
  };

  const launch = () => {
    if (!file || !coordsOk || uploading) return;
    stage({
      fileName: file.name,
      file,
      origin: filled === 3 ? { x: Number(origin.x), y: Number(origin.y), z: Number(origin.z) } : null,
      rotation: Number(rotation),
      replaceBlocks: replace,
    });
  };

  const disabledReason = uploading
    ? "The upload is in progress."
    : !file
      ? "Choose a Sponge .schem file first."
      : !coordsOk
        ? "Fix the origin coordinates first."
        : undefined;

  return (
    <Panel
      eyebrow="Schematic planner"
      title="Load a structure"
      sub="One schematic runs at a time."
    >
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          if (uploading) return;
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) accept(dropped);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-4 text-center transition-colors focus-within:border-rose",
          drag ? "border-rose bg-rose/10" : "border-line-2 hover:border-faint hover:bg-panel-2",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <input
          type="file"
          accept=".schem"
          className="sr-only"
          aria-label="Choose schematic file"
          disabled={uploading}
          onChange={(event) => {
            const picked = event.currentTarget.files?.[0];
            if (picked) accept(picked);
            event.currentTarget.value = "";
          }}
        />
        <Upload size={17} className="text-faint" />
        <span className="text-[12.5px] font-medium text-ink">{file ? "Replace schematic" : "Drop a schematic or choose a file"}</span>
        <span className="eyebrow">Sponge .schem · max 8 MB</span>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-[11.5px] leading-snug text-danger">
          {error}
        </p>
      )}

      {file && (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-line-2 bg-panel-2/70 py-2 pl-2.5 pr-1.5">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-rose">
            <FileBox size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[12px] font-medium text-ink">{file.name}</p>
            <p className="num text-[10px] text-faint">
              {fmtBytes(file.size)} · dimensions and materials are reported after ENI1 validates it
            </p>
          </div>
          <IconButton size="sm" icon={X} label="Remove selected schematic" disabled={uploading} onClick={() => setFile(null)} />
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-medium text-ink">Origin</p>
          <button type="button" onClick={useForemanPosition} className="inline-flex items-center gap-1 rounded text-[11.5px] font-medium text-rose transition-colors hover:text-rose-2">
            <Compass size={11} />
            Use ENI1's position
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {AXES.map(([axis, min, max]) => (
            <div key={axis} className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10.5px] uppercase text-faint">{axis}</span>
              <TextInput
                aria-label={`Origin ${axis.toUpperCase()}`}
                inputMode="numeric"
                placeholder="auto"
                value={origin[axis]}
                invalid={!inRange(origin[axis], min, max)}
                onChange={(event) => setOrigin((current) => ({ ...current, [axis]: event.target.value }))}
                className="pl-7 font-mono"
              />
            </div>
          ))}
        </div>
        <p role={coordsOk ? undefined : "alert"} className={cn("mt-1.5 text-[11.5px] leading-snug", coordsOk ? "text-faint" : "text-danger")}>
          {coordsOk ? "Leave all three empty to build where the builder is standing." : "Use whole numbers within world limits, and fill all three or none."}
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Rotation">
          <Segmented label="Rotation" className="flex w-full" value={rotation} onChange={setRotation} options={ROTATIONS.map((deg) => ({ value: deg, label: `${deg}°` }))} />
        </Field>
        <Field label="Replace existing blocks" hint="Off skips occupied cells.">
          <div className="flex h-[30px] items-center">
            <Switch checked={replace} onChange={setReplace} label="Replace existing blocks" />
          </div>
        </Field>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {uploading && (
          <div className="mb-3">
            <div className="mb-1.5 flex justify-between gap-3 text-[11px] text-mute">
              <span className="truncate">Uploading {file?.name ?? "schematic"}</span>
              <span className="num shrink-0">{Math.round(progress ?? 0)}%</span>
            </div>
            <Bar value={progress ?? 0} active />
          </div>
        )}
        <Button
          variant="primary"
          icon={Play}
          className="w-full"
          disabled={Boolean(disabledReason)}
          disabledReason={disabledReason}
          loading={uploading}
          loadingLabel="Uploading"
          onClick={launch}
        >
          {file ? `Upload & stage ${file.name}` : "Upload and start build"}
        </Button>
      </div>
    </Panel>
  );
}

/* ── History ───────────────────────────────────────────── */

function BuildHistory() {
  const history = useConsole((s) => s.build.history);
  const now = useConsole((s) => s.nowTick);
  const stageSample = useConsole((s) => s.buildStageSample);
  const uploading = useConsole((s) => s.buildUploadProgress !== null);

  return (
    <Panel eyebrow="Archive" title="Build history" pad={false}>
      {history.length === 0 ? (
        <EmptyState icon={History} title="No finished builds yet">
          Completed, failed and stopped builds are kept here. The server owns this list; it is read-only.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {history.map((job) => (
            <li key={job.id} className="flex items-center gap-3 px-5 py-3">
              <Blueprint dims={job.size} rotation={job.rotation} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink">{job.name}</p>
                <p className="num truncate text-[10.5px] text-faint">
                  {fmtInt(job.placed)} of {fmtInt(job.totalBlocks)} placed · {job.skipped} skipped · {fmtAgo(job.finishedAt ?? job.startedAt ?? job.createdAt, now)}
                </p>
              </div>
              <Button
                size="xs"
                variant="quiet"
                icon={RotateCcw}
                disabled={uploading}
                onClick={() => stageSample({ fileName: job.fileName, rotation: job.rotation, origin: job.origin })}
              >
                Re-stage
              </Button>
              <JobStatusLabel status={job.status} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Build() {
  return (
    <div className="view-in space-y-4">
      <BuildHero />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="contents min-w-0 xl:block xl:space-y-4">
          <div className="min-w-0">
            <CurrentBuild />
          </div>
          <div className="order-last min-w-0 xl:order-none">
            <BuildHistory />
          </div>
        </div>
        <BuildPlanner />
      </div>
    </div>
  );
}
