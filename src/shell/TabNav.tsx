import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useConsole } from "../state/store";
import { cn } from "../utils/cn";
import { NAV, NavBadge } from "./Sidebar";

/**
 * Thumb-reachable view switcher for narrow screens. On desktop the sidebar
 * already does this job, so the strip is hidden there to avoid two navs.
 */
export function TabNav() {
  const view = useConsole((s) => s.view);
  const setView = useConsole((s) => s.setView);
  const strip = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = strip.current;
    const tab = node?.querySelector<HTMLElement>(`[data-tab="${view}"]`);
    if (!node || !tab) return;
    node.scrollTo({ left: tab.offsetLeft - (node.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [view]);

  return (
    <nav ref={strip} aria-label="Views" className="chrome sticky top-[var(--topbar-h)] z-20 no-scrollbar flex shrink-0 items-center overflow-x-auto border-b border-line px-1.5 lg:hidden">
      {NAV.map((item) => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-tab={item.id}
            aria-current={active ? "page" : undefined}
            onClick={() => setView(item.id)}
            className={cn(
            "relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-[12.5px] font-medium transition-colors",
              active ? "text-ink" : "text-faint",
            )}
          >
            {item.label}
            <NavBadge view={item.id} />
            {active && <motion.span layoutId="mobile-nav-underline" className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-rose" transition={{ type: "spring", stiffness: 500, damping: 42 }} />}
          </button>
        );
      })}
    </nav>
  );
}
