import type { JobStatus } from "../data/model";
import { cn } from "../utils/cn";

const STATUS: Record<JobStatus, string> = {
  running: "text-ink",
  submitted: "text-mute",
  queued: "text-mute",
  pausing: "text-warn",
  paused: "text-warn",
  cancelling: "text-warn",
  blocked: "text-danger",
  completed: "text-mute",
  cancelled: "text-faint",
  failed: "text-danger",
};

/** Plain coloured status word. Quieter than a pill in dense lists. */
export function JobStatusLabel({ status, className }: { status: JobStatus; className?: string }) {
  return <span className={cn("shrink-0 text-[11px] font-semibold", STATUS[status], className)}>{status}</span>;
}

/** Label and value pair used in the small stat grids under a job. */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className={cn("num mt-1 truncate text-[13px] font-medium", tone === "warn" ? "text-warn" : "text-ink")} title={value}>
        {value}
      </dd>
    </div>
  );
}
