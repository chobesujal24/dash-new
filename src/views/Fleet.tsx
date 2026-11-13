import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Antenna, ArrowUpRight, Ban, ChevronRight, Copy, Drumstick, Heart, Home, Maximize2, Play, RotateCw } from "lucide-react";
import { bearingCompass, coord, fmtBytes, fmtDuration, fmtInt, prettyBlock, type FleetBot, type Service, type Threat } from "../data/model";
import { useAlerts } from "../state/derive";
import { botTone, foodTone, healthTone, useConsole } from "../state/store";
import { HeroArt, Portrait } from "../ui/art";
import { Bar, Button, Chip, EmptyState, Panel, Segmented, StatusDot, VialMeter } from "../ui/kit";
import { Dialog } from "../ui/overlay";
import { Radar, Sparkline, rangeColor, type RadarRange } from "../ui/viz";
import { cn } from "../utils/cn";

const STATE_TEXT = { ok: "text-mute", warn: "text-warn", danger: "text-danger", idle: "text-faint" } as const;
const isDark = (bot: FleetBot) => bot.state === "offline" || bot.state === "stale";

/* ── Hero ──────────────────────────────────────────────── */

function HeroStat({ label, value, unit, note, chart, warn }: { label: string; value: string; unit: string; note?: string; chart?: ReactNode; warn?: boolean }) {
  return (
    <div className="min-w-0 border-line px-4 py-3.5 max-xl:[&:nth-child(n+3)]:border-t max-xl:[&:nth-child(odd)]:border-r sm:px-5 xl:px-6">
      <dt className="eyebrow">{label}</dt>
      <dd className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="num mt-1 block font-display text-[22px] font-medium leading-none text-ink">
            {value}
            <span className="ml-1 font-sans text-[11px] font-medium text-faint">{unit}</span>
          </span>
          {note && <span className={cn("num mt-1.5 block text-[10.5px] leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden sm:line-clamp-none sm:block sm:truncate", warn ? "text-warn" : "text-faint")}>{note}</span>}
        </span>
        {chart && <span className="hidden shrink-0 sm:block">{chart}</span>}
      </dd>
    </div>
  );
}

