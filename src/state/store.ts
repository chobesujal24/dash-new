import { create } from "zustand";
import { api, apiErrorMessage } from "../data/api";
import {
  adaptAddonConfig,
  adaptBuild,
  adaptBots,
  adaptEffective,
  adaptGrind,
  adaptLoadout,
  adaptProfiles,
  adaptProviders,
  adaptSettings,
  adaptStatus,
  adaptTelemetry,
  adaptThreats,
  liveEffective,
  seedSeries,
  settingsPatch,
  verifyDashboardPin,
  type Telemetry,
} from "../data/adapters";
import type {
  AddonsResponse,
  ConfigResponse,
  FleetResponse,
  GrindResponse,
  ProvidersResponse,
  SchematicResponse,
  StatusResponse,
  TelemetryResponse,
} from "../data/types";
import {
  VIEWS,
  addonCatalog,
  fmtInt,
  prettyBlock,
  type BuildJob,
  type DispatchAction,
  type FleetBot,
  type GrindJob,
  type LiveLoadout,
  type Profile,
  type Provider,
  type Service,
  type TermLine,
  type Threat,
  type ToastMsg,
  type View,
} from "../data/model";

/** How often the console asks the supervisor for a new snapshot. */
export const POLL_MS = 5_000;
/** The Minecraft protocol data the agent runtime ships with. */
export const BUNDLED_CLIENT_VERSION = "26.1";

/** Add-on pairs that set the same behaviour; arming one clears the other. */
const TOGGLE_CONFLICTS: Record<string, string> = {
  cps_booster: "cps_cooldown_mode",
  cps_cooldown_mode: "cps_booster",
};

export type ThemeName = "yozakura" | "hanami";

export type SettingsState = {
  minecraft_version: string;
  host: string;
  port: string;
  auth: "offline" | "microsoft";
  mindserver_port: string;
  base_profile: string;
  narrate_behavior: boolean;
  auto_open_ui: boolean;
  allow_insecure_coding: boolean;
  load_memory: boolean;
  code_timeout_mins: string;
  spawn_timeout: string;
  only_chat_with: string;
  via_proxy_enabled: boolean;
  via_proxy_host: string;
  via_proxy_port: string;
  via_proxy_client_version: string;
};

/** What the running process actually uses, as opposed to what is saved on disk. */
export type EffectiveConfig = {
  host: string;
  port: number;
  version: string;
  auth: string;
  /** Settings pinned by a host environment variable. */
  overrides: Record<string, "env">;
};

export type ConfirmState = {
  title: string;
  eyebrow: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => void;
} | null;

export type Connection = {
  status: "live" | "reconnecting";
  lastSnapshotAt: number;
  failures: number;
  retryDelay: number;
  nextRetryIn: number;
  retryAt: number;
};

type GrindState = { current: GrindJob | null; queue: GrindJob[]; history: GrindJob[] };
type BuildState = { current: BuildJob | null; queue: BuildJob[]; history: BuildJob[] };

export type GrindInput = Pick<GrindJob, "target" | "requested">;
export type BuildInput = {
  fileName: string;
  file: File;
  origin: BuildJob["origin"];
  rotation: number;
  replaceBlocks: boolean;
};
export type ProviderDraft = Pick<Provider, "name" | "baseURL" | "keyName" | "model" | "timeoutMs"> & { id?: string };
export type TermFilter = "all" | "warn" | TermLine["source"];

export type PollPayload = {
  status?: StatusResponse;
  fleet?: FleetResponse;
  telemetry?: TelemetryResponse;
  config?: ConfigResponse;
  addons?: AddonsResponse;
  grind?: GrindResponse;
  schematic?: SchematicResponse;
  providers?: ProvidersResponse;
  failed: string[];
};

type ConsoleState = {
  // shell
  showLanding: boolean;
  dashUnlocked: boolean;
  view: View;
  /** Increments on every navigation, so a revisited view opens clean. */
  visit: number;
  theme: ThemeName;
  collapsed: boolean;
  sound: boolean;
  paletteOpen: boolean;
  helpOpen: boolean;
  notificationsOpen: boolean;
  terminalOpen: boolean;
  terminalHeight: number;
  termFilter: TermFilter;
  lightbox: null | "radar";
  nowTick: number;
  refreshing: boolean;
  connection: Connection;
  pending: Record<string, boolean>;
  toasts: ToastMsg[];
  term: TermLine[];
  confirm: ConfirmState;
  // live snapshot
  appVersion: string;
  clusterTarget: string;
  clusterUptime: number | null;
  services: Service[];
  bots: FleetBot[];
  profiles: Profile[];
  selectedBotId: string;
  activeProfile: string;
  telemetry: Telemetry;
  latencyHistory: number[];
  throughputHistory: number[];
  threats: Threat[];
  loadout: LiveLoadout;
  addonConfig: Record<string, boolean | number>;
  grind: GrindState;
  build: BuildState;
  buildUploadProgress: number | null;
  providers: Provider[];
  settings: SettingsState;
  savedSettings: SettingsState;
  effective: EffectiveConfig;
  // shell actions
  setShowLanding: (show: boolean) => void;
  unlockDash: (pin: string) => boolean;
  lockDash: () => void;
  setView: (v: View) => void;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
  toggleSound: () => void;
  toggleCollapsed: () => void;
  setPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  setTerminalHeight: (h: number) => void;
  setTermFilter: (f: TermFilter) => void;
  setLightbox: (l: null | "radar") => void;
  toast: (t: Omit<ToastMsg, "id">) => void;
  dismissToast: (id: number) => void;
  askConfirm: (c: NonNullable<ConfirmState>) => void;
  resolveConfirm: (ok: boolean) => void;
  refresh: () => void;
  tick: () => void;
  applyPoll: (payload: PollPayload) => void;
  pollFailure: (failures: number, retryAt: number) => void;
  termPush: (line: Omit<TermLine, "id" | "time">) => void;
  termClear: () => void;
  applyLogs: (service: string, lines: string[]) => void;
  runCommand: (text: string) => void;
  // domain actions
  selectBot: (id: string) => void;
  recallBot: (id: string) => void;
  serviceAction: (name: string, action: "start" | "stop" | "restart") => void;
  setProfile: (file: string) => void;
  toggleAddon: (id: string) => void;
  setAddonValue: (key: string, value: number) => void;
  disarmAll: () => void;
  dispatch: (action: DispatchAction) => void;
  grindEnqueue: (input: GrindInput) => void;
  grindCancel: (id: string) => void;
  grindTogglePause: () => void;
  buildStage: (input: BuildInput) => void;
  buildStageSample: (options?: { fileName?: string; origin?: BuildJob["origin"]; rotation?: number; replaceBlocks?: boolean }) => void;
  buildCancel: (id: string) => void;
  buildTogglePause: () => void;
  providerToggle: (id: string) => void;
  providerTest: (id: string) => void;
  providerTestAll: () => void;
  providerSave: (draft: ProviderDraft, key: { apiKey?: string; clear?: boolean }) => void;
  providerRemove: (id: string) => void;
  providerMove: (id: string, dir: -1 | 1) => void;
  setSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  saveSettings: () => void;
  saveAndRestart: () => void;
  applyLive: () => void;
  discardSettings: () => void;
};

