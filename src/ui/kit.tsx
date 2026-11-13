import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { Loader2, Minus, Plus, type LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";

/* ── Panel ─────────────────────────────────────────────── */

export function Panel({
  eyebrow,
  title,
  sub,
  tools,
  children,
  className,
  bodyClassName,
  pad = true,
}: {
  eyebrow?: string;
  title?: ReactNode;
  sub?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  pad?: boolean;
}) {
  const hasHead = Boolean(eyebrow || title || tools);
  return (
    <section className={cn("panel min-w-0", className)}>
      {hasHead && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-5">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h3 className="mt-1 text-balance font-display text-[17px] font-semibold leading-snug text-ink">{title}</h3>}
            {sub && <div className="mt-1 text-[12px] leading-relaxed text-mute">{sub}</div>}
          </div>
          {tools && <div className="flex shrink-0 items-center gap-1.5">{tools}</div>}
        </header>
      )}
      <div className={cn(pad && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ── Buttons ───────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "xs" | "sm" | "md";
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  loadingLabel?: string;
  /** Shown as a tooltip while the button is disabled, so the reason is never a mystery. */
  disabledReason?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: IconCmp, iconRight: IconRightCmp, loading, loadingLabel, disabledReason, className, children, disabled, title, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      title={disabled && disabledReason ? disabledReason : title}
      className={cn(
        "group/btn inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "xs" && "h-7 gap-1.5 rounded-md px-2.5 text-[11.5px]",
        size === "sm" && "h-8 gap-1.5 px-3 text-[12px]",
        size === "md" && "h-9 gap-2 px-3.5 text-[12.5px]",
        variant === "primary" && "btn-primary",
        variant === "secondary" && "btn-secondary",
        variant === "quiet" && "text-mute enabled:hover:bg-panel-2 enabled:hover:text-ink",
        variant === "danger" && "border border-danger/35 bg-danger/10 text-danger enabled:hover:border-danger/50 enabled:hover:bg-danger/16",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === "xs" ? 12 : 13.5} className=" shrink-0 animate-spin text-current" />
      ) : IconCmp ? (
        <IconCmp
          size={size === "xs" ? 12 : 13.5}
          strokeWidth={1.9}
          className={cn(
            "shrink-0 transition-colors",
            variant === "primary" || variant === "danger" ? "text-current" : "text-mute group-hover/btn:text-ink",
          )}
        />
      ) : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
      {!loading && IconRightCmp ? (
        <IconRightCmp
          size={size === "xs" ? 12 : 13.5}
          strokeWidth={1.9}
          className={cn(
            "shrink-0 transition-colors",
            variant === "primary" || variant === "danger" ? "text-current" : "text-mute group-hover/btn:text-ink",
          )}
        />
      ) : null}
    </button>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  /** Accessible name, also used as the tooltip. */
  label: string;
  size?: "sm" | "md";
  active?: boolean;
  tone?: "default" | "danger";
  spin?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: IconCmp, label, size = "md", active, tone = "default", spin, className, title, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35",
        size === "sm" ? "size-7" : "size-9",
        active ? "text-rose" : "text-mute",
        tone === "danger" ? "enabled:hover:bg-danger/10 enabled:hover:text-danger" : "enabled:hover:bg-panel-2 enabled:hover:text-ink",
        className,
      )}
      {...rest}
    >
      <IconCmp size={size === "sm" ? 13 : 15.5} strokeWidth={1.9} className={cn(spin && "animate-spin")} />
    </button>
  );
});

/* ── Status ────────────────────────────────────────────── */

/* A healthy state is a quiet outlined chip with a coloured dot. Only states
   that need attention get a tinted fill. */
/* Chips sit on every surface, including the raised one, so a translucent wash
   can never guarantee contrast. An opaque fill plus a coloured border and ink
   does, and reads as a quiet badge rather than a coloured pill. */
const chipTone = {
  ok: "border border-line-2 bg-[var(--surface-solid)] text-mute",
  warn: "border border-warn/35 bg-[var(--surface-solid)] text-warn",
  danger: "border border-danger/35 bg-[var(--surface-solid)] text-danger",
  idle: "border border-transparent bg-panel-3 text-mute",
  accent: "border border-rose/35 bg-[var(--surface-solid)] text-rose",
  info: "border border-info/35 bg-[var(--surface-solid)] text-info",
  neutral: "border border-line-2 text-mute",
} as const;

const chipDot = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  idle: "bg-faint",
  accent: "bg-rose",
  info: "bg-info",
  neutral: "bg-faint",
} as const;