function FleetHero() {
  const bots = useConsole((s) => s.bots);
  const telemetry = useConsole((s) => s.telemetry);
  const latency = useConsole((s) => s.latencyHistory);
  const throughput = useConsole((s) => s.throughputHistory);
  const services = useConsole((s) => s.services);
  const profiles = useConsole((s) => s.profiles);
  const activeProfile = useConsole((s) => s.activeProfile);
  const clusterTarget = useConsole((s) => s.clusterTarget);
  const clusterUptime = useConsole((s) => s.clusterUptime);
  const setNotificationsOpen = useConsole((s) => s.setNotificationsOpen);
  const setTerminalOpen = useConsole((s) => s.setTerminalOpen);
  const grind = useConsole((s) => s.grind.current);
  const build = useConsole((s) => s.build.current);
  const alerts = useAlerts();

  const currentProfile = profiles.find((p) => p.file === activeProfile);

  // The headline states the most important fact, not a slogan.
  const urgent = alerts.filter((alert) => alert.tone !== "info");
  const reporting = bots.filter((b) => b.state === "active" || b.state === "warning").length;
  const headline =
    bots.length === 0
      ? "No agents reporting"
      : urgent.length === 0
        ? `All ${bots.length} agents reporting`
        : urgent.length === 1
          ? urgent[0].title
          : `${urgent.length} things need attention`;
  const lead =
    bots.length === 0
      ? "The supervisor reports no bots. Check the foreman unit and the active profile."
      : urgent.length === 0
        ? `${reporting} of ${bots.length} agents are reporting and the fleet is ready.`
        : urgent.length === 1
          ? urgent[0].detail
          : `${urgent.slice(0, 2).map((alert) => alert.title).join(". ")}.`;
  const work = [
    grind ? `collecting ${prettyBlock(grind.target).toLowerCase()} (${grind.completed}/${grind.requested})` : null,
    build ? `building ${build.name} (${build.totalBlocks > 0 ? Math.round((build.placed / build.totalBlocks) * 100) : 0}%)` : null,
  ].filter(Boolean);

  const total = telemetry.hits + telemetry.misses;
  const hitRate = total > 0 ? (telemetry.hits / total) * 100 : 0;
  const up = services.filter((svc) => svc.state === "active").length;
  const down = services.find((svc) => svc.state !== "active");

  return (
    <section className="hero-summary relative overflow-hidden rounded-[14px] border border-line" aria-label="Fleet summary">
      <HeroArt />
      <div className="relative px-5 py-6 sm:px-6 lg:px-7">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="eyebrow">Live summary</p>
          {currentProfile && (
            <>
              <span aria-hidden="true" className="text-line-2">·</span>
              <span className="font-mono text-[11px] text-mute">{currentProfile.name}</span>
            </>
          )}
          {clusterTarget && (
            <>
              <span aria-hidden="true" className="hidden text-line-2 sm:inline">·</span>
              <span className="hidden font-mono text-[11px] text-faint sm:inline">{clusterTarget}</span>
            </>
          )}
          {clusterUptime !== null && (
            <>
              <span aria-hidden="true" className="hidden text-line-2 md:inline">·</span>
              <span className="num hidden font-mono text-[11px] text-faint md:inline">up {fmtDuration(clusterUptime * 1000)}</span>
            </>
          )}
        </div>
        <h2 className="mt-2.5 max-w-[28ch] text-balance font-display text-[clamp(24px,2.4vw,31px)] font-semibold leading-[1.12] tracking-[-0.015em] text-ink">
          {headline}
        </h2>
        <p className="mt-2 max-w-[59ch] text-[12.5px] leading-relaxed text-mute">
          {lead} {work.length > 0 ? `The fleet is ${work.join(" and ")}.` : "No jobs are running."}
          {" "}
          {urgent.length > 0 ? (
            <button type="button" onClick={() => setNotificationsOpen(true)} className="inline-flex items-center gap-1 rounded font-semibold text-rose transition-colors hover:text-rose-2">
              Review alerts <ArrowUpRight size={12} />
            </button>
          ) : (
            <button type="button" onClick={() => setTerminalOpen(true)} className="inline-flex items-center gap-1 rounded font-semibold text-rose transition-colors hover:text-rose-2">
              Open console <ArrowUpRight size={12} />
            </button>
          )}
        </p>
      </div>

      <dl className="glass relative grid grid-cols-2 border-t border-line xl:grid-cols-4 xl:divide-x xl:divide-line">
        <HeroStat
          label="API latency p95"
          value={fmtInt(telemetry.p95)}
          unit="ms"
          note={telemetry.p50 === null ? "no requests sampled yet" : `median ${fmtInt(telemetry.p50)} ms`}
          chart={<Sparkline values={latency} width={92} height={28} />}
        />
        <HeroStat
          label="Requests/min"
          value={telemetry.throughput === null ? "—" : telemetry.throughput.toFixed(1)}
          unit="req/min"
          note={
            telemetry.throughput === null
              ? "no requests sampled yet"
              : `peak ${(throughput.length ? Math.max(...throughput) : telemetry.throughput).toFixed(1)} this window`
          }
          chart={<Sparkline values={throughput} width={92} height={28} stroke="var(--gold)" />}
        />
        <HeroStat
          label="API success rate"
          value={telemetry.hits + telemetry.misses > 0 ? hitRate.toFixed(1) : "—"}
          unit="%"
          note={`${fmtInt(telemetry.hits)} ok · ${fmtInt(telemetry.misses)} failed`}
          warn={total > 0 && hitRate < 95}
        />
        <HeroStat label="Service status" value={`${up}/${services.length}`} unit="active" note={down ? `${down.name} is ${down.state}` : "all units running"} warn={Boolean(down)} />
      </dl>
    </section>
  );
}