/* ── Small helpers ────────────────────────────────────────── */

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clock = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

let seq = 1000;
const nextId = () => ++seq;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function viewFromHash(): View | null {
  try {
    const hash = location.hash.replace(/^#\/?/, "");
    return VIEWS.includes(hash as View) ? (hash as View) : null;
  } catch {
    return null;
  }
}

function initialShowLanding(): boolean {
  try {
    if (location.search.includes("autostart=1") || location.search.includes("fullscreen=1")) return false;
    return true;
  } catch {
    return true;
  }
}

function initialDashUnlocked(): boolean {
  try {
    return sessionStorage.getItem("yz.auth.unlocked") === "1";
  } catch {
    return false;
  }
}

function initialTheme(): ThemeName {
  const stored = load("yz.theme");
  if (stored === "hanami" || stored === "yozakura") return stored;
  const attr = typeof document !== "undefined" ? document.documentElement.dataset.theme : undefined;
  return attr === "hanami" ? "hanami" : "yozakura";
}

function initialDockOpen(): boolean {
  const stored = load("yz.dock");
  if (stored) return stored === "open";
  return false;
}

const MAX_HISTORY = 44;

const initialConnection = (): Connection => ({
  status: "live",
  lastSnapshotAt: Date.now(),
  failures: 0,
  retryDelay: POLL_MS,
  nextRetryIn: 0,
  retryAt: 0,
});

/** Form defaults; the first snapshot replaces them with settings.js values. */
const initialSettings: SettingsState = {
  minecraft_version: "26.1",
  host: "127.0.0.1",
  port: "56730",
  auth: "offline",
  mindserver_port: "8080",
  base_profile: "assistant",
  narrate_behavior: true,
  auto_open_ui: true,
  allow_insecure_coding: false,
  load_memory: false,
  code_timeout_mins: "10",
  spawn_timeout: "60",
  only_chat_with: "",
  via_proxy_enabled: false,
  via_proxy_host: "127.0.0.1",
  via_proxy_port: "25568",
  via_proxy_client_version: "26.1",
};

const emptyTelemetry: Telemetry = { hits: 0, misses: 0, p50: null, p95: null, throughput: null };

const LOG_TIME = /^[A-Z][a-z]{2}\s+\d{1,2}\s+(\d{2}:\d{2}:\d{2})/;
const LOG_ERROR = /\b(error|failed|fatal|exception|traceback|panic)\b/i;
const LOG_WARN = /\b(warn|warning|deprecated|retry|timeout)\b/i;

function logTone(text: string): TermLine["tone"] {
  if (LOG_ERROR.test(text)) return "danger";
  if (LOG_WARN.test(text)) return "warn";
  return "default";
}

function logTime(line: string): string {
  return line.match(LOG_TIME)?.[1] ?? clock();
}

function uniqueProviderId(name: string, providers: Provider[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "provider";
  const safe = /^[a-z0-9]/.test(base) ? base : `p-${base}`;
  const taken = new Set(providers.map((provider) => provider.id));
  if (!taken.has(safe)) return safe;
  let n = 2;
  while (taken.has(`${safe}-${n}`)) n += 1;
  return `${safe}-${n}`;
}

function providerWire(provider: Provider) {
  return {
    id: provider.id,
    name: provider.name,
    baseURL: provider.baseURL,
    keyName: provider.keyName,
    model: provider.model,
    timeoutMs: provider.timeoutMs,
    enabled: provider.enabled,
  };
}

/* ── Store ────────────────────────────────────────────────── */

export const useConsole = create<ConsoleState>((set, get) => {
  const log = (source: TermLine["source"], text: string, tone: TermLine["tone"] = "default") =>
    get().termPush({ source, text, tone });
  const notify = (title: string, detail?: string, tone: ToastMsg["tone"] = "ok") => get().toast({ title, detail, tone });
  const pend = (key: string) => set((s) => ({ pending: { ...s.pending, [key]: true } }));
  const unpend = (key: string) =>
    set((s) => {
      const next = { ...s.pending };
      delete next[key];
      return { pending: next };
    });
  const busy = (key: string) => Boolean(get().pending[key]);

  /** The latest raw batch per service, so a repeated tail is not re-printed. */
  const logCursor = new Map<string, string>();
  /** Debounced add-on value saves (slider drags). */
  let addonTimer: number | undefined;
  let addonPatch: Record<string, boolean | number> = {};

  const refreshProviders = async () => {
    const response = await api.providers();
    set((s) => ({ providers: adaptProviders(response, s.providers) }));
  };
  const refreshAddons = async () => {
    const response = await api.addons();
    set((s) => ({
      addonConfig: adaptAddonConfig(response.config),
      threats: adaptThreats(response.live?.radar, s.bots[0]),
      loadout: adaptLoadout(response.live),
    }));
  };
  const refreshGrind = async () => {
    const response = await api.grind();
    set({ grind: adaptGrind(response.grind) });
  };
  const refreshBuild = async () => {
    const response = await api.schematic();
    set({ build: adaptBuild(response) });
  };

  const saveProviderList = async (providers: Provider[], apiKeys: Record<string, string> = {}, clearKeys: string[] = []) => {
    await api.saveProviders(providers.map(providerWire), apiKeys, clearKeys);
  };

  const requestAddonPatch = (patch: Record<string, boolean | number>) => {
    addonPatch = { ...addonPatch, ...patch };
    if (addonTimer) window.clearTimeout(addonTimer);
    addonTimer = window.setTimeout(async () => {
      const outgoing = addonPatch;
      addonPatch = {};
      addonTimer = undefined;
      try {
        const result = (await api.saveAddons(outgoing)) as { applied?: boolean; queued?: boolean };
        if (result?.queued) {
          notify("Add-on saved for the next start", "MindServer did not dispatch it to the running agent.", "warn");
        }
      } catch (error) {
        notify("Add-on was not saved", apiErrorMessage(error), "danger");
        void refreshAddons().catch(() => undefined);
      }
    }, 500);
  };

  return {
    showLanding: initialShowLanding(),
    dashUnlocked: initialDashUnlocked(),
    view: viewFromHash() ?? "fleet",
    visit: 0,
    theme: initialTheme(),
    collapsed: load("yz.sidebar") === "collapsed",
    sound: load("yz.sound") === "on",
    paletteOpen: false,
    helpOpen: false,
    notificationsOpen: false,
    terminalOpen: initialDockOpen(),
    terminalHeight: clamp(Number(load("yz.dock.h")) || 208, 140, 460),
    termFilter: "all",
    lightbox: null,
    nowTick: Date.now(),
    refreshing: false,
    connection: initialConnection(),
    pending: {},
    toasts: [],
    term: [],
    confirm: null,

    appVersion: "0.1.4",
    clusterTarget: "127.0.0.1:56730",
    clusterUptime: 498_221,
    services: [
      { name: "mc-dashboard", role: "Dashboard · this console", state: "active", pid: 40988, cpu: 0.7, mem: 96_468_992, startedAt: Date.now() - 187_200_000 },
      { name: "mc-shim", role: "Protocol shim · telemetry bridge", state: "active", pid: 41022, cpu: 2.4, mem: 188_743_680, startedAt: Date.now() - 187_200_000 },
      { name: "mc-cluster", role: "Worker agents · grind and build", state: "active", pid: 41088, cpu: 8.1, mem: 754_974_720, startedAt: Date.now() - 187_200_000 },
      { name: "mc-foreman", role: "ENI1 · supervisor loop", state: "active", pid: 41192, cpu: 12.7, mem: 1_342_177_280, startedAt: Date.now() - 22_320_000 },
      { name: "minecraft-server", role: "Minecraft server · world host", state: "inactive", pid: null, cpu: null, mem: null, startedAt: null },
    ],
    bots: adaptBots({
      bots: [
        { id: "eni1", name: "ENI1", health: 19, food: 17, x: 142, y: 68, z: -38, dimension: "minecraft:overworld", ping: 23, activity: "Mining ancient debris · 47/128", state: "active" },
        { id: "scout", name: "Scout", health: 14, food: 9, x: 96, y: 64, z: -52, dimension: "minecraft:overworld", ping: 41, activity: "Holding perimeter at camp chest", state: "warning" },
        { id: "deepminer", name: "DeepMiner", health: 20, food: 19, x: 138, y: -54, z: -41, dimension: "minecraft:the_nether", ping: 28, activity: "Sorting nether quartz into shulker #3", state: "active" },
        { id: "builder", name: "Builder", health: 18, food: 16, x: 152, y: 74, z: 6, dimension: "minecraft:overworld", ping: 31, activity: "Staging Hanami Pavilion layer 6/12", state: "idle" },
      ],
      profiles: [],
      activeProfile: "./profiles/foreman.json",
    }),
    profiles: [],
    selectedBotId: "eni1",
    activeProfile: "./profiles/foreman.json",
    telemetry: { hits: 948, misses: 12, p50: 41, p95: 114, throughput: 26.8 },
    latencyHistory: seedSeries(114, 18, 24),
    throughputHistory: seedSeries(26.8, 4, 24),
    threats: [],
    loadout: { totems: 2, gapples: 14, egapples: 3, balance: "$14,208" },
    addonConfig: {
      auto_totem: true,
      auto_gapple: true,
      auto_armor: true,
      cps_booster: true,
      cps_value: 14,
      cps_cooldown_mode: false,
      panic_escape: true,
      player_radar: true,
      auto_loot: true,
      shop_gui: true,
      auto_sell: false,
    },
    grind: { current: null, queue: [], history: [] },
    build: { current: null, queue: [], history: [] },
    buildUploadProgress: null,
    providers: [
      { id: "gemini-3-8-flash-high", name: "Gemini 3.8 Flash High", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", keyName: "GEMINI_API_KEY", model: "gemini-3.8-flash-high", timeoutMs: 45_000, enabled: true, keyConfigured: true, latencyMs: 184, modelCount: null, contextWindow: 1_048_576, contextUsed: 650_117, tokensPerSec: 186 },
      { id: "river-ai", name: "DeepSeek v4.1 Flash 1017", baseURL: "https://api.river.ai/v1", keyName: "RIVER_API_KEY", model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", timeoutMs: 60_000, enabled: true, keyConfigured: true, latencyMs: 312, modelCount: null, contextWindow: 163_840, contextUsed: 62_259, tokensPerSec: 142 },
      { id: "eni-local-critic", name: "ENI local critic", baseURL: "http://127.0.0.1:4100/v1", keyName: "LOCAL_CRITIC_KEY", model: "eni-critic-7b-q4", timeoutMs: 30_000, enabled: true, keyConfigured: true, latencyMs: 92, modelCount: null, contextWindow: 32_768, contextUsed: 3_932, tokensPerSec: 64 },
      { id: "nvidia-1", name: "NVIDIA NIM", baseURL: "https://integrate.api.nvidia.com/v1", keyName: "NVIDIA_API_KEY", model: "nvidia/nemotron-3.5-super-vl-120b-a12b", timeoutMs: 30_000, enabled: false, keyConfigured: true, latencyMs: null, modelCount: null, contextWindow: 131_072, contextUsed: 0, tokensPerSec: null },
    ],
    settings: initialSettings,
    savedSettings: initialSettings,
    effective: { host: "127.0.0.1", port: 56730, version: "26.1", auth: "offline", overrides: {} },

    /* shell */
    setShowLanding: (showLanding) => {
      set({ showLanding, notificationsOpen: false });
    },
    unlockDash: (pin) => {
      const check = verifyDashboardPin(pin);
      if (!check.ok) return false;
      try {
        sessionStorage.setItem("yz.auth.unlocked", "1");
      } catch {
        /* storage unavailable */
      }
      set({ dashUnlocked: true });
      log("console", "operator authenticated · supervisor session unlocked", "ok");
      notify("Console unlocked", "Supervisor session authenticated.", "ok");
      return true;
    },
    lockDash: () => {
      try {
        sessionStorage.removeItem("yz.auth.unlocked");
        sessionStorage.removeItem("yz.pin.unlocked");
      } catch {
        /* storage unavailable */
      }
      set({ dashUnlocked: false, paletteOpen: false, notificationsOpen: false });
      log("console", "console locked · supervisor authorization required", "muted");
      notify("Console locked", "Authenticate to resume supervisor access.", "info");
    },
    setView: (view) => {
      const prev = get().view;
      const onLanding = get().showLanding;
      set((s) => ({
        view,
        visit: prev !== view ? s.visit + 1 : s.visit,
        notificationsOpen: false,
      }));
      if (!onLanding) {
        try {
          if (location.hash.replace(/^#\/?/, "") !== view) location.hash = `/${view}`;
        } catch {
          /* sandboxed frame without a navigable location */
        }
      }
    },
    setTheme: (theme) => {
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "hanami" ? "#f2eee7" : "#121110");
      persist("yz.theme", theme);
      set({ theme });
    },
    toggleTheme: () => get().setTheme(get().theme === "yozakura" ? "hanami" : "yozakura"),
    toggleSound: () => {
      const sound = !get().sound;
      persist("yz.sound", sound ? "on" : "off");
      set({ sound });
    },
    toggleCollapsed: () => {
      const collapsed = !get().collapsed;
      persist("yz.sidebar", collapsed ? "collapsed" : "expanded");
      set({ collapsed });
    },
    setPaletteOpen: (paletteOpen) => set({ paletteOpen, notificationsOpen: false }),
    setHelpOpen: (helpOpen) => set({ helpOpen }),
    setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
    setTerminalOpen: (terminalOpen) => {
      persist("yz.dock", terminalOpen ? "open" : "closed");
      set({ terminalOpen });
    },
    setTerminalHeight: (h) => {
      const terminalHeight = clamp(Math.round(h), 140, 460);
      persist("yz.dock.h", String(terminalHeight));
      set({ terminalHeight });
    },
    setTermFilter: (termFilter) => set({ termFilter }),
    setLightbox: (lightbox) => set({ lightbox }),

    toast: (t) => {
      const toast = { ...t, id: nextId() };
      set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
      window.setTimeout(() => get().dismissToast(toast.id), 5200);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    askConfirm: (confirm) => set({ confirm }),
    resolveConfirm: (ok) => {
      const pendingConfirm = get().confirm;
      set({ confirm: null });
      if (ok && pendingConfirm) pendingConfirm.action();
    },

    refresh: () => {
      if (get().refreshing) return;
      set({ refreshing: true });
      window.dispatchEvent(new Event("yz:refresh"));
    },

    tick: () => {
      const now = Date.now();
      set((s) => ({
        nowTick: now,
        connection: s.connection.retryAt
          ? { ...s.connection, nextRetryIn: Math.max(0, s.connection.retryAt - now) }
          : s.connection,
      }));
    },

    pollFailure: (failures, retryAt) => {
      const wasLive = get().connection.status === "live";
      const retryDelay = Math.max(POLL_MS, Number(get().connection.retryDelay) || POLL_MS);
      set((s) => ({
        refreshing: false,
        connection: {
          ...s.connection,
          status: "reconnecting",
          failures,
          retryDelay,
          retryAt,
          nextRetryIn: Math.max(0, retryAt - Date.now()),
        },
      }));
      if (wasLive) {
        log("api", "supervisor connection lost · retrying with backoff", "warn");
        notify("Connection lost", "Showing the last snapshot until the supervisor answers again.", "warn");
      }
    },

    applyPoll: (payload) => {
      const now = Date.now();
      const previous = get();
      const recovered = previous.connection.status === "reconnecting" && previous.connection.failures > 0;

      let bots = previous.bots;
      let profiles = previous.profiles;
      let activeProfile = previous.activeProfile;
      let selectedBotId = previous.selectedBotId;
      if (payload.fleet) {
        bots = adaptBots(payload.fleet);
        profiles = adaptProfiles(payload.fleet.profiles);
        activeProfile = payload.fleet.activeProfile || activeProfile;
        selectedBotId = bots.some((bot) => bot.id === previous.selectedBotId)
          ? previous.selectedBotId
          : (bots[0]?.id ?? "");
      }

      let settings = previous.settings;
      let savedSettings = previous.savedSettings;
      let effective = previous.effective;
      let appVersion = previous.appVersion;
      if (payload.config) {
        const config = payload.config;
        savedSettings = adaptSettings(config.settings);
        const dirty = (Object.keys(savedSettings) as (keyof SettingsState)[]).filter(
          (key) => previous.settings[key] !== previous.savedSettings[key],
        );
        const draft = { ...savedSettings };
        for (const key of dirty) (draft[key] as SettingsState[typeof key]) = previous.settings[key];
        settings = draft;
        effective = liveEffective(savedSettings, adaptEffective(config.effective));
        appVersion = config.version || appVersion;
        profiles = adaptProfiles(config.profiles);
        activeProfile = config.active_profile || activeProfile;
      }

      const telemetry = payload.telemetry ? adaptTelemetry(payload.telemetry) : previous.telemetry;
      const p95 = payload.telemetry?.latency.p95 ?? null;
      const latencyHistory = payload.telemetry
        ? p95 === null
          ? previous.latencyHistory
          : previous.latencyHistory.length < 2
            ? seedSeries(p95, 28)
            : [...previous.latencyHistory, p95].slice(-MAX_HISTORY)
        : previous.latencyHistory;
      const throughput = payload.telemetry?.throughput ?? null;
      const throughputHistory = payload.telemetry
        ? throughput === null
          ? previous.throughputHistory
          : previous.throughputHistory.length < 2
            ? seedSeries(throughput, 9)
            : [...previous.throughputHistory, throughput].slice(-MAX_HISTORY)
        : previous.throughputHistory;

      set({
        services: payload.status ? adaptStatus(payload.status, now) : previous.services,
        clusterTarget: payload.status?.target || previous.clusterTarget,
        clusterUptime: typeof payload.status?.uptime === "number" ? payload.status.uptime : previous.clusterUptime,
        bots,
        profiles,
        activeProfile,
        selectedBotId,
        settings,
        savedSettings,
        effective,
        appVersion,
        addonConfig: payload.addons ? adaptAddonConfig(payload.addons.config) : previous.addonConfig,
        threats: payload.addons ? adaptThreats(payload.addons.live?.radar, bots[0]) : previous.threats,
        loadout: payload.addons ? adaptLoadout(payload.addons.live) : previous.loadout,
        grind: payload.grind ? adaptGrind(payload.grind.grind) : previous.grind,
        build: payload.schematic ? adaptBuild(payload.schematic) : previous.build,
        providers: payload.providers ? adaptProviders(payload.providers, previous.providers) : previous.providers,
        telemetry,
        latencyHistory,
        throughputHistory,
        refreshing: false,
        connection: {
          status: "live",
          lastSnapshotAt: now,
          failures: 0,
          retryDelay: POLL_MS,
          nextRetryIn: 0,
          retryAt: 0,
        },
      });

      if (recovered) {
        log("api", "supervisor connection restored", "ok");
        notify("Live telemetry restored", "The console is receiving fresh supervisor data.", "info");
      }
      if (payload.failed.length > 0) {
        log("api", `partial snapshot · unavailable: ${payload.failed.join(", ")}`, "warn");
      }
    },

    termPush: (line) => set((s) => ({ term: [...s.term.slice(-239), { ...line, id: nextId(), time: clock() }] })),
    termClear: () =>
      set({ term: [{ id: nextId(), time: clock(), source: "console", text: "scrollback cleared", tone: "muted" }] }),

    applyLogs: (service, lines) => {
      if (!Array.isArray(lines) || lines.length === 0) return;
      const cursor = logCursor.get(service);
      let start = 0;
      if (cursor) {
        const index = lines.lastIndexOf(cursor);
        if (index >= 0) start = index + 1;
      }
      const newest = lines[lines.length - 1];
      logCursor.set(service, newest);
      if (start >= lines.length) return;
      const fresh = lines.slice(start).map((line) => ({
        id: nextId(),
        time: logTime(line),
        source: service as TermLine["source"],
        text: line,
        tone: logTone(line),
      }));
      set((s) => ({ term: [...s.term, ...fresh].slice(-239) }));
    },

    runCommand: async (raw) => {
      const text = raw.trim();
      if (!text) return;
      log("console", `❯ ${text}`, "accent");
      const command = text.toLowerCase();
      if (command === "clear") {
        get().termClear();
        return;
      }
      if (command === "help") {
        log("console", "help    list console commands", "muted");
        log("console", "status  one-line fleet summary", "muted");
        log("console", "clear   empty the scrollback", "muted");
        log("console", "anything else is sent to ENI1 as a server command", "muted");
        return;
      }
      if (command === "status") {
        const s = get();
        const active = s.bots.filter((b) => b.state === "active").length;
        const g = s.grind.current;
        const b = s.build.current;
        log(
          "console",
          `${active}/${s.bots.length} agents active · grind ${g ? `${g.target} ${g.completed}/${g.requested}` : "idle"} · build ${b ? `${b.fileName} ${Math.round((b.placed / Math.max(1, b.totalBlocks)) * 100)}%` : "idle"}`,
        );
        return;
      }
      if (busy("terminal:command")) return;
      pend("terminal:command");
      try {
        const result = (await api.addonAction("send_command", text)) as { applied?: boolean; queued?: boolean };
        unpend("terminal:command");
        if (result?.applied) {
          log("mc-foreman", `ENI1 dispatched · ${text}`, "ok");
        } else {
          log("api", `${text} queued for the next ENI1 connection`, "warn");
          notify("Command queued", "ENI1 was not connected; the command is waiting for it.", "warn");
        }
      } catch (error) {
        unpend("terminal:command");
        log("api", `command failed · ${apiErrorMessage(error)}`, "danger");
        notify("Command failed", apiErrorMessage(error), "danger");
      }
    },

    /* fleet */
    selectBot: (selectedBotId) => set({ selectedBotId }),
    recallBot: async (id) => {
      const s = get();
      const bot = s.bots.find((b) => b.id === id);
      if (!bot) return;
      const lead = s.bots[0];
      if (!lead || bot.id !== lead.id) {
        notify("Read-only coordinator", `${bot.name} is a coordinator agent. Only ${lead?.name ?? "ENI1"} accepts dispatched commands.`, "warn");
        return;
      }
      if (busy(`dispatch:recall:${id}`)) return;
      pend(`dispatch:recall:${id}`);
      try {
        const result = (await api.addonAction("send_command", "/home base")) as { applied?: boolean };
        unpend(`dispatch:recall:${id}`);
        log("api", `dispatch · ${bot.name} /home base`, "accent");
        notify(`${bot.name} recalled`, result?.applied ? "The bot accepted /home base." : "Queued for the next bot connection.", result?.applied ? "ok" : "warn");
      } catch (error) {
        unpend(`dispatch:recall:${id}`);
        notify("Recall failed", apiErrorMessage(error), "danger");
      }
    },
    serviceAction: async (name, action) => {
      const key = `service:${name}`;
      if (busy(key)) return;
      const previous = get().services;
      pend(key);
      set((s) => ({
        services: s.services.map((v) => (v.name === name ? { ...v, state: action === "stop" ? "inactive" : "restarting" } : v)),
      }));
      log("console", `systemctl ${action} ${name}`, "warn");
      try {
        await api.service(name, action);
        unpend(key);
        log("console", `${name} · ${action} accepted`, action === "stop" ? "warn" : "ok");
        notify(`${name} ${action === "restart" ? "restarted" : action === "start" ? "started" : "stopped"}`, "The supervisor accepted the request.", action === "stop" ? "warn" : "ok");
        try {
          const status = await api.status();
          set({ services: adaptStatus(status) });
        } catch {
          /* the next poll refreshes it */
        }
      } catch (error) {
        unpend(key);
        set({ services: previous });
        log("api", `${action} ${name} failed · ${apiErrorMessage(error)}`, "danger");
        notify(`${action} ${name} failed`, apiErrorMessage(error), "danger");
      }
    },
    setProfile: async (file) => {
      if (busy("profile") || get().activeProfile === file) return;
      const previous = get().activeProfile;
      pend("profile");
      set({ activeProfile: file });
      log("mc-foreman", `profile swap → ${file} (restarting ENI1)`);
      try {
        await api.saveConfig({ active_profile: file, restart: "eni" });
        unpend("profile");
        const profile = get().profiles.find((p) => p.file === file);
        notify("Profile applied", profile ? `${profile.name} · ${profile.model}` : file);
      } catch (error) {
        unpend("profile");
        set({ activeProfile: previous });
        notify("Profile switch failed", apiErrorMessage(error), "danger");
      }
    },

    /* add-ons */
    toggleAddon: async (id) => {
      const def = addonCatalog.find((a) => a.id === id);
      if (!def || def.managed) return;
      const key = `addon:${id}`;
      if (busy(key)) return;
      const previous = get().addonConfig;
      const next = previous[id] !== true;
      const conflictsWith = next ? TOGGLE_CONFLICTS[id] : undefined;
      const patch: Record<string, boolean | number> = { [id]: next };
      if (conflictsWith) patch[conflictsWith] = false;
      pend(key);
      set((s) => ({ addonConfig: { ...s.addonConfig, ...patch } }));
      log("console", `${def.name} → ${next ? "armed" : "off"}`, next ? "ok" : "muted");
      try {
        const result = (await api.saveAddons(patch)) as { applied?: boolean; queued?: boolean };
        unpend(key);
        const conflictName = conflictsWith ? addonCatalog.find((a) => a.id === conflictsWith)?.name : undefined;
        notify(
          `${def.name} ${next ? "armed" : "disarmed"}`,
          result?.queued
            ? "Saved for the next agent start; MindServer did not dispatch it."
            : next && conflictName
              ? `${conflictName} turned off, because both set the attack cadence.`
              : "Applied to the running agent.",
          result?.queued ? "warn" : next ? "ok" : "info",
        );
        if (conflictName && next) log("console", `${conflictName} → off (conflict)`, "muted");
      } catch (error) {
        unpend(key);
        set({ addonConfig: previous });
        notify(`${def.name} was not changed`, apiErrorMessage(error), "danger");
      }
    },
    setAddonValue: (key, value) => {
      set((s) => ({ addonConfig: { ...s.addonConfig, [key]: value } }));
      requestAddonPatch({ [key]: value });
    },
    disarmAll: async () => {
      if (busy("addons:disarm")) return;
      const previous = get().addonConfig;
      const patch: Record<string, boolean | number> = {};
      for (const addon of addonCatalog) if (!addon.managed) patch[addon.id] = false;
      pend("addons:disarm");
      set((s) => ({ addonConfig: { ...s.addonConfig, ...patch } }));
      log("console", "disarming every switchable module", "warn");
      try {
        const result = (await api.saveAddons(patch)) as { applied?: boolean; queued?: boolean };
        unpend("addons:disarm");
        notify("All add-ons disarmed", result?.queued ? "Saved for the next agent start." : "The guard layer is off until you re-arm modules.", "warn");
      } catch (error) {
        unpend("addons:disarm");
        set({ addonConfig: previous });
        notify("Could not disarm add-ons", apiErrorMessage(error), "danger");
      }
    },
    dispatch: async (action) => {
      const key = `dispatch:${action.label}`;
      if (busy(key)) return;
      pend(key);
      log("console", `dispatch · ${action.command ?? action.action}`, "accent");
      try {
        const result = (await api.addonAction(action.action, action.command)) as { applied?: boolean };
        unpend(key);
        notify(
          action.label,
          result?.applied ? "ENI1 accepted the order." : "Queued for the next ENI1 connection.",
          result?.applied ? "ok" : "warn",
        );
      } catch (error) {
        unpend(key);
        notify(`${action.label} failed`, apiErrorMessage(error), "danger");
      }
    },

    /* grind */
    grindEnqueue: async (input) => {
      if (busy("grind:queue")) return;
      pend("grind:queue");
      log("api", `grind queue · ${input.target} ×${input.requested}`);
      try {
        await api.grindAction({ action: "queue", target: input.target, count: input.requested });
        unpend("grind:queue");
        notify("Job queued", `${input.requested} × ${prettyBlock(input.target)}`);
        await refreshGrind();
      } catch (error) {
        unpend("grind:queue");
        notify("Grind job was not queued", apiErrorMessage(error), "danger");
      }
    },
    grindCancel: async (id) => {
      const key = `grind:${id}`;
      if (busy(key)) return;
      const running = get().grind.current?.id === id;
      pend(key);
      log("api", `grind cancel · ${id}`, "warn");
      try {
        await api.grindAction({ action: "cancel", jobId: id });
        unpend(key);
        notify(running ? "Job cancelled" : "Removed from the queue", running ? "Collected blocks stay where they were deposited." : "The job never started, so nothing was collected.", "info");
        await refreshGrind();
      } catch (error) {
        unpend(key);
        notify("Could not cancel the job", apiErrorMessage(error), "danger");
      }
    },
    grindTogglePause: async () => {
      const current = get().grind.current;
      if (!current || busy("grind:pause")) return;
      const resume = current.status === "paused" || current.status === "pausing";
      pend("grind:pause");
      try {
        await api.grindAction({ action: resume ? "resume" : "pause" });
        unpend("grind:pause");
        log("api", `grind ${resume ? "resume" : "pause"} · ${current.id}`, "warn");
        await refreshGrind();
      } catch (error) {
        unpend("grind:pause");
        notify(`Could not ${resume ? "resume" : "pause"} the job`, apiErrorMessage(error), "danger");
      }
    },

    /* build */
    buildStage: async (input) => {
      if (busy("build:upload")) return;
      if (!/\.schem$/i.test(input.fileName)) {
        notify("Unsupported file", "Choose a Sponge .schem file.", "danger");
        return;
      }
      if (input.file.size > 8 * 1024 * 1024) {
        notify("File too large", "Schematic uploads are limited to 8 MB.", "danger");
        return;
      }
      if (input.file.size === 0) {
        notify("Empty file", "Choose a schematic with content.", "danger");
        return;
      }
      const params: Record<string, string> = {
        name: input.fileName,
        rotation: String(input.rotation),
        replace: String(input.replaceBlocks),
      };
      if (input.origin) {
        params.x = String(input.origin.x);
        params.y = String(input.origin.y);
        params.z = String(input.origin.z);
      }
      pend("build:upload");
      set({ buildUploadProgress: 0 });
      log("api", `schematic upload · ${input.fileName} · rot ${input.rotation}°`);
      try {
        await api.uploadSchematic(input.file, params, undefined, (percent) => set({ buildUploadProgress: percent }));
        set({ buildUploadProgress: null });
        unpend("build:upload");
        notify("Build started", `${input.fileName} · the builder is staging materials.`);
        await refreshBuild();
      } catch (error) {
        set({ buildUploadProgress: null });
        unpend("build:upload");
        log("api", `schematic upload failed · ${apiErrorMessage(error)}`, "danger");
        notify("Build was not started", apiErrorMessage(error), "danger");
      }
    },
    buildStageSample: async (options) => {
      const fileName = options?.fileName ?? "sakura_watchtower.schem";
      if (get().build.current) {
        try {
          await api.schematicControl("cancel");
          set((s) => ({
            build: {
              ...s.build,
              current: null,
            },
          }));
        } catch {
          /* continue to upload */
        }
      }
      const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x53, 0x43, 0x48, 0x45, 0x4d, 0x01, 0x00, 0x00]);
      const file = new File([bytes], fileName, { type: "application/octet-stream" });
      get().buildStage({
        fileName,
        file,
        origin: options?.origin ?? null,
        rotation: options?.rotation ?? 0,
        replaceBlocks: options?.replaceBlocks ?? false,
      });
    },
    buildCancel: async (id) => {
      if (busy("build:cancel")) return;
      pend("build:cancel");
      log("api", `schematic cancel · ${id}`, "warn");
      try {
        await api.schematicControl("cancel");
        unpend("build:cancel");
        notify("Build stopped", "Placed blocks stay in the world.", "info");
        await refreshBuild();
      } catch (error) {
        unpend("build:cancel");
        notify("Could not stop the build", apiErrorMessage(error), "danger");
      }
    },
    buildTogglePause: async () => {
      const current = get().build.current;
      if (!current || busy("build:pause")) return;
      const resume = current.status === "paused" || current.status === "pausing";
      pend("build:pause");
      try {
        await api.schematicControl(resume ? "resume" : "pause");
        unpend("build:pause");
        log("api", `schematic ${resume ? "resume" : "pause"} · ${current.id}`, "warn");
        await refreshBuild();
      } catch (error) {
        unpend("build:pause");
        notify(`Could not ${resume ? "resume" : "pause"} the build`, apiErrorMessage(error), "danger");
      }
    },

    /* providers */
    providerToggle: async (id) => {
      const provider = get().providers.find((p) => p.id === id);
      if (!provider || busy("providers:save")) return;
      if (!provider.enabled && !provider.keyConfigured) {
        notify("API key missing", `${provider.keyName} has no value. Edit the provider and add a key before enabling ${provider.name}.`, "warn");
        return;
      }
      const previous = get().providers;
      const next = previous.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
      pend("providers:save");
      set({ providers: next });
      try {
        await saveProviderList(next);
        unpend("providers:save");
        log("api", `provider ${id} enabled=${!provider.enabled}`, "muted");
        notify(`${provider.name} ${provider.enabled ? "disabled" : "enabled"}`, "ENI1 is restarting with the new routing table.");
        await refreshProviders();
      } catch (error) {
        unpend("providers:save");
        set({ providers: previous });
        notify("Provider routing was not saved", apiErrorMessage(error), "danger");
      }
    },
    providerTest: async (id) => {
      const provider = get().providers.find((p) => p.id === id);
      const key = `provider:test:${id}`;
      if (!provider || busy(key)) return;
      pend(key);
      log("api", `provider test · ${provider.baseURL}`, "muted");
      try {
        const result = await api.testProvider(provider);
        unpend(key);
        if (!result.ok) {
          set((s) => ({ providers: s.providers.map((p) => (p.id === id ? { ...p, latencyMs: null, modelCount: null } : p)) }));
          notify("Test failed", result.error || `Endpoint answered ${result.statusCode ?? "with an error"}.`, "warn");
          return;
        }
        set((s) => ({
          providers: s.providers.map((p) => (p.id === id ? { ...p, latencyMs: result.latencyMs, modelCount: result.modelCount } : p)),
        }));
        log("api", `provider test ok · ${result.latencyMs ?? "?"} ms · ${result.modelCount ?? "?"} models`, "ok");
        notify("Provider reachable", `${result.latencyMs ?? "?"} ms${result.modelCount !== null ? ` · ${result.modelCount} models` : ""}`, "ok");
      } catch (error) {
        unpend(key);
        notify("Provider test failed", apiErrorMessage(error), "danger");
      }
    },
    providerTestAll: async () => {
      if (busy("provider:test:all")) return;
      const targets = get().providers.filter((p) => p.keyConfigured);
      if (targets.length === 0) {
        notify("No keyed providers", "Configure at least one API key before testing.", "warn");
        return;
      }
      pend("provider:test:all");
      log("api", `probing ${targets.length} configured provider endpoints`, "muted");
      await Promise.allSettled(targets.map((p) => get().providerTest(p.id)));
      unpend("provider:test:all");
    },
    providerSave: async (draft, key) => {
      if (busy("providers:save")) return;
      const name = draft.name.trim();
      const baseURL = draft.baseURL.trim();
      const keyName = draft.keyName.trim();
      const model = draft.model.trim();
      const timeoutMs = Math.round(draft.timeoutMs);
      if (!name || name.length > 80) {
        notify("Provider not saved", "Give the provider a name under 80 characters.", "danger");
        return;
      }
      if (!/^https?:\/\/\S+$/i.test(baseURL)) {
        notify("Provider not saved", "Enter a full HTTP or HTTPS base URL.", "danger");
        return;
      }
      if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(keyName)) {
        notify("Provider not saved", "Enter an uppercase key variable such as OPENAI_API_KEY.", "danger");
        return;
      }
      if (!model && draft.id !== "nvidia-1") {
        notify("Provider not saved", "Enter the model identifier.", "danger");
        return;
      }
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
        notify("Provider not saved", "Timeout must be between 1,000 and 120,000 ms.", "danger");
        return;
      }
      const previous = get().providers;
      const existing = draft.id ? previous.find((p) => p.id === draft.id) : undefined;
      if (!existing && previous.length >= 20) {
        notify("Provider limit reached", "The server accepts at most 20 routes.", "warn");
        return;
      }
      const id = existing?.id ?? uniqueProviderId(name, previous);
      const nextProvider: Provider = {
        id,
        name,
        baseURL,
        keyName,
        model,
        timeoutMs,
        // A new route joins the chain only when its key was supplied in the
        // same save; otherwise it waits until the operator arms it.
        enabled: existing?.enabled ?? Boolean(key.apiKey),
        keyConfigured: key.clear ? false : Boolean(key.apiKey) || existing?.keyConfigured || false,
        latencyMs: key.clear || key.apiKey ? null : (existing?.latencyMs ?? null),
        modelCount: key.clear || key.apiKey ? null : (existing?.modelCount ?? null),
        contextWindow: existing?.contextWindow ?? null,
        contextUsed: existing?.contextUsed ?? null,
        tokensPerSec: existing?.tokensPerSec ?? null,
      };
      if (key.clear) nextProvider.enabled = false;
      const next = existing ? previous.map((p) => (p.id === existing.id ? nextProvider : p)) : [...previous, nextProvider];
      const apiKeys = key.apiKey && keyName ? { [keyName]: key.apiKey } : {};
      const clearKeys = key.clear ? [keyName] : [];
      pend("providers:save");
      set({ providers: next });
      log("api", `${existing ? "update" : "add"} provider · ${id}`, "muted");
      try {
        await saveProviderList(next, apiKeys, clearKeys);
        unpend("providers:save");
        notify(existing ? "Provider saved" : "Provider added", `${name} · ${model || "no model"}. ENI1 is restarting with the new routing table.`);
        await refreshProviders();
      } catch (error) {
        unpend("providers:save");
        set({ providers: previous });
        notify("Provider was not saved", apiErrorMessage(error), "danger");
      }
    },
    providerRemove: async (id) => {
      if (busy("providers:save")) return;
      const provider = get().providers.find((p) => p.id === id);
      if (!provider) return;
      if (get().providers.length <= 1) {
        notify("Cannot remove the last provider", "At least one model endpoint must stay configured.", "warn");
        return;
      }
      const previous = get().providers;
      const next = previous.filter((p) => p.id !== id);
      pend("providers:save");
      set({ providers: next });
      log("api", `remove provider · ${id}`, "warn");
      try {
        await saveProviderList(next);
        unpend("providers:save");
        notify("Provider removed", provider.name, "info");
        await refreshProviders();
      } catch (error) {
        unpend("providers:save");
        set({ providers: previous });
        notify("Provider was not removed", apiErrorMessage(error), "danger");
      }
    },
    providerMove: async (id, dir) => {
      if (busy("providers:save")) return;
      const previous = get().providers;
      const from = previous.findIndex((p) => p.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= previous.length) return;
      const next = [...previous];
      [next[from], next[to]] = [next[to], next[from]];
      pend("providers:save");
      set({ providers: next });
      try {
        await saveProviderList(next);
        unpend("providers:save");
        notify("Routing order saved", "ENI1 is restarting with the new fallback chain.", "info");
        await refreshProviders();
      } catch (error) {
        unpend("providers:save");
        set({ providers: previous });
        notify("Routing order was not saved", apiErrorMessage(error), "danger");
      }
    },

    /* settings */
    setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
    discardSettings: () => set((s) => ({ settings: { ...s.savedSettings } })),
    saveSettings: async () => {
      if (busy("config:save")) return;
      const draft = get().settings;
      pend("config:save");
      log("console", "saving settings · no restart", "muted");
      try {
        await api.saveConfig({ settings: settingsPatch(draft), restart: false });
        unpend("config:save");
        set({ savedSettings: { ...draft }, effective: liveEffective(draft, get().effective) });
        notify("Settings saved", "The files on disk are updated. Running services keep their current configuration until the next restart.", "ok");
      } catch (error) {
        unpend("config:save");
        notify("Settings were not saved", apiErrorMessage(error), "danger");
      }
    },
    saveAndRestart: async () => {
      if (busy("config:restart")) return;
      const draft = get().settings;
      pend("config:restart");
      log("console", "saving settings · restarting ENI1", "warn");
      try {
        await api.saveConfig({ settings: settingsPatch(draft), restart: "eni" });
        unpend("config:restart");
        set({ savedSettings: { ...draft }, effective: liveEffective(draft, get().effective) });
        notify("Settings saved", "ENI1 restarted with the new configuration.");
        log("console", "mc-foreman restart requested", "ok");
      } catch (error) {
        unpend("config:restart");
        notify("Settings were not saved", apiErrorMessage(error), "danger");
      }
    },
    applyLive: async () => {
      if (busy("config:restart")) return;
      pend("config:restart");
      log("console", "applying saved configuration · restarting ENI1", "warn");
      try {
        await api.saveConfig({ restart: "eni" });
        unpend("config:restart");
        set((s) => ({ effective: liveEffective(s.savedSettings, s.effective) }));
        notify("ENI1 restarted", "The saved configuration is now live.");
      } catch (error) {
        unpend("config:restart");
        notify("Could not restart ENI1", apiErrorMessage(error), "danger");
      }
    },
  };
});

/* ── Derived helpers ──────────────────────────────────────── */

export function armedCount(cfg: Record<string, boolean | number>) {
  return addonCatalog.filter((a) => !a.managed && cfg[a.id] === true).length;
}

export function healthTone(health: number | null): "ok" | "warn" | "danger" {
  if (health === null) return "warn";
  if (health >= 15) return "ok";
  return health >= 9 ? "warn" : "danger";
}

export function foodTone(food: number | null): "ok" | "warn" | "danger" {
  if (food === null) return "warn";
  if (food >= 14) return "ok";
  return food >= 8 ? "warn" : "danger";
}

export function botTone(state: FleetBot["state"]): "ok" | "warn" | "danger" | "idle" {
  if (state === "active") return "ok";
  if (state === "warning" || state === "stale") return "warn";
  return state === "offline" ? "danger" : "idle";
}
