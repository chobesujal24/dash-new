import type {
  AddonsResponse,
  ConfigResponse,
  FleetBot,
  FleetResponse,
  GrindResponse,
  LogsResponse,
  ProfileOption,
  Provider,
  ProvidersResponse,
  ProviderTest,
  SchematicResponse,
  Service,
  StatusResponse,
  TelemetryResponse,
} from "./types";

const DEFAULT_TIMEOUT = 8_000;
// Schematic uploads can be up to 8 MB on a slow tailnet link; the request
// timeout must cover transfer plus server-side validation.
const UPLOAD_TIMEOUT = 120_000;

export class ApiError extends Error {
  readonly status: number;
  readonly correlationId: string;
  readonly detail?: string;

  constructor(message: string, status: number, correlationId: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.correlationId = correlationId;
    this.detail = detail;
  }
}

function correlationId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `yz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) headers.authorization = `Bearer ${token}`;
  } catch {
    /* no location token */
  }
  return headers;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  raw?: BodyInit;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const id = correlationId();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const timeoutMessage = `Request timed out after ${Math.ceil(timeoutMs / 1_000)} seconds`;
  const timeout = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
  const abortFromCaller = () => controller.abort("cancelled");
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const headers: Record<string, string> = {
    accept: "application/json",
    "x-correlation-id": id,
    ...authHeaders(),
    ...options.headers,
  };

  let body: BodyInit | undefined = options.raw;
  if (options.body !== undefined && body === undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
      const message = String(record.error || record.message || `Request failed (${response.status})`);
      throw new ApiError(message, response.status, id, typeof payload === "string" ? payload : undefined);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      const timedOut = controller.signal.reason === "timeout";
      throw new ApiError(timedOut ? timeoutMessage : "Request cancelled", 0, id);
    }
    if (error instanceof Error && error.message === "timeout") {
      throw new ApiError(timeoutMessage, 0, id);
    }
    throw new ApiError(error instanceof Error ? error.message : "Network request failed", 0, id);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} · ${error.correlationId.slice(0, 8)}`;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function finite(value: unknown): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function serviceList(input: unknown): Service[] {
  if (Array.isArray(input)) {
    return input.map((value, index) => normaliseService(value, text(recordOf(value).name, `service-${index}`)));
  }
  return Object.entries(recordOf(input)).map(([name, value]) => normaliseService(value, name));
}

function normaliseService(value: unknown, name: string): Service {
  const record = recordOf(value);
  return {
    name: text(record.name, name),
    state: text(record.state ?? record.status ?? record.active, "unknown").toLowerCase(),
    pid: finite(record.pid),
    cpu: finite(record.cpu ?? record.cpuPercent),
    mem: finite(record.mem ?? record.memory ?? record.rss),
    uptime: record.uptime == null ? null : text(record.uptime),
  };
}

function normaliseProfile(value: unknown, index: number): ProfileOption {
  const record = recordOf(value);
  const filename = text(record.filename ?? record.file, `profile-${index}.json`);
  const rawName = text(record.rawName ?? record.raw_name ?? record.name, filename.replace(/\.json$/, ""));
  return {
    file: text(record.file, `./profiles/${filename}`),
    filename,
    name: text(record.name, rawName),
    rawName,
    is_online: Boolean(record.is_online),
    model: text(record.model, "model not reported"),
    hide_commands_in_chat: Boolean(record.hide_commands_in_chat),
  };
}

function normaliseBot(value: unknown, index: number): FleetBot {
  const record = recordOf(value);
  const state = ["active", "idle", "warning", "offline", "stale"].includes(text(record.state))
    ? (record.state as FleetBot["state"])
    : "idle";
  const position = recordOf(record.position);
  return {
    id: text(record.id ?? record.name, `bot-${index}`),
    name: text(record.name ?? record.id, `Bot ${index + 1}`),
    health: finite(record.health),
    food: finite(record.food),
    x: finite(record.x ?? position.x),
    y: finite(record.y ?? position.y),
    z: finite(record.z ?? position.z),
    dimension: record.dimension == null ? null : text(record.dimension),
    ping: finite(record.ping ?? record.latency),
    activity: text(record.activity ?? record.task ?? record.message, "Awaiting next task"),
    state,
  };
}

