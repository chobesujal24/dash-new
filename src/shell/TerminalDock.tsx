import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ChevronDown, ChevronUp, Eraser, Pause, Play } from "lucide-react";
import type { TermLine } from "../data/model";
import { useConsole, type TermFilter } from "../state/store";
import { IconButton, Kbd, StatusDot } from "../ui/kit";
import { cn } from "../utils/cn";
import { MOD_LABEL } from "../utils/platform";

const TONE: Record<TermLine["tone"], string> = {
  default: "text-ink/85",
  muted: "text-faint",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  accent: "text-rose",
};

const FILTERS: { id: TermFilter; label: string }[] = [
  { id: "all", label: "all" },
  { id: "mc-foreman", label: "foreman" },
  { id: "mc-cluster", label: "cluster" },
  { id: "mc-shim", label: "shim" },
  { id: "mc-dashboard", label: "dashboard" },
  { id: "minecraft-server", label: "server" },
  { id: "console", label: "console" },
  { id: "api", label: "api" },
  { id: "warn", label: "warnings" },
];

const matches = (line: TermLine, filter: TermFilter) =>
  filter === "all" ? true : filter === "warn" ? line.tone === "warn" || line.tone === "danger" : line.source === filter;

/**
 * The console keeps the night palette in both themes: log colours are tuned
 * for a dark surface, and a terminal reads as a terminal.
 */
export function TerminalDock() {
  const open = useConsole((s) => s.terminalOpen);
  const setOpen = useConsole((s) => s.setTerminalOpen);
  const savedHeight = useConsole((s) => s.terminalHeight);
  const setHeight = useConsole((s) => s.setTerminalHeight);
  const term = useConsole((s) => s.term);
  const filter = useConsole((s) => s.termFilter);
  const setFilter = useConsole((s) => s.setTermFilter);
  const runCommand = useConsole((s) => s.runCommand);
  const termClear = useConsole((s) => s.termClear);

  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<TermLine[]>([]);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);

  const source = paused ? frozen : term;
  const lines = useMemo(() => source.filter((line) => matches(line, filter)), [source, filter]);
  const newest = term[term.length - 1];
  const lastId = lines[lines.length - 1]?.id;
  const height = dragHeight ?? savedHeight;

  // Follow the tail unless the operator has scrolled up to read.
  useEffect(() => {
    if (open && stick.current && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [lastId, open, filter]);

  const togglePause = () => {
    if (!paused) setFrozen(term);
    else stick.current = true;
    setPaused(!paused);
  };

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    let latest = startHeight;
    const move = (ev: globalThis.PointerEvent) => {
      latest = Math.max(140, Math.min(460, startHeight + (startY - ev.clientY)));
      setDragHeight(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHeight(latest);
      setDragHeight(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    history.current = [text, ...history.current.filter((entry) => entry !== text)].slice(0, 30);
    cursor.current = -1;
    stick.current = true;
    runCommand(text);
    setInput("");
  };

  const recall = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (history.current.length === 0) return;
    event.preventDefault();
    const next = cursor.current + (event.key === "ArrowUp" ? 1 : -1);
    cursor.current = Math.max(-1, Math.min(history.current.length - 1, next));
    setInput(cursor.current === -1 ? "" : history.current[cursor.current]);
  };

  return (
    <motion.section
      data-theme="yozakura"
      aria-label="Console"
      initial={false}
      animate={{ height: open ? height : 36 }}
      transition={dragHeight !== null ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 38 }}
      className="terminal-dock chrome relative z-10 flex shrink-0 flex-col overflow-hidden border-t border-line-2"
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open console"
          className="flex h-9 w-full shrink-0 items-center gap-2.5 px-4 text-left font-mono text-[11px] transition-colors hover:bg-panel-2"
        >
          <span className="text-rose">❯</span>
          <span className="hidden shrink-0 font-sans text-[11px] font-medium text-mute sm:inline">Console</span>
          {newest && <span className="hidden shrink-0 text-info/85 sm:inline">[{newest.source}]</span>}
          <span className={cn("min-w-0 flex-1 truncate", newest ? TONE[newest.tone] : "text-faint")}>{newest ? newest.text : "console idle"}</span>
          <span className="hidden shrink-0 items-center gap-0.5 sm:flex">
            <Kbd>{MOD_LABEL}</Kbd>
            <Kbd>J</Kbd>
          </span>
          <ChevronUp size={13} className="shrink-0 text-faint" />
        </button>
      ) : (
      <>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize console"
        aria-valuenow={height}
        aria-valuemin={140}
        aria-valuemax={460}
        aria-valuetext={`${height} pixels tall`}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startResize}
        onDoubleClick={() => setHeight(208)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setHeight(height + (event.key === "ArrowUp" ? 24 : -24));
          }
        }}
        className="group absolute inset-x-0 top-0 z-20 flex h-[7px] cursor-row-resize items-start justify-center outline-none"
      >
        <span className="mt-[3px] h-[3px] w-10 rounded-full bg-line-2 transition-colors group-hover:bg-rose/70 group-focus-visible:bg-rose" />
      </div>

      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line pl-3 pr-1.5">
        <span className="eyebrow flex shrink-0 items-center gap-1.5">
          <StatusDot tone={paused ? "warn" : "ok"} />
          <span className="hidden sm:inline">Console</span>
        </span>
        <div role="tablist" aria-label="Log filters" className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                "shrink-0 rounded-md px-2 py-1 font-mono text-[10.5px] transition-colors",
                filter === item.id ? "bg-panel-3 text-ink" : "text-faint hover:text-mute",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {paused && <span className="shrink-0 rounded-full bg-warn/14 px-2 py-px text-[10px] font-semibold text-warn">paused</span>}
        <span className="num hidden font-mono text-[10px] text-faint md:inline">{lines.length} lines</span>
        <IconButton size="sm" icon={paused ? Play : Pause} label={paused ? "Resume stream" : "Pause stream"} onClick={togglePause} />
        <IconButton size="sm" icon={Eraser} label="Clear scrollback" onClick={termClear} />
        <IconButton size="sm" icon={ChevronDown} label={`Collapse console (${MOD_LABEL} J)`} onClick={() => setOpen(false)} />
      </div>

      <div
        ref={body}
        role="log"
        aria-label="Console output"
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 28;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-[1.7]"
      >
        {lines.length === 0 ? (
          <p className="py-1 text-faint">No lines match this filter.</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex gap-2.5">
              <span className="num shrink-0 text-faint">{line.time}</span>
              <span className={cn("hidden w-[88px] shrink-0 truncate sm:block", line.source === "console" ? "text-rose/85" : "text-info/85")}>[{line.source}]</span>
              <span className={cn("min-w-0 break-words", TONE[line.tone])}>{line.text}</span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="flex h-9 shrink-0 items-center gap-2 border-t border-line pl-3 pr-1.5">
        <span aria-hidden="true" className="font-mono text-[12px] text-rose">
          ❯
        </span>
        <input
          ref={field}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={recall}
          placeholder='Send a server command to ENI1, or type "help"'
          aria-label="Console input"
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink placeholder:text-faint focus:outline-none"
        />
        <IconButton size="sm" type="submit" icon={ArrowUp} label="Send" disabled={!input.trim()} />
      </form>
      </>
      )}
    </motion.section>
  );
}
