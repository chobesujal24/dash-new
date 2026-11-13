import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { addonCatalog, dispatchGroups, type AddonDef, type DispatchAction } from "../data/model";
import { armedCount, useConsole } from "../state/store";
import { AddonSvgIcon } from "../ui/art";
import { Button, Chip, EmptyState, IconButton, Panel, Segmented, Slider, Switch } from "../ui/kit";
import { cn } from "../utils/cn";
import { Threats } from "./addons/Threats";

const CATEGORIES: AddonDef["category"][] = ["Combat", "Survival", "Recon", "Economy", "System"];

const CATEGORY_SVG_KEY: Record<AddonDef["category"], string> = {
  Combat: "combat_cat",
  Survival: "survival_cat",
  Recon: "recon_cat",
  Economy: "economy_cat",
  System: "system_cat",
};

const CATEGORY_NOTE: Record<AddonDef["category"], string> = {
  Combat: "Fight handling and attack cadence.",
  Survival: "Keeps the agent alive without being asked.",
  Recon: "What the agent notices around it.",
  Economy: "Shop and inventory housekeeping.",
  System: "Workers driven from their own views.",
};

/** Arming one of these switches the other off, because they set the same thing. */
const CONFLICT: Record<string, string> = {
  cps_booster: "cps_cooldown_mode",
  cps_cooldown_mode: "cps_booster",
};

const dispatchSvgKey = (action: DispatchAction): string => {
  switch (action.action) {
    case "totem":
      return "auto_totem";
    case "eat":
      return "auto_gapple";
    case "armor":
      return "auto_armor";
    case "loot":
      return "auto_loot";
    case "shopgui":
      return "shop_gui";
    case "bal":
      return "bal";
    case "sell_all":
      return "auto_sell";
    case "send_command":
      if (action.command === "/spawn") return "spawn";
      if (action.command === "/server lifesteal" || action.command === "/randomtp") return "portal";
      return "home";
    default:
      return "combat_cat";
  }
};

/* ── Module row ────────────────────────────────────────── */

function ModuleRow({ def }: { def: AddonDef }) {
  const on = useConsole((s) => s.addonConfig[def.id] === true);
  const value = useConsole((s) => (def.setting ? Number(s.addonConfig[def.setting.key] ?? def.setting.min) : 0));
  const toggle = useConsole((s) => s.toggleAddon);
  const setValue = useConsole((s) => s.setAddonValue);
  const setView = useConsole((s) => s.setView);
  const askConfirm = useConsole((s) => s.askConfirm);
  const home = def.id === "schematic_builder" ? "build" : "grind";
  const conflict = CONFLICT[def.id] ? addonCatalog.find((a) => a.id === CONFLICT[def.id]) : undefined;

  // Guarded modules act on their own, so arming one is a deliberate step.
  const flip = () => {
    if (!on && def.risk === "guarded") {
      askConfirm({
        eyebrow: "Guarded module",
        title: `Arm ${def.name}?`,
        description: `${def.description} Once armed it acts without asking.`,
        confirmLabel: `Arm ${def.name}`,
        action: () => toggle(def.id),
      });
      return;
    }
    toggle(def.id);
  };

  const status = def.managed ? "Managed" : on ? "Armed" : "Off";

  return (
    <li className={cn("group px-4 py-3 transition-colors sm:px-5", on && !def.managed && "bg-panel-2/30")}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
            on || def.managed ? "border-line-2 bg-panel-2 text-rose" : "border-line text-faint",
          )}
        >
          <AddonSvgIcon name={def.id} size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h4 className="text-[13px] font-semibold text-ink">{def.name}</h4>
            {on && !def.managed && <Check size={12} className="text-mute" aria-label="Armed" />}
            {def.risk === "guarded" && <span className="text-[10.5px] font-medium text-warn">Asks before arming</span>}
            {def.managed && <Chip tone="neutral" className="h-[18px] px-1.5 text-[10px]">Managed</Chip>}
          </div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-mute">{def.description}</p>

          {def.setting && (
            <div className="mt-2.5 max-w-[300px]">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-mute">{def.setting.label}</span>
                <span className="num font-mono text-[10.5px] text-ink">
                  {value} <span className="text-faint">{def.setting.unit}</span>
                </span>
              </div>
              <Slider
                label={def.setting.label}
                value={value}
                min={def.setting.min}
                max={def.setting.max}
                step={def.setting.step}
                disabled={!on}
                onChange={(next) => setValue(def.setting!.key, next)}
              />
            </div>
          )}

          {conflict && (
            <p className="mt-1.5 text-[10.5px] leading-snug text-faint">
              {on ? `Armed. ${conflict.name} is off to avoid a conflict.` : `Arming this turns off ${conflict.name}.`}
            </p>
          )}

          {def.managed && (
            <button
              type="button"
              onClick={() => setView(home)}
              className="mt-1.5 inline-flex items-center gap-1 rounded text-[11.5px] font-medium text-mute transition-colors hover:text-ink"
            >
              Open {home === "build" ? "Build" : "Grind"}
              <ArrowRight size={11} />
            </button>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {def.managed ? (
            <span className="text-[11px] text-faint">—</span>
          ) : (
            <Switch checked={on} onChange={flip} label={`${def.name}, ${on ? "armed" : "disarmed"}`} />
          )}
          <span aria-hidden="true" className="text-[10px] text-faint">{status}</span>
        </div>
      </div>
    </li>
  );
}