function normaliseStatus(raw: unknown): StatusResponse {
  const record = recordOf(raw);
  const coordinator = recordOf(record.coordinator);
  const agents = Array.isArray(coordinator.agents) ? coordinator.agents : Array.isArray(record.bots) ? record.bots : [];
  return {
    ok: record.ok !== false,
    services: serviceList(record.services),
    botCount: finite(record.botCount) ?? agents.length,
    uptime: finite(record.uptime) ?? finite(coordinator.uptime),
    target: text(record.target ?? record.host, "localhost"),
  };
}

function normaliseFleet(raw: unknown): FleetResponse {
  const record = recordOf(raw);
  const coordinator = recordOf(record.coordinator);
  const rawBots = Array.isArray(record.bots)
    ? record.bots
    : Array.isArray(coordinator.agents)
      ? coordinator.agents
      : [];
  const rawProfiles = Array.isArray(record.profiles) ? record.profiles : [];
  return {
    bots: rawBots.map(normaliseBot),
    profiles: rawProfiles.map(normaliseProfile),
    activeProfile: text(record.activeProfile ?? record.active_profile, ""),
  };
}

function normaliseTelemetry(raw: unknown): TelemetryResponse {
  const record = recordOf(raw);
  const nested = recordOf(record.telemetry);
  const source = Object.keys(nested).length ? nested : record;
  const latencyValue = recordOf(source.latency);
  // Preserve "not reported" as null so the history buffer never records a
  // missing sample as a real zero-latency reading.
  const latencyNumber = finite(source.latency);
  return {
    hits: finite(source.hits) ?? 0,
    misses: finite(source.misses) ?? 0,
    latency: {
      p50: finite(latencyValue.p50) ?? latencyNumber,
      p95: finite(latencyValue.p95) ?? latencyNumber,
    },
    throughput: finite(source.throughput ?? source.tps),
    lastSweep: finite(source.lastSweep ?? source.last_sweep ?? record.lastSeen ?? record.timestamp),
  };
}

function normaliseConfig(raw: unknown): ConfigResponse {
  const record = recordOf(raw);
  return {
    settings: recordOf(record.settings),
    bots: recordOf(record.bots),
    env: Object.fromEntries(
      Object.entries(recordOf(record.env)).map(([key, value]) => [key, text(value)]),
    ),
    effective: recordOf(record.effective) as ConfigResponse["effective"],
    profiles: Array.isArray(record.profiles) ? record.profiles.map(normaliseProfile) : [],
    active_profile: text(record.active_profile ?? record.activeProfile, ""),
    version: text(record.version, "0.1.4"),
  };
}

