import { useState } from "react";
import { Maximize2, Radar as RadarIcon, ShieldCheck, User } from "lucide-react";
import { bearingCompass, type Threat } from "../../data/model";
import { useConsole } from "../../state/store";
import { Button, Chip, EmptyState, Panel, Segmented } from "../../ui/kit";
import { Radar, rangeColor, type RadarRange } from "../../ui/viz";
import { cn } from "../../utils/cn";

const RANGES = ["16", "32", "64"] as const;

const assessment = (distance: number) => (distance <= 10 ? "Critical" : distance <= 20 ? "Caution" : "Clear");
const tone = (distance: number): "ok" | "warn" | "danger" => (distance <= 10 ? "danger" : distance <= 20 ? "warn" : "ok");

function Summary({ contacts, range, on }: { contacts: Threat[]; range: RadarRange; on: boolean }) {
  const nearest = contacts.reduce<Threat | null>((best, t) => (!best || t.distance < best.distance ? t : best), null);
  const close = contacts.filter((t) => t.distance <= 16).length;
  const sneaking = contacts.filter((t) => t.sneaking).length;

  const items = [
    { label: "Nearest", value: nearest ? `${nearest.distance.toFixed(1)}` : "—", unit: nearest ? "m" : "no contacts" },
    { label: "Within 16 m", value: String(close), unit: `of ${contacts.length} seen` },
    { label: "Sneaking", value: String(sneaking), unit: "on radar" },
    { label: "Sweep", value: on ? "On" : "Off", unit: `range ${range} m` },
  ];

  return (
    <dl className="panel grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-4 py-3">
          <dt className="eyebrow !text-[10.5px]">{item.label}</dt>
          <dd className="mt-0.5 flex items-baseline gap-1">
            <span className={cn("num font-display text-[19px] font-semibold leading-none", item.label === "Sweep" && !on ? "text-faint" : "text-ink")}>{item.value}</span>
            <span className="truncate text-[10.5px] text-faint">{item.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ContactRow({ threat, range, active, onActive }: { threat: Threat; range: RadarRange; active: boolean; onActive: (v: boolean) => void }) {
  const share = Math.min(1, threat.distance / range);
  const compass = bearingCompass(threat.bearing);
  return (
    <li
      onMouseEnter={() => onActive(true)}
      onMouseLeave={() => onActive(false)}
      className={cn("flex items-center gap-3 px-4 py-3 transition-colors sm:px-5", active && "bg-panel-2/60")}
    >
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-2 bg-panel-2 text-faint">
        <User size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-[12.5px] font-semibold text-ink">{threat.username}</p>
          {threat.sneaking && <span className="text-[10.5px] font-medium text-warn">sneaking</span>}
          {threat.distance <= 20 && <Chip tone={tone(threat.distance)} className="h-[19px] px-2 text-[10px]">{assessment(threat.distance)}</Chip>}
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <div className="h-[3px] min-w-[60px] max-w-[220px] flex-1 overflow-hidden rounded-full bg-panel-3">
            <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: rangeColor(threat.distance) }} />
          </div>
          <span className="num shrink-0 font-mono text-[10.5px] text-mute">
            {threat.distance.toFixed(1)} m · {compass.deg}° {compass.label}
          </span>
        </div>
      </div>
      <div className="hidden w-[128px] shrink-0 text-right sm:block">
        <p className="text-[10.5px] text-faint">Holding</p>
        <p className="font-mono text-[11px] leading-snug text-mute">{threat.heldItem.replace(/_/g, " ")}</p>
      </div>
    </li>
  );
}

export function Threats() {
  const threats = useConsole((s) => s.threats);
  const radarOn = useConsole((s) => s.addonConfig.player_radar === true);
  const toggleAddon = useConsole((s) => s.toggleAddon);
  const setLightbox = useConsole((s) => s.setLightbox);
  const setView = useConsole((s) => s.setView);
  const [range, setRange] = useState<RadarRange>(64);
  const [active, setActive] = useState<string | null>(null);

  const visible = radarOn
    ? [...threats.filter((t) => t.distance <= range)].sort((a, b) => a.distance - b.distance)
    : [];

  return (
    <div className="space-y-4">
      <Summary contacts={visible} range={range} on={radarOn} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          eyebrow="Player radar"
          title="Contacts"
          sub={radarOn ? "Nearest first. Distance is measured from ENI1." : "The radar is disarmed, so no contacts are being collected."}
          pad={false}
          tools={
            radarOn ? (
              <Button
                size="sm"
                variant="quiet"
                icon={Maximize2}
                onClick={() => {
                  setView("fleet");
                  setLightbox("radar");
                }}
              >
                Open radar
              </Button>
            ) : undefined
          }
        >
          {!radarOn ? (
            <EmptyState
              icon={RadarIcon}
              title="The radar is off"
              action={<Button size="sm" onClick={() => toggleAddon("player_radar")}>Arm Player Radar</Button>}
            >
              The ledger fills in once Player Radar is armed and ENI1 reports a sweep.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No players in range">
              Nothing within {range} m. The sweep continues.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((threat) => (
                <ContactRow
                  key={threat.username}
                  threat={threat}
                  range={range}
                  active={active === threat.username}
                  onActive={(on) => setActive(on ? threat.username : null)}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          eyebrow="Sweep"
          title="Radar"
          sub={radarOn ? `Showing ${visible.length} of ${threats.length} contacts.` : "Disarmed."}
          tools={radarOn ? <span className="num text-[11px] text-faint">{range} m</span> : undefined}
        >
          {radarOn ? (
            <>
              <div className="mb-3 flex justify-center">
                <Segmented
                  label="Radar range"
                  value={String(range) as (typeof RANGES)[number]}
                  onChange={(next) => setRange(Number(next) as RadarRange)}
                  options={RANGES.map((r) => ({ value: r, label: `${r} m` }))}
                />
              </div>
              <Radar threats={visible} range={range} size={190} active={active} onActive={setActive} />
              <p className="mt-3 text-center text-[10.5px] text-faint">A dashed ring marks a sneaking player.</p>
            </>
          ) : (
            <EmptyState icon={RadarIcon} title="No sweep">
              Arm Player Radar to see contacts here.
            </EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
