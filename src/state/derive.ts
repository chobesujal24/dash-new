import { useMemo } from "react";
import { prettyBlock, type View } from "../data/model";
import { BUNDLED_CLIENT_VERSION, useConsole, type SettingsState } from "./store";

/* ── Alerts ───────────────────────────────────────────────── */

export type AlertItem = {
  id: string;
  tone: "danger" | "warn" | "info";
  title: string;
  detail: string;
  view: View;
  botId?: string;
};

const SEVERITY = { danger: 0, warn: 1, info: 2 } as const;

/** Everything that currently deserves the operator's attention, worst first. */
export function useAlerts(): AlertItem[] {
  const status = useConsole((s) => s.connection.status);
  const services = useConsole((s) => s.services);
  const bots = useConsole((s) => s.bots);
  const build = useConsole((s) => s.build.current);
  const providers = useConsole((s) => s.providers);
  const saved = useConsole((s) => s.savedSettings);
  const effective = useConsole((s) => s.effective);
  const threats = useConsole((s) => s.threats);
  const radarOn = useConsole((s) => s.addonConfig.player_radar === true);

  return useMemo(() => {
    const out: AlertItem[] = [];
    if (status !== "live") {
      out.push({ id: "bus", tone: "danger", title: "Supervisor bus is reconnecting", detail: "The last snapshot stays on screen until polling resumes.", view: "fleet" });
    }
    for (const svc of services) {
      if (svc.state === "inactive") {
        out.push({ id: `svc-${svc.name}`, tone: "danger", title: `${svc.name} is stopped`, detail: "Its agents are offline. Start the unit from Services.", view: "fleet" });
      }
    }
    if (!providers.some((p) => p.enabled)) {
      out.push({ id: "providers", tone: "danger", title: "No provider is enabled", detail: "Agents cannot decide anything without a model endpoint.", view: "providers" });
    }
    for (const bot of bots) {
      if (bot.state === "warning") {
        const lowFood = bot.food !== null && bot.food <= 9;
        out.push({
          id: `bot-${bot.id}`,
          tone: "warn",
          title: `${bot.name} needs attention`,
          detail: lowFood ? `Food is down to ${bot.food}/20.` : `Health is down to ${bot.health ?? "—"}/20.`,
          view: "fleet",
          botId: bot.id,
        });
      }
    }
    if (radarOn) {
      for (const t of threats) {
        if (t.distance <= 10) {
          out.push({ id: `threat-${t.username}`, tone: "warn", title: `${t.username} is ${t.distance.toFixed(0)} m from ENI1`, detail: `Holding ${t.heldItem.replace(/_/g, " ")}${t.sneaking ? ", sneaking" : ""}.`, view: "fleet" });
        }
      }
    }
    if (build) {
      const short = build.materials.filter((m) => m.missing);
      if (short.length > 0) {
        out.push({ id: "materials", tone: "warn", title: `${build.name} is short on materials`, detail: short.map((m) => prettyBlock(m.block)).join(", "), view: "build" });
      }
    }
    if (saved.allow_insecure_coding) {
      out.push({ id: "insecure", tone: "warn", title: "Insecure coding is allowed", detail: "Generated code may shell out or write files.", view: "settings" });
    }
    if (isDrifted(saved, effective)) {
      out.push({ id: "drift", tone: "info", title: "Saved configuration is not live", detail: "Restart ENI1 to apply the connection settings.", view: "settings" });
    }
    return out.sort((a, b) => SEVERITY[a.tone] - SEVERITY[b.tone]);
  }, [status, services, bots, build, providers, saved, effective, threats, radarOn]);
}

/* ── Settings draft ───────────────────────────────────────── */

type Live = { host: string; port: number; version: string; auth: string };

export function isDrifted(saved: SettingsState, live: Live) {
  return (
    saved.host !== live.host ||
    saved.port !== String(live.port) ||
    saved.minecraft_version !== live.version ||
    saved.auth !== live.auth
  );
}

