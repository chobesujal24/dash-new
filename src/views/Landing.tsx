import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  Code2,
  Compass,
  Copy,
  Cpu,
  ExternalLink,
  Layers,
  Lock,
  Maximize2,
  MoonStar,
  Pause,
  Pickaxe,
  Play,
  Shield,
  SunMedium,
  Terminal,
} from "lucide-react";
import heroBannerImg from "../assets/hero-banner.jpg";
import { validateClusterDispatch } from "../data/adapters";
import {
  SCHEMATIC_PRESETS,
  VIEWS,
  addonCatalog,
  coord,
  fmtBytes,
  fmtInt,
  prettyBlock,
  type FleetBot,
  type View,
} from "../data/model";
import { armedCount, botTone, foodTone, healthTone, useConsole } from "../state/store";
import { AddonSvgIcon, BlockIcon, Blueprint, Crest, Portrait, ProviderLogo } from "../ui/art";
import { StatusDot, VialMeter } from "../ui/kit";
import { cn } from "../utils/cn";

const GRIND_SAMPLES = [
  { block: "ancient_debris", label: "Ancient Debris", region: "Nether Y=15", rate: "14 / min", efficiency: 68 },
  { block: "diamond_ore", label: "Diamond Ore", region: "Overworld Y=-54", rate: "28 / min", efficiency: 82 },
  { block: "cherry_log", label: "Cherry Log", region: "Grove Canopy", rate: "92 / min", efficiency: 96 },
  { block: "emerald_ore", label: "Emerald Ore", region: "Jagged Peaks", rate: "22 / min", efficiency: 74 },
  { block: "nether_quartz_ore", label: "Nether Quartz", region: "Nether Wastes", rate: "64 / min", efficiency: 90 },
  { block: "dark_oak_log", label: "Dark Oak Log", region: "Roofed Forest", rate: "86 / min", efficiency: 94 },
] as const;

const GUARD_HIGHLIGHTS = [
  {
    id: "auto_totem",
    title: "Auto Totem Lock",
    latency: "< 1 tick (50 ms)",
    summary: "Monitors off-hand slot state on every packet and refills Totems of Undying through the shared inventory mutex.",
  },
  {
    id: "auto_gapple",
    title: "Threshold Gapple",
    latency: "< 1 tick (50 ms)",
    summary: "Suspends pathfinding to consume a Golden Apple the moment health drops below the configured heart buffer.",
  },
  {
    id: "panic_escape",
    title: "Pearl Evasion",
    latency: "Immediate",
    summary: "Calculates an unobstructed trajectory, throws an Ender Pearl, and disengages when surrounded.",
  },
  {
    id: "player_radar",
    title: "Perimeter Radar",
    latency: "Continuous sweep",
    summary: "Tracks non-crew players within 64 blocks, logging distance, compass bearing, held weapon, and sneak posture.",
  },
] as const;

const ARCH_MEDIA = {
  depot: "/assets/world/cluster-depot.jpg",
  guard: "/assets/world/perimeter-guard.jpg",
  grind: "/assets/world/nether-grind.jpg",
  router: heroBannerImg,
} as const;

const VIEW_LABELS: Record<View, string> = {
  fleet: "Fleet",
  grind: "Grind",
  build: "Build",
  addons: "Add-ons",
  providers: "Providers",
  settings: "Settings",
};

const NAV_LINKS = [
  { id: "console", code: "00", label: "Live Console", href: "#console" },
  { id: "architecture", code: "01", label: "Architecture", href: "#architecture" },
  { id: "agents", code: "02", label: "Agents", href: "#agents" },
  { id: "schematics", code: "03", label: "Schematics", href: "#schematics" },
  { id: "references", code: "04", label: "Ref Code", href: "#references" },
  { id: "dispatch", code: "05", label: "Dispatch", href: "#dispatch" },
] as const;

type RefModuleId = "mindserver" | "guard" | "pathfinder" | "schematic" | "router";

const UPSTREAM_REFERENCES: readonly {
  id: RefModuleId;
  fileName: string;
  badge: string;
  title: string;
  summary: string;
  repoLabel: string;
  repoUrl: string;
  upstreamPath: string;
  docLabel: string;
  docUrl: string;
  targetView: View;
  code: string;
}[] = [
  {
    id: "mindserver",
    fileName: "mindserver-bridge.ts",
    badge: "01 · systemd / MindServer",
    title: "MindServer Multi-Agent Coordinator & Chest Mutex",
    summary:
      "Adapts kolbytn/mindcraft's MindServer socket coordinator with five isolated systemd units and a shared camp-chest mutex so 4 agents never collide on shulker I/O.",
    repoLabel: "kolbytn/mindcraft",
    repoUrl: "https://github.com/kolbytn/mindcraft",
    upstreamPath: "src/mindcraft/mindserver.js · MIT",
    docLabel: "Mindcraft Agent Architecture",
    docUrl: "https://github.com/kolbytn/mindcraft#readme",
    targetView: "fleet",
    code: `// Ref: https://github.com/kolbytn/mindcraft (src/mindcraft/mindserver.js)
import { Server as SocketServer } from "socket.io";
import type { FleetBot, ServiceUnit } from "./data/model";

export function attachMindServerBridge(io: SocketServer, port = 8080) {
  const chestMutex = new Map<string, string>(); // chestXYZ -> botId

  io.on("connection", (socket) => {
    socket.on("agent:register", (bot: FleetBot) => {
      socket.join(\`unit:\${bot.unit}\`);
      io.emit("telemetry:snapshot", { bot, ts: Date.now() });
    });

    socket.on("inventory:lock", ({ chestPos, botId }, ack) => {
      const holder = chestMutex.get(chestPos);
      if (holder && holder !== botId) return ack({ ok: false, holder });
      chestMutex.set(chestPos, botId);
      ack({ ok: true, lockMs: 2500 });
    });
  });
}`,
  },
  {
    id: "guard",
    fileName: "guard-reflex.ts",
    badge: "02 · 20 Hz Tick Guard",
    title: "Deterministic 50 ms Physics-Tick Survival Reflexes",
    summary:
      "Built on PrismarineJS/mineflayer and mineflayer-pvp. Executes off-hand Totem locks, Golden Apple thresholds, and 64m radar sweeps inside physicsTick without waiting on LLM latency.",
    repoLabel: "PrismarineJS/mineflayer",
    repoUrl: "https://github.com/PrismarineJS/mineflayer",
    upstreamPath: "lib/plugins/physics.js + mineflayer-pvp · MIT",
    docLabel: "Mineflayer PvP & Tick API",
    docUrl: "https://github.com/PrismarineJS/mineflayer-pvp",
    targetView: "addons",
    code: `// Ref: https://github.com/PrismarineJS/mineflayer (20 Hz physicsTick)
import type { Bot } from "mineflayer";

export function bindSurvivalGuardLoop(bot: Bot, cfg: { gappleHp: number }) {
  let mutexBusy = false;

  bot.on("physicsTick", async () => {
    if (mutexBusy) return;
    // 1. Sub-tick Off-hand Totem of Undying Lock (< 50 ms)
    const offhand = bot.inventory.slots[45];
    if (!offhand || offhand.name !== "totem_of_undying") {
      const totem = bot.inventory.items().find((i) => i.name === "totem_of_undying");
      if (totem) {
        mutexBusy = true;
        await bot.equip(totem, "off-hand").finally(() => (mutexBusy = false));
      }
    }
    // 2. Deterministic Gapple Threshold Interrupt
    if (bot.health > 0 && bot.health <= cfg.gappleHp) {
      bot.pathfinder?.stop();
      await bot.consume().catch(() => {});
    }
  });
}`,
  },
  {
    id: "pathfinder",
    fileName: "grind-worker.ts",
    badge: "03 · A* Pathfinder",
    title: "Voxel A* Navigation & Persistent Vein Excavation",
    summary:
      "Powered by PrismarineJS/mineflayer-pathfinder. Computes 3D A* block trajectories, mines target ore veins within a 32-meter sweep, and deposits full stacks at camp shulkers.",
    repoLabel: "PrismarineJS/mineflayer-pathfinder",
    repoUrl: "https://github.com/PrismarineJS/mineflayer-pathfinder",
    upstreamPath: "index.js (Movements, GoalLookAtBlock) · MIT",
    docLabel: "Mineflayer Pathfinder Spec",
    docUrl: "https://github.com/PrismarineJS/mineflayer-pathfinder#readme",
    targetView: "grind",
    code: `// Ref: https://github.com/PrismarineJS/mineflayer-pathfinder
import { Movements, goals } from "mineflayer-pathfinder";
import type { Bot } from "mineflayer";

export async function runExcavationBatch(bot: Bot, blockName: string, quota = 64) {
  const mcData = require("minecraft-data")(bot.version);
  const movements = new Movements(bot, mcData);
  movements.canDig = true;
  movements.allow1by1towers = true;
  bot.pathfinder.setMovements(movements);

  const targetId = mcData.blocksByName[blockName]?.id;
  const targets = bot.findBlocks({ matching: targetId, maxDistance: 32, count: quota });

  for (const pos of targets) {
    await bot.pathfinder.goto(new goals.GoalGetToBlock(pos.x, pos.y, pos.z));
    const block = bot.blockAt(pos);
    if (block && bot.canDigBlock(block)) await bot.dig(block);
  }
}`,
  },
  {
    id: "schematic",
    fileName: "schem-builder.ts",
    badge: "04 · Sponge .schem v3",
    title: "Sponge .schem NBT Layer Slicer & Isometric Builder",
    summary:
      "Implements the SpongePowered Schematic Specification v2/v3 with prismarine-schematic. Verifies Bill of Materials against camp chests before placing blocks layer-by-layer.",
    repoLabel: "SpongePowered/Schematic-Specification",
    repoUrl: "https://github.com/SpongePowered/Schematic-Specification",
    upstreamPath: "versions/schematic-3.md · MIT",
    docLabel: "Prismarine Schematic Library",
    docUrl: "https://github.com/PrismarineJS/prismarine-schematic",
    targetView: "build",
    code: `// Ref: https://github.com/SpongePowered/Schematic-Specification (v3 .schem)
import { Schematic } from "prismarine-schematic";
import { Vec3 } from "vec3";

export async function stageSchematicLayer(rawNbt: Buffer, origin: Vec3, yLayer: number) {
  const schem = await Schematic.read(rawNbt);
  const [sizeX, , sizeZ] = [schem.size.x, schem.size.y, schem.size.z];
  const placements: { worldPos: Vec3; stateId: number }[] = [];

  for (let x = 0; x < sizeX; x++) {
    for (let z = 0; z < sizeZ; z++) {
      const block = schem.getBlock(new Vec3(x, yLayer, z));
      if (block && block.name !== "air") {
        placements.push({ worldPos: origin.offset(x, yLayer, z), stateId: block.stateId });
      }
    }
  }
  return { fileName: "hanami_pavilion.schem", yLayer, count: placements.length, placements };
}`,
  },
  {
    id: "router",
    fileName: "llm-failover.ts",
    badge: "05 · OpenAI Router",
    title: "Ordered Multi-Provider LLM Cognitive Failover Chain",
    summary:
      "Extends Mindcraft's Prompter model router with ordered OpenAI-compatible failover (Gemini 3.8 Flash → DeepSeek v4.1 → Local Critic → NVIDIA NIM) while keeping API secrets strictly in keys.json.",
    repoLabel: "kolbytn/mindcraft",
    repoUrl: "https://github.com/kolbytn/mindcraft",
    upstreamPath: "src/models/prompter.js + keys.json · MIT",
    docLabel: "ViaProxy Cross-Version Bridge",
    docUrl: "https://github.com/ViaVersion/ViaProxy",
    targetView: "providers",
    code: `// Ref: https://github.com/kolbytn/mindcraft (src/models/prompter.js)
import type { ProviderRoute } from "./data/model";

export async function dispatchCognitiveTurn(routes: ProviderRoute[], messages: unknown[]) {
  const enabled = routes.filter((r) => r.enabled && r.keyConfigured);

  for (const route of enabled) {
    try {
      const res = await fetch(\`\${route.baseURL}/chat/completions\`, {
        method: "POST",
        signal: AbortSignal.timeout(route.timeoutMs),
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${process.env[route.keyName]}\` },
        body: JSON.stringify({ model: route.model, messages, temperature: 0.2 }),
      });
      if (res.ok) return { route: route.name, payload: await res.json() };
    } catch {
      // Advance deterministically to next fallback route without dropping memory
      continue;
    }
  }
  throw new Error("All configured LLM provider routes exhausted.");
}`,
  },
] as const;

