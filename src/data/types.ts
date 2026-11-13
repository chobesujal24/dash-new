export type View = "fleet" | "grind" | "build" | "addons" | "providers" | "settings";
export type Theme = "yozakura" | "hanami";
export type Tone = "ok" | "warn" | "danger" | "idle" | "accent";

export type Service = {
  name: string;
  state: string;
  pid: number | null;
  cpu: number | null;
  mem: number | null;
  uptime: string | null;
};

export type StatusResponse = {
  ok: boolean;
  services: Service[];
  botCount: number;
  uptime: number | null;
  target: string;
};

export type FleetBot = {
  id: string;
  name: string;
  health: number | null;
  food: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
  dimension: string | null;
  ping: number | null;
  activity: string;
  state: "active" | "idle" | "warning" | "offline" | "stale";
};

export type ProfileOption = {
  file: string;
  filename: string;
  name: string;
  rawName: string;
  is_online: boolean;
  model: string;
  hide_commands_in_chat: boolean;
};

export type FleetResponse = {
  bots: FleetBot[];
  profiles: ProfileOption[];
  activeProfile: string;
};

export type TelemetryResponse = {
  hits: number;
  misses: number;
  latency: { p50: number | null; p95: number | null };
  throughput: number | null;
  lastSweep: number | null;
};

export type Threat = {
  username: string;
  distance: number;
  x: number;
  y: number;
  z: number;
  heldItem: string;
  isSneaking: boolean;
};

export type AddonValue = boolean | number | string;
export type AddonConfig = Record<string, AddonValue>;

export type GrindJob = {
  id: string;
  target: string;
  requested: number;
  completed: number;
  status: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
  message?: string;
  radius?: number;
  deposit?: string;
  tools?: string[];
};

export type GrindState = {
  current: GrindJob | null;
  queue: GrindJob[];
  history: GrindJob[];
};

export type GrindResponse = {
  agentName: string;
  grind: GrindState;
  agentStatus: string;
  lastSeen: number | null;
};

export type AddonsResponse = {
  agentName: string;
  config: AddonConfig;
  live: {
    agentName?: string;
    timestamp?: number;
    health?: number;
    maxHealth?: number;
    food?: number;
    totems?: number;
    gapples?: number;
    egapples?: number;
    balance?: string;
    radar?: Threat[];
    config?: AddonConfig;
    grind?: GrindState;
    schematic?: SchematicState;
    dimension?: string;
    ping?: number;
    position?: { x: number; y: number; z: number };
    x?: number;
    y?: number;
    z?: number;
  };
};

export type Vec3 = { x: number | null; y: number | null; z: number | null };

export type SchematicJob = {
  id: string;
  fileName: string;
  sourceName: string;
  origin: Vec3;
  rotation?: number;
  replaceBlocks: boolean;
  status: string;
  totalBlocks: number;
  nextIndex: number;
  placed: number;
  skipped: number;
  size: { x: number; y: number; z: number } | null;
  materials: Record<string, number>;
  missing: string[];
  message: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
};

export type SchematicState = {
  current: SchematicJob | null;
  history: SchematicJob[];
};

export type SchematicResponse = {
  agentName: string;
  current: SchematicJob | null;
  history: SchematicJob[];
};

export type Provider = {
  id: string;
  name: string;
  baseURL: string;
  keyName: string;
  model: string;
  timeoutMs: number;
  enabled: boolean;
  keyConfigured?: boolean;
  contextWindow?: number | null;
  contextUsed?: number | null;
  tokensPerSec?: number | null;
  lastLatencyMs?: number | null;
};

export type ProvidersResponse = { providers: Provider[] };

export type ProviderTest = {
  ok: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  modelCount: number | null;
  error?: string;
};

export type Settings = Record<string, unknown>;

export type ConfigResponse = {
  settings: Settings;
  bots: Record<string, unknown>;
  env: Record<string, string>;
  effective: {
    host?: string;
    port?: number;
    version?: string;
    auth?: string;
    startPaused?: boolean;
    overrides?: Record<string, string>;
  };
  profiles: ProfileOption[];
  active_profile: string;
  version: string;
};

export type LogsResponse = { service: string; lines: string[] };

export type Toast = {
  id: number;
  title: string;
  detail?: string;
  tone: "ok" | "warn" | "info" | "danger";
};

export type TerminalLine = {
  id: number;
  text: string;
  tone?: "default" | "muted" | "ok" | "warn" | "accent";
  time?: string;
  isLog?: boolean;
};

export type PendingKey = string;
export type PendingMap = Record<PendingKey, boolean>;

export type ApiErrorBody = { error?: string; message?: string } | null;