/* ── Dispatch ──────────────────────────────────────────── */

function DispatchRow({ action }: { action: DispatchAction }) {
  const cfg = useConsole((s) => s.addonConfig);
  const busy = useConsole((s) => Boolean(s.pending[`dispatch:${action.label}`]));
  const dispatch = useConsole((s) => s.dispatch);
  const svgKey = dispatchSvgKey(action);
  const needs = action.requires ? addonCatalog.find((a) => a.id === action.requires) : undefined;
  const locked = Boolean(needs) && cfg[action.requires!] !== true;

  return (
    <button
      type="button"
      disabled={locked || busy}
      title={locked ? `Arm ${needs?.name} first.` : action.command ? `Sends ${action.command} to ENI1.` : `Asks ENI1 to run ${action.label.toLowerCase()}.`}
      aria-label={locked ? `${action.label}, needs ${needs?.name}` : action.label}
      onClick={() => dispatch(action)}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-lg border border-transparent px-2 text-left text-[12px] transition-colors",
        "enabled:hover:border-line enabled:hover:bg-panel-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
        busy && "opacity-70",
      )}
    >
      <AddonSvgIcon name={svgKey} size={14} className="shrink-0 text-faint" />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      {action.command && <span className="shrink-0 font-mono text-[10px] text-faint">{action.command}</span>}
    </button>
  );
}