/* ── Agent card ────────────────────────────────────────── */

function BotRow({ bot, selected, onSelect }: { bot: FleetBot; selected: boolean; onSelect: () => void }) {
  const tone = botTone(bot.state);
  const dark = isDark(bot);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Inspect ${bot.name}`}
      aria-describedby={`agent-summary-${bot.id}`}
      className="agent-row group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3.5 text-left sm:grid-cols-[minmax(0,1fr)_138px_86px] sm:px-5"
    >
      <span id={`agent-summary-${bot.id}`} className="sr-only">
        {bot.state}. {bot.activity}. Health {bot.health ?? "unknown"} of 20. Food {bot.food ?? "unknown"} of 20.
      </span>
      <span className="flex min-w-0 items-center gap-3.5">
        <Portrait name={bot.name} src={bot.avatar} size={42} className={cn(dark && "opacity-50 grayscale")} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-[13.5px] font-semibold text-ink">{bot.name}</span>
            <span className="hidden shrink-0 text-[11px] text-faint lg:inline">· {bot.role}</span>
            {bot.dimension && (
              <span className="hidden shrink-0 font-mono text-[10.5px] text-faint md:inline">
                · {bot.dimension.replace(/^minecraft:/, "").replace(/^the_/, "")}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-mute">{bot.activity}</span>
        </span>
      </span>

      <span className={cn("col-span-2 flex items-center gap-2 sm:col-span-1 sm:flex-col sm:items-stretch sm:gap-1.5", dark && "opacity-50")}>
        <span className="flex items-center gap-2">
          <Heart size={11.5} className="shrink-0 text-danger" />
          {bot.health === null ? (
            <span className="text-[10.5px] text-faint">no reading</span>
          ) : (
            <VialMeter value={bot.health} tone={healthTone(bot.health)} label={`${bot.name} health`} />
          )}
          <span className="num ml-auto text-[10px] text-faint">{bot.health === null ? "—" : `${bot.health}/20`}</span>
        </span>
        <span className="flex items-center gap-2">
          <Drumstick size={11.5} className="shrink-0 text-gold" />
          {bot.food === null ? (
            <span className="text-[10.5px] text-faint">no reading</span>
          ) : (
            <VialMeter value={bot.food} tone={foodTone(bot.food)} label={`${bot.name} food`} />
          )}
          <span className="num ml-auto text-[10px] text-faint">{bot.food === null ? "—" : `${bot.food}/20`}</span>
        </span>
      </span>

      <span className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-auto sm:row-start-auto">
        <span className="text-right">
          <span className={cn("flex items-center justify-end gap-1.5 text-[11px] font-semibold capitalize", STATE_TEXT[tone])}>
            <StatusDot tone={tone} /> {bot.state}
          </span>
          <span className="num mt-0.5 block font-mono text-[10px] text-faint">{dark || bot.ping === null ? "—" : `${bot.ping} ms`}</span>
        </span>
        <ChevronRight size={14} className={cn("shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5", selected && "text-rose")} />
      </span>
    </button>
  );
}

/* ── Agent inspector ───────────────────────────────────── */

function AgentInspector({ bot }: { bot: FleetBot }) {
  const recall = useConsole((s) => s.recallBot);
  const toast = useConsole((s) => s.toast);
  const setView = useConsole((s) => s.setView);
  const lead = useConsole((s) => s.bots[0]);
  const tone = botTone(bot.state);
  const dark = isDark(bot);
  const isLead = Boolean(lead && lead.id === bot.id);

  const copy = async () => {
    if (bot.x === null || bot.y === null || bot.z === null) {
      toast({ title: "No position yet", detail: `${bot.name} has not reported a position.`, tone: "info" });
      return;
    }
    const text = `${Math.round(bot.x)} ${Math.round(bot.y)} ${Math.round(bot.z)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Coordinates copied", detail: text, tone: "ok" });
    } catch {
      toast({ title: "Clipboard is blocked", detail: `${bot.name} is at ${text}.`, tone: "info" });
    }
  };

  const facts: [string, string][] = [
    ["Position", coord(bot)],
    ["Dimension", bot.dimension ? bot.dimension.replace(/^minecraft:/, "").replace(/_/g, " ") : "—"],
    ["Unit", `${bot.unit}.service`],
    ["Ping", dark || bot.ping === null ? "—" : `${bot.ping} ms`],
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="panel overflow-hidden"
      aria-label={`Details for ${bot.name}`}
    >
      <header className="flex items-center gap-3.5 border-b border-line px-4 py-3.5">
        <Portrait name={bot.name} src={bot.avatar} size={46} className={cn(dark && "opacity-50 grayscale")} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{bot.role}</p>
          <h3 className="mt-0.5 truncate font-display text-[17px] font-semibold text-ink">{bot.name}</h3>
        </div>
        <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold capitalize", STATE_TEXT[tone])}>
          <StatusDot tone={tone} />
          {bot.state}
        </span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="eyebrow">{label}</dt>
            <dd className="num mt-1 truncate font-mono text-[11.5px] text-ink" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <Button size="xs" icon={Copy} onClick={copy}>
          Copy coordinates
        </Button>
        <Button
          size="xs"
          variant="quiet"
          icon={Home}
          disabled={dark || !isLead}
          disabledReason={
            !isLead
              ? `${bot.name} is a coordinator agent; only ${lead?.name ?? "ENI1"} accepts dispatched commands.`
              : `${bot.name} is not reachable right now.`
          }
          onClick={() => recall(bot.id)}
        >
          Recall to base
        </Button>
        {isLead && (
          <button
            type="button"
            onClick={() => setView("addons")}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-mute transition-colors hover:text-ink"
          >
            Dispatch <ArrowUpRight size={11} />
          </button>
        )}
      </div>
    </motion.section>
  );
}

