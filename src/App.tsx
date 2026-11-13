import { useEffect, useRef, useState, type ComponentType } from "react";
import { MotionConfig } from "framer-motion";
import { api } from "./data/api";
import type { View } from "./data/model";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import { CommandPalette } from "./shell/CommandPalette";
import { PinGate } from "./shell/PinGate";
import { Sidebar, VIEW_META } from "./shell/Sidebar";
import { TabNav } from "./shell/TabNav";
import { TerminalDock } from "./shell/TerminalDock";
import { TopBar } from "./shell/TopBar";
import { POLL_MS, useConsole, viewFromHash, type PollPayload } from "./state/store";
import { Button, Kbd, StatusDot } from "./ui/kit";
import { ConfirmDialog, Dialog, ToastStack } from "./ui/overlay";
import { MOD_LABEL } from "./utils/platform";
import { Addons } from "./views/Addons";
import { Build } from "./views/Build";
import { Fleet } from "./views/Fleet";
import { Grind } from "./views/Grind";
import { Landing } from "./views/Landing";
import { Providers } from "./views/Providers";
import { Settings, SettingsSaveBar } from "./views/Settings";

const VIEW_COMPONENTS: Record<View, ComponentType> = {
  fleet: Fleet,
  grind: Grind,
  build: Build,
  addons: Addons,
  providers: Providers,
  settings: Settings,
};

const SHORTCUTS: [keys: string[], label: string][] = [
  [[MOD_LABEL, "K"], "Search views, agents and actions"],
  [[MOD_LABEL, "J"], "Open or collapse the console"],
  [["G", "F"], "Go to Fleet"],
  [["G", "G"], "Go to Grind"],
  [["G", "B"], "Go to Build"],
  [["G", "A"], "Go to Add-ons"],
  [["G", "P"], "Go to Providers"],
  [["G", "S"], "Go to Settings"],
  [["R"], "Refresh the snapshot"],
  [["T"], "Switch between night and day"],
  [["S"], "Toggle interface sounds"],
  [["?"], "Show this list"],
];

function ShortcutSheet() {
  const open = useConsole((s) => s.helpOpen);
  const setOpen = useConsole((s) => s.setHelpOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} eyebrow="Reference" title="Keyboard shortcuts" width="md">
      <dl className="grid gap-x-8 sm:grid-cols-2">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-line py-2.5">
            <dt className="text-[12.5px] text-mute">{label}</dt>
            <dd className="flex shrink-0 items-center gap-1">
              {keys.map((key, index) => (
                <Kbd key={`${key}-${index}`}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11.5px] text-faint">Single-key shortcuts pause while you are typing in a field.</p>
    </Dialog>
  );
}

function ConnectionBanner() {
  const down = useConsole((s) => s.connection.status !== "live");
  const retryIn = useConsole((s) => Math.max(1, Math.ceil(s.connection.nextRetryIn / 1000)));
  const age = useConsole((s) => Math.max(0, Math.round((s.nowTick - s.connection.lastSnapshotAt) / 1000)));
  const refresh = useConsole((s) => s.refresh);
  const refreshing = useConsole((s) => s.refreshing);
  if (!down) return null;
  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-warn/30 bg-warn/10 px-4 py-2 text-[12px] lg:px-5">
      <StatusDot tone="warn" className="animate-pulse" />
      <strong className="font-semibold text-warn">Reconnecting to the supervisor</strong>
      <span className="num text-mute">
        Showing the snapshot from {age}s ago. Next attempt in {retryIn}s.
      </span>
      <Button size="xs" className="ml-auto" loading={refreshing} loadingLabel="Retrying" onClick={refresh}>
        Retry now
      </Button>
    </div>
  );
}