const DEFAULT_BOTS: FleetBot[] = [
  {
    id: "eni1",
    name: "ENI1",
    role: "Foreman · AI Commander",
    unit: "mc-foreman",
    health: 19,
    food: 17,
    x: 142,
    y: 68,
    z: -38,
    dimension: "minecraft:overworld",
    ping: 23,
    basePing: 23,
    activity: "Mining ancient debris · 47/128",
    state: "active",
  },
  {
    id: "scout",
    name: "Scout",
    role: "Vanguard · Perimeter & Combat",
    unit: "mc-cluster",
    health: 14,
    food: 9,
    x: 96,
    y: 64,
    z: -52,
    dimension: "minecraft:overworld",
    ping: 41,
    basePing: 41,
    activity: "Holding perimeter at camp chest",
    state: "warning",
  },
  {
    id: "deepminer",
    name: "DeepMiner",
    role: "Excavator · Ore Specialist",
    unit: "mc-cluster",
    health: 20,
    food: 19,
    x: 138,
    y: -54,
    z: -41,
    dimension: "minecraft:the_nether",
    ping: 28,
    basePing: 28,
    activity: "Sorting nether quartz into shulker #3",
    state: "active",
  },
  {
    id: "builder",
    name: "Builder",
    role: "Architect · Schematic Builder",
    unit: "mc-cluster",
    health: 18,
    food: 16,
    x: 152,
    y: 74,
    z: 6,
    dimension: "minecraft:overworld",
    ping: 31,
    basePing: 31,
    activity: "Staging Hanami Pavilion layer 6/12",
    state: "idle",
  },
];

// Well-spaced 2D coordinates on the Hero Sanctuary Stage so pins never overlap horizontally
const HERO_PIN_COORDS: Record<string, [number, number]> = {
  sakura_watchtower: [20, 24],
  yozakura_bridge: [41, 39],
  lantern_pier: [62, 27],
  hanami_pavilion: [82, 37],
};

// Compositor-safe Framer Motion constants (module-scoped to prevent re-triggering on store ticks)
const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;
const PILL_SPRING = { type: "spring" as const, stiffness: 480, damping: 36, mass: 0.7 };
const CARD_SPRING = { type: "spring" as const, stiffness: 360, damping: 28, mass: 0.8 };

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const REVEAL_UP = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.52, ease: EASE_OUT_EXPO },
  },
};

