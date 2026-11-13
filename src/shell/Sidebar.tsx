import { Cpu, Hammer, PanelLeftClose, PanelLeftOpen, Pickaxe, Puzzle, Settings2, Users, X, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { fmtDuration, type View } from "../data/model";
import { armedCount, useConsole } from "../state/store";
import { Crest } from "../ui/art";
import { IconButton, StatusDot } from "../ui/kit";
import { cn } from "../utils/cn";

export const VIEW_META: Record<View, { title: string; sub: string }> = {
  fleet: { title: "Fleet", sub: "Agents, host services and the player radar" },
  grind: { title: "Grind", sub: "Resource collection jobs and their queue" },
  build: { title: "Build", sub: "Schematic placement, layers and materials" },
  addons: { title: "Add-ons", sub: "Behavior modules, dispatch and threats" },
  providers: { title: "Providers", sub: "Model endpoints, keys and the fallback order" },
  settings: { title: "Settings", sub: "Connection, runtime and interface" },
};

export const NAV: { id: View; label: string; icon: LucideIcon; group: "Operate" | "System" }[] = [
  { id: "fleet", label: "Fleet", icon: Users, group: "Operate" },
  { id: "grind", label: "Grind", icon: Pickaxe, group: "Operate" },
  { id: "build", label: "Build", icon: Hammer, group: "Operate" },
  { id: "addons", label: "Add-ons", icon: Puzzle, group: "Operate" },
  { id: "providers", label: "Providers", icon: Cpu, group: "Operate" },
  { id: "settings", label: "Settings", icon: Settings2, group: "System" },
];

const BADGE_HINT: Partial<Record<View, string>> = {
  fleet: "Agents reporting",
  grind: "Jobs running or queued",
  build: "Current build progress",
  addons: "Add-ons armed",
  providers: "Providers enabled",
};

/** One live figure per destination, so the nav doubles as a status summary. */
export function NavBadge({ view }: { view: View }) {
  const text = useConsole((s) => {
    switch (view) {
      case "fleet":
        return `${s.bots.filter((b) => b.state === "active" || b.state === "warning").length}/${s.bots.length}`;
      case "grind":
        return s.grind.current ? String(s.grind.queue.length + 1) : s.grind.queue.length > 0 ? String(s.grind.queue.length) : "";
      case "build":
        return s.build.current && s.build.current.totalBlocks > 0
          ? `${Math.round((s.build.current.placed / s.build.current.totalBlocks) * 100)}%`
          : "";
      case "addons":
        return String(armedCount(s.addonConfig));
      case "providers":
        return String(s.providers.filter((p) => p.enabled).length);
      default:
        return "";
    }
  });
  if (!text) return null;
  return (
    <span title={BADGE_HINT[view]} className="num text-[10.5px] font-medium text-faint">
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">
        , {BADGE_HINT[view]}: {text}
      </span>
    </span>
  );
}

export function Sidebar({ drawer = false, onNavigate }: { drawer?: boolean; onNavigate?: () => void }) {
  const view = useConsole((s) => s.view);
  const setView = useConsole((s) => s.setView);
  const setShowLanding = useConsole((s) => s.setShowLanding);
  const collapsedPref = useConsole((s) => s.collapsed);
  const toggle = useConsole((s) => s.toggleCollapsed);
  const collapsed = collapsedPref && !drawer;
  const live = useConsole((s) => s.connection.status === "live");
  const age = useConsole((s) => Math.max(0, Math.round((s.nowTick - s.connection.lastSnapshotAt) / 1000)));
  const retryIn = useConsole((s) => Math.max(1, Math.ceil(s.connection.nextRetryIn / 1000)));
  const appVersion = useConsole((s) => s.appVersion);
  const clusterUptime = useConsole((s) => s.clusterUptime);

  return (
    <aside
      data-drawer={drawer || undefined}
      className={cn(
        "app-sidebar flex h-full shrink-0 flex-col border-r border-line",
        collapsed ? "w-[68px]" : "w-[236px]",
      )}
    >
      <div className={cn("flex h-[60px] shrink-0 items-center gap-3 border-b border-line sm:h-[68px]", collapsed ? "justify-center" : "px-5")}>
        <button
          type="button"
          onClick={() => {
            setShowLanding(true);
            onNavigate?.();
          }}
          title="Return to Yozakura Overview"
          className="flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-85"
        >
          <Crest size={36} />
          {!collapsed && (
            <div className="min-w-0 leading-none">
              <p className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink">Yozakura</p>
              <p className="mt-1.5 text-[11px] text-faint">Mindcraft console</p>
            </div>
          )}
        </button>
        {drawer && <IconButton icon={X} label="Close navigation" size="sm" onClick={onNavigate} className="ml-auto" />}
      </div>

      <nav aria-label="Primary" className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto py-5", collapsed ? "items-center px-2" : "px-3")}>
        {(["Operate", "System"] as const).map((group) => (
          <div key={group} className={cn("flex flex-col gap-0.5", collapsed && "items-center", group === "System" && "mt-4")}>
            {collapsed ? group === "System" && <span className="mb-2 h-px w-5 bg-line-2" /> : <p className="eyebrow px-2.5 pb-1.5">{group}</p>}
            {NAV.filter((item) => item.group === group).map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView(item.id);
                    onNavigate?.();
                  }}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-lg text-[13px] font-medium transition-colors duration-150",
                    collapsed ? "w-10 justify-center" : "w-full px-3",
                    active ? "text-ink" : "text-mute hover:bg-panel-2/60 hover:text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId={drawer ? "drawer-nav-current" : "sidebar-nav-current"}
                      className="nav-current"
                      transition={{ type: "spring", stiffness: 500, damping: 42 }}
                    />
                  )}
                  <item.icon size={16} strokeWidth={active ? 2.1 : 1.8} className={cn("relative shrink-0", active ? "text-rose" : "text-faint group-hover:text-mute")} />
                  {!collapsed && <span className="relative flex-1 text-left">{item.label}</span>}
                  {!collapsed && <span className="relative"><NavBadge view={item.id} /></span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {collapsed ? (
        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-line py-3">
          <span title={live ? `Supervisor live · snapshot ${age}s ago` : `Reconnecting · retry in ${retryIn}s`} className="flex size-7 items-center justify-center">
            <StatusDot tone={live ? "ok" : "warn"} />
          </span>
          <IconButton icon={PanelLeftOpen} label="Expand sidebar" size="sm" onClick={toggle} />
        </div>
      ) : (
        <div className="shrink-0 border-t border-line px-4 py-4">
          <p className="eyebrow mb-3">Workspace</p>
          <div className="flex items-center gap-2">
            <StatusDot tone={live ? "ok" : "warn"} />
            <p className="text-[12px] font-semibold text-ink">{live ? "Supervisor live" : "Reconnecting"}</p>
            <span className="num ml-auto font-mono text-[9.5px] text-faint">v{appVersion}</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
            {live
              ? `Snapshot ${age}s ago${clusterUptime ? ` · up ${fmtDuration(clusterUptime * 1000)}` : ""}.`
              : `Next attempt in ${retryIn}s. Showing the last snapshot.`}
          </p>
          {!drawer && (
            <button
              type="button"
              onClick={toggle}
              className="-mx-1 mt-2.5 flex h-7 w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg px-1.5 text-[11.5px] font-medium text-faint transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <PanelLeftClose size={14} strokeWidth={1.9} />
              Collapse sidebar
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
