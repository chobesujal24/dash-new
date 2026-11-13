import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_PIN,
  adaptBots,
  adaptBuild,
  adaptGrind,
  adaptLoadout,
  adaptProviders,
  adaptThreats,
  liveEffective,
  parseUptimeSeconds,
  resolveBotProfile,
  seedSeries,
  settingsPatch,
  validateClusterDispatch,
  verifyDashboardPin,
} from "./adapters";
import { SCHEMATIC_PRESETS, bearingCompass, fmtBytes, fmtDuration, fmtTokens, layerElevation, layerOf } from "./model";
import { buildRemoteLogoUrls, parseEndpointHost, resolveProviderIdentity } from "./provider-identity";
import { ADDON_SVGS } from "../assets/embedded/addon-svgs";
import { PROVIDER_SVGS } from "../assets/embedded/provider-svgs";

describe("Yozakura pure logic & data adapters", () => {
  it("parseUptimeSeconds parses compact supervisor durations and handles edge cases", () => {
    assert.equal(parseUptimeSeconds("14d 6h"), 14 * 86_400 + 6 * 3_600);
    assert.equal(parseUptimeSeconds("3h 04m"), 3 * 3_600 + 4 * 60);
    assert.equal(parseUptimeSeconds("5m 06s"), 5 * 60 + 6);
    assert.equal(parseUptimeSeconds("7s"), 7);
    assert.equal(parseUptimeSeconds(null), null);
    assert.equal(parseUptimeSeconds(""), null);
    assert.equal(parseUptimeSeconds("invalid"), null);
  });

  it("layerOf computes 1-based schematic layer within [1, layers]", () => {
    assert.equal(layerOf({ placed: 0, totalBlocks: 2048, layers: 12 }), 1);
    assert.equal(layerOf({ placed: 1024, totalBlocks: 2048, layers: 12 }), 7);
    assert.equal(layerOf({ placed: 2048, totalBlocks: 2048, layers: 12 }), 12);
    assert.equal(layerOf({ placed: 9999, totalBlocks: 2048, layers: 12 }), 12);
    assert.equal(layerOf({ placed: 0, totalBlocks: 0, layers: 0 }), 1);
  });

  it("bearingCompass converts radians to 0..359 degrees and 8-point cardinal labels", () => {
    assert.deepEqual(bearingCompass(0), { deg: 0, label: "N" });
    assert.deepEqual(bearingCompass(Math.PI / 2), { deg: 90, label: "E" });
    assert.deepEqual(bearingCompass(Math.PI), { deg: 180, label: "S" });
    assert.deepEqual(bearingCompass(-Math.PI / 2), { deg: 270, label: "W" });
  });

  it("adaptProviders preserves contextWindow, contextUsed, tokensPerSec, and baseline latency", () => {
    const adapted = adaptProviders({
      providers: [
        {
          id: "nvidia-1",
          name: "NVIDIA NIM",
          baseURL: "https://integrate.api.nvidia.com/v1",
          keyName: "NVIDIA_API_KEY",
          model: "qwen/qwen3.5-397b-a17b",
          timeoutMs: 30000,
          keyConfigured: true,
          enabled: true,
          contextWindow: 128000,
          contextUsed: 18420,
          tokensPerSec: 34.2,
          lastLatencyMs: 218,
        },
      ],
    });
    assert.equal(adapted.length, 1);
    assert.equal(adapted[0].contextWindow, 128000);
    assert.equal(adapted[0].contextUsed, 18420);
    assert.equal(adapted[0].tokensPerSec, 34.2);
    assert.equal(adapted[0].latencyMs, 218);
  });

  it("adaptLoadout normalizes live inventory and balance", () => {
    assert.deepEqual(adaptLoadout({ totems: 3, gapples: 19, egapples: 2, balance: "$184,920" }), {
      totems: 3,
      gapples: 19,
      egapples: 2,
      balance: "$184,920",
    });
    assert.deepEqual(adaptLoadout(undefined), {
      totems: 0,
      gapples: 0,
      egapples: 0,
      balance: "$0",
    });
  });

  it("adaptGrind and adaptBuild move terminal current jobs into history", () => {
    const grind = adaptGrind({
      current: {
        id: "g-1",
        target: "diamond_ore",
        requested: 64,
        completed: 64,
        status: "completed",
        createdAt: 1000,
        updatedAt: 2000,
        message: "Done",
      },
      queue: [],
      history: [],
    });
    assert.equal(grind.current, null);
    assert.equal(grind.history.length, 1);
    assert.equal(grind.history[0].id, "g-1");

    const build = adaptBuild({
      agentName: "Builder",
      current: {
        id: "b-1",
        fileName: "schem-1.schem",
        sourceName: "watchtower.schem",
        status: "cancelled",
        totalBlocks: 500,
        placed: 120,
        skipped: 0,
        nextIndex: 120,
        size: { x: 10, y: 12, z: 10 },
        createdAt: 1000,
        updatedAt: 2000,
        origin: { x: 0, y: 64, z: 0 },
        rotation: 90,
        replaceBlocks: false,
        materials: { stone_bricks: 300 },
        missing: ["stone_bricks"],
        message: "Stopped",
      },
      history: [],
    });
    assert.equal(build.current, null);
    assert.equal(build.history.length, 1);
    assert.equal(build.history[0].name, "Watchtower");
    assert.equal(build.history[0].materials[0].missing, true);
  });

  it("adaptThreats computes relative bearings from ENI1 origin", () => {
    const threats = adaptThreats(
      [{ username: "kuro_99", distance: 10, x: -412, y: 64, z: 185, heldItem: "netherite_sword", isSneaking: true }],
      { x: -412, z: 175 },
    );
    assert.equal(threats.length, 1);
    assert.equal(threats[0].username, "kuro_99");
    assert.equal(threats[0].sneaking, true);
    assert.equal(threats[0].bearing, 0);
  });

  it("seedSeries produces a deterministic positive series ending at current", () => {
    const series = seedSeries(240, 25, 16);
    assert.equal(series.length, 16);
    assert.equal(series[series.length - 1], 240);
    assert.ok(series.every((n) => n >= 1));
  });

  it("formatters and settingsPatch handle edge cases cleanly", () => {
    assert.equal(fmtBytes(null), "—");
    assert.equal(fmtBytes(1024 * 1024 * 256), "256.0 MiB");
    assert.equal(fmtTokens(128000), "128.0k");
    assert.equal(fmtDuration(65000), "1m 05s");

    const patch = settingsPatch({
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
      only_chat_with: "alice, bob , ",
      via_proxy_enabled: false,
      via_proxy_host: "127.0.0.1",
      via_proxy_port: "25568",
      via_proxy_client_version: "26.1",
    });
    assert.deepEqual(patch.only_chat_with, ["alice", "bob"]);
    assert.equal(patch.port, 56730);

    const eff = liveEffective(
      {
        minecraft_version: "26.1",
        host: "10.0.0.5",
        port: "25565",
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
      },
      { host: "127.0.0.1", port: 56730, version: "26.1", auth: "offline", overrides: { port: "env" } },
    );
    assert.equal(eff.host, "10.0.0.5");
    assert.equal(eff.port, 56730);
  });

  it("layerElevation computes worldY, blocksPerLayer, and layer completion state", () => {
    const job = { placed: 1200, totalBlocks: 2400, layers: 12, origin: { x: 152, y: 68, z: 6 } };
    const active = layerElevation(job, null);
    assert.equal(active.layer, 7);
    assert.equal(active.totalLayers, 12);
    assert.equal(active.worldY, 74);
    assert.equal(active.blocksPerLayer, 200);
    assert.equal(active.state, "active");

    const lower = layerElevation(job, 3);
    assert.equal(lower.layer, 3);
    assert.equal(lower.worldY, 70);
    assert.equal(lower.state, "completed");

    const upper = layerElevation(job, 11);
    assert.equal(upper.layer, 11);
    assert.equal(upper.worldY, 78);
    assert.equal(upper.state, "pending");

    assert.equal(SCHEMATIC_PRESETS.length, 4);
    assert.equal(SCHEMATIC_PRESETS[0].id, "hanami_pavilion");
    const uniqueImages = new Set(SCHEMATIC_PRESETS.map((p) => p.image));
    assert.equal(uniqueImages.size, 4);
    for (const preset of SCHEMATIC_PRESETS) {
      assert.ok(preset.image.length > 0);
      assert.ok(preset.biome.length > 0);
    }
  });

  it("resolveProviderIdentity auto-detects known AI APIs and custom domains from pasted URLs", () => {
    const openai = resolveProviderIdentity({ baseURL: "https://api.openai.com/v1" });
    assert.equal(openai.isKnown, true);
    assert.equal(openai.key, "openai");
    assert.equal(openai.brandName, "OpenAI");
    assert.equal(openai.suggestedKeyName, "OPENAI_API_KEY");
    assert.equal(openai.suggestedModel, "gpt-4o");

    const groq = resolveProviderIdentity({ baseURL: "https://api.groq.com/openai/v1" });
    assert.equal(groq.isKnown, true);
    assert.equal(groq.key, "groq");
    assert.equal(groq.brandName, "Groq");
    assert.equal(groq.suggestedKeyName, "GROQ_API_KEY");

    const ollama = resolveProviderIdentity({ baseURL: "http://127.0.0.1:11434/v1" });
    assert.equal(ollama.isKnown, true);
    assert.equal(ollama.key, "ollama");
    assert.equal(ollama.brandName, "Ollama");

    const custom = resolveProviderIdentity({ baseURL: "https://api.sambanova.ai/v1" });
    assert.equal(custom.isKnown, false);
    assert.equal(custom.rootDomain, "sambanova.ai");
    assert.equal(custom.brandSlug, "sambanova");
    assert.equal(custom.suggestedKeyName, "SAMBANOVA_API_KEY");
    assert.ok(custom.remoteLogoUrls.length >= 3);
    assert.ok(custom.remoteLogoUrls.some((u) => u.includes("sambanova")));

    const parsed = parseEndpointHost("api.deepseek.com/v1");
    assert.equal(parsed.hostname, "api.deepseek.com");
    assert.equal(parsed.rootDomain, "deepseek.com");
    assert.equal(parsed.brandSlug, "deepseek");
    assert.ok(buildRemoteLogoUrls("deepseek.com", "deepseek").length >= 4);
  });

  it("embedded addon and provider SVG registries contain valid vector markup", () => {
    assert.ok(Object.keys(ADDON_SVGS).length >= 21);
    assert.ok(ADDON_SVGS.auto_totem.d.length > 50);
    assert.ok(Object.keys(PROVIDER_SVGS).length >= 25);
    assert.ok(PROVIDER_SVGS.gemini.svg.includes("<svg"));
    assert.ok(PROVIDER_SVGS.openai.svg.includes("<svg"));
  });

  it("resolveBotProfile and adaptBots assign Minecraft AI roles and studio portraits", () => {
    assert.deepEqual(resolveBotProfile("ENI1", 0), {
      avatarKey: "eni",
      role: "Foreman · AI Commander",
    });
    assert.deepEqual(resolveBotProfile("Scout", 1), {
      avatarKey: "grinder",
      role: "Vanguard · Perimeter & Combat",
    });
    assert.deepEqual(resolveBotProfile("DeepMiner", 2), {
      avatarKey: "miner",
      role: "Excavator · Ore Specialist",
    });
    assert.deepEqual(resolveBotProfile("Builder", 3), {
      avatarKey: "builder",
      role: "Architect · Schematic Builder",
    });
    const bots = adaptBots({
      bots: [
        { id: "eni1", name: "ENI1", health: 20, food: 20, x: 0, y: 64, z: 0, dimension: "minecraft:overworld", ping: 32, activity: "Ready", state: "active" },
        { id: "scout", name: "Scout", health: 14, food: 9, x: 10, y: 64, z: 12, dimension: "minecraft:overworld", ping: 41, activity: "Patrol", state: "warning" },
        { id: "miner1", name: "DeepMiner", health: 18, food: 19, x: 10, y: -54, z: 12, dimension: "minecraft:the_nether", ping: 38, activity: "Mining", state: "active" },
      ],
      profiles: [],
      activeProfile: "",
    });
    assert.equal(bots[0].avatar, "/src/assets/images/yozakura_avatar_eni_1794487237022.jpg");
    assert.equal(bots[0].role, "Foreman · AI Commander");
    assert.equal(bots[1].avatar, "/src/assets/images/yozakura_avatar_scout_1794487237138.jpg");
    assert.equal(bots[1].role, "Vanguard · Perimeter & Combat");
    assert.equal(bots[2].avatar, "/src/assets/images/yozakura_avatar_miner_1794487239226.jpg");
    assert.equal(bots[2].role, "Excavator · Ore Specialist");
  });

  it("validateClusterDispatch validates host, TCP port, and MindServer dispatch command", () => {
    const valid = validateClusterDispatch({
      host: "127.0.0.1",
      port: "56730",
      command: "/home base",
    });
    assert.deepEqual(valid, {
      ok: true,
      host: "127.0.0.1",
      port: 56730,
      command: "/home base",
    });

    const badHost = validateClusterDispatch({
      host: "invalid host name",
      port: "56730",
      command: "/home base",
    });
    assert.equal(badHost.ok, false);
    if (!badHost.ok) assert.equal(badHost.field, "host");

    const badPort = validateClusterDispatch({
      host: "127.0.0.1",
      port: "99999",
      command: "/home base",
    });
    assert.equal(badPort.ok, false);
    if (!badPort.ok) assert.equal(badPort.field, "port");

    const badCmd = validateClusterDispatch({
      host: "127.0.0.1",
      port: "56730",
      command: "   ",
    });
    assert.equal(badCmd.ok, false);
    if (!badCmd.ok) assert.equal(badCmd.field, "command");
  });

  it("verifyDashboardPin grants access only for 2010 and never leaks the code in error messages", () => {
    assert.equal(DASHBOARD_PIN, "2010");
    assert.deepEqual(verifyDashboardPin("2010"), { ok: true });
    assert.deepEqual(verifyDashboardPin(" 2010 "), { ok: true });

    const shortPin = verifyDashboardPin("201");
    assert.equal(shortPin.ok, false);
    if (!shortPin.ok) {
      assert.equal(shortPin.reason, "incomplete");
      assert.equal(shortPin.message.includes("2010"), false);
      assert.equal(/pin/i.test(shortPin.message), false);
    }

    const wrongPin = verifyDashboardPin("1234");
    assert.equal(wrongPin.ok, false);
    if (!wrongPin.ok) {
      assert.equal(wrongPin.reason, "invalid");
      assert.equal(wrongPin.message.includes("2010"), false);
      assert.equal(/pin/i.test(wrongPin.message), false);
    }
  });
});



