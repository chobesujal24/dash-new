import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  MoonStar,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldOff,
  TerminalSquare,
  User,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useConsole } from "../state/store";
import { Kbd } from "../ui/kit";
import { cn } from "../utils/cn";
import { MOD_LABEL } from "../utils/platform";
import { NAV } from "./Sidebar";

type Group = "Go to" | "Agents" | "Actions";

type Command = {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
};

const GROUPS: Group[] = ["Go to", "Agents", "Actions"];
const VIEW_KEYS: Record<string, string> = { fleet: "G F", grind: "G G", build: "G B", addons: "G A", providers: "G P", settings: "G S" };
const VIEW_WORDS: Record<string, string> = {
  fleet: "agents bots services radar home",
  grind: "mine collect queue ore resources",
  build: "schematic upload layers blocks",
  addons: "modules combat dispatch threats",
  providers: "models api keys endpoints routing",
  settings: "config host port profile theme",
};

export function CommandPalette() {
  const open = useConsole((s) => s.paletteOpen);
  const setOpen = useConsole((s) => s.setPaletteOpen);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Commands are captured when the palette opens; labels reflect that moment.
  const commands = useMemo<Command[]>(() => {
    if (!open) return [];
    const s = useConsole.getState();
    const grindPaused = s.grind.current?.status === "paused" || s.grind.current?.status === "pausing";
    const grindRunning = Boolean(s.grind.current && (s.grind.current.status === "running" || grindPaused));
    const buildPaused = s.build.current?.status === "paused" || s.build.current?.status === "pausing";
    const buildRunning = Boolean(s.build.current && (s.build.current.status === "running" || buildPaused));

    const out: Command[] = NAV.map((item) => ({
      id: `view-${item.id}`,
      group: "Go to",
      label: item.label,
      hint: VIEW_KEYS[item.id],
      icon: item.icon,
      keywords: VIEW_WORDS[item.id],
      run: () => s.setView(item.id),
    }));

    for (const bot of s.bots) {
      out.push({
        id: `agent-${bot.id}`,
        group: "Agents",
        label: `Inspect ${bot.name}`,
        hint: bot.state,
        icon: User,
        keywords: `${bot.role} ${bot.state} ${bot.unit}`,
        run: () => {
          s.selectBot(bot.id);
          s.setView("fleet");
        },
      });
    }

    out.push(
      { id: "refresh", group: "Actions", label: "Refresh snapshot", hint: "R", icon: RefreshCw, keywords: "reload poll", run: () => s.refresh() },
      {
        id: "theme",
        group: "Actions",
        label: s.theme === "yozakura" ? "Switch to Hanami, the day theme" : "Switch to Yozakura, the night theme",
        hint: "T",
        icon: MoonStar,
        keywords: "dark light appearance",
        run: () => s.toggleTheme(),
      },
      { id: "sound", group: "Actions", label: s.sound ? "Mute interface sounds" : "Enable interface sounds", hint: "S", icon: Volume2, keywords: "audio", run: () => s.toggleSound() },
      {
        id: "console",
        group: "Actions",
        label: s.terminalOpen ? "Collapse the console" : "Open the console",
        hint: `${MOD_LABEL} J`,
        icon: TerminalSquare,
        keywords: "terminal logs dock",
        run: () => s.setTerminalOpen(!s.terminalOpen),
      },
      { id: "shortcuts", group: "Actions", label: "Keyboard shortcuts", hint: "?", icon: Keyboard, keywords: "help keys", run: () => s.setHelpOpen(true) },
    );
    if (grindRunning) {
      out.push({ id: "grind-pause", group: "Actions", label: grindPaused ? "Resume the grind job" : "Pause the grind job", icon: grindPaused ? Play : Pause, keywords: "collection", run: () => s.grindTogglePause() });
    }
    if (buildRunning) {
      out.push({ id: "build-pause", group: "Actions", label: buildPaused ? "Resume the build" : "Pause the build", icon: buildPaused ? Play : Pause, keywords: "schematic", run: () => s.buildTogglePause() });
    }
    out.push({
      id: "disarm",
      group: "Actions",
      label: "Disarm all add-ons…",
      icon: ShieldOff,
      keywords: "kill switch safety stop",
      run: () =>
        s.askConfirm({
          eyebrow: "Safety",
          title: "Disarm all add-ons?",
          description: "Auto Totem, Auto Gapple, the radar and every other switchable module turn off. ENI1 keeps running without its guard layer.",
          confirmLabel: "Disarm everything",
          danger: true,
          action: () => s.disarmAll(),
        }),
    });
    return out;
  }, [open]);

  const rows = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const visible = commands.filter((command) => {
      const haystack = `${command.label} ${command.keywords ?? ""} ${command.group}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
    return GROUPS.flatMap((group) => visible.filter((command) => command.group === group));
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => field.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previous?.focus?.();
    };
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const run = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    command.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <button type="button" tabIndex={-1} aria-label="Close" className="fade-in absolute inset-0 cursor-default bg-scrim backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="glass-deep sheet-in relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-line-2 shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            ref={field}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((i) => Math.min(rows.length - 1, i + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(rows[index]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              } else if (event.key === "Tab") {
                event.preventDefault(); // keep focus inside the palette
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-autocomplete="list"
            aria-activedescendant={rows[index] ? `palette-option-${index}` : undefined}
            aria-label="Search views, agents and actions"
            placeholder="Search views, agents and actions"
            spellCheck={false}
            autoComplete="off"
            className="h-12 w-full bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={list} id="palette-list" role="listbox" className="max-h-[min(52vh,420px)] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] text-mute">Nothing matches “{query}”.</p>
          ) : (
            rows.map((command, i) => (
              <div key={command.id}>
                {(i === 0 || rows[i - 1].group !== command.group) && <p className="eyebrow px-2.5 pb-1 pt-2.5">{command.group}</p>}
                <button
                  type="button"
                  role="option"
                  id={`palette-option-${i}`}
                  aria-selected={i === index}
                  data-index={i}
                  tabIndex={-1}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(command)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                    i === index ? "bg-panel-2 text-ink" : "text-mute",
                  )}
                >
                  <command.icon size={14.5} strokeWidth={1.9} className={cn("shrink-0", i === index ? "text-rose" : "text-faint")} />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.hint && <span className="num shrink-0 font-mono text-[10.5px] text-faint">{command.hint}</span>}
                </button>
              </div>
            ))
          )}
        </div>

        <footer className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[10.5px] text-faint">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> run
          </span>
          <span className="num ml-auto">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </span>
        </footer>
      </div>
    </div>
  );
}
