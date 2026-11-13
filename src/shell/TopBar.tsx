import { useEffect, useRef } from "react";
import { Bell, ChevronRight, CircleHelp, Lock, Menu, MoonStar, RefreshCw, Search, SunMedium, TerminalSquare, Volume2, VolumeX } from "lucide-react";
import { useAlerts, type AlertItem } from "../state/derive";
import { useConsole } from "../state/store";
import { IconButton, Kbd, StatusDot } from "../ui/kit";
import { cn } from "../utils/cn";
import { MOD_LABEL } from "../utils/platform";
import { VIEW_META } from "./Sidebar";

/* ── Connection pill ───────────────────────────────────── */

function ConnectionPill() {
  const live = useConsole((s) => s.connection.status === "live");
  const age = useConsole((s) => Math.max(0, Math.round((s.nowTick - s.connection.lastSnapshotAt) / 1000)));
  const retryIn = useConsole((s) => Math.max(1, Math.ceil(s.connection.nextRetryIn / 1000)));
  const target = useConsole((s) => s.clusterTarget);
  return (
    <div
      title={
        live
          ? `Connected to ${target} · supervisor accepted the last snapshot ${age}s ago.`
          : `The supervisor is unreachable. The console keeps the last snapshot and retries in ${retryIn}s.`
      }
      className={cn(
        "num hidden h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[11.5px] font-medium xl:flex",
        live ? "border-line-2 bg-panel/70 text-mute" : "border-warn/35 bg-warn/10 text-warn",
      )}
    >
      <StatusDot tone={live ? "ok" : "warn"} />
      {live ? (
        <>
          <span>Live</span>
          <span className="font-mono text-[11px] font-normal text-faint">{age === 0 ? "just now" : `${age}s ago`}</span>
          <span aria-hidden="true" className="text-line-2">·</span>
          <span className="font-mono text-[11px] font-normal text-faint">{target}</span>
        </>
      ) : (
        `Retry in ${retryIn}s`
      )}
    </div>
  );
}

/* ── Notifications ─────────────────────────────────────── */