export const api = {
  async status(signal?: AbortSignal): Promise<StatusResponse> {
    return normaliseStatus(await request<unknown>("/api/status", { signal }));
  },

  async fleet(signal?: AbortSignal): Promise<FleetResponse> {
    return normaliseFleet(await request<unknown>("/api/fleet", { signal }));
  },

  async telemetry(signal?: AbortSignal): Promise<TelemetryResponse> {
    return normaliseTelemetry(await request<unknown>("/api/telemetry", { signal }));
  },

  async config(signal?: AbortSignal): Promise<ConfigResponse> {
    return normaliseConfig(await request<unknown>("/api/config", { signal }));
  },

  saveConfig(body: unknown): Promise<unknown> {
    return request("/api/config", { method: "POST", body });
  },

  service(name: string, action: "start" | "stop" | "restart"): Promise<unknown> {
    return request(`/api/service/${encodeURIComponent(name)}/${encodeURIComponent(action)}`, {
      method: "POST",
      body: { action },
    });
  },

  addons(signal?: AbortSignal): Promise<AddonsResponse> {
    return request<AddonsResponse>("/api/addons", { signal });
  },

  saveAddons(patch: Record<string, boolean | number | string>): Promise<unknown> {
    return request("/api/addons", { method: "POST", body: patch });
  },

  addonAction(action: string, command?: string): Promise<unknown> {
    return request("/api/addons/action", {
      method: "POST",
      body: { action, command: command ?? "", params: {} },
    });
  },

  grind(signal?: AbortSignal): Promise<GrindResponse> {
    return request<GrindResponse>("/api/grind", { signal });
  },

  grindAction(body: Record<string, unknown>): Promise<unknown> {
    return request("/api/grind", { method: "POST", body });
  },

  schematic(signal?: AbortSignal): Promise<SchematicResponse> {
    return request<SchematicResponse>("/api/schematic", { signal });
  },

  uploadSchematic(
    file: File,
    params: Record<string, string>,
    signal?: AbortSignal,
    onProgress?: (percent: number, loaded: number, total: number) => void,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = correlationId();
      const xhr = new XMLHttpRequest();
      const query = new URLSearchParams(params);
      xhr.open("POST", `/api/schematic/upload?${query.toString()}`);
      xhr.timeout = UPLOAD_TIMEOUT;
      xhr.setRequestHeader("accept", "application/json");
      xhr.setRequestHeader("content-type", "application/octet-stream");
      xhr.setRequestHeader("x-correlation-id", id);
      const token = authHeaders().authorization;
      if (token) xhr.setRequestHeader("authorization", token);
      const abort = () => xhr.abort();
      signal?.addEventListener("abort", abort, { once: true });
      const cleanup = () => signal?.removeEventListener("abort", abort);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        const percent = Math.max(0, Math.min(100, (event.loaded / event.total) * 100));
        onProgress(percent, event.loaded, event.total);
      };
      xhr.onload = () => {
        cleanup();
        let payload: unknown = null;
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          payload = xhr.responseText;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload);
          return;
        }
        const record = recordOf(payload);
        reject(
          new ApiError(
            text(record.error ?? record.message, `Upload failed (${xhr.status})`),
            xhr.status,
            id,
          ),
        );
      };
      xhr.onerror = () => {
        cleanup();
        reject(new ApiError("Network error while uploading schematic", 0, id));
      };
      xhr.ontimeout = () => {
        cleanup();
        reject(new ApiError(`Upload timed out after ${Math.ceil(UPLOAD_TIMEOUT / 1_000)} seconds`, 0, id));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new ApiError("Upload cancelled", 0, id));
      };
      xhr.send(file);
    });
  },

  schematicControl(action: "pause" | "resume" | "cancel", replaceBlocks?: boolean): Promise<unknown> {
    return request("/api/schematic/control", {
      method: "POST",
      body: { action, replaceBlocks },
    });
  },

  providers(signal?: AbortSignal): Promise<ProvidersResponse> {
    return request<ProvidersResponse>("/api/providers", { signal });
  },

  saveProviders(providers: Provider[], apiKeys: Record<string, string>, clearKeys: string[] = []): Promise<unknown> {
    return request("/api/providers", {
      method: "POST",
      body: { providers, apiKeys, clearKeys, restart: true },
    });
  },

  testProvider(
    provider: Pick<Provider, "id" | "baseURL" | "keyName" | "model">,
    apiKey?: string,
  ): Promise<ProviderTest> {
    return request<ProviderTest>("/api/providers/test", {
      method: "POST",
      body: { ...provider, apiKey },
      timeoutMs: 15_000,
    });
  },

  logs(service: string, lines = 120, signal?: AbortSignal): Promise<LogsResponse> {
    return request<LogsResponse>(`/api/logs?service=${encodeURIComponent(service)}&lines=${lines}`, { signal });
  },
};
