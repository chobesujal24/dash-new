import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function createYozakuraApiPlugin(): Plugin {
  let failAll = false;
  let failNext = 0;
  let tickCount = 0;

  const profiles = [
    { file: "./profiles/foreman.json", filename: "foreman.json", name: "ENI1 Foreman (foreman.json)", rawName: "ENI1", is_online: true, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: true },
    { file: "./profiles/assistant.json", filename: "assistant.json", name: "ENI1 Assistant (assistant.json)", rawName: "ENI1 Assistant", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: false },
    { file: "./profiles/scout.json", filename: "scout.json", name: "Scout (scout.json)", rawName: "Scout", is_online: true, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: true },
    { file: "./profiles/miner.json", filename: "miner.json", name: "DeepMiner (miner.json)", rawName: "DeepMiner", is_online: false, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: true },
    { file: "./profiles/builder.json", filename: "builder.json", name: "SchematicBuilder (builder.json)", rawName: "SchematicBuilder", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: true },
    { file: "./profiles/trader.json", filename: "trader.json", name: "Quartermaster (trader.json)", rawName: "Quartermaster", is_online: false, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: false },
    { file: "./profiles/guard.json", filename: "guard.json", name: "Night Watch (guard.json)", rawName: "Night Watch", is_online: false, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: true },
    { file: "./profiles/fisher.json", filename: "fisher.json", name: "Tidewalker (fisher.json)", rawName: "Tidewalker", is_online: false, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: false },
    { file: "./profiles/architect.json", filename: "architect.json", name: "Architect (architect.json)", rawName: "Architect", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: true },
    { file: "./profiles/nether.json", filename: "nether.json", name: "Ember Runner (nether.json)", rawName: "Ember Runner", is_online: false, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: true },
    { file: "./profiles/farmer.json", filename: "farmer.json", name: "Hanami Farmer (farmer.json)", rawName: "Hanami Farmer", is_online: false, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: false },
    { file: "./profiles/envoy.json", filename: "envoy.json", name: "Envoy (envoy.json)", rawName: "Envoy", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: false },
    { file: "./profiles/archivist.json", filename: "archivist.json", name: "Archivist (archivist.json)", rawName: "Archivist", is_online: false, model: "eni-critic-7b-q4", hide_commands_in_chat: true },
  ];

  let activeProfileFile = "./profiles/foreman.json";

  let services = [
    { name: "mc-dashboard", state: "active", pid: 40988, cpu: 0.7, mem: 96_468_992, uptime: "2d 4h" },
    { name: "mc-shim", state: "active", pid: 41022, cpu: 2.4, mem: 188_743_680, uptime: "2d 4h" },
    { name: "mc-cluster", state: "active", pid: 41088, cpu: 8.1, mem: 754_974_720, uptime: "2d 4h" },
    { name: "mc-foreman", state: "active", pid: 41192, cpu: 12.7, mem: 1_342_177_280, uptime: "6h 12m" },
    { name: "minecraft-server", state: "inactive", pid: null as number | null, cpu: null as number | null, mem: null as number | null, uptime: null as string | null },
  ];

  const bots = [
    { id: "eni1", name: "ENI1", health: 19, food: 17, x: 142, y: 68, z: -38, dimension: "minecraft:overworld", ping: 23, activity: "Mining ancient debris · 47/128", state: "active" },
    { id: "scout", name: "Scout", health: 14, food: 9, x: 96, y: 64, z: -52, dimension: "minecraft:overworld", ping: 41, activity: "Holding perimeter at camp chest", state: "warning" },
    { id: "deepminer", name: "DeepMiner", health: 20, food: 19, x: 138, y: -54, z: -41, dimension: "minecraft:the_nether", ping: 28, activity: "Sorting nether quartz into shulker #3", state: "active" },
    { id: "builder", name: "Builder", health: 18, food: 16, x: 152, y: 74, z: 6, dimension: "minecraft:overworld", ping: 31, activity: "Staging Hanami Pavilion layer 6/12", state: "idle" },
  ];

  let addonConfig: Record<string, boolean | number | string> = {
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
  };

  const threats = [
    { username: "sujal24", distance: 8.4, x: 150, y: 68, z: -34, heldItem: "netherite_sword", isSneaking: true },
    { username: "52hx", distance: 21.7, x: 121, y: 66, z: -20, heldItem: "enchanted_bow", isSneaking: false },
    { username: "ADMIN", distance: 42.2, x: 184, y: 70, z: -70, heldItem: "golden_apple", isSneaking: false },
  ];

  const now = Date.now();
  let grind: {
    current: Record<string, unknown> | null;
    queue: Record<string, unknown>[];
    history: Record<string, unknown>[];
  } = {
    current: {
      id: "grind-3f6c2a1e-77b4-4a11-9d9e-2d0d2a3e6c11",
      target: "ancient_debris",
      requested: 128,
      completed: 68,
      status: "running",
      createdAt: now - 1_920_000,
      startedAt: now - 1_680_000,
      updatedAt: now - 2_000,
      message: "Sweeping the northern debris field · Y=-54 tunnel.",
      radius: 32,
      deposit: "camp chest",
      tools: ["pickaxe"],
    },
    queue: [
      { id: "grind-q1", target: "nether_quartz_ore", requested: 96, completed: 0, status: "queued", createdAt: now - 900_000, updatedAt: now - 900_000, radius: 24, deposit: "camp chest" },
      { id: "grind-q2", target: "gold_ore", requested: 64, completed: 0, status: "queued", createdAt: now - 880_000, updatedAt: now - 880_000, radius: 32, deposit: "inventory" },
    ],
    history: [
      { id: "grind-h1", target: "diamond_ore", requested: 32, completed: 32, status: "completed", createdAt: now - 9_000_000, startedAt: now - 8_400_000, finishedAt: now - 7_000_000, updatedAt: now - 7_000_000 },
      { id: "grind-h2", target: "cherry_log", requested: 128, completed: 128, status: "completed", createdAt: now - 14_000_000, startedAt: now - 13_500_000, finishedAt: now - 12_100_000, updatedAt: now - 12_100_000 },
      { id: "grind-h3", target: "coal_ore", requested: 128, completed: 92, status: "cancelled", createdAt: now - 18_000_000, startedAt: now - 17_400_000, finishedAt: now - 16_000_000, updatedAt: now - 16_000_000 },
      { id: "grind-h4", target: "oak_log", requested: 64, completed: 64, status: "completed", createdAt: now - 24_000_000, startedAt: now - 23_400_000, finishedAt: now - 22_000_000, updatedAt: now - 22_000_000 },
    ],
  };

  const buildMaterials = {
    deepslate_bricks: 1280,
    polished_blackstone: 640,
    cherry_log: 320,
    sand: 192,
    gold_ore: 48,
    ancient_debris: 16,
  };

  let schematic: {
    current: Record<string, unknown> | null;
    history: Record<string, unknown>[];
  } = {
    current: {
      id: "schem-9a8e2d11-4c9b-4a55-b8e0-6b1c1e1b4a22",
      fileName: "schem-9a8e2d11-4c9b-4a55-b8e0-6b1c1e1b4a22.schem",
      sourceName: "hanami_pavilion",
      origin: { x: 152, y: 68, z: 6 },
      rotation: 90,
      replaceBlocks: false,
      status: "blocked",
      totalBlocks: 2496,
      nextIndex: 1420,
      placed: 1420,
      skipped: 4,
      size: { x: 24, y: 12, z: 18 },
      materials: buildMaterials,
      missing: ["gold_ore", "ancient_debris"],
      message: "Waiting for 16 ancient debris and 48 gold ore before layer 7.",
      createdAt: now - 3_600_000,
      startedAt: now - 3_400_000,
      updatedAt: now - 6_000,
    },
    history: [
      { id: "schem-h1", fileName: "schem-h1.schem", sourceName: "yozakura_torii_gate", origin: { x: 140, y: 68, z: -18 }, rotation: 180, replaceBlocks: false, status: "completed", totalBlocks: 640, nextIndex: 640, placed: 640, skipped: 0, size: { x: 14, y: 16, z: 6 }, materials: { cherry_log: 420, stone: 220 }, missing: [], message: "Build complete.", createdAt: now - 28_000_000, startedAt: now - 27_400_000, updatedAt: now - 25_000_000, finishedAt: now - 25_000_000 },
      { id: "schem-h2", fileName: "schem-h2.schem", sourceName: "camp_storage_vault", origin: { x: 150, y: 68, z: -12 }, rotation: 0, replaceBlocks: false, status: "completed", totalBlocks: 128, nextIndex: 128, placed: 128, skipped: 4, size: { x: 8, y: 4, z: 8 }, materials: { oak_log: 96, cobblestone: 32 }, missing: [], message: "Build complete.", createdAt: now - 40_000_000, startedAt: now - 38_000_000, updatedAt: now - 34_000_000, finishedAt: now - 34_000_000 },
    ],
  };

  let providers = [
    { id: "gemini-3-8-flash-high", name: "Gemini 3.8 Flash High", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", keyName: "GEMINI_API_KEY", model: "gemini-3.8-flash-high", timeoutMs: 45_000, enabled: true, keyConfigured: true, contextWindow: 1_048_576, contextUsed: 650_117, tokensPerSec: 186, lastLatencyMs: 184 },
    { id: "river-ai", name: "DeepSeek v4.1 Flash 1017", baseURL: "https://api.river.ai/v1", keyName: "RIVER_API_KEY", model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", timeoutMs: 60_000, enabled: true, keyConfigured: true, contextWindow: 163_840, contextUsed: 62_259, tokensPerSec: 142, lastLatencyMs: 312 },
    { id: "eni-local-critic", name: "ENI local critic", baseURL: "http://127.0.0.1:4100/v1", keyName: "LOCAL_CRITIC_KEY", model: "eni-critic-7b-q4", timeoutMs: 30_000, enabled: true, keyConfigured: true, contextWindow: 32_768, contextUsed: 3_932, tokensPerSec: 64, lastLatencyMs: 92 },
    { id: "nvidia-1", name: "NVIDIA NIM", baseURL: "https://integrate.api.nvidia.com/v1", keyName: "NVIDIA_API_KEY", model: "nvidia/nemotron-3.5-super-vl-120b-a12b", timeoutMs: 30_000, enabled: false, keyConfigured: true, contextWindow: 131_072, contextUsed: 0, tokensPerSec: null as number | null, lastLatencyMs: null as number | null },
  ];

  const settings: Record<string, unknown> = {
    host: "127.0.0.1",
    port: 56730,
    minecraft_version: "26.1",
    auth: "offline",
    mindserver_port: 8080,
    base_profile: "assistant",
    only_chat_with: ["sujal24", "52hx", "ADMIN"],
    load_memory: true,
    narrate_behavior: true,
    allow_insecure_coding: false,
    code_timeout_mins: 10,
    spawn_timeout: 60,
    auto_open_ui: true,
    via_proxy: {
      enabled: false,
      host: "127.0.0.1",
      port: 25568,
      client_version: "26.1",
    },
  };

  const serviceLogs: Record<string, string[]> = {
    "mc-foreman": [
      "Nov 12 07:45:10 [foreman] ENI1 joined 127.0.0.1:56730 (protocol 26.1)",
      "Nov 12 07:46:02 [foreman] profile loaded: ./profiles/foreman.json (deepseek-ai/DeepSeek-V4.1-Flash-1017)",
      "Nov 12 07:47:18 [foreman] auto_totem armed · off-hand totem verified (2 in reserve)",
      "Nov 12 07:48:04 [foreman] grind worker sweeping northern debris field (68/128 collected)",
    ],
    "mc-cluster": [
      "Nov 12 07:45:14 [cluster] 3 coordinator agents synchronized with MindServer:8080",
      "Nov 12 07:46:40 [cluster] DeepMiner deposited 64x nether_quartz_ore into camp shulker #3",
      "Nov 12 07:47:55 [cluster] Scout warn: food level dropped to 9/20 at perimeter post",
    ],
    "mc-shim": [
      "Nov 12 07:45:02 [shim] telemetry bridge listening on 127.0.0.1:8091",
      "Nov 12 07:48:11 [shim] p50=42ms p95=114ms · 948 hits / 12 misses",
    ],
    "mc-dashboard": [
      "Nov 12 07:45:00 [dashboard] Yozakura / ENI-01 Operations Console v0.1.4 ready",
    ],
    "minecraft-server": [
      "Nov 12 05:12:00 [server] Saving chunks for level 'ServerLevel[yozakura_world]'/minecraft:overworld",
      "Nov 12 05:12:02 [server] ThreadedAnvilChunkStorage: All dimensions are saved",
    ],
  };

  function json(res: ServerResponse, code: number, body: unknown) {
    res.writeHead(code, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-mock-server": "yozakura",
    });
    res.end(JSON.stringify(body));
  }

  function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || "/";
    if (!rawUrl.startsWith("/api/")) {
      next();
      return;
    }

    const url = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (pathname === "/api/mock/fail") {
      failAll = url.searchParams.get("on") === "1";
      return json(res, 200, { failAll });
    }
    if (pathname === "/api/mock/fail-next") {
      failNext = Number(url.searchParams.get("count") || 1);
      return json(res, 200, { failNext });
    }

    if (failAll || failNext > 0) {
      if (failNext > 0) failNext -= 1;
      return json(res, 503, { error: "Mock outage: the supervisor is unreachable." });
    }

    tickCount += 1;

    if (pathname === "/api/status") {
      return json(res, 200, {
        ok: services.some((service) => service.state === "active"),
        services,
        botCount: bots.length,
        uptime: 498_221 + tickCount * 5,
        target: `${settings.host}:${settings.port}`,
      });
    }

    if (pathname === "/api/fleet") {
      return json(res, 200, { bots, profiles, activeProfile: activeProfileFile });
    }

    if (pathname === "/api/telemetry") {
      const wave = Math.sin(tickCount * 0.45);
      const p50 = Math.round(41 + wave * 6);
      const p95 = Math.round(114 + wave * 14 + (tickCount % 3) * 4);
      const throughput = Number((26.8 + Math.cos(tickCount * 0.35) * 3.4).toFixed(1));
      return json(res, 200, {
        hits: 948 + tickCount * 2,
        misses: 12,
        latency: { p50, p95 },
        throughput,
        lastSweep: Date.now() - 800,
      });
    }

    if (pathname === "/api/config" && req.method === "GET") {
      return json(res, 200, {
        settings,
        bots: {
          server: {
            host: settings.host,
            port: settings.port,
            version: settings.minecraft_version,
            auth: settings.auth,
          },
          safeguards: { startPaused: false },
        },
        env: {},
        effective: {
          host: settings.host,
          port: settings.port,
          version: settings.minecraft_version,
          auth: settings.auth,
          startPaused: false,
          overrides: {},
        },
        profiles,
        active_profile: activeProfileFile,
        version: "0.1.4",
      });
    }

    if (pathname === "/api/config" && req.method === "POST") {
      const body = await readBody(req);
      if (body.settings && typeof body.settings === "object") {
        Object.assign(settings, body.settings);
      }
      if (typeof body.active_profile === "string") {
        activeProfileFile = body.active_profile;
        const match = profiles.find((profile) => profile.file === body.active_profile);
        if (match) {
          profiles.forEach((profile) => {
            profile.is_online = profile === match || profile.file === "./profiles/scout.json";
          });
        }
      }
      return json(res, 200, {
        settings: Object.keys((body.settings as object) || {}),
        restarted: body.restart === false ? [] : ["mc-foreman"],
      });
    }

    if (pathname === "/api/addons" && req.method === "GET") {
      return json(res, 200, {
        agentName: "ENI1",
        config: addonConfig,
        live: {
          agentName: "ENI1",
          timestamp: Date.now(),
          health: 19,
          maxHealth: 20,
          food: 17,
          totems: 2,
          gapples: 14,
          egapples: 3,
          balance: "$14,208",
          radar: threats,
          config: addonConfig,
          grind,
          schematic,
          dimension: "minecraft:overworld",
          ping: 23,
          position: { x: 142, y: 68, z: -38 },
        },
      });
    }

    if (pathname === "/api/addons" && req.method === "POST") {
      const body = await readBody(req);
      addonConfig = { ...addonConfig, ...(body as Record<string, boolean | number | string>) };
      return json(res, 200, { ok: true, applied: true, config: addonConfig });
    }

    if (pathname === "/api/addons/action" && req.method === "POST") {
      const body = await readBody(req);
      const cmd = String(body.command || body.action || "dispatch");
      serviceLogs["mc-foreman"].push(
        `${new Date().toTimeString().slice(0, 8)} [foreman] dispatched order: ${cmd}`,
      );
      return json(res, 200, { ok: true, applied: true, agentName: "ENI1" });
    }

    if (pathname === "/api/grind" && req.method === "GET") {
      return json(res, 200, { agentName: "ENI1", grind, agentStatus: "connected", lastSeen: Date.now() });
    }

    if (pathname === "/api/grind" && req.method === "POST") {
      const body = await readBody(req);
      const action = String(body.action || "");
      if (action === "queue" || action === "start") {
        const newJob = {
          id: `grind-${Date.now()}`,
          target: String(body.target || "stone"),
          requested: Number(body.count) || 1,
          completed: 0,
          status: grind.current ? "queued" : "running",
          createdAt: Date.now(),
          startedAt: grind.current ? undefined : Date.now(),
          updatedAt: Date.now(),
          message: grind.current ? "Waiting in hopper." : "Locating nearest vein.",
        };
        if (!grind.current) {
          grind.current = newJob;
        } else {
          grind.queue.push(newJob);
        }
      } else if (action === "pause" && grind.current) {
        grind.current = { ...grind.current, status: "paused", updatedAt: Date.now(), message: "Paused by operator." };
      } else if (action === "resume" && grind.current) {
        grind.current = { ...grind.current, status: "running", updatedAt: Date.now(), message: "Resumed by operator · sweeping vein." };
      } else if (action === "cancel") {
        if (body.jobId && grind.current && grind.current.id === body.jobId) {
          grind.history.unshift({ ...grind.current, status: "cancelled", finishedAt: Date.now(), updatedAt: Date.now() });
          const nextJob = grind.queue.shift() ?? null;
          grind.current = nextJob ? { ...nextJob, status: "running", startedAt: Date.now(), message: "Started from queue." } : null;
        } else if (body.jobId) {
          grind.queue = grind.queue.filter((job) => job.id !== body.jobId);
        }
      }
      return json(res, 200, { ok: true, applied: true, agentName: "ENI1", grind });
    }

    if (pathname === "/api/schematic" && req.method === "GET") {
      return json(res, 200, { agentName: "ENI1", ...schematic });
    }

    if (pathname === "/api/schematic/control" && req.method === "POST") {
      const body = await readBody(req);
      if (schematic.current) {
        if (body.action === "pause") {
          schematic.current = { ...schematic.current, status: "paused", message: "Paused by operator.", updatedAt: Date.now() };
        }
        if (body.action === "resume") {
          schematic.current = { ...schematic.current, status: "running", message: "Placing layer 7 · deepslate_bricks.", updatedAt: Date.now() };
        }
        if (body.action === "cancel") {
          schematic.history.unshift({ ...schematic.current, status: "cancelled", finishedAt: Date.now(), updatedAt: Date.now() });
          schematic.current = null;
        }
      }
      return json(res, 200, { ok: true, applied: true });
    }

    if (pathname === "/api/schematic/upload" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const sourceFile = path.basename(String(url.searchParams.get("name") || "schematic.schem"));
      const sourceName = sourceFile.replace(/\.schem$/i, "");
      const hasOrigin = url.searchParams.has("x") && url.searchParams.has("y") && url.searchParams.has("z");

      const presetMeta: Record<string, { size: { x: number; y: number; z: number }; totalBlocks: number; materials: Record<string, number> }> = {
        hanami_pavilion: {
          size: { x: 24, y: 12, z: 18 },
          totalBlocks: 2496,
          materials: { deepslate_bricks: 1280, cherry_log: 640, oak_log: 384, gold_ore: 48, sand: 144 },
        },
        lantern_pier: {
          size: { x: 18, y: 6, z: 10 },
          totalBlocks: 684,
          materials: { oak_log: 320, spruce_log: 180, cobblestone: 148, gold_ore: 36 },
        },
        yozakura_bridge: {
          size: { x: 28, y: 9, z: 8 },
          totalBlocks: 1120,
          materials: { dark_oak_log: 540, cherry_log: 310, stone: 220, gold_ore: 50 },
        },
        sakura_watchtower: {
          size: { x: 16, y: 22, z: 16 },
          totalBlocks: 1840,
          materials: { deepslate_bricks: 860, cherry_log: 520, birch_log: 340, emerald_ore: 120 },
        },
      };

      const matched = presetMeta[sourceName];
      if (schematic.current) {
        schematic.history.unshift({
          ...schematic.current,
          status: "cancelled",
          finishedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const totalBlocks = matched ? matched.totalBlocks : Math.max(196, Math.round(size / 8));
      const placed = Math.min(totalBlocks, Math.max(48, Math.round(totalBlocks * 0.24)));

      schematic.current = {
        id: `schem-${Date.now()}`,
        fileName: `${sourceName}.schem`,
        sourceName,
        origin: hasOrigin
          ? {
              x: Number(url.searchParams.get("x") || 0),
              y: Number(url.searchParams.get("y") || 0),
              z: Number(url.searchParams.get("z") || 0),
            }
          : { x: 152, y: 68, z: 6 },
        rotation: Number(url.searchParams.get("rotation") || 0),
        replaceBlocks: url.searchParams.get("replace") === "true",
        status: "running",
        totalBlocks,
        nextIndex: placed,
        placed,
        skipped: 0,
        size: matched ? matched.size : { x: 16, y: 10, z: 16 },
        materials: matched ? matched.materials : { cherry_log: 160, deepslate_bricks: 240, stone: 96 },
        missing: [],
        message: `Validated Sponge schematic · placing ${sourceName.replace(/_/g, " ")}.`,
        createdAt: Date.now(),
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      return json(res, 202, { ok: true, jobId: schematic.current.id, applied: true });
    }

    if (pathname === "/api/providers" && req.method === "GET") {
      return json(res, 200, { providers });
    }

    if (pathname === "/api/providers" && req.method === "POST") {
      const body = await readBody(req);
      const incoming = body.providers as typeof providers | undefined;
      const apiKeys = (body.apiKeys as Record<string, string>) || {};
      const clearKeys = (body.clearKeys as string[]) || [];
      if (Array.isArray(incoming)) {
        const oldMap = new Map(providers.map((p) => [p.id, p]));
        providers = incoming.map((provider) => {
          const prev = oldMap.get(provider.id);
          return {
            ...provider,
            keyConfigured: Boolean(apiKeys[provider.keyName]) || Boolean(provider.keyConfigured) || Boolean(prev?.keyConfigured),
            contextWindow: prev?.contextWindow ?? 128_000,
            contextUsed: prev?.contextUsed ?? 12_400,
            tokensPerSec: prev?.tokensPerSec ?? 115,
            lastLatencyMs: prev?.lastLatencyMs ?? 240,
          };
        });
        for (const key of clearKeys) {
          providers = providers.map((provider) =>
            provider.keyName === key ? { ...provider, keyConfigured: false } : provider,
          );
        }
      }
      return json(res, 200, { ok: true, restarted: ["mc-foreman"] });
    }

    if (pathname === "/api/providers/test" && req.method === "POST") {
      const body = await readBody(req);
      const targetId = String(body.id || "");
      const match = providers.find((p) => p.id === targetId);
      const latencyMs = match?.lastLatencyMs ?? Math.round(140 + Math.random() * 140);
      return json(res, 200, { ok: true, latencyMs, statusCode: 200, modelCount: 14 });
    }

    if (pathname === "/api/logs") {
      const svc = String(url.searchParams.get("service") || "mc-foreman");
      const lines = serviceLogs[svc] ?? serviceLogs["mc-foreman"];
      return json(res, 200, { service: svc, lines });
    }

    if (pathname.startsWith("/api/service/") && req.method === "POST") {
      const parts = pathname.split("/").filter(Boolean);
      const name = decodeURIComponent(parts[2] || "");
      const action = decodeURIComponent(parts[3] || "");
      services = services.map((service) => {
        if (service.name !== name) return service;
        if (action === "stop") {
          return { ...service, state: "inactive", pid: null, cpu: null, mem: null, uptime: null };
        }
        return {
          ...service,
          state: "active",
          pid: service.pid ?? 42110,
          cpu: service.cpu ?? 3.8,
          mem: service.mem ?? 512_000_000,
          uptime: "12s",
        };
      });
      return json(res, 200, { ok: true, action });
    }

    return json(res, 404, { error: "endpoint not found" });
  };

  return {
    name: "yozakura-api-server",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), createYozakuraApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