function Notifications() {
  const open = useConsole((s) => s.notificationsOpen);
  const setOpen = useConsole((s) => s.setNotificationsOpen);
  const setView = useConsole((s) => s.setView);
  const selectBot = useConsole((s) => s.selectBot);
  const setTerminalOpen = useConsole((s) => s.setTerminalOpen);
  const setTermFilter = useConsole((s) => s.setTermFilter);
  const alerts = useAlerts();
  const root = useRef<HTMLDivElement>(null);
  const worst = alerts[0]?.tone;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const follow = (alert: AlertItem) => {
    if (alert.botId) selectBot(alert.botId);
    setView(alert.view); // also closes the popover
  };

  return (
    <div ref={root} className="relative">
      <IconButton
        icon={Bell}
        label={`Notifications, ${alerts.length} open`}
        aria-expanded={open}
        aria-haspopup="dialog"
        active={open}
        onClick={() => setOpen(!open)}
      />
      {alerts.length > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "num pointer-events-none absolute right-0.5 top-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] text-[9px] font-bold leading-none text-canvas ring-2 ring-canvas",
            worst === "danger" ? "bg-danger" : worst === "warn" ? "bg-warn" : "bg-info",
          )}
        >
          {alerts.length}
        </span>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="pop-in z-40 overflow-hidden rounded-xl border border-line-2 bg-[var(--surface-solid)] shadow-pop max-sm:fixed max-sm:inset-x-3 max-sm:top-[68px] sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]"
        >
          <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-[14.5px] font-semibold text-ink">Notifications</h2>
            <span className="num text-[11px] text-faint">{alerts.length === 0 ? "all clear" : `${alerts.length} open`}</span>
          </header>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="font-display text-[14px] font-semibold text-ink">The world is quiet</p>
              <p className="mt-1 text-[12px] text-mute">Nothing needs your attention right now.</p>
            </div>
          ) : (
            <ul className="max-h-[min(52vh,360px)] divide-y divide-line overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <button type="button" onClick={() => follow(alert)} className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2">
                    <StatusDot tone={alert.tone === "info" ? "accent" : alert.tone} className="mt-[6px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold leading-snug text-ink">{alert.title}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-mute">{alert.detail}</span>
                    </span>
                    <ChevronRight size={13} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <footer className="border-t border-line p-1.5">
            <button
              type="button"
              onClick={() => {
                setTermFilter("warn");
                setTerminalOpen(true);
                setOpen(false);
              }}
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-medium text-mute transition-colors hover:bg-panel-2 hover:text-ink"
            >
              Show warnings in the console
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

/* ── Top bar ───────────────────────────────────────────── */

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const view = useConsole((s) => s.view);
  const theme = useConsole((s) => s.theme);
  const toggleTheme = useConsole((s) => s.toggleTheme);
  const sound = useConsole((s) => s.sound);
  const toggleSound = useConsole((s) => s.toggleSound);
  const refresh = useConsole((s) => s.refresh);
  const refreshing = useConsole((s) => s.refreshing);
  const setPaletteOpen = useConsole((s) => s.setPaletteOpen);
  const setHelpOpen = useConsole((s) => s.setHelpOpen);
  const terminalOpen = useConsole((s) => s.terminalOpen);
  const setTerminalOpen = useConsole((s) => s.setTerminalOpen);
  const lockDash = useConsole((s) => s.lockDash);
  const meta = VIEW_META[view];
  const night = theme === "yozakura";

  return (
    <header className="chrome sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-0.5 border-b border-line px-2 sm:h-[68px] sm:gap-1.5 sm:px-3 lg:px-7">
      <IconButton icon={Menu} label="Open navigation" onClick={onMenu} size="sm" className="max-sm:size-8 lg:hidden" />

      <div className="min-w-0 flex-1 pl-1 lg:pl-0">
        <h1 className="truncate font-display text-[18px] font-semibold leading-tight text-ink">{meta.title}</h1>
        <p className="hidden truncate text-[11px] text-faint lg:block">{meta.sub}</p>
      </div>

      <ConnectionPill />

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="ml-1 hidden h-9 items-center gap-2 rounded-lg border border-line-2 bg-panel-2/60 pl-3 pr-2 text-[12px] text-mute transition-colors hover:border-faint/60 hover:text-ink md:flex"
      >
        <Search size={13} />
        <span className="whitespace-nowrap pr-2">Search or jump to…</span>
        <span className="flex items-center gap-0.5">
          <Kbd>{MOD_LABEL}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <Notifications />
      <IconButton icon={Search} label="Search or jump to" onClick={() => setPaletteOpen(true)} className="md:hidden" />
      <IconButton icon={RefreshCw} label="Refresh snapshot (R)" spin={refreshing} onClick={refresh} className="hidden md:inline-flex" />
      <IconButton
        icon={sound ? Volume2 : VolumeX}
        label={sound ? "Mute interface sounds (S)" : "Enable interface sounds (S)"}
        aria-pressed={sound}
        active={sound}
        onClick={toggleSound}
        className="hidden md:inline-flex"
      />
      <IconButton
        icon={CircleHelp}
        label="Keyboard shortcuts (?)"
        onClick={() => setHelpOpen(true)}
        className="hidden lg:inline-flex"
      />
      <button
        type="button"
        aria-label={night ? "Switch to Hanami, the day theme (T)" : "Switch to Yozakura, the night theme (T)"}
        title={night ? "Switch to day theme (T)" : "Switch to night theme (T)"}
        onClick={toggleTheme}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-panel-2 hover:text-ink"
      >
        {/* The icon swaps immediately and rotates in. An exit animation would
            leave the old glyph on screen whenever frames are throttled. */}
        <span key={theme} className="theme-swap">
          {night ? <SunMedium size={16} /> : <MoonStar size={16} />}
        </span>
      </button>
      <IconButton
        icon={Lock}
        label="Lock console"
        onClick={lockDash}
        className="max-[360px]:hidden"
      />
      <IconButton
        icon={TerminalSquare}
        label={`${terminalOpen ? "Collapse" : "Open"} console (${MOD_LABEL} J)`}
        aria-pressed={terminalOpen}
        active={terminalOpen}
        onClick={() => setTerminalOpen(!terminalOpen)}
        className="max-[360px]:hidden"
      />
    </header>
  );
}

