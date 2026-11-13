import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useSound } from "../hooks/useSound";
import { useConsole } from "../state/store";
import { cn } from "../utils/cn";
import { Button, IconButton } from "./kit";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/* ── Dialog ────────────────────────────────────────────── */

export function Dialog({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  width = "sm",
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Parents re-render on every telemetry tick. Reading onClose through a ref
  // keeps the focus effect from re-running and stealing focus mid-typing.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    (node?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0])?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  // Portalled to the body so no ancestor (a scrolling view, a transformed
  // wrapper) can clip the dialog or trap it under the console.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" tabIndex={-1} aria-label="Close dialog" className="fade-in absolute inset-0 cursor-default bg-scrim backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "glass-deep sheet-in relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl border border-line-2 shadow-pop",
          width === "sm" && "max-w-[430px]",
          width === "md" && "max-w-[540px]",
          width === "lg" && "max-w-[760px]",
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 className="mt-1 font-display text-[19px] font-semibold leading-snug text-ink">{title}</h2>
          </div>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-1 -mt-1" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3.5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ── Confirm dialog (store-driven) ─────────────────────── */

export function ConfirmDialog() {
  const confirm = useConsole((s) => s.confirm);
  const resolve = useConsole((s) => s.resolveConfirm);
  const danger = Boolean(confirm?.danger);
  return (
    <Dialog
      open={Boolean(confirm)}
      onClose={() => resolve(false)}
      eyebrow={confirm?.eyebrow}
      title={confirm?.title ?? "Confirm"}
      footer={
        <>
          {/* Destructive prompts rest on Cancel, so a stray Enter is harmless. */}
          <Button variant="quiet" onClick={() => resolve(false)} data-autofocus={danger ? "" : undefined}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => resolve(true)} data-autofocus={danger ? undefined : ""}>
            {confirm?.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {confirm?.description && <p className="text-[13px] leading-relaxed text-mute">{confirm.description}</p>}
    </Dialog>
  );
}

/* ── Toasts ────────────────────────────────────────────── */

const toastIcon = { ok: CheckCircle2, warn: AlertTriangle, danger: XCircle, info: Info } as const;
const toastTint = { ok: "text-ok", warn: "text-warn", danger: "text-danger", info: "text-info" } as const;
const toastBarTint = { ok: "bg-ok/70", warn: "bg-warn/70", danger: "bg-danger/70", info: "bg-info/70" } as const;

export function ToastStack() {
  const toasts = useConsole((s) => s.toasts);
  const dismiss = useConsole((s) => s.dismissToast);
  const sound = useConsole((s) => s.sound);
  const dockOpen = useConsole((s) => s.terminalOpen);
  const dockHeight = useConsole((s) => s.terminalHeight);
  const play = useSound(sound);
  // Sit just above the console dock, whatever its height, so toasts never
  // cover the header or the controls at the top of a view.
  const bottom = (dockOpen ? dockHeight : 36) + 16;
  const lastId = useRef(0);

  useEffect(() => {
    const newest = toasts[toasts.length - 1];
    if (!newest || newest.id <= lastId.current) return;
    lastId.current = newest.id;
    play(newest.tone === "danger" || newest.tone === "warn" ? "warn" : "ok");
  }, [toasts, play]);

  return (
    <div
      className="pointer-events-none fixed right-4 z-[60] flex w-[330px] max-w-[calc(100vw-2rem)] flex-col justify-end gap-2 transition-[bottom] duration-300"
      style={{ bottom }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const IconCmp = toastIcon[t.tone];
        return (
          <div key={t.id} className="glass-deep toast-in pointer-events-none relative flex items-start gap-2.5 overflow-hidden rounded-xl border border-line-2 py-2.5 pl-3.5 pr-2 shadow-pop">
            <IconCmp size={15} className={cn("mt-[2px] shrink-0", toastTint[t.tone])} />
            <div className="min-w-0 flex-1 py-px">
              <p className="text-[12.5px] font-semibold leading-tight text-ink">{t.title}</p>
              {t.detail && <p className="mt-0.5 text-[11.5px] leading-snug text-mute">{t.detail}</p>}
            </div>
            {/* Toasts are click-through so they never block the UI beneath; only dismiss catches the pointer. */}
            <IconButton icon={X} label="Dismiss" size="sm" onClick={() => dismiss(t.id)} className="pointer-events-auto" />
            <span
              aria-hidden="true"
              className={cn("toast-timer absolute inset-x-0 bottom-0 h-[2px] origin-left", toastBarTint[t.tone])}
            />
          </div>
        );
      })}
    </div>
  );
}