export function Chip({
  tone = "idle",
  dot,
  children,
  className,
}: {
  tone?: keyof typeof chipTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex h-[21px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[10.5px] font-semibold", chipTone[tone], className)}>
      {dot && <span className={cn("size-[5px] rounded-full", chipDot[tone])} />}
      {children}
    </span>
  );
}

const dotTone = { ok: "text-ok", warn: "text-warn", danger: "text-danger", idle: "text-faint", accent: "text-rose" } as const;

export function StatusDot({ tone = "ok", pulse, className }: { tone?: keyof typeof dotTone; pulse?: boolean; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-[7px] shrink-0 rounded-full bg-current", dotTone[tone], pulse && "live-dot", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-2 bg-panel-2 px-1 font-mono text-[10px] font-medium text-mute">
      {children}
    </kbd>
  );
}

/* ── Controls ──────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200",
        checked ? "border-rose bg-rose text-on-rose" : "border-line-2 bg-panel-3 text-mute",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <motion.span
        className="absolute left-[2px] top-[2px] size-4 rounded-full bg-current shadow-[0_1px_2px_rgb(0_0_0/0.28)]"
        initial={false}
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: "spring", stiffness: 550, damping: 38 }}
      />
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={label}
      className="slider w-full disabled:opacity-50"
      style={{ "--fill": `${fill}%` } as CSSProperties}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  const groupId = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-line bg-panel-2 p-0.5", className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 :
              (index + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
            onChange(options[next].value);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
          }}
          className={cn(
            "num relative flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors duration-150",
            value === option.value ? "text-ink" : "text-faint hover:text-mute",
          )}
        >
          {value === option.value && (
            <motion.span
              layoutId={`segment-${groupId}`}
              className="absolute inset-0 rounded-md bg-raise shadow-[0_1px_2px_rgb(0_0_0/0.14)]"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (next: number) => {
    const safe = Math.max(min, Math.min(max, Math.round(next)));
    setDraft(String(safe));
    onChange(safe);
  };
  const side = "flex w-8 items-center justify-center text-mute transition-colors enabled:hover:bg-panel-3 enabled:hover:text-ink disabled:opacity-35";
  return (
    <div className="inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-line-2 bg-panel-2 focus-within:border-rose/60">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => commit(value - step)} className={side}>
        <Minus size={13} />
      </button>
      <input
        aria-label={label}
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9]/g, "");
          setDraft(next);
          if (next && Number(next) >= min) onChange(Math.min(max, Number(next)));
        }}
        onBlur={() => commit(draft ? Number(draft) : value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            commit(value + (e.key === "ArrowUp" ? step : -step));
          }
        }}
        className="num w-14 border-x border-line bg-transparent text-center text-[13px] font-medium text-ink focus:outline-none"
      />
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => commit(value + step)} className={side}>
        <Plus size={13} />
      </button>
    </div>
  );
}

/* ── Meters ────────────────────────────────────────────── */

/** Healthy readings are drawn in neutral ink; colour is kept for exceptions. */
const meterTone = { accent: "bg-rose", neutral: "bg-ink/45", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", gold: "bg-gold" } as const;

/** Ten-cell vital meter, the way Minecraft counts hearts and drumsticks. */
export function VialMeter({ value, max = 20, tone, label }: { value: number; max?: number; tone: "ok" | "warn" | "danger"; label: string }) {
  const cells = 10;
  const filled = Math.round((Math.max(0, value) / max) * cells);
  const fill = tone === "ok" ? meterTone.neutral : meterTone[tone];
  return (
    <span className="flex items-center gap-[3px] max-[360px]:gap-[2px]" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-[7px] w-[5px] rounded-[1.5px] transition-colors duration-300 max-[360px]:w-[4px]",
            i < filled ? fill : "bg-panel-3",
          )}
        />
      ))}
    </span>
  );
}

export function Bar({
  value,
  tone = "accent",
  milestones,
  active,
  className,
}: {
  value: number;
  tone?: keyof typeof meterTone;
  milestones?: boolean;
  /** Shows a subtle travelling light pulse when a job is actively progressing. */
  active?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative h-[5px] w-full overflow-hidden rounded-full bg-panel-3", className)}>
      <div
        className={cn("relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out", meterTone[tone])}
        style={{ width: `${clamped}%` }}
      >
        {active && clamped > 0 && clamped < 100 && <span aria-hidden="true" className="bar-shimmer absolute inset-0" />}
      </div>
      {milestones && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex justify-evenly">
          <span className="h-full w-px bg-panel/65" />
          <span className="h-full w-px bg-panel/65" />
          <span className="h-full w-px bg-panel/65" />
        </div>
      )}
    </div>
  );
}

/* ── Form ──────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  dirty,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  dirty?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
        <span>{label}</span>
        {dirty && <span title="Unsaved change" className="size-1.5 rounded-full bg-warn" />}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[11.5px] leading-snug text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "h-9 w-full rounded-lg border bg-panel-2 text-[13px] text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-2";
const inputTone = (invalid?: boolean) =>
  invalid ? "border-danger/60 focus:border-danger focus:ring-danger/20" : "border-line-2 hover:border-faint/70 focus:border-rose/70 focus:ring-rose/20";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...rest }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(inputBase, inputTone(invalid), "num px-3", className)} {...rest} />;
  },
);

export function Select({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, inputTone(), "appearance-none pl-3 pr-8")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ── Content blocks ────────────────────────────────────── */

export function EmptyState({
  icon: IconCmp,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-panel-2 text-faint">
        <IconCmp size={18} strokeWidth={1.8} />
      </span>
      <h4 className="mt-3 font-display text-[15px] font-semibold text-ink">{title}</h4>
      {children && <p className="mt-1.5 max-w-[46ch] text-[12.5px] leading-relaxed text-mute">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Metric({
  label,
  value,
  unit,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: "default" | "ok" | "warn" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "num mt-1.5 font-display text-[23px] font-medium leading-none tracking-[-0.01em]",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
          tone === "default" && "text-ink",
        )}
      >
        {value}
        {unit && <span className="ml-1 font-sans text-[11px] font-medium text-faint">{unit}</span>}
      </p>
      {hint && <div className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-faint">{hint}</div>}
    </div>
  );
}