export const SETTING_LABELS: Record<keyof SettingsState, string> = {
  minecraft_version: "Minecraft version",
  host: "Host",
  port: "Port",
  auth: "Auth mode",
  mindserver_port: "Mindserver port",
  base_profile: "Base profile",
  narrate_behavior: "Narrate behavior",
  auto_open_ui: "Auto-open UI",
  allow_insecure_coding: "Insecure coding",
  load_memory: "Load memory",
  code_timeout_mins: "Code timeout",
  spawn_timeout: "Spawn timeout",
  only_chat_with: "Chat allow-list",
  via_proxy_enabled: "ViaProxy bridge",
  via_proxy_host: "Bridge host",
  via_proxy_port: "Bridge port",
  via_proxy_client_version: "Bridge client version",
};

const isPort = (value: string) => {
  const n = Number(value);
  return value !== "" && Number.isInteger(n) && n > 0 && n < 65_536;
};
const within = (value: string, min: number, max: number) => {
  const n = Number(value);
  return value !== "" && Number.isFinite(n) && n >= min && n <= max;
};

export type VersionNote = { tone: "warn" | "danger"; title: string; body: string } | null;

/** Validation, dirty tracking and the protocol advisory for the settings form. */
export function useSettingsDraft() {
  const settings = useConsole((s) => s.settings);
  const saved = useConsole((s) => s.savedSettings);
  const effective = useConsole((s) => s.effective);

  return useMemo(() => {
    const errors: Partial<Record<keyof SettingsState, string>> = {};
    if (!settings.host.trim()) errors.host = "Enter the server host.";
    if (!isPort(settings.port)) errors.port = "Use a port between 1 and 65535.";
    if (!settings.minecraft_version.trim()) errors.minecraft_version = "Enter the target version.";
    if (!isPort(settings.mindserver_port)) errors.mindserver_port = "Use a port between 1 and 65535.";
    if (!settings.base_profile.trim()) errors.base_profile = "Name the base profile.";
    // -1 disables the code timeout; settings.js ships with -1 on purpose.
    if (!/^-?\d+$/.test(settings.code_timeout_mins) || !(Number(settings.code_timeout_mins) === -1 || within(settings.code_timeout_mins, 1, 120))) {
      errors.code_timeout_mins = "Use -1 for no timeout, or 1–120 minutes.";
    }
    if (!within(settings.spawn_timeout, 10, 600)) errors.spawn_timeout = "Between 10 and 600 seconds.";
    if (settings.via_proxy_enabled) {
      if (!settings.via_proxy_host.trim()) errors.via_proxy_host = "Enter the bridge host.";
      if (!isPort(settings.via_proxy_port)) errors.via_proxy_port = "Use a port between 1 and 65535.";
      if (!settings.via_proxy_client_version.trim()) errors.via_proxy_client_version = "Enter the client version.";
    }

    const dirtyKeys = (Object.keys(settings) as (keyof SettingsState)[]).filter((key) => settings[key] !== saved[key]);
    const target = settings.minecraft_version.trim();
    const bridge = settings.via_proxy_client_version.trim();

    let note: VersionNote = null;
    if (target && !settings.via_proxy_enabled && target !== BUNDLED_CLIENT_VERSION) {
      note = {
        tone: "danger",
        title: `Direct connection to ${target} is unsupported`,
        body: `The bundled client protocol data is pinned to ${BUNDLED_CLIENT_VERSION}. A direct ${target} handshake will fail. Enable the ViaProxy bridge or install a matching minecraft-data build.`,
      };
    } else if (target && settings.via_proxy_enabled && target !== bridge) {
      note = {
        tone: "warn",
        title: "ViaProxy translation required",
        body: `Target ${target} is bridged to client ${bridge || "—"}. Keep ViaProxy running and pointed at the same target, or the handshake fails before ENI1 joins.`,
      };
    }

    return {
      errors,
      valid: Object.keys(errors).length === 0,
      errorCount: Object.keys(errors).length,
      dirtyKeys,
      dirty: dirtyKeys.length > 0,
      drift: isDrifted(saved, effective),
      note,
    };
  }, [settings, saved, effective]);
}