export function Landing({ consoleSlot }: { consoleSlot?: ReactNode }) {
  const view = useConsole((s) => s.view);
  const dashUnlocked = useConsole((s) => s.dashUnlocked);
  const lockDash = useConsole((s) => s.lockDash);
  const setShowLanding = useConsole((s) => s.setShowLanding);
  const setView = useConsole((s) => s.setView);
  const selectBot = useConsole((s) => s.selectBot);
  const theme = useConsole((s) => s.theme);
  const toggleTheme = useConsole((s) => s.toggleTheme);
  const bots = useConsole((s) => s.bots);
  const services = useConsole((s) => s.services);
  const telemetry = useConsole((s) => s.telemetry);
  const providers = useConsole((s) => s.providers);
  const loadout = useConsole((s) => s.loadout);
  const addonConfig = useConsole((s) => s.addonConfig);
  const clusterTarget = useConsole((s) => s.clusterTarget);
  const settings = useConsole((s) => s.settings);
  const setSetting = useConsole((s) => s.setSetting);
  const grindEnqueue = useConsole((s) => s.grindEnqueue);
  const buildStageSample = useConsole((s) => s.buildStageSample);
  const runCommand = useConsole((s) => s.runCommand);
  const toast = useConsole((s) => s.toast);

  const crew = bots.length > 0 ? bots : DEFAULT_BOTS;

  // Smooth scroll progress for the floating Command Bridge header bar
  const { scrollYProgress } = useScroll();
  const scrollScaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    restDelta: 0.001,
  });

  // Interactive Nav Hover, Active Section Scroll-Spy & Footer Quick-Ping state
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("console");
  const [footerPingNotice, setFooterPingNotice] = useState<string | null>(null);

  // Interactive Reference Code Studio state
  const [activeRefId, setActiveRefId] = useState<RefModuleId>("mindserver");
  const [copiedRefId, setCopiedRefId] = useState<RefModuleId | null>(null);
  const activeRef = UPSTREAM_REFERENCES.find((r) => r.id === activeRefId) ?? UPSTREAM_REFERENCES[0];

  // Scroll-spy observer for header section indicator
  useEffect(() => {
    const ids = NAV_LINKS.map((n) => n.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.05, 0.25, 0.5] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Interactive Hero Stage state
  const [heroBotId, setHeroBotId] = useState<string>(crew[0]?.id ?? "eni1");
  const activeHeroBot = crew.find((b) => b.id === heroBotId) ?? crew[0];

  // Interactive Schematic Blueprint state (shared between Hero Showcase & Section 3)
  const [presetId, setPresetId] = useState<string>(SCHEMATIC_PRESETS[0].id);
  const [autoTour, setAutoTour] = useState<boolean>(true);
  const selectedPreset = SCHEMATIC_PRESETS.find((p) => p.id === presetId) ?? SCHEMATIC_PRESETS[0];

  // Gentle auto-tour rotation across the 4 world renders in the Hero Stage
  useEffect(() => {
    if (!autoTour) return;
    const timer = window.setInterval(() => {
      setPresetId((current) => {
        const idx = SCHEMATIC_PRESETS.findIndex((p) => p.id === current);
        const nextIdx = (idx + 1) % SCHEMATIC_PRESETS.length;
        return SCHEMATIC_PRESETS[nextIdx].id;
      });
    }, 5600);
    return () => window.clearInterval(timer);
  }, [autoTour]);

  const handleSelectPresetManual = (id: string) => {
    setAutoTour(false);
    setPresetId(id);
  };

  const jumpToRefModule = (refId: RefModuleId) => {
    setActiveRefId(refId);
    const el = document.getElementById("references");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCopyRefCode = async (refItem: (typeof UPSTREAM_REFERENCES)[number]) => {
    try {
      await navigator.clipboard?.writeText(refItem.code);
    } catch {
      // Fallback if clipboard permission is restricted in iframe
    }
    setCopiedRefId(refItem.id);
    toast({
      title: `Copied ${refItem.fileName}`,
      detail: `Reference source from ${refItem.repoLabel}`,
      tone: "ok",
    });
    window.setTimeout(() => {
      setCopiedRefId((current) => (current === refItem.id ? null : current));
    }, 2200);
  };

  // Interactive Grind Quick-Launcher state
  const [selectedBlock, setSelectedBlock] = useState<string>(GRIND_SAMPLES[0].block);
  const [grindCount, setGrindCount] = useState<number>(64);
  const activeGrindSample = GRIND_SAMPLES.find((g) => g.block === selectedBlock) ?? GRIND_SAMPLES[0];

  // Interactive Systemd Unit Inspector state
  const [selectedUnit, setSelectedUnit] = useState<string>("mc-foreman");

  // Interactive Cluster Node & Command Sandbox state
  const [hostInput, setHostInput] = useState<string>(settings.host || "127.0.0.1");
  const [portInput, setPortInput] = useState<string>(settings.port || "56730");
  const [commandInput, setCommandInput] = useState<string>("/home base");
  const [formError, setFormError] = useState<{ field: "host" | "port" | "command"; message: string } | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  const focusEmbeddedConsole = (targetView: View = "fleet") => {
    setView(targetView);
    const el = document.getElementById("console");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openFullscreenConsole = (targetView?: View) => {
    if (targetView) setView(targetView);
    setShowLanding(false);
    window.scrollTo({ top: 0 });
  };

  const handleInspectAgent = (botId: string) => {
    selectBot(botId);
    focusEmbeddedConsole("fleet");
  };

  const handleStagePreset = () => {
    buildStageSample({
      fileName: selectedPreset.fileName,
      origin: { x: 152, y: 68, z: 6 },
      rotation: 0,
      replaceBlocks: false,
    });
    focusEmbeddedConsole("build");
  };

  const handleQuickGrind = () => {
    grindEnqueue({ target: selectedBlock, requested: grindCount });
    focusEmbeddedConsole("grind");
  };

  const handleClusterSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validation = validateClusterDispatch({
      host: hostInput,
      port: portInput,
      command: commandInput,
    });

    if (validation.ok === false) {
      setFormError({ field: validation.field, message: validation.error });
      setDispatchSuccess(null);
      return;
    }

    setFormError(null);
    setSetting("host", validation.host);
    setSetting("port", String(validation.port));
    runCommand(validation.command);
    setDispatchSuccess(
      `Dispatched "${validation.command}" to ${validation.host}:${validation.port}`,
    );
    toast({
      title: "Order dispatched to ENI1",
      detail: `${validation.command} → ${validation.host}:${validation.port}`,
      tone: "ok",
    });
  };

  const activeBotsCount = crew.filter((b) => b.state === "active" || b.state === "warning").length;
  const totalBotsCount = crew.length;
  const p95Latency = telemetry.p95 ?? 114;
  const enabledProvidersCount = providers.filter((p) => p.enabled).length || 3;
  const armedModulesCount = armedCount(addonConfig) || 8;

  const serviceRows =
    services.length > 0
      ? services
      : [
          { name: "mc-foreman", role: "ENI1 · supervisor loop", state: "active" as const, pid: 41192, cpu: 12.7, mem: 1320 * 1024 * 1024, startedAt: null },
          { name: "mc-cluster", role: "Worker agents · grind and build", state: "active" as const, pid: 41088, cpu: 8.1, mem: 720 * 1024 * 1024, startedAt: null },
          { name: "mc-shim", role: "Protocol shim · telemetry bridge", state: "active" as const, pid: 41022, cpu: 2.4, mem: 180 * 1024 * 1024, startedAt: null },
          { name: "mc-dashboard", role: "Dashboard · this console", state: "active" as const, pid: 40988, cpu: 0.7, mem: 92 * 1024 * 1024, startedAt: null },
          { name: "minecraft-server", role: "Minecraft server · world host", state: "active" as const, pid: 38900, cpu: 14.2, mem: 2140 * 1024 * 1024, startedAt: null },
        ];

  const activeServiceUnit = serviceRows.find((s) => s.name === selectedUnit) ?? serviceRows[0];

  const routeRows =
    providers.length > 0
      ? providers.slice(0, 4)
      : [
          {
            id: "gemini-1",
            name: "Gemini 3.8 Flash High",
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
            keyName: "GEMINI_API_KEY",
            model: "gemini-3.8-flash-high",
            timeoutMs: 25000,
            keyConfigured: true,
            enabled: true,
            latencyMs: 184,
            modelCount: null,
            contextWindow: 1000000,
            contextUsed: 42800,
            tokensPerSec: 186.0,
          },
          {
            id: "deepseek-1",
            name: "DeepSeek v4.1 Flash",
            baseURL: "https://api.deepseek.com/v1",
            keyName: "DEEPSEEK_API_KEY",
            model: "deepseek-ai/DeepSeek-V4.1-Flash",
            timeoutMs: 30000,
            keyConfigured: true,
            enabled: true,
            latencyMs: 312,
            modelCount: null,
            contextWindow: 128000,
            contextUsed: 19400,
            tokensPerSec: 142.0,
          },
          {
            id: "eni-critic",
            name: "ENI Local Critic",
            baseURL: "http://127.0.0.1:11434/v1",
            keyName: "LOCAL_CRITIC_KEY",
            model: "eni-critic-7b-q4",
            timeoutMs: 15000,
            keyConfigured: true,
            enabled: true,
            latencyMs: 92,
            modelCount: null,
            contextWindow: 32768,
            contextUsed: 8400,
            tokensPerSec: 64.0,
          },
          {
            id: "nvidia-1",
            name: "NVIDIA NIM",
            baseURL: "https://integrate.api.nvidia.com/v1",
            keyName: "NVIDIA_API_KEY",
            model: "nvidia/nemotron-3.5-super-vl-120b",
            timeoutMs: 30000,
            keyConfigured: true,
            enabled: true,
            latencyMs: 228,
            modelCount: null,
            contextWindow: 128000,
            contextUsed: 14200,
            tokensPerSec: 88.0,
          },
        ];

  const highlightedNavId = hoveredNav ?? activeSection;

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-canvas text-ink">
      <div className="ambient" aria-hidden="true" />

      {/* ── Detached Floating Glass-Neumorphic Sanctuary Command Bridge ─── */}
      <header className="sticky top-0 z-30 pt-2.5 sm:pt-4">
        <div className="mx-auto max-w-[1440px] px-3 sm:px-5 lg:px-10">
          <div className="lp-glass-card relative overflow-hidden rounded-2xl px-3 py-2 sm:px-5 sm:py-2.5">
            <div className="flex items-center justify-between gap-2 sm:gap-6">
              {/* Zone 1: Sculpted Sanctuary Seal + Live Supervisor Heartbeat Capsule */}
              <div className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3">
                <a
                  href="#top"
                  className="group flex items-center gap-2.5 whitespace-nowrap text-ink transition-opacity hover:opacity-95 sm:gap-3"
                >
                  <span className="lp-neu-socket relative size-9 shrink-0 p-1 sm:size-10">
                    <Crest size={28} />
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full border border-line bg-panel font-mono text-[7.5px] font-bold text-gold"
                    >
                      夜
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[17.5px] font-semibold leading-none tracking-[-0.015em] text-ink sm:text-[18.5px]">
                        Yozakura
                      </span>
                      <span className="hidden rounded-md border border-line-2 bg-panel-2/80 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-wider text-gold sm:inline-block">
                        ENI-01
                      </span>
                    </div>
                    <p className="mt-0.5 hidden font-mono text-[10px] tracking-[0.04em] text-faint sm:block">
                      SANCTUARY COMMAND BRIDGE
                    </p>
                  </div>
                </a>

                {/* Live Recessed Cluster Heartbeat Socket */}
                <div className="lp-neu-well hidden items-center gap-2 px-3 py-1.5 font-mono text-[10.5px] text-mute xl:flex num">
                  <StatusDot tone="ok" />
                  <span className="text-ink">{activeBotsCount}/{totalBotsCount} Crew</span>
                  <span aria-hidden="true" className="text-faint">·</span>
                  <span className="text-gold">20 Hz</span>
                </div>
              </div>

              {/* Zone 2: Indexed Architectural Hardware Rocker Track (Desktop) */}
              <nav
                aria-label="Landing sections"
                onMouseLeave={() => setHoveredNav(null)}
                className="lp-neu-well hidden items-center gap-0.5 p-1 lg:flex"
              >
                {NAV_LINKS.map((item) => {
                  const isHighlighted = highlightedNavId === item.id;
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      onMouseEnter={() => setHoveredNav(item.id)}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                        isHighlighted ? "text-ink" : "text-mute hover:text-ink",
                      )}
                    >
                      {isHighlighted && (
                        <motion.span
                          layoutId="lp-nav-hover"
                          className="lp-neu-pill absolute inset-0 rounded-xl"
                          transition={PILL_SPRING}
                        />
                      )}
                      <span className="relative z-10 font-mono text-[10px] text-gold num">{item.code}</span>
                      <span className="relative z-10">{item.label}</span>
                    </a>
                  );
                })}
              </nav>

              {/* Zone 3: World Atmosphere Rocker + Tactile Kinari-Paper Command Trigger */}
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleTheme}
                  aria-label={theme === "yozakura" ? "Switch to Hanami day theme" : "Switch to Yozakura night theme"}
                  title={theme === "yozakura" ? "Switch to Hanami day theme" : "Switch to Yozakura night theme"}
                  className="lp-neu-btn inline-flex h-8.5 items-center gap-1.5 px-2.5 text-[11.5px] font-medium text-mute hover:text-ink sm:h-9 sm:px-3"
                >
                  {theme === "yozakura" ? (
                    <>
                      <SunMedium size={14} className="text-gold" />
                      <span className="hidden font-mono text-[11px] sm:inline">昼 Hanami</span>
                    </>
                  ) : (
                    <>
                      <MoonStar size={14} className="text-ink" />
                      <span className="hidden font-mono text-[11px] sm:inline">夜 Yozakura</span>
                    </>
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => focusEmbeddedConsole("fleet")}
                  className="lp-neu-cta inline-flex h-8.5 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[11.5px] font-medium sm:h-9 sm:gap-2 sm:px-3.5 sm:text-[12px]"
                >
                  <span>Live Console</span>
                  <ArrowDown size={13} />
                </motion.button>
              </div>
            </div>

            {/* Mobile & Tablet Indexed Section Quick-Jump Track (< lg) */}
            <nav
              aria-label="Mobile section jump"
              className="mt-2 flex items-center gap-1 overflow-x-auto border-t border-line pt-2 no-scrollbar lg:hidden"
            >
              {NAV_LINKS.map((item) => {
                const isCurrent = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[10.5px] transition-colors",
                      isCurrent ? "lp-neu-well font-semibold text-ink" : "text-mute hover:text-ink",
                    )}
                  >
                    <span className="text-gold">{item.code}</span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>

            {/* Bottom Optical Scroll-Progress Telemetry Hairline */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] overflow-hidden rounded-full bg-line"
            >
              <motion.div
                style={{ scaleX: scrollScaleX, transformOrigin: "0% 50%" }}
                className="h-full w-full bg-gold"
              />
            </div>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-10">
        {/* ── Hero Section: Glassmorphic & Neumorphic Spatial Stage ─────── */}
        <section className="pt-8 pb-12 sm:pt-10 lg:pt-14 lg:pb-16">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Hero Left Column */}
            <motion.div
              variants={STAGGER_CONTAINER}
              initial="hidden"
              animate="visible"
              className="min-w-0 lg:col-span-6"
            >
              {/* Tactile Neumorphic Status Well + Upstream Ecosystem Citation */}
              <motion.div
                variants={REVEAL_UP}
                className="flex flex-wrap items-center gap-2"
              >
                <div className="lp-neu-well inline-flex flex-wrap items-center gap-2.5 px-3.5 py-1.5 text-[11.5px]">
                  <StatusDot tone="ok" />
                  <span className="font-medium text-ink">Mindcraft Autonomous Cluster</span>
                  <span aria-hidden="true" className="text-faint">·</span>
                  <span className="font-mono text-mute num">Java 26.1 · {clusterTarget}</span>
                </div>
                <a
                  href="#references"
                  onClick={() => jumpToRefModule("mindserver")}
                  className="lp-neu-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10.5px] text-mute hover:text-ink"
                >
                  <Code2 size={12} className="text-gold" />
                  <span>Upstream Specs &amp; Ref Code</span>
                </a>
              </motion.div>

              <motion.h1
                variants={REVEAL_UP}
                className="mt-5 font-display font-semibold text-ink"
                style={{
                  fontSize: "clamp(2.25rem, 4vw, 3.65rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  textWrap: "balance",
                }}
              >
                Tactile command over autonomous Minecraft AI agents.
              </motion.h1>

              <motion.p
                variants={REVEAL_UP}
                className="mt-5 max-w-[56ch] text-[15px] leading-[1.7] text-mute"
              >
                Yozakura fuses a 20 Hz deterministic{" "}
                <a
                  href="https://github.com/PrismarineJS/mineflayer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-gold"
                >
                  Mineflayer
                </a>{" "}
                survival reflex layer with{" "}
                <a
                  href="https://github.com/kolbytn/mindcraft"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-gold"
                >
                  MindServer
                </a>{" "}
                multi-agent coordination, Sponge <code className="font-mono text-[13px] text-ink">.schem</code>{" "}
                construction, and multi-provider LLM failover routing.
              </motion.p>

              {/* Interactive Hero Agent Selector in a Glass-Neumorphic Card */}
              <motion.div variants={REVEAL_UP} className="lp-glass-card mt-7 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                  <span className="eyebrow">Live Agent Telemetry Preview</span>
                  <span className="font-mono text-[11px] text-mute num">
                    MindServer :8080 · {armedModulesCount} Guard Modules Armed
                  </span>
                </div>

                {/* Neumorphic Segmented Agent Track */}
                <div className="lp-neu-well grid grid-cols-4 gap-1 p-1" role="tablist" aria-label="Preview crew unit">
                  {crew.map((bot) => {
                    const selected = bot.id === activeHeroBot.id;
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setHeroBotId(bot.id)}
                        className={cn(
                          "relative flex items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-[11.5px] font-medium transition-colors sm:gap-2 sm:text-[12px]",
                          selected ? "text-ink" : "text-mute hover:text-ink",
                        )}
                      >
                        {selected && (
                          <motion.span
                            layoutId="hero-agent-thumb"
                            className="lp-neu-pill absolute inset-0 rounded-xl"
                            transition={PILL_SPRING}
                          />
                        )}
                        <StatusDot tone={botTone(bot.state)} className="relative z-10 shrink-0" />
                        <span className="relative z-10 truncate">{bot.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Agent Readout with Smooth Transition */}
                <div className="mt-3.5 pt-1">
                  <motion.div
                    key={activeHeroBot.id}
                    initial={{ opacity: 0.55, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="lp-neu-socket p-1">
                        <Portrait name={activeHeroBot.name} src={activeHeroBot.avatar} size={40} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-[15px] font-semibold text-ink">{activeHeroBot.name}</span>
                          <span className="text-[12px] text-mute">· {activeHeroBot.role}</span>
                        </div>
                        <p className="text-[12px] text-faint">
                          {activeHeroBot.activity || "Standing by"} ·{" "}
                          <span className="font-mono text-mute num">{coord(activeHeroBot)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="lp-neu-well hidden px-2.5 py-1 font-mono text-[11px] text-mute num sm:inline-block">
                        {activeHeroBot.ping ?? 24} ms
                      </span>
                      <motion.button
                        type="button"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleInspectAgent(activeHeroBot.id)}
                        className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-3 text-[11.5px] font-medium"
                      >
                        <span>Inspect {activeHeroBot.name}</span>
                        <ArrowRight size={12} />
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Tactile Hero Action Row */}
              <motion.div variants={REVEAL_UP} className="mt-7 flex flex-wrap items-center gap-3">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => focusEmbeddedConsole("fleet")}
                  className="lp-neu-cta inline-flex h-11 items-center gap-2.5 px-5 text-[13.5px] font-semibold"
                >
                  <span>Explore Live Console Below</span>
                  <ArrowDown size={15} />
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openFullscreenConsole("fleet")}
                  className="lp-neu-btn inline-flex h-11 items-center gap-2 px-4 text-[13px] font-medium"
                >
                  <Maximize2 size={14} className="text-mute" />
                  <span>Full Screen Workspace</span>
                </motion.button>
              </motion.div>
            </motion.div>

            {/* Hero Right Column: Multi-Image Glass-Neumorphic World & Schematic Stage */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.12, ease: EASE_OUT_EXPO }}
              className="min-w-0 lg:col-span-6"
            >
              <div className="lp-glass-card p-3 sm:p-4">
                {/* Stage Top Header Bar */}
                <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2 text-[11.5px] text-mute">
                    <StatusDot tone="ok" />
                    <span className="font-mono">Sanctuary Optical Feed · 4 World Sectors</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoTour((v) => !v)}
                    className="lp-neu-well inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10.5px] text-mute transition-colors hover:text-ink"
                  >
                    {autoTour ? <Pause size={10} /> : <Play size={10} />}
                    <span>{autoTour ? "Auto-Tour On" : "Auto-Tour Paused"}</span>
                  </button>
                </div>

                {/* Recessed Neumorphic Frame around the Active World Render */}
                <div className="lp-neu-well relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[#141311]">
                  <AnimatePresence mode="sync" initial={false}>
                    <motion.img
                      key={selectedPreset.id}
                      initial={{ opacity: 0, scale: 1.045 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.99 }}
                      transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
                      src={selectedPreset.image}
                      alt={`${selectedPreset.title} — ${selectedPreset.subtitle}`}
                      className="absolute inset-0 size-full object-cover"
                      style={{ objectPosition: selectedPreset.focalPoint }}
                    />
                  </AnimatePresence>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(12, 11, 10, 0.12) 0%, rgba(12, 11, 10, 0.25) 48%, rgba(12, 11, 10, 0.88) 100%)",
                    }}
                  />

                  {/* Interactive World Waypoint Pins on the Render with Sonar Beacon (Desktop/Tablet) */}
                  {SCHEMATIC_PRESETS.map((preset) => {
                    const isSelected = preset.id === selectedPreset.id;
                    const coords = HERO_PIN_COORDS[preset.id] ?? preset.pin;
                    return (
                      <motion.button
                        key={preset.id}
                        type="button"
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSelectPresetManual(preset.id)}
                        style={{ left: `${coords[0]}%`, top: `${coords[1]}%` }}
                        aria-label={`Focus ${preset.title} schematic`}
                        className={cn(
                          "absolute z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold backdrop-blur-md transition-colors sm:inline-flex",
                          isSelected
                            ? "lp-neu-cta rounded-full!"
                            : "border border-white/25 bg-[#141311]/75 text-[#ebe6dd] hover:border-white/50 hover:bg-[#1e1c19]/90",
                        )}
                      >
                        {isSelected && (
                          <span
                            aria-hidden="true"
                            className="lp-sonar-ring pointer-events-none absolute inset-0 rounded-full border border-white/40"
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              isSelected ? "bg-ok" : "bg-[#c8ab78]",
                            )}
                          />
                          {preset.shortTitle}
                        </span>
                      </motion.button>
                    );
                  })}

                  {/* Floating Frosted Glass HUD inside the Sanctuary Frame */}
                  <div className="absolute inset-x-2.5 bottom-2.5 z-10 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/15 bg-[#141311]/76 p-3 text-[#f4efe6] backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:p-4">
                    <motion.div
                      key={selectedPreset.id}
                      initial={{ opacity: 0.55, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#dfc08e] sm:text-[10.5px]">
                        {selectedPreset.biome} · {selectedPreset.fileName}
                      </p>
                      <p className="mt-0.5 truncate font-display text-[16px] font-semibold leading-snug text-[#f4efe6] sm:text-[19px]">
                        {selectedPreset.title} · {fmtInt(selectedPreset.totalBlocks)} Blocks
                      </p>
                      <p className="mt-0.5 hidden truncate font-mono text-[11.5px] text-[#c7bfb4] sm:block num">
                        Footprint {selectedPreset.size[0]}W × {selectedPreset.size[1]}H × {selectedPreset.size[2]}D · {selectedPreset.subtitle}
                      </p>
                    </motion.div>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStagePreset}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-3 text-[11.5px] font-medium text-[#f4efe6] transition-colors hover:border-white/45 hover:bg-white/25 sm:text-[12px]"
                    >
                      <span>Stage in Builder</span>
                      <ArrowUpRight size={13} />
                    </motion.button>
                  </div>
                </div>

                {/* 4-Scene Tactile Thumbnail Switcher Strip (Variety of World Renders) */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SCHEMATIC_PRESETS.map((preset) => {
                    const active = preset.id === selectedPreset.id;
                    return (
                      <motion.button
                        key={preset.id}
                        type="button"
                        whileHover={{ y: -1.5 }}
                        whileTap={{ scale: 0.98 }}
                        data-active={active}
                        onClick={() => handleSelectPresetManual(preset.id)}
                        className="lp-neu-btn group relative flex items-center gap-2 overflow-hidden p-1.5 text-left"
                      >
                        <img
                          src={preset.image}
                          alt=""
                          className="h-9 w-12 shrink-0 rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11.5px] font-semibold text-ink">{preset.shortTitle}</p>
                          <p className="truncate font-mono text-[10px] text-faint num">{fmtInt(preset.totalBlocks)} blk</p>
                        </div>
                        {active && (
                          <motion.span
                            layoutId="hero-scene-bar"
                            className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gold"
                            transition={PILL_SPRING}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── 4-Column Tactile Glass-Neumorphic Telemetry Strip ─────── */}
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="lp-glass-card mt-10 p-4 sm:p-5"
          >
            <dl className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-5">
              <motion.div
                variants={REVEAL_UP}
                whileHover={{ y: -2.5 }}
                transition={CARD_SPRING}
                className="lp-neu-well p-4"
              >
                <div className="flex items-center justify-between">
                  <dt className="eyebrow">Active Crew</dt>
                  <StatusDot tone="ok" />
                </div>
                <dd className="mt-2 font-display text-[24px] font-semibold leading-none text-ink sm:text-[26px] num">
                  {activeBotsCount} / {totalBotsCount}
                </dd>
                <p className="mt-1.5 text-[12px] text-mute">Foreman + 3 coordinator workers</p>
              </motion.div>

              <motion.div
                variants={REVEAL_UP}
                whileHover={{ y: -2.5 }}
                transition={CARD_SPRING}
                className="lp-neu-well p-4"
              >
                <div className="flex items-center justify-between">
                  <dt className="eyebrow">Supervisor Handshake</dt>
                  <Activity size={13} className="text-mute" />
                </div>
                <dd className="mt-2 font-display text-[24px] font-semibold leading-none text-ink sm:text-[26px] num">
                  {p95Latency} ms
                </dd>
                <p className="mt-1.5 text-[12px] text-mute">p95 telemetry bridge (:8091)</p>
              </motion.div>

              <motion.div
                variants={REVEAL_UP}
                whileHover={{ y: -2.5 }}
                transition={CARD_SPRING}
                className="lp-neu-well p-4"
              >
                <div className="flex items-center justify-between">
                  <dt className="eyebrow">Guard Reflex Loop</dt>
                  <Shield size={13} className="text-mute" />
                </div>
                <dd className="mt-2 font-display text-[24px] font-semibold leading-none text-ink sm:text-[26px] num">
                  20 Hz
                </dd>
                <p className="mt-1.5 text-[12px] text-mute">Deterministic 50 ms tick checks</p>
              </motion.div>

              <motion.div
                variants={REVEAL_UP}
                whileHover={{ y: -2.5 }}
                transition={CARD_SPRING}
                className="lp-neu-well p-4"
              >
                <div className="flex items-center justify-between">
                  <dt className="eyebrow">Model Failover Chain</dt>
                  <Cpu size={13} className="text-mute" />
                </div>
                <dd className="mt-2 font-display text-[24px] font-semibold leading-none text-ink sm:text-[26px] num">
                  {enabledProvidersCount} Routes
                </dd>
                <p className="mt-1.5 text-[12px] text-mute">OpenAI-compatible failover</p>
              </motion.div>
            </dl>
          </motion.div>
        </section>

        {/* ── Embedded Live Operations Console (#console) in a Glass-Neumorphic Chassis ── */}
        {consoleSlot && (
          <section
            id="console"
            aria-label="Embedded Operations Console"
            className="scroll-mt-24 py-6 lg:py-10"
          >
            <div className="lp-glass-card p-3 sm:p-5">
              {/* Outer Glass Chassis Top Controls */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-3">
                  <span className="lp-neu-socket size-10 text-ink">
                    <Terminal size={17} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[19px] font-semibold text-ink">
                        Live Operations Console
                      </h2>
                      <span className="lp-neu-well inline-flex items-center gap-1.5 px-2.5 py-0.5 font-mono text-[11px] text-mute num">
                        <StatusDot tone="ok" />
                        {clusterTarget}
                      </span>
                      <span className="lp-neu-well inline-flex items-center gap-1.5 px-2.5 py-0.5 font-mono text-[11px] text-mute num">
                        <StatusDot tone={dashUnlocked ? "ok" : "warn"} />
                        <span>{dashUnlocked ? "Session Verified" : "Session Locked"}</span>
                      </span>
                    </div>
                    <p className="text-[12.5px] text-mute">
                      Interact with all six supervisor modules right inside the page or expand to full screen.
                    </p>
                  </div>
                </div>

                {/* Tactile Neumorphic View Switcher + Lock / Fullscreen Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    className="lp-neu-well flex flex-wrap items-center gap-1 p-1"
                    role="group"
                    aria-label="Quick view switcher"
                  >
                    {VIEWS.map((v) => {
                      const active = view === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setView(v)}
                          className={cn(
                            "relative h-8 rounded-xl px-2.5 text-[11.5px] font-medium transition-colors sm:px-3 sm:text-[12px]",
                            active ? "text-ink" : "text-mute hover:text-ink",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="console-view-pill"
                              className="lp-neu-pill absolute inset-0 rounded-xl"
                              transition={PILL_SPRING}
                            />
                          )}
                          <span className="relative z-10">{VIEW_LABELS[v]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {dashUnlocked && (
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={lockDash}
                      className="lp-neu-btn inline-flex h-9 items-center gap-1.5 px-3 text-[12px] font-medium text-mute hover:text-ink"
                    >
                      <Lock size={12.5} />
                      <span>Lock Console</span>
                    </motion.button>
                  )}

                  <motion.button
                    type="button"
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openFullscreenConsole()}
                    className="lp-neu-cta inline-flex h-9 items-center gap-1.5 px-3.5 text-[12px] font-semibold"
                  >
                    <Maximize2 size={13} />
                    <span>Expand Full Screen</span>
                  </motion.button>
                </div>
              </div>

              {/* Recessed Neumorphic Cradle holding the Live Console */}
              <div className="lp-neu-well overflow-hidden rounded-2xl p-1.5">
                <div className="h-[640px] w-full overflow-hidden rounded-xl border border-line bg-canvas sm:h-[760px] lg:h-[820px]">
                  {consoleSlot}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Section 1: Glass-Neumorphic System Architecture Bento Grid (01. – 04.) ── */}
        <section id="architecture" className="scroll-mt-24 py-14 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="flex flex-wrap items-end justify-between gap-6"
          >
            <div>
              <p className="eyebrow">System Architecture</p>
              <h2
                className="mt-2 font-display font-semibold text-ink"
                style={{ fontSize: "clamp(1.65rem, 2.8vw, 2.45rem)", lineHeight: 1.12, letterSpacing: "-0.02em" }}
              >
                Decoupled intelligence for survival worlds.
              </h2>
            </div>
            <p className="max-w-[52ch] text-[14px] leading-relaxed text-mute">
              High-level planning runs through your LLM provider chain while combat reflexes, block excavation, and
              schematic placement execute deterministically inside the Mineflayer runtime.
            </p>
          </motion.div>

          <div className="mt-8 grid gap-6 lg:grid-cols-12">
            {/* 01. MindServer & Systemd Unit Supervision (col-span-7) */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.48, ease: EASE_OUT_EXPO }}
              className="lp-glass-card min-w-0 flex flex-col justify-between p-5 sm:p-6 lg:col-span-7 lg:p-7"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="lp-neu-socket gap-2 px-3 py-1 font-mono text-[12px] font-semibold text-ink num">
                    <StatusDot tone="ok" />
                    01 · systemd
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToRefModule("mindserver")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-2.5 font-mono text-[11px] text-mute hover:text-ink"
                    >
                      <Code2 size={12} className="text-gold" />
                      <span>Ref Code</span>
                    </button>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => focusEmbeddedConsole("fleet")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium"
                    >
                      <span>Manage units</span>
                      <ArrowUpRight size={13} />
                    </motion.button>
                  </div>
                </div>

                {/* Bespoke Sanctuary Storage & Coordination Visual */}
                <div className="lp-neu-well group relative mt-4 h-44 w-full overflow-hidden rounded-xl bg-[#141311]">
                  <img
                    src={ARCH_MEDIA.depot}
                    alt="Sanctuary timber and blackstone shulker storage depot synchronized across the MindServer cluster"
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: "linear-gradient(180deg, rgba(12,11,10,0.08) 0%, rgba(12,11,10,0.84) 100%)",
                    }}
                  />
                  <div className="absolute inset-x-3.5 bottom-2.5 flex items-center justify-between gap-2 font-mono text-[11px] text-[#f4efe6]">
                    <span>Camp Shulker &amp; Chest Mutex · MindServer :8080</span>
                    <span className="text-[#dfc08e]">5 Isolated Services</span>
                  </div>
                </div>

                <h3 className="mt-4 font-display text-[21px] font-semibold text-ink">
                  MindServer &amp; Five-Unit Process Isolation
                </h3>
                <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed text-mute">
                  Click any supervised <code className="font-mono text-[12px] text-ink">systemd</code> unit below to inspect
                  its live PID, CPU load, and memory footprint. Isolating the bridge and worker cluster ensures zero dropped packets.
                </p>

                <div className="lp-neu-well mt-4 overflow-x-auto p-2">
                  <div className="space-y-1.5">
                    {serviceRows.map((svc) => {
                      const isSelected = selectedUnit === svc.name;
                      return (
                        <button
                          key={svc.name}
                          type="button"
                          onClick={() => setSelectedUnit(svc.name)}
                          data-active={isSelected}
                          className="lp-neu-btn flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[12.5px]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <StatusDot tone={svc.state === "active" ? "ok" : "warn"} />
                            <span className="truncate font-mono text-[12px] font-semibold text-ink">{svc.name}</span>
                            <span className="hidden truncate text-mute sm:inline">· {svc.role}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-4 font-mono text-[11.5px] num">
                            <span className="hidden text-faint sm:inline">PID {svc.pid ?? "—"}</span>
                            <span className="text-mute">{fmtBytes(svc.mem)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Animated Live Unit Telemetry Readout */}
                <motion.div
                  key={activeServiceUnit.name}
                  initial={{ opacity: 0.55, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="lp-neu-well mt-3 flex flex-wrap items-center justify-between gap-4 px-3.5 py-2.5 font-mono text-[11.5px] num"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-faint">Selected:</span>
                    <span className="font-semibold text-ink">{activeServiceUnit.name}.service</span>
                    <span className="text-mute">· PID {activeServiceUnit.pid ?? 41192}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-mute">CPU {(activeServiceUnit.cpu ?? 8.4).toFixed(1)}%</span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-panel-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(12, (activeServiceUnit.cpu ?? 8) * 4.5))}%` }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="h-full rounded-full bg-ok"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5 text-[12px] text-mute">
                <a
                  href="https://github.com/kolbytn/mindcraft"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink hover:text-gold"
                >
                  <span>Source: github.com/kolbytn/mindcraft</span>
                  <ExternalLink size={11.5} className="text-gold" />
                </a>
                <span className="lp-neu-well px-2.5 py-1 font-mono text-[11px] text-faint num">POLL_MS = 5,000 ms</span>
              </div>
            </motion.article>

            {/* 02. Deterministic Tick-Loop Guard Layer (col-span-5) */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.48, delay: 0.06, ease: EASE_OUT_EXPO }}
              className="lp-glass-card min-w-0 flex flex-col justify-between p-5 sm:p-6 lg:col-span-5 lg:p-7"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="lp-neu-socket gap-2 px-3 py-1 font-mono text-[12px] font-semibold text-ink num">
                    <StatusDot tone="ok" />
                    02 · 20 Hz Guard
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToRefModule("guard")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-2.5 font-mono text-[11px] text-mute hover:text-ink"
                    >
                      <Code2 size={12} className="text-gold" />
                      <span>Ref Code</span>
                    </button>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => focusEmbeddedConsole("addons")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium"
                    >
                      <span>Add-ons</span>
                      <ArrowUpRight size={13} />
                    </motion.button>
                  </div>
                </div>

                {/* Bespoke Perimeter Watchpost Visual with Live Radar Sweep */}
                <div className="lp-neu-well group relative mt-4 h-44 w-full overflow-hidden rounded-xl bg-[#141311]">
                  <img
                    src={ARCH_MEDIA.guard}
                    alt="Fortified cherry-wood and deepslate perimeter watchpost scanning a 64-meter radar ring"
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: "linear-gradient(180deg, rgba(12,11,10,0.08) 0%, rgba(12,11,10,0.84) 100%)",
                    }}
                  />
                  {/* Live Radar Dial Badge in Corner */}
                  <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-white/15 bg-[#141311]/75 px-2.5 py-1 font-mono text-[10px] text-[#ebe6dd] backdrop-blur-md">
                    <span className="relative flex size-3.5 items-center justify-center rounded-full border border-[#86b58f]/60">
                      <span className="radar-sweep absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-[#86b58f]/60" />
                      <span className="size-1 rounded-full bg-[#86b58f]" />
                    </span>
                    <span>RADAR ARMED</span>
                  </div>
                  <div className="absolute inset-x-3.5 bottom-2.5 flex items-center justify-between gap-2 font-mono text-[11px] text-[#f4efe6]">
                    <span>Perimeter Watchpost · 64m Radar Ring</span>
                    <span className="text-[#86b58f]">50 ms Tick Loop</span>
                  </div>
                </div>

                <h3 className="mt-4 font-display text-[21px] font-semibold text-ink">
                  Zero-Latency Survival Guard Layer
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">
                  LLM inference takes hundreds of milliseconds—too slow for crystal or sword combat. Yozakura runs{" "}
                  {addonCatalog.length} behavior modules directly inside the Mineflayer physics tick.
                </p>

                <ul className="mt-4 space-y-2">
                  {GUARD_HIGHLIGHTS.map((item) => (
                    <motion.li
                      key={item.id}
                      whileHover={{ x: 2 }}
                      transition={CARD_SPRING}
                      className="lp-neu-well flex items-start gap-3 p-3"
                    >
                      <span className="lp-neu-socket mt-0.5 size-8 shrink-0 text-ink">
                        <AddonSvgIcon name={item.id} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12.5px] font-semibold text-ink">{item.title}</p>
                          <span className="font-mono text-[10.5px] text-mute num">{item.latency}</span>
                        </div>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-mute">{item.summary}</p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 border-t border-line pt-3.5">
                <div className="grid grid-cols-4 gap-2 text-center num">
                  <div className="lp-neu-well py-2">
                    <p className="text-[10px] uppercase tracking-wider text-faint">Totems</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-ink">{loadout.totems || 2}</p>
                  </div>
                  <div className="lp-neu-well py-2">
                    <p className="text-[10px] uppercase tracking-wider text-faint">Gapples</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-ink">{loadout.gapples || 14}</p>
                  </div>
                  <div className="lp-neu-well py-2">
                    <p className="text-[10px] uppercase tracking-wider text-faint">E-Gapples</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-ink">{loadout.egapples || 3}</p>
                  </div>
                  <div className="lp-neu-well py-2">
                    <p className="text-[10px] uppercase tracking-wider text-faint">Balance</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-gold">
                      {loadout.balance !== "$0" ? loadout.balance : "$14,208"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-mute">
                  <a
                    href="https://github.com/PrismarineJS/mineflayer-pvp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-ink hover:text-gold"
                  >
                    <span>Source: PrismarineJS/mineflayer-pvp</span>
                    <ExternalLink size={11.5} className="text-gold" />
                  </a>
                  <span className="text-faint">20 TPS Hook</span>
                </div>
              </div>
            </motion.article>

            {/* 03. Interactive Resource Grind Worker (col-span-5) */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.48, ease: EASE_OUT_EXPO }}
              className="lp-glass-card min-w-0 flex flex-col justify-between p-5 sm:p-6 lg:col-span-5 lg:p-7"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="lp-neu-socket gap-2 px-3 py-1 font-mono text-[12px] font-semibold text-ink num">
                    <StatusDot tone="ok" />
                    03 · Pathfinder
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToRefModule("pathfinder")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-2.5 font-mono text-[11px] text-mute hover:text-ink"
                    >
                      <Code2 size={12} className="text-gold" />
                      <span>Ref Code</span>
                    </button>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => focusEmbeddedConsole("grind")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium"
                    >
                      <span>Grind queue</span>
                      <ArrowUpRight size={13} />
                    </motion.button>
                  </div>
                </div>

                {/* Bespoke Nether Y=15 Excavation Corridor Visual */}
                <div className="lp-neu-well group relative mt-4 h-44 w-full overflow-hidden rounded-xl bg-[#141311]">
                  <img
                    src={ARCH_MEDIA.grind}
                    alt="Underground Nether Y=15 excavation rail tunnel with Ancient Debris and Nether Quartz veins"
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: "linear-gradient(180deg, rgba(12,11,10,0.08) 0%, rgba(12,11,10,0.84) 100%)",
                    }}
                  />
                  <div className="absolute inset-x-3.5 bottom-2.5 flex items-center justify-between gap-2 font-mono text-[11px] text-[#f4efe6]">
                    <span>Nether Sector Y=-54 · Ancient Debris Tunnel</span>
                    <span className="text-[#dfc08e]">32m Sweep Radius</span>
                  </div>
                </div>

                <h3 className="mt-4 font-display text-[21px] font-semibold text-ink">
                  Persistent Resource Grind Queue
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">
                  Press any tactile block socket below to stage an excavation job. The grind worker navigates via{" "}
                  <code className="font-mono text-[12px] text-ink">mineflayer-pathfinder</code> and deposits stacks at camp chests.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {GRIND_SAMPLES.map((item) => {
                    const active = selectedBlock === item.block;
                    return (
                      <motion.button
                        key={item.block}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        data-active={active}
                        onClick={() => setSelectedBlock(item.block)}
                        className="lp-neu-btn flex items-center gap-3 p-2.5 text-left"
                      >
                        <span className="lp-neu-socket size-9 shrink-0 p-1">
                          <BlockIcon name={item.block} size={24} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-ink">{item.label}</p>
                          <p className="truncate font-mono text-[10.5px] text-faint num">{item.rate}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Animated Selected Resource Yield & Pathfinding Efficiency Bar */}
                <div className="lp-neu-well mt-3 px-3.5 py-2.5 font-mono text-[11px] num">
                  <div className="flex items-center justify-between text-mute">
                    <span>
                      Target: <strong className="text-ink">{activeGrindSample.label}</strong> ({activeGrindSample.region})
                    </span>
                    <span className="text-ink">{activeGrindSample.rate}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${activeGrindSample.efficiency}%` }}
                      transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                      className="h-full rounded-full bg-gold"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-line pt-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="lp-neu-well flex items-center gap-1 p-1">
                    {[64, 128, 256].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        data-active={grindCount === qty}
                        onClick={() => setGrindCount(qty)}
                        className="lp-neu-btn num h-7 rounded-lg px-2.5 font-mono text-[11.5px] font-semibold"
                      >
                        ×{qty}
                      </button>
                    ))}
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleQuickGrind}
                    className="lp-neu-cta inline-flex h-9 items-center gap-2 px-3.5 text-[12px] font-semibold"
                  >
                    <Pickaxe size={13.5} />
                    <span>Queue {grindCount} × {prettyBlock(selectedBlock)}</span>
                  </motion.button>
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-mute">
                  <a
                    href="https://github.com/PrismarineJS/mineflayer-pathfinder"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-ink hover:text-gold"
                  >
                    <span>Source: PrismarineJS/mineflayer-pathfinder</span>
                    <ExternalLink size={11.5} className="text-gold" />
                  </a>
                  <span className="text-faint">A* Voxel Graph</span>
                </div>
              </div>
            </motion.article>

            {/* 04. Multi-Provider LLM Fallback Chain (col-span-7) */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.48, delay: 0.06, ease: EASE_OUT_EXPO }}
              className="lp-glass-card min-w-0 flex flex-col justify-between p-5 sm:p-6 lg:col-span-7 lg:p-7"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="lp-neu-socket gap-2 px-3 py-1 font-mono text-[12px] font-semibold text-ink num">
                    <StatusDot tone="ok" />
                    04 · LLM Router
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToRefModule("router")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-2.5 font-mono text-[11px] text-mute hover:text-ink"
                    >
                      <Code2 size={12} className="text-gold" />
                      <span>Ref Code</span>
                    </button>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => focusEmbeddedConsole("providers")}
                      className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium"
                    >
                      <span>Routing table</span>
                      <ArrowUpRight size={13} />
                    </motion.button>
                  </div>
                </div>

                {/* Moonlit Sanctuary Panorama Visual */}
                <div className="lp-neu-well group relative mt-4 h-44 w-full overflow-hidden rounded-xl bg-[#141311]">
                  <img
                    src={ARCH_MEDIA.router}
                    alt="Moonlit Yozakura cherry-blossom canal and lantern pavilion supervised by the LLM routing chain"
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: "linear-gradient(180deg, rgba(12,11,10,0.08) 0%, rgba(12,11,10,0.84) 100%)",
                    }}
                  />
                  <div className="absolute inset-x-3.5 bottom-2.5 flex items-center justify-between gap-2 font-mono text-[11px] text-[#f4efe6]">
                    <span>Supervisor Cognitive Loop · Memory State Preserved</span>
                    <span className="text-[#86b58f]">{enabledProvidersCount} Active Endpoints</span>
                  </div>
                </div>

                <h3 className="mt-4 font-display text-[21px] font-semibold text-ink">
                  Ordered OpenAI-Compatible Provider Failover
                </h3>
                <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed text-mute">
                  ENI1 walks the enabled provider chain from top to bottom on every planning turn. If the primary endpoint
                  times out or hits a rate limit, the next route answers without dropping the agent’s memory state.
                </p>

                <div className="mt-4 space-y-2">
                  {routeRows.map((route, idx) => {
                    const tokSpeed = route.tokensPerSec ?? 96;
                    const barPct = Math.min(100, Math.round((tokSpeed / 200) * 100));
                    return (
                      <motion.div
                        key={route.id}
                        whileHover={{ x: 2 }}
                        transition={CARD_SPRING}
                        className="lp-neu-well px-4 py-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="lp-neu-socket p-1">
                              <ProviderLogo
                                baseURL={route.baseURL}
                                name={route.name}
                                model={route.model}
                                enabled={route.enabled}
                                size={30}
                              />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[13px] font-semibold text-ink">{route.name}</p>
                                <span className="font-mono text-[11px] text-mute">
                                  {idx === 0 ? "· Primary" : `· Fallback #${idx}`}
                                </span>
                              </div>
                              <p className="truncate font-mono text-[11.5px] text-faint">
                                {route.model} · {route.keyName}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-4 font-mono text-[12px] num">
                            {route.tokensPerSec !== null && (
                              <span className="hidden text-mute sm:inline">{route.tokensPerSec.toFixed(1)} tok/s</span>
                            )}
                            <span className="inline-flex items-center gap-1.5 text-ink">
                              <StatusDot tone={route.enabled ? "ok" : "idle"} />
                              {route.latencyMs ?? 180} ms
                            </span>
                          </div>
                        </div>

                        {/* Animated Throughput Fill Bar */}
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel-3">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${barPct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.65, delay: idx * 0.08, ease: EASE_OUT_EXPO }}
                            className={cn("h-full rounded-full", idx === 0 ? "bg-ok" : "bg-gold")}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5 text-[12px] text-mute">
                <a
                  href="https://github.com/kolbytn/mindcraft"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink hover:text-gold"
                >
                  <span>Source: mindcraft/src/models/prompter.js</span>
                  <ExternalLink size={11.5} className="text-gold" />
                </a>
                <button
                  type="button"
                  onClick={() => focusEmbeddedConsole("providers")}
                  className="font-semibold text-ink underline decoration-line-2 underline-offset-4 transition-colors hover:decoration-ink"
                >
                  Test all endpoints →
                </button>
              </div>
            </motion.article>
          </div>
        </section>

        {/* ── Section 2: Autonomous Crew Tactile Glass-Neumorphic Cards (#agents) ── */}
        <section id="agents" className="scroll-mt-24 py-14 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="flex flex-wrap items-end justify-between gap-6"
          >
            <div>
              <p className="eyebrow">Autonomous Crew</p>
              <h2
                className="mt-2 font-display font-semibold text-ink"
                style={{ fontSize: "clamp(1.65rem, 2.8vw, 2.45rem)", lineHeight: 1.12, letterSpacing: "-0.02em" }}
              >
                Four specialized units, one shared world state.
              </h2>
            </div>
            <motion.button
              type="button"
              whileHover={{ y: -1.5 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => focusEmbeddedConsole("fleet")}
              className="lp-neu-btn inline-flex h-9 items-center gap-2 px-4 text-[12.5px] font-medium"
            >
              <span>Inspect Full Fleet</span>
              <ArrowRight size={13} />
            </motion.button>
          </motion.div>

          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {crew.map((bot) => (
              <motion.div
                key={bot.id}
                variants={REVEAL_UP}
                whileHover={{ y: -5 }}
                transition={CARD_SPRING}
                className="lp-glass-card flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-center gap-3.5">
                    <div className="lp-neu-socket p-1.5">
                      <Portrait name={bot.name} src={bot.avatar} size={52} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate font-display text-[18px] font-semibold text-ink">{bot.name}</h3>
                        <StatusDot tone={botTone(bot.state)} />
                      </div>
                      <p className="truncate text-[12px] text-mute">{bot.role}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-faint">{bot.unit}</p>
                    </div>
                  </div>

                  <p className="mt-4 truncate text-[12.5px] text-ink">
                    {bot.activity || "Standing by for supervisor order"}
                  </p>

                  {/* Recessed Neumorphic Vitals & Coordinates Well */}
                  <div className="lp-neu-well mt-4 space-y-2.5 p-3 font-mono text-[11.5px] num">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] uppercase text-faint">Health</span>
                      <div className="flex items-center gap-2">
                        <VialMeter value={bot.health ?? 20} tone={healthTone(bot.health ?? 20)} label={`${bot.name} health`} />
                        <span className="text-ink">{bot.health ?? 20}/20</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] uppercase text-faint">Hunger</span>
                      <div className="flex items-center gap-2">
                        <VialMeter value={bot.food ?? 20} tone={foodTone(bot.food ?? 20)} label={`${bot.name} food`} />
                        <span className="text-ink">{bot.food ?? 20}/20</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
                      <span className="text-[10.5px] uppercase text-faint">XYZ</span>
                      <span className="truncate text-ink">{coord(bot)}</span>
                    </div>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleInspectAgent(bot.id)}
                  className="lp-neu-btn mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 text-[12px] font-medium"
                >
                  <span>Inspect {bot.name} in Fleet</span>
                  <ArrowRight size={12} />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Section 3: Interactive Sponge .schem Blueprint Studio (#schematics) ── */}
        <section id="schematics" className="scroll-mt-24 py-14 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="flex flex-wrap items-end justify-between gap-6"
          >
            <div>
              <p className="eyebrow">Sponge .schem Architect</p>
              <h2
                className="mt-2 font-display font-semibold text-ink"
                style={{ fontSize: "clamp(1.65rem, 2.8vw, 2.45rem)", lineHeight: 1.12, letterSpacing: "-0.02em" }}
              >
                Layer-by-layer schematic staging and material manifests.
              </h2>
            </div>

            {/* Tactile Neumorphic Preset Switcher */}
            <div className="lp-neu-well flex flex-wrap gap-1.5 p-1.5" role="tablist" aria-label="Sanctuary schematic presets">
              {SCHEMATIC_PRESETS.map((preset) => {
                const selected = preset.id === selectedPreset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => handleSelectPresetManual(preset.id)}
                    className={cn(
                      "relative h-8 rounded-xl px-3.5 text-[12.5px] font-medium transition-colors",
                      selected ? "text-ink" : "text-mute hover:text-ink",
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId="schem-tab-pill"
                        className="lp-neu-pill absolute inset-0 rounded-xl"
                        transition={PILL_SPRING}
                      />
                    )}
                    <span className="relative z-10">{preset.shortTitle}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* 4-Card Visual Architectural Gallery Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {SCHEMATIC_PRESETS.map((preset) => {
              const selected = preset.id === selectedPreset.id;
              return (
                <motion.button
                  key={preset.id}
                  type="button"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.985 }}
                  transition={CARD_SPRING}
                  data-active={selected}
                  onClick={() => handleSelectPresetManual(preset.id)}
                  className="lp-neu-btn group flex flex-col overflow-hidden p-2 text-left"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-[#141311]">
                    <img
                      src={preset.image}
                      alt={preset.title}
                      className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[10px] text-[#f4efe6] backdrop-blur-sm num">
                      {preset.size[0]}×{preset.size[1]}×{preset.size[2]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 px-1">
                    <span className="truncate font-display text-[14px] font-semibold text-ink">{preset.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-mute num">{fmtInt(preset.totalBlocks)} blk</span>
                  </div>
                  <p className="mt-0.5 truncate px-1 text-[11.5px] text-faint">{preset.biome}</p>
                </motion.button>
              );
            })}
          </div>

          <div className="lp-glass-card mt-6 grid overflow-hidden p-3 sm:p-5 lg:grid-cols-12 lg:gap-6">
            {/* Left: Recessed Neumorphic Dedicated Preset Render */}
            <div className="lp-neu-well relative min-h-[300px] overflow-hidden rounded-2xl bg-[#141311] lg:col-span-5">
              <AnimatePresence mode="sync" initial={false}>
                <motion.img
                  key={selectedPreset.id}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                  src={selectedPreset.image}
                  alt={selectedPreset.title}
                  className="absolute inset-0 size-full object-cover"
                  style={{ objectPosition: selectedPreset.focalPoint }}
                />
              </AnimatePresence>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: "linear-gradient(180deg, rgba(12,11,10,0.1) 0%, rgba(12,11,10,0.84) 100%)",
                }}
              />
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#141311]/72 p-3.5 text-[#f4efe6] backdrop-blur-md">
                <div>
                  <p className="font-mono text-[11px] text-[#dfc08e]">{selectedPreset.fileName}</p>
                  <p className="font-display text-[18px] font-semibold text-[#f4efe6]">{selectedPreset.title}</p>
                  <p className="font-mono text-[11px] text-[#c7bfb4]">{selectedPreset.biome}</p>
                </div>
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                  <Blueprint dims={selectedPreset.size} size={34} />
                </div>
              </div>
            </div>

            {/* Right: Isometric Blueprint Spec + Neumorphic Bill of Materials */}
            <div className="flex flex-col justify-between p-3 sm:p-4 lg:col-span-7">
              <div>
                <motion.div
                  key={selectedPreset.id}
                  initial={{ opacity: 0.55, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-wrap items-start justify-between gap-4"
                >
                  <div>
                    <p className="eyebrow">Selected Blueprint</p>
                    <h3 className="mt-1 font-display text-[23px] font-semibold text-ink">{selectedPreset.title}</h3>
                    <p className="mt-1 text-[13.5px] text-mute">{selectedPreset.subtitle}</p>
                  </div>
                  <div className="lp-neu-well px-4 py-2.5 text-right font-mono num">
                    <p className="text-[19px] font-semibold text-ink">{fmtInt(selectedPreset.totalBlocks)} blocks</p>
                    <p className="text-[11px] text-faint">
                      {selectedPreset.size[0]}W × {selectedPreset.size[1]}H × {selectedPreset.size[2]}D
                    </p>
                  </div>
                </motion.div>

                <div className="mt-6">
                  <p className="eyebrow">Bill of Materials (Auto-Verified Against Camp Chests)</p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {Object.entries(selectedPreset.materials).map(([block, count]) => {
                      const sharePct = Math.min(100, Math.max(12, Math.round((count / selectedPreset.totalBlocks) * 180)));
                      return (
                        <div
                          key={block}
                          className="lp-neu-well px-3.5 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="lp-neu-socket size-8 p-1">
                                <BlockIcon name={block} size={20} />
                              </span>
                              <span className="text-[13px] font-medium text-ink">{prettyBlock(block)}</span>
                            </div>
                            <span className="font-mono text-[12.5px] text-mute num">{fmtInt(count)}</span>
                          </div>
                          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel-3">
                            <motion.div
                              key={`${selectedPreset.id}-${block}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${sharePct}%` }}
                              transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                              className="h-full rounded-full bg-gold"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
                <a
                  href="https://github.com/SpongePowered/Schematic-Specification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-mute hover:text-ink"
                >
                  <span>Spec: SpongePowered/Schematic-Specification (v3)</span>
                  <ExternalLink size={12} className="text-gold" />
                </a>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => jumpToRefModule("schematic")}
                    className="lp-neu-btn inline-flex h-9 items-center gap-1.5 px-3 font-mono text-[11.5px] text-mute hover:text-ink"
                  >
                    <Code2 size={13} className="text-gold" />
                    <span>.schem Ref Code</span>
                  </button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => focusEmbeddedConsole("build")}
                    className="lp-neu-btn inline-flex h-9 items-center px-3.5 text-[12.5px] font-medium"
                  >
                    Open Build View
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleStagePreset}
                    className="lp-neu-cta inline-flex h-9 items-center gap-2 px-4 text-[12.5px] font-semibold"
                  >
                    <Layers size={14} />
                    <span>Stage {selectedPreset.shortTitle}</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: Upstream Reference Code & Open-Source Protocol Studio (#references) ── */}
        <section id="references" className="scroll-mt-24 py-14 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="flex flex-wrap items-end justify-between gap-6"
          >
            <div>
              <p className="eyebrow">Open-Source Reference Code &amp; Internet Sources</p>
              <h2
                className="mt-2 font-display font-semibold text-ink"
                style={{ fontSize: "clamp(1.65rem, 2.8vw, 2.45rem)", lineHeight: 1.12, letterSpacing: "-0.02em" }}
              >
                 Inspect the upstream protocols powering ENI-01.
              </h2>
            </div>
            <p className="max-w-[54ch] text-[14px] leading-relaxed text-mute">
              Every subsystem in Yozakura is grounded in battle-tested open-source Minecraft &amp; LLM protocols. Switch
              modules below to inspect the reference implementation and jump directly to the upstream GitHub sources.
            </p>
          </motion.div>

          {/* Interactive 5-Module Reference Code Studio */}
          <div className="lp-glass-card mt-8 overflow-hidden p-4 sm:p-6 lg:p-7">
            {/* Top File Tab Strip */}
            <div
              className="lp-neu-well flex items-center gap-1.5 overflow-x-auto p-1.5 no-scrollbar"
              role="tablist"
              aria-label="Reference implementation modules"
            >
              {UPSTREAM_REFERENCES.map((refItem) => {
                const selected = refItem.id === activeRef.id;
                return (
                  <button
                    key={refItem.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveRefId(refItem.id)}
                    className={cn(
                      "relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 font-mono text-[12px] font-medium transition-colors",
                      selected ? "text-ink" : "text-mute hover:text-ink",
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId="ref-code-tab-pill"
                        className="lp-neu-pill absolute inset-0 rounded-xl"
                        transition={PILL_SPRING}
                      />
                    )}
                    <Code2 size={13} className="relative z-10 text-gold" />
                    <span className="relative z-10">{refItem.fileName}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Reference Module Split View */}
            <motion.div
              key={activeRef.id}
              initial={{ opacity: 0.6, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mt-6 grid gap-6 lg:grid-cols-12"
            >
              {/* Left 5 Cols: Architectural Context & Verified Internet Sources */}
              <div className="flex flex-col justify-between lg:col-span-5">
                <div>
                  <span className="lp-neu-socket gap-2 px-3 py-1 font-mono text-[11.5px] font-semibold text-gold">
                    <StatusDot tone="ok" />
                    {activeRef.badge}
                  </span>

                  <h3 className="mt-3.5 font-display text-[22px] font-semibold leading-snug text-ink">
                    {activeRef.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
                    {activeRef.summary}
                  </p>

                  {/* Upstream GitHub Source & Spec Cards */}
                  <div className="mt-5 space-y-2.5">
                    <a
                      href={activeRef.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lp-neu-btn flex items-center justify-between gap-3 p-3.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[10.5px] uppercase tracking-wider text-gold">
                          Primary Upstream Repository
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-ink">
                          github.com/{activeRef.repoLabel}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
                          {activeRef.upstreamPath}
                        </p>
                      </div>
                      <span className="lp-neu-socket size-9 shrink-0 text-ink">
                        <ExternalLink size={14} />
                      </span>
                    </a>

                    <a
                      href={activeRef.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lp-neu-btn flex items-center justify-between gap-3 p-3.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                          Protocol Specification &amp; Docs
                        </p>
                        <p className="mt-0.5 truncate font-display text-[14px] font-semibold text-ink">
                          {activeRef.docLabel}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-mute">
                          {activeRef.docUrl}
                        </p>
                      </div>
                      <span className="lp-neu-socket size-9 shrink-0 text-mute">
                        <ArrowUpRight size={15} />
                      </span>
                    </a>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  <motion.button
                    type="button"
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => focusEmbeddedConsole(activeRef.targetView)}
                    className="lp-neu-cta inline-flex h-9 items-center gap-2 px-4 text-[12px] font-semibold"
                  >
                    <span>Open {VIEW_LABELS[activeRef.targetView]} Module</span>
                    <ArrowUpRight size={13.5} />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleCopyRefCode(activeRef)}
                    className="lp-neu-btn inline-flex h-9 items-center gap-1.5 px-3.5 font-mono text-[11.5px] font-medium"
                  >
                    {copiedRefId === activeRef.id ? (
                      <>
                        <Check size={13} className="text-ok" />
                        <span className="text-ok">Copied Snippet</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} className="text-gold" />
                        <span>Copy Reference Code</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Right 7 Cols: Recessed Sumi-Ink Reference Code Terminal */}
              <div className="lg:col-span-7">
                <div className="lp-neu-well overflow-hidden rounded-2xl border border-line bg-[#11100f] text-[#ebe6dd]">
                  {/* Code Window Top Chrome */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#181614] px-4 py-2.5 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#86b58f]" />
                      <span className="font-semibold text-[#f4efe6]">{activeRef.fileName}</span>
                      <span className="text-[#ada59a]">· {activeRef.repoLabel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={activeRef.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#dfc08e] hover:underline"
                      >
                        <span>GitHub Source</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* Numbered Code Lines */}
                  <div className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.65]">
                    <pre className="m-0">
                      <code>
                        {activeRef.code.split("\n").map((line, i) => (
                          <div key={i} className="table-row">
                            <span className="table-cell pr-4 text-right select-none text-[#6e675f] num">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span
                              className={cn(
                                "table-cell whitespace-pre",
                                line.trim().startsWith("//")
                                  ? "text-[#dfc08e]"
                                  : line.includes("import ") || line.includes("export ")
                                    ? "text-[#d9cfc0]"
                                    : "text-[#ebe6dd]",
                              )}
                            >
                              {line}
                            </span>
                          </div>
                        ))}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Bottom 4-Column Internet Ecosystem Directory */}
            <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  name: "kolbytn/mindcraft",
                  role: "Multi-Agent LLM Coordinator",
                  url: "https://github.com/kolbytn/mindcraft",
                },
                {
                  name: "PrismarineJS/mineflayer",
                  role: "20 Hz Node.js Bot Runtime",
                  url: "https://github.com/PrismarineJS/mineflayer",
                },
                {
                  name: "mineflayer-pathfinder",
                  role: "3D Voxel A* Navigation",
                  url: "https://github.com/PrismarineJS/mineflayer-pathfinder",
                },
                {
                  name: "Sponge .schem Spec v3",
                  role: "NBT Schematic Standard",
                  url: "https://github.com/SpongePowered/Schematic-Specification",
                },
              ].map((src) => (
                <a
                  key={src.name}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-neu-well group flex items-center justify-between gap-2 px-3.5 py-2.5 transition-colors hover:border-line-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11.5px] font-semibold text-ink group-hover:text-gold">
                      {src.name}
                    </p>
                    <p className="truncate text-[11px] text-mute">{src.role}</p>
                  </div>
                  <ExternalLink size={12.5} className="shrink-0 text-faint group-hover:text-gold" />
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: Tactile Cluster Node & Dispatch Sandbox (#dispatch) ── */}
        <motion.section
          id="dispatch"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          className="scroll-mt-24 py-14 lg:py-20"
        >
          <div className="lp-glass-card grid gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:p-10">
            <div className="lg:col-span-5">
              <span className="lp-neu-socket gap-2 px-3 py-1 font-mono text-[11.5px] font-semibold text-ink">
                <StatusDot tone="ok" />
                Live Dispatch Deck
              </span>
              <h2
                className="mt-3 font-display font-semibold text-ink"
                style={{ fontSize: "clamp(1.5rem, 2.3vw, 2.1rem)", lineHeight: 1.18, letterSpacing: "-0.02em" }}
              >
                Bind your world socket or dispatch an order to ENI1.
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-mute">
                Test-configure the target Minecraft Java endpoint and send an immediate supervisor command into the console
                scrollback. Orders are validated before hitting the MindServer bridge.
              </p>

              <div className="mt-6 space-y-2.5 pt-2 text-[12.5px] text-mute">
                <div className="lp-neu-well flex items-center gap-3 px-3.5 py-2.5">
                  <Compass size={15} className="shrink-0 text-ink" />
                  <span>Supports vanilla 26.1 or cross-version worlds through ViaProxy</span>
                </div>
                <div className="lp-neu-well flex items-center gap-3 px-3.5 py-2.5">
                  <Shield size={15} className="shrink-0 text-ink" />
                  <span>Respects shared inventory locks when an agent is mid-combat</span>
                </div>
                <div className="lp-neu-well flex items-center gap-3 px-3.5 py-2.5">
                  <Terminal size={15} className="shrink-0 text-ink" />
                  <span>Full journald and command history inside the console dock</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleClusterSubmit} noValidate className="flex flex-col justify-between lg:col-span-7">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="landing-host" className="block text-[12px] font-medium text-ink">
                    Minecraft Server Host
                  </label>
                  <input
                    id="landing-host"
                    type="text"
                    value={hostInput}
                    aria-invalid={formError?.field === "host" || undefined}
                    onChange={(e) => {
                      setHostInput(e.target.value);
                      if (formError?.field === "host") setFormError(null);
                    }}
                    placeholder="127.0.0.1 or play.example.net"
                    className={cn(
                      "lp-neu-well mt-1.5 h-10 w-full px-3.5 font-mono text-[13px] text-ink placeholder:text-faint focus:outline-none",
                      formError?.field === "host" && "border-danger",
                    )}
                  />
                </div>

                <div>
                  <label htmlFor="landing-port" className="block text-[12px] font-medium text-ink">
                    TCP Port
                  </label>
                  <input
                    id="landing-port"
                    type="text"
                    inputMode="numeric"
                    value={portInput}
                    aria-invalid={formError?.field === "port" || undefined}
                    onChange={(e) => {
                      setPortInput(e.target.value);
                      if (formError?.field === "port") setFormError(null);
                    }}
                    placeholder="56730"
                    className={cn(
                      "lp-neu-well num mt-1.5 h-10 w-full px-3.5 font-mono text-[13px] text-ink placeholder:text-faint focus:outline-none",
                      formError?.field === "port" && "border-danger",
                    )}
                  />
                </div>

                <div className="sm:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="landing-command" className="block text-[12px] font-medium text-ink">
                      Initial ENI1 Supervisor Order
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-faint">Tactile Presets:</span>
                      {["/home base", "/spawn", "status", "/server lifesteal"].map((presetCmd) => (
                        <button
                          key={presetCmd}
                          type="button"
                          data-active={commandInput === presetCmd}
                          onClick={() => {
                            setCommandInput(presetCmd);
                            if (formError?.field === "command") setFormError(null);
                          }}
                          className="lp-neu-btn rounded-lg px-2.5 py-1 font-mono text-[11px]"
                        >
                          {presetCmd}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="landing-command"
                    type="text"
                    value={commandInput}
                    aria-invalid={formError?.field === "command" || undefined}
                    onChange={(e) => {
                      setCommandInput(e.target.value);
                      if (formError?.field === "command") setFormError(null);
                    }}
                    placeholder="/home base"
                    className={cn(
                      "lp-neu-well mt-2 h-10 w-full px-3.5 font-mono text-[13px] text-ink placeholder:text-faint focus:outline-none",
                      formError?.field === "command" && "border-danger",
                    )}
                  />
                </div>
              </div>

              {formError && (
                <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">
                  {formError.message}
                </p>
              )}

              {dispatchSuccess && !formError && (
                <div
                  role="status"
                  className="lp-neu-well mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[12.5px] text-ink"
                >
                  <span className="inline-flex items-center gap-2">
                    <Check size={14} className="text-ok" />
                    {dispatchSuccess}
                  </span>
                  <button
                    type="button"
                    onClick={() => focusEmbeddedConsole("fleet")}
                    className="font-mono text-[11.5px] font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink"
                  >
                    View in Console →
                  </button>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
                <p className="font-mono text-[11.5px] text-faint num">
                  MindServer Port: {settings.mindserver_port || "8080"} · Auth: {settings.auth}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <motion.button
                    type="submit"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="lp-neu-btn inline-flex h-10 items-center gap-2 px-4 text-[12.5px] font-semibold"
                  >
                    <Play size={13} className="text-ok" />
                    <span>Stage &amp; Dispatch Order</span>
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => focusEmbeddedConsole("fleet")}
                    className="lp-neu-cta inline-flex h-10 items-center gap-2 px-4 text-[12.5px] font-semibold"
                  >
                    <span>Focus Live Console</span>
                    <ArrowUpRight size={14} />
                  </motion.button>
                </div>
              </div>
            </form>
          </div>
        </motion.section>
      </main>

      {/* ── Architectural Sanctuary Colophon & Live Telemetry Ledger Footer ── */}
      <footer className="relative z-10 mt-6 pb-10 pt-6">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-10">
          <div className="lp-glass-card overflow-hidden p-5 sm:p-7 lg:p-9">
            {/* Part A: Recessed Hardware Telemetry Ribbon & Zenith Return */}
            <div className="lp-neu-well flex flex-wrap items-center justify-between gap-4 px-4 py-3 font-mono text-[11px] num">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="inline-flex items-center gap-2 text-ink">
                  <StatusDot tone="ok" />
                  <span className="text-faint">WORLD SOCKET</span>
                  <strong>{clusterTarget}</strong>
                </span>
                <span className="hidden items-center gap-2 text-mute sm:inline-flex">
                  <span className="text-faint">MINDSERVER</span>
                  <span className="text-ink">:{settings.mindserver_port || "8080"}</span>
                </span>
                <span className="hidden items-center gap-2 text-mute md:inline-flex">
                  <span className="text-faint">SHIM BRIDGE</span>
                  <span className="text-ink">:8091 · p95 {p95Latency} ms</span>
                </span>
                <span className="hidden items-center gap-2 text-mute lg:inline-flex">
                  <span className="text-faint">GUARD LOOP</span>
                  <span className="text-ok">20 Hz ({armedModulesCount} Armed)</span>
                </span>
              </div>

              <motion.button
                type="button"
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="lp-neu-btn inline-flex h-8 items-center gap-1.5 px-3 font-mono text-[11px] font-semibold text-ink"
              >
                <span>Return to Zenith</span>
                <ArrowUp size={12.5} className="text-gold" />
              </motion.button>
            </div>

            {/* Part B: 12-Column Architectural Colophon Matrix */}
            <div className="mt-7 grid gap-8 lg:grid-cols-12">
              {/* Columns 1–5: Sanctuary Seal, Editorial Colophon & One-Tap Supervisor Ping */}
              <div className="flex flex-col justify-between lg:col-span-5">
                <div>
                  <div className="flex items-start gap-4">
                    <div className="lp-neu-socket relative size-14 shrink-0 p-2">
                      <Crest size={40} />
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -bottom-1 rounded-md border border-line-2 bg-panel px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-gold"
                      >
                        夜桜
                      </span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">
                          Yozakura / ENI-01
                        </h2>
                        <span className="lp-neu-well px-2 py-0.5 font-mono text-[10px] text-gold">
                          v0.1.4 · JAVA 26.1
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-faint">
                        MINDCRAFT AUTONOMOUS SANCTUARY &amp; SUPERVISOR
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 max-w-[46ch] text-[13px] leading-relaxed text-mute">
                    Crafted with warm sumi-ink and unbleached kinari-paper surfaces. High-level LLM cognition is
                    decoupled from deterministic 50 ms Mineflayer survival reflexes.
                  </p>
                </div>

                {/* Interactive One-Tap Supervisor Ping Bar */}
                <div className="lp-neu-well mt-5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                      Quick Terminal Ping → ENI1
                    </span>
                    {footerPingNotice && (
                      <span className="font-mono text-[10.5px] text-ok">{footerPingNotice}</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(["status", "/home base", "/spawn", "save-all"] as const).map((cmd) => (
                      <motion.button
                        key={cmd}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          runCommand(cmd);
                          setFooterPingNotice(`Sent "${cmd}"`);
                          toast({
                            title: "Footer ping dispatched",
                            detail: `${cmd} → ${clusterTarget}`,
                            tone: "ok",
                          });
                        }}
                        className="lp-neu-btn inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] text-ink"
                      >
                        <Terminal size={11} className="text-gold" />
                        <span>{cmd}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Columns 6–9: Indexed Console Module Matrix (M-01 to M-06) */}
              <div className="lg:col-span-4">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Supervisor Console Matrix</p>
                  <span className="font-mono text-[10.5px] text-faint num">6 MODULES</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: "fleet" as const, code: "M-01", label: "Fleet", meta: `${activeBotsCount}/${totalBotsCount} Active` },
                      { id: "grind" as const, code: "M-02", label: "Grind", meta: "Pathfinder" },
                      { id: "build" as const, code: "M-03", label: "Build", meta: "4 .schem" },
                      { id: "addons" as const, code: "M-04", label: "Add-ons", meta: `${armedModulesCount} Armed` },
                      { id: "providers" as const, code: "M-05", label: "Providers", meta: `${enabledProvidersCount} Routes` },
                      { id: "settings" as const, code: "M-06", label: "Settings", meta: "Socket" },
                    ] as const
                  ).map((mod) => {
                    const active = view === mod.id;
                    return (
                      <motion.button
                        key={mod.id}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        data-active={active}
                        onClick={() => focusEmbeddedConsole(mod.id)}
                        className="lp-neu-btn flex flex-col justify-between p-2.5 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-gold num">{mod.code}</span>
                          <ArrowUpRight size={11.5} className="text-faint" />
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between gap-1">
                          <span className="font-display text-[14px] font-semibold text-ink">{mod.label}</span>
                          <span className="truncate font-mono text-[10px] text-mute num">{mod.meta}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Columns 10–12: Sanctuary World Sector Postcard & Atmosphere Rocker */}
              <div className="flex flex-col justify-between lg:col-span-3">
                <div>
                  <p className="eyebrow">Active Sanctuary Sector</p>
                  <div className="lp-neu-well relative mt-3 h-32 w-full overflow-hidden rounded-xl bg-[#141311]">
                    <img
                      src={selectedPreset.image}
                      alt={selectedPreset.title}
                      className="size-full object-cover"
                      style={{ objectPosition: selectedPreset.focalPoint }}
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(12,11,10,0.12) 0%, rgba(12,11,10,0.86) 100%)",
                      }}
                    />
                    <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2 text-[#f4efe6]">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[9.5px] uppercase tracking-wider text-[#dfc08e]">
                          {selectedPreset.fileName}
                        </p>
                        <p className="truncate font-display text-[13.5px] font-semibold">
                          {selectedPreset.title}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9.5px] text-[#c7bfb4] num">
                        {fmtInt(selectedPreset.totalBlocks)} blk
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dual-Mode World Atmosphere Rocker */}
                <div className="lp-neu-well mt-3 grid grid-cols-2 gap-1.5 p-1.5">
                  <button
                    type="button"
                    data-active={theme === "yozakura"}
                    onClick={() => {
                      if (theme !== "yozakura") toggleTheme();
                    }}
                    className="lp-neu-btn flex items-center justify-center gap-1.5 py-2 font-mono text-[11px] font-medium"
                  >
                    <MoonStar size={12.5} className="text-gold" />
                    <span>夜 Yozakura</span>
                  </button>
                  <button
                    type="button"
                    data-active={theme === "hanami"}
                    onClick={() => {
                      if (theme !== "hanami") toggleTheme();
                    }}
                    className="lp-neu-btn flex items-center justify-center gap-1.5 py-2 font-mono text-[11px] font-medium"
                  >
                    <SunMedium size={12.5} className="text-gold" />
                    <span>昼 Hanami</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Part C: Engraved Hardware Serial, Upstream GitHub Citations & Section Index Bar */}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 font-mono text-[11px] text-faint">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-ink">SERIAL · ENI-01-YOZAKURA</span>
                <span aria-hidden="true">·</span>
                <a
                  href="https://github.com/kolbytn/mindcraft"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold"
                >
                  MINDCRAFT
                </a>
                <span aria-hidden="true">+</span>
                <a
                  href="https://github.com/PrismarineJS/mineflayer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold"
                >
                  MINEFLAYER 4.20
                </a>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">KEYS ISOLATED IN KEYS.JSON</span>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {NAV_LINKS.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="transition-colors hover:text-ink"
                  >
                    {item.code}.{item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