export default function App() {
  const showLanding = useConsole((s) => s.showLanding);
  const dashUnlocked = useConsole((s) => s.dashUnlocked);
  const view = useConsole((s) => s.view);
  const visit = useConsole((s) => s.visit);
  const [drawer, setDrawer] = useState(false);
  const main = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Single-key shortcuts stand down while a modal owns the keyboard or the console is PIN-locked.
  const store = useConsole.getState;
  const idle = (run: () => void) => () => {
    if (!store().dashUnlocked) return;
    if (!document.querySelector('[aria-modal="true"]')) run();
  };
  useKeyboardNav({
    "mod+k": () => {
      if (store().dashUnlocked) store().setPaletteOpen(!store().paletteOpen);
    },
    "mod+j": () => {
      if (store().dashUnlocked) store().setTerminalOpen(!store().terminalOpen);
    },
    "shift+?": idle(() => store().setHelpOpen(true)),
    "?": idle(() => store().setHelpOpen(true)), // layouts where ? needs no Shift
    "g f": idle(() => store().setView("fleet")),
    "g g": idle(() => store().setView("grind")),
    "g b": idle(() => store().setView("build")),
    "g a": idle(() => store().setView("addons")),
    "g p": idle(() => store().setView("providers")),
    "g s": idle(() => store().setView("settings")),
    r: idle(() => store().refresh()),
    t: () => store().toggleTheme(),
    s: idle(() => store().toggleSound()),
  });

  // Live snapshot polling. Polls rest while the tab is hidden and back off
  // exponentially (5s → 30s) while every endpoint is unreachable.
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let inFlight = false;
    let again = false;
    let failures = 0;
    let delay = POLL_MS;
    let controller: AbortController | null = null;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      if (stopped) return;
      timer = window.setTimeout(run, ms);
    };

    const gather = async () => {
      controller = new AbortController();
      const signal = controller.signal;
      const results = await Promise.allSettled([
        api.status(signal),
        api.fleet(signal),
        api.telemetry(signal),
        api.config(signal),
        api.addons(signal),
        api.grind(signal),
        api.schematic(signal),
        api.providers(signal),
      ]);
      if (stopped || signal.aborted) return null;
      const payload: PollPayload = { failed: [] };
      const [status, fleet, telemetry, config, addons, grind, schematic, providers] = results;
      if (status.status === "fulfilled") payload.status = status.value;
      else payload.failed.push("status");
      if (fleet.status === "fulfilled") payload.fleet = fleet.value;
      else payload.failed.push("fleet");
      if (telemetry.status === "fulfilled") payload.telemetry = telemetry.value;
      else payload.failed.push("telemetry");
      if (config.status === "fulfilled") payload.config = config.value;
      else payload.failed.push("config");
      if (addons.status === "fulfilled") payload.addons = addons.value;
      else payload.failed.push("addons");
      if (grind.status === "fulfilled") payload.grind = grind.value;
      else payload.failed.push("grind");
      if (schematic.status === "fulfilled") payload.schematic = schematic.value;
      else payload.failed.push("schematic");
      if (providers.status === "fulfilled") payload.providers = providers.value;
      else payload.failed.push("providers");
      return payload;
    };

    const run = async () => {
      if (stopped) return;
      if (document.hidden) {
        schedule(POLL_MS);
        return;
      }
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      try {
        const payload = await gather();
        if (!payload || stopped) return;
        if (payload.failed.length < 8) {
          failures = 0;
          delay = POLL_MS;
          useConsole.getState().applyPoll(payload);
          schedule(POLL_MS);
        } else {
          failures += 1;
          delay = Math.min(30_000, POLL_MS * 2 ** Math.min(failures - 1, 3));
          useConsole.getState().pollFailure(failures, Date.now() + delay);
          schedule(delay);
        }
      } catch {
        if (stopped) return;
        failures += 1;
        delay = Math.min(30_000, POLL_MS * 2 ** Math.min(failures - 1, 3));
        useConsole.getState().pollFailure(failures, Date.now() + delay);
        schedule(delay);
      } finally {
        inFlight = false;
        if (again) {
          again = false;
          schedule(0);
        }
      }
    };

    const wake = () => {
      if (stopped || document.hidden) return;
      window.clearTimeout(timer);
      void run();
    };
    const onVisibility = () => {
      if (!document.hidden) wake();
    };

    window.addEventListener("yz:refresh", wake);
    document.addEventListener("visibilitychange", onVisibility);
    void run();

    return () => {
      stopped = true;
      controller?.abort();
      window.clearTimeout(timer);
      window.removeEventListener("yz:refresh", wake);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // One-second heartbeat keeps "ago", uptime and retry countdowns current.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) useConsole.getState().tick();
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // Journal tail for the console dock. Only runs while the dock is open.
  const terminalOpen = useConsole((s) => s.terminalOpen);
  useEffect(() => {
    if (!terminalOpen) return;
    let stopped = false;
    let inFlight = false;
    let timer: number | undefined;
    const controller = new AbortController();

    const load = async () => {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      const services = ["mc-foreman", "mc-cluster", "mc-shim", "mc-dashboard", "minecraft-server"];
      const results = await Promise.allSettled(services.map((service) => api.logs(service, 200, controller.signal)));
      inFlight = false;
      if (stopped || controller.signal.aborted) return;
      for (const result of results) {
        if (result.status === "fulfilled") {
          useConsole.getState().applyLogs(result.value.service, result.value.lines);
        }
      }
    };

    void load();
    timer = window.setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [terminalOpen]);

  // Back and forward buttons move between views.
  useEffect(() => {
    const onHash = () => {
      const next = viewFromHash();
      if (next && next !== useConsole.getState().view) {
        useConsole.setState((s) => ({ view: next, visit: s.visit + 1 }));
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = showLanding ? "Yozakura / ENI-01 Operations Console" : `${VIEW_META[view].title} · Yozakura Console`;
    setDrawer(false);
    main.current?.scrollTo({ top: 0 });
  }, [view, showLanding]);

  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(drawerRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    (drawerRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]') ?? items()[0])?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
      if (event.key !== "Tab") return;
      const buttons = items();
      if (buttons.length === 0) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault();
        buttons[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [drawer]);

  const ActiveView = VIEW_COMPONENTS[view];

  const consoleWorkspace = (
    <div className={showLanding ? "flex h-full w-full overflow-hidden bg-canvas" : "flex h-dvh overflow-hidden"}>
      {!showLanding && (
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2 focus:text-[12.5px] focus:font-medium focus:text-ink focus:shadow-pop"
        >
          Skip to content
        </a>
      )}
      {!showLanding && <div className="ambient" aria-hidden="true" />}

      <div className="relative z-10 hidden h-full lg:block">
        <Sidebar />
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" tabIndex={-1} aria-label="Close navigation" className="fade-in absolute inset-0 cursor-default bg-scrim" onClick={() => setDrawer(false)} />
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation" className="drawer-in absolute inset-y-0 left-0 shadow-pop">
            <Sidebar drawer onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="app-column relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <div ref={main} id="main" tabIndex={-1} className="h-full overflow-y-auto overscroll-contain focus:outline-none">
            <TopBar onMenu={() => setDrawer(true)} />
            <TabNav />
            <ConnectionBanner />
            <main className="mx-auto max-w-[1540px] px-4 py-4 pb-6 lg:px-7 lg:pt-5 lg:pb-8">
              {/* The view swaps immediately and the entrance is CSS-driven. A
                  JS exit animation would hold the old view on screen whenever
                  requestAnimationFrame is throttled. */}
              <div key={`${view}-${visit}`}>
                <ActiveView />
              </div>
            </main>
          </div>
          <SettingsSaveBar />
        </div>
        <TerminalDock />
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {showLanding ? (
        <Landing consoleSlot={dashUnlocked ? consoleWorkspace : <PinGate embedded />} />
      ) : dashUnlocked ? (
        consoleWorkspace
      ) : (
        <PinGate />
      )}
      <CommandPalette />
      <ToastStack />
      <ConfirmDialog />
      <ShortcutSheet />
    </MotionConfig>
  );
}