function Dispatch() {
  const cfg = useConsole((s) => s.addonConfig);
  const loadout = useConsole((s) => s.loadout);
  const askConfirm = useConsole((s) => s.askConfirm);
  const disarmAll = useConsole((s) => s.disarmAll);
  const armed = armedCount(cfg);

  return (
    <Panel
      eyebrow="Operations"
      title="Dispatch"
      sub="Send an order to ENI1. Coordinator agents are read-only."
      pad={false}
      tools={
        <div className="hidden items-center gap-1.5 sm:flex">
          <Chip tone="neutral" className="num font-mono">
            <AddonSvgIcon name="auto_totem" size={11} className="text-faint" />
            {loadout.totems} totems
          </Chip>
          <Chip tone="neutral" className="num font-mono">
            <AddonSvgIcon name="auto_gapple" size={11} className="text-faint" />
            {loadout.gapples} gapples
          </Chip>
          <Chip tone="neutral" className="num font-mono">
            <AddonSvgIcon name="bal" size={11} className="text-faint" />
            {loadout.balance}
          </Chip>
        </div>
      }
    >
      <div className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
        {dispatchGroups.map((group) => (
          <section key={group.title}>
            <h4 className="text-[11px] font-semibold text-ink">{group.title}</h4>
            <p className="mt-0.5 text-[10.5px] leading-snug text-faint">{group.hint}</p>
            <div className="mt-2 space-y-0.5">
              {group.actions.map((action) => (
                <DispatchRow key={action.label} action={action} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 text-[11.5px] text-mute">
          <ShieldOff size={13} className="shrink-0 text-danger" />
          <span>
            <strong className="font-semibold text-ink">Kill switch.</strong> Disarms every module at once.
          </span>
        </p>
        <Button
          size="sm"
          variant="danger"
          disabled={armed === 0}
          disabledReason="Nothing is armed."
          onClick={() =>
            askConfirm({
              eyebrow: "Safety",
              title: "Disarm all add-ons?",
              description: "Auto Totem, Auto Gapple, the radar and every other switchable module turn off. The running agent keeps running without its guard layer.",
              confirmLabel: "Disarm everything",
              danger: true,
              action: disarmAll,
            })
          }
        >
          Disarm all
        </Button>
      </div>
    </Panel>
  );
}

/* ── Toolbar ───────────────────────────────────────────── */

type Filter = "all" | "armed" | "guarded";

function ModuleSummary() {
  const cfg = useConsole((s) => s.addonConfig);
  const switchable = addonCatalog.filter((a) => !a.managed);
  const armed = armedCount(cfg);
  const guarded = switchable.filter((a) => a.risk === "guarded").length;
  const managed = addonCatalog.length - switchable.length;

  const items = [
    { label: "Armed", value: `${armed}`, unit: `of ${switchable.length}` },
    { label: "Guarded", value: `${guarded}`, unit: "ask first" },
    { label: "Managed", value: `${managed}`, unit: "own views" },
  ];
  return (
    <dl className="panel grid grid-cols-3 divide-x divide-line">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-3 py-2.5 sm:px-4">
          <dt className="eyebrow !text-[10.5px]">{item.label}</dt>
          <dd className="mt-0.5 flex items-baseline gap-1">
            <span className="num font-display text-[18px] font-semibold leading-none text-ink">{item.value}</span>
            <span className="truncate text-[10.5px] text-faint">{item.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ── View ──────────────────────────────────────────────── */

export function Addons() {
  const cfg = useConsole((s) => s.addonConfig);
  const threats = useConsole((s) => s.threats);
  const radarOn = useConsole((s) => s.addonConfig.player_radar === true);
  const [tab, setTab] = useState<"modules" | "threats">("modules");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const armed = armedCount(cfg);
  const search = query.trim().toLowerCase();

  const matches = useMemo(
    () =>
      addonCatalog.filter((def) => {
        if (search && !`${def.name} ${def.description} ${def.category}`.toLowerCase().includes(search)) return false;
        if (filter === "armed" && cfg[def.id] !== true) return false;
        if (filter === "guarded" && def.risk !== "guarded") return false;
        return true;
      }),
    [search, filter, cfg],
  );

  return (
    <div className="view-in space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
            {tab === "modules" ? "Behavior modules" : "Threat ledger"}
          </h2>
          <p className="mt-1 max-w-[62ch] text-[12px] leading-relaxed text-mute">
            {tab === "modules"
              ? "Changes are saved to the add-on config and pushed to ENI1. Guarded modules ask before arming."
              : "Every player the radar can see, measured from ENI1."}
          </p>
        </div>
        <Segmented
          label="Add-on sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "modules", label: "Modules" },
            { value: "threats", label: `Threats · ${radarOn ? threats.length : 0}` },
          ]}
        />
      </div>

      {/* The section swaps immediately; `view-in` handles the entrance. */}
      {tab === "threats" ? (
        <div key="threats" className="view-in">
          <Threats />
        </div>
      ) : (
        <div key="modules" className="view-in space-y-4">
          <ModuleSummary />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 sm:max-w-[360px]">
                <Search size={13} className="shrink-0 text-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter modules…"
                  aria-label="Filter add-on modules"
                  className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-faint focus:outline-none"
                />
                {query && <IconButton size="sm" icon={X} label="Clear filter" onClick={() => setQuery("")} />}
              </div>
              <Segmented
                label="Module filter"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "armed", label: `Armed ${armed}` },
                  { value: "guarded", label: "Guarded" },
                ]}
              />
            </div>

            {matches.length === 0 ? (
              <Panel>
                <EmptyState icon={Search} title="No modules match">
                  {query ? `Nothing matches “${query}”.` : "No module is armed yet."} Clear the filter to see all modules.
                </EmptyState>
              </Panel>
            ) : (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                {CATEGORIES.map((category) => {
                  const defs = matches.filter((def) => def.category === category);
                  if (defs.length === 0) return null;
                  const svgKey = CATEGORY_SVG_KEY[category];
                  const active = defs.filter((def) => cfg[def.id] === true).length;
                  return (
                    <Panel
                      key={category}
                      pad={false}
                      title={
                        <span className="flex items-center gap-2">
                          <AddonSvgIcon name={svgKey} size={15} className="shrink-0 text-faint" />
                          {category}
                        </span>
                      }
                      sub={CATEGORY_NOTE[category]}
                      tools={<span className="num text-[11px] text-faint">{active} of {defs.length} on</span>}
                    >
                      <ul className="divide-y divide-line">
                        {defs.map((def) => (
                          <ModuleRow key={def.id} def={def} />
                        ))}
                      </ul>
                    </Panel>
                  );
                })}
              </div>
            )}

            <Dispatch />
        </div>
      )}
    </div>
  );
}