/* ── Radar ─────────────────────────────────────────────── */

const RANGES = ["16", "32", "64"] as const;

function RangePicker({ value, onChange }: { value: RadarRange; onChange: (range: RadarRange) => void }) {
  return (
    <Segmented
      label="Radar range"
      value={String(value) as (typeof RANGES)[number]}
      onChange={(next) => onChange(Number(next) as RadarRange)}
      options={RANGES.map((range) => ({ value: range, label: `${range} m` }))}
    />
  );
}

function ContactList({ contacts, range, active, onActive }: { contacts: Threat[]; range: RadarRange; active: string | null; onActive: (name: string | null) => void }) {
  if (contacts.length === 0) {
    return <p className="mt-4 rounded-lg border border-dashed border-line-2 px-3 py-2.5 text-center text-[11.5px] text-mute">No players within {range} m. The sweep continues.</p>;
  }
  return (
    <ul className="mt-3 space-y-0.5">
      {contacts.map((t) => {
        const compass = bearingCompass(t.bearing);
        return (
          <li
            key={t.username}
            onMouseEnter={() => onActive(t.username)}
            onMouseLeave={() => onActive(null)}
            className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors", active === t.username && "bg-panel-2")}
          >
            <span className="size-[7px] shrink-0 rounded-full" style={{ background: rangeColor(t.distance) }} />
            <span className="truncate font-medium text-ink">{t.username}</span>
            {t.sneaking && <span className="shrink-0 text-[10.5px] font-medium text-warn">sneaking</span>}
            <span className="num ml-auto shrink-0 font-mono text-[11px] text-mute">
              {t.distance.toFixed(1)} m · {compass.label}
            </span>
            <span className="w-[96px] shrink-0 truncate text-right text-[11px] text-faint">{t.heldItem.replace(/_/g, " ")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function useContacts(range: RadarRange) {
  const threats = useConsole((s) => s.threats);
  return threats.filter((t) => t.distance <= range).sort((a, b) => a.distance - b.distance);
}

function RadarPanel() {
  const radarOn = useConsole((s) => s.addonConfig.player_radar === true);
  const setView = useConsole((s) => s.setView);
  const setLightbox = useConsole((s) => s.setLightbox);
  const [range, setRange] = useState<RadarRange>(32);
  const [active, setActive] = useState<string | null>(null);
  const contacts = useContacts(range);

  return (
    <Panel
      eyebrow="Player radar"
      title="Nearby players"
      sub={radarOn ? "Range and bearing relative to ENI1." : "The Player Radar add-on is disarmed."}
      tools={
        radarOn ? (
          <Button size="sm" variant="quiet" icon={Maximize2} onClick={() => setLightbox("radar")}>
            Expand
          </Button>
        ) : undefined
      }
    >
      {radarOn ? (
        <>
          <div className="mb-3 flex justify-center">
            <RangePicker value={range} onChange={setRange} />
          </div>
          <Radar threats={contacts} range={range} size={192} active={active} onActive={setActive} />
          <ContactList contacts={contacts} range={range} active={active} onActive={setActive} />
        </>
      ) : (
        <EmptyState icon={Antenna} title="The radar is off" action={<Button size="sm" onClick={() => setView("addons")}>Open Add-ons</Button>}>
          Arm Player Radar to see who is nearby, what they are holding and whether they are sneaking.
        </EmptyState>
      )}
    </Panel>
  );
}

function RadarLightbox() {
  const open = useConsole((s) => s.lightbox === "radar");
  const setLightbox = useConsole((s) => s.setLightbox);
  const [range, setRange] = useState<RadarRange>(64);
  const [active, setActive] = useState<string | null>(null);
  const contacts = useContacts(range);
  return (
    <Dialog open={open} onClose={() => setLightbox(null)} eyebrow="Player radar" title="Nearby players" width="lg">
      <div className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex justify-center">
            <RangePicker value={range} onChange={setRange} />
          </div>
          <Radar threats={contacts} range={range} size={320} active={active} onActive={setActive} />
        </div>
        <div className="min-w-0">
          <p className="eyebrow">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"} within {range} m
          </p>
          <ContactList contacts={contacts} range={range} active={active} onActive={setActive} />
          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">A dashed ring marks a sneaking player. Red is within 10 m, amber within 20 m.</p>
        </div>
      </div>
    </Dialog>
  );
}

/* ── Services ──────────────────────────────────────────── */

function ServiceRow({ svc }: { svc: Service }) {
  const now = useConsole((s) => s.nowTick);
  const busy = useConsole((s) => Boolean(s.pending[`service:${svc.name}`]));
  const askConfirm = useConsole((s) => s.askConfirm);
  const serviceAction = useConsole((s) => s.serviceAction);
  const active = svc.state === "active";
  const restarting = svc.state === "restarting";

  const detail = restarting
    ? "restarting…"
    : active
      ? `${svc.role} · pid ${svc.pid ?? "—"} · up ${fmtDuration(now - (svc.startedAt ?? now))}`
      : `${svc.role} · stopped`;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 px-5 py-3.5 md:grid-cols-[auto_minmax(0,1fr)_108px_76px_auto]">
      <StatusDot tone={active ? "ok" : restarting ? "warn" : "idle"} pulse={active} className={cn(restarting && "animate-pulse")} />
      <div className="min-w-0">
        <p className="truncate font-mono text-[12.5px] font-medium text-ink">{svc.name}.service</p>
        <p className="num truncate text-[11px] text-faint">{detail}</p>
      </div>
      <div className="hidden md:block">
        <div className="mb-1 flex items-baseline justify-between text-[10px] text-faint">
          <span>cpu</span>
          <span className="num text-mute">{svc.cpu === null ? "—" : `${svc.cpu.toFixed(1)}%`}</span>
        </div>
        <Bar value={svc.cpu ?? 0} tone={(svc.cpu ?? 0) > 60 ? "warn" : "neutral"} />
      </div>
      <p className="num hidden text-right font-mono text-[11px] text-mute md:block">{fmtBytes(svc.mem)}</p>
      <div className="flex items-center justify-end gap-1">
        {svc.state === "inactive" ? (
          <Button size="xs" icon={Play} loading={busy} loadingLabel="Starting" onClick={() => serviceAction(svc.name, "start")}>
            Start
          </Button>
        ) : (
          <>
            <Button
              size="xs"
              variant="quiet"
              icon={RotateCw}
              disabled={!active || busy}
              disabledReason="Wait for the unit to settle."
              onClick={() =>
                askConfirm({
                  eyebrow: "Service control",
                  title: `Restart ${svc.name}?`,
                  description: "The unit drains and restarts. Its agents go quiet for a few seconds, then pick up where they left off.",
                  confirmLabel: "Restart unit",
                  action: () => serviceAction(svc.name, "restart"),
                })
              }
            >
              Restart
            </Button>
            <Button
              size="xs"
              variant="quiet"
              icon={Ban}
              disabled={!active || busy}
              disabledReason="Wait for the unit to settle."
              onClick={() =>
                askConfirm({
                  eyebrow: "Service control",
                  title: `Stop ${svc.name}?`,
                  description: "The unit stops and stays down. Its agents go offline and their jobs stall until you start it again.",
                  confirmLabel: "Stop unit",
                  danger: true,
                  action: () => serviceAction(svc.name, "stop"),
                })
              }
            >
              Stop
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function ServicesPanel() {
  const services = useConsole((s) => s.services);
  const up = services.filter((svc) => svc.state === "active").length;
  const totalCpu = services.reduce((acc, svc) => acc + (svc.cpu ?? 0), 0);
  const totalMem = services.reduce((acc, svc) => acc + (svc.mem ?? 0), 0);
  return (
    <Panel
      eyebrow="Host · systemd"
      title="Services"
      sub={`The units that keep the fleet running · ${totalCpu.toFixed(1)}% CPU · ${fmtBytes(totalMem)} RAM`}
      pad={false}
      tools={
        <Chip tone={up === services.length ? "ok" : "warn"} dot>
          {up}/{services.length} active
        </Chip>
      }
    >
      <ul className="divide-y divide-line">
        {services.map((svc) => (
          <ServiceRow key={svc.name} svc={svc} />
        ))}
      </ul>
    </Panel>
  );
}

/* ── View ──────────────────────────────────────────────── */

export function Fleet() {
  const bots = useConsole((s) => s.bots);
  const selectedBotId = useConsole((s) => s.selectedBotId);
  const selectBot = useConsole((s) => s.selectBot);
  const selected = bots.find((bot) => bot.id === selectedBotId) ?? bots[0];
  const reporting = bots.filter((bot) => bot.state === "active" || bot.state === "warning").length;

  return (
    <div className="view-in space-y-4">
      <FleetHero />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_372px]">
        <div className="space-y-4">
          <section aria-labelledby="agents-title">
            <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
              <h2 id="agents-title" className="font-display text-[16px] font-semibold text-ink">
                Agents
              </h2>
              <p className="num text-[11.5px] font-medium text-mute">
                {reporting} of {bots.length} reporting
              </p>
            </div>
            <div className="panel overflow-hidden divide-y divide-line">
              {bots.map((bot) => (
                <BotRow key={bot.id} bot={bot} selected={bot.id === selected?.id} onSelect={() => selectBot(bot.id)} />
              ))}
            </div>
          </section>
          <ServicesPanel />
        </div>

        <div className="space-y-4">
          {selected && (
            <AgentInspector key={selected.id} bot={selected} />
          )}
          <RadarPanel />
        </div>
      </div>

      <RadarLightbox />
    </div>
  );
}
