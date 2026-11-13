import { useEffect, useId, useState } from "react";
import { FALLBACK_AVATARS, HERO, blockTexture } from "../assets";
import { ADDON_SVGS } from "../assets/embedded/addon-svgs";
import { PROVIDER_SVGS } from "../assets/embedded/provider-svgs";
import { resolveProviderIdentity } from "../data/provider-identity";
import { AnimatePresence, motion } from "framer-motion";
import { useConsole } from "../state/store";
import { cn } from "../utils/cn";

/* Every piece of art has a drawn fallback, so a missing texture never shows as
   a broken image. */

/* ── Brand crest ───────────────────────────────────────── */

/* The petal points up from the flower's centre at (0, 0). Real sakura petals
   carry a small notch at the tip, which is what separates this from a generic
   five-petal flower. */
const PETAL =
  "M0 -4.6C-5.4 -7.6 -10.6 -14.2 -10.4 -21.4C-10.2 -26.6 -7 -30.2 -3.4 -30.4L0 -26.4L3.4 -30.4C7 -30.2 10.2 -26.6 10.4 -21.4C10.6 -14.2 5.4 -7.6 0 -4.6Z";

/** Brand mark: a notched cherry blossom on a softly lit tile. Theme-aware. */
export function Crest({ size = 34, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Yozakura" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`crest-lit-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="97" rx="24" style={{ fill: "var(--panel-2)", stroke: "var(--line-2)" }} strokeWidth="2" />
      <rect x="1.5" y="1.5" width="97" height="97" rx="24" fill={`url(#crest-lit-${id})`} />
      <g transform="translate(50 51) rotate(-18)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d={PETAL} style={{ fill: "var(--rose)" }} />
            <path d="M0 -8.5V-21" style={{ stroke: "var(--on-rose)" }} strokeOpacity="0.28" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        ))}
        {[36, 108, 180, 252, 324].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`} style={{ stroke: "var(--gold)", fill: "var(--gold)" }}>
            <path d="M0 -4V-10.5" strokeWidth="1.4" strokeLinecap="round" />
            <circle cy="-11.6" r="1.7" stroke="none" />
          </g>
        ))}
        <circle r="4.6" style={{ fill: "var(--gold)" }} />
      </g>
    </svg>
  );
}

/* ── Minecraft block ───────────────────────────────────── */

/** Base colour and optional ore fleck, used only when a texture is missing. */
const TINT: Record<string, [string, string?]> = {
  ancient_debris: ["#6b4a44", "#a9806f"],
  diamond_ore: ["#7d8087", "#5fd6d0"],
  emerald_ore: ["#7d8087", "#3fc56f"],
  gold_ore: ["#7d8087", "#e7c54a"],
  iron_ore: ["#7d8087", "#d3a98a"],
  copper_ore: ["#7d8087", "#d9824f"],
  coal_ore: ["#7d8087", "#2b2b2e"],
  redstone_ore: ["#7d8087", "#d8362f"],
  lapis_ore: ["#7d8087", "#3760c9"],
  nether_quartz_ore: ["#7a3131", "#e6ddd3"],
  nether_gold_ore: ["#7a3131", "#e7c54a"],
  oak_log: ["#7a5c36"],
  birch_log: ["#d8d2c0"],
  spruce_log: ["#4d3722"],
  jungle_log: ["#6b5a2c"],
  acacia_log: ["#7a5548"],
  dark_oak_log: ["#3b2a18"],
  mangrove_log: ["#6a3b34"],
  cherry_log: ["#4a2a35", "#e7a9bb"],
  stone: ["#7d8087"],
  cobblestone: ["#6f7278"],
  netherrack: ["#7a3131"],
  dirt: ["#7b563a"],
  sand: ["#dccf9f"],
  gravel: ["#85807c"],
  wheat: ["#c9a24a"],
  carrots: ["#e3852b"],
  potatoes: ["#c9a45a"],
  beetroots: ["#9c2f3f"],
  sugar_cane: ["#7fb24c"],
};

const FLECKS: [number, number][] = [[8, 17], [11, 23], [21, 21], [24.5, 15.5], [15, 8], [20, 10.5]];

export function BlockIcon({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const src = blockTexture(name);
  if (src) {
    return <img src={src} alt="" draggable={false} className={cn("shrink-0 select-none", className)} style={{ width: size, height: size }} />;
  }
  const [base, fleck] = TINT[name] ?? ["#7d8087"];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cn("shrink-0", className)}>
      <polygon points="16,3 29,9.5 16,16 3,9.5" style={{ fill: `color-mix(in oklab, ${base}, white 18%)` }} />
      <polygon points="3,9.5 16,16 16,29.5 3,23" style={{ fill: base }} />
      <polygon points="29,9.5 16,16 16,29.5 29,23" style={{ fill: `color-mix(in oklab, ${base}, black 26%)` }} />
      {fleck && FLECKS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="2.4" height="2.4" fill={fleck} opacity="0.85" />)}
    </svg>
  );
}

/* ── Agent portrait ────────────────────────────────────── */

function resolveAgentKind(name: string): {
  key: "eni" | "miner" | "grinder" | "builder";
  badgeSvg: string;
  visorColor: string;
} {
  const lower = name.toLowerCase();
  if (
    lower.includes("grind") ||
    lower.includes("scout") ||
    lower.includes("recon") ||
    lower.includes("patrol") ||
    lower.includes("guard") ||
    lower.includes("combat")
  ) {
    return { key: "grinder", badgeSvg: "cps_booster", visorColor: "#e7c54a" };
  }
  if (lower.includes("miner") || lower.includes("excavat") || lower.includes("dig")) {
    return { key: "miner", badgeSvg: "grind_worker", visorColor: "#5fd6d0" };
  }
  if (lower.includes("build") || lower.includes("arch") || lower.includes("schem")) {
    return { key: "builder", badgeSvg: "schematic_builder", visorColor: "#f0927e" };
  }
  return { key: "eni", badgeSvg: "auto_totem", visorColor: "#d9a5a9" };
}

export function Portrait({ name, src, size = 40, className }: { name: string; src?: string; size?: number; className?: string }) {
  const borderRadius = Math.round(size * 0.22);
  const kind = resolveAgentKind(name);
  const fallbackSrc = FALLBACK_AVATARS[kind.key];
  const [stage, setStage] = useState<"primary" | "fallback" | "svg">("primary");

  useEffect(() => {
    setStage("primary");
  }, [src, name]);

  const activeSrc = stage === "primary" ? src ?? fallbackSrc : stage === "fallback" ? fallbackSrc : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex shrink-0 select-none overflow-hidden border border-line-2 bg-panel-2", className)}
      style={{ width: size, height: size, borderRadius }}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setStage((s) => (s === "primary" && fallbackSrc && fallbackSrc !== src ? "fallback" : "svg"))}
          className="size-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
          <rect width="32" height="32" fill="var(--panel-3)" />
          <rect x="6" y="6" width="20" height="20" rx="2" fill="var(--panel-2)" stroke="var(--line-2)" strokeWidth="1.5" />
          <rect x="8" y="12" width="16" height="5" fill={kind.visorColor} opacity="0.9" />
          <rect x="10" y="13" width="4" height="3" fill="#fff" opacity="0.75" />
          <rect x="18" y="13" width="4" height="3" fill="#fff" opacity="0.75" />
          <rect x="11" y="20" width="10" height="2.5" fill="var(--mute)" opacity="0.5" />
        </svg>
      )}
    </span>
  );
}

/* ── Fleet hero backdrop ───────────────────────────────── */

export function HeroArt() {
  const theme = useConsole((s) => s.theme);
  const src = theme === "hanami" ? HERO.day : HERO.night;
  return (
    <div className="hero-art" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.div key={theme} className="hero-art-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}>
          {src ? <img src={src} alt="" draggable={false} /> : <span />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** High-resolution Yozakura sanctuary architectural reference provided by the user. */
export const BUILD_SANCTUARY_ART = "/assets/aistudio/image_b04824af.png";

export function BuildHeroArt() {
  const fileName = useConsole((s) => s.build.current?.fileName ?? "");
  const matchedImage =
    fileName.includes("lantern_pier")
      ? "/assets/world/lantern-pier.jpg"
      : fileName.includes("yozakura_bridge") || fileName.includes("moonlit_bridge")
        ? "/assets/world/moonlit-bridge.jpg"
        : fileName.includes("sakura_watchtower") || fileName.includes("cliffside_pagoda")
          ? "/assets/world/cliffside-pagoda.jpg"
          : BUILD_SANCTUARY_ART;

  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art-layer">
        <img src={matchedImage} alt="" draggable={false} style={{ objectPosition: "68% 48%" }} />
      </div>
    </div>
  );
}

/* ── Schematic footprint ───────────────────────────────── */

/** Isometric outline of a schematic's bounding box, drawn from its real dimensions. */
export function Blueprint({
  dims,
  rotation = 0,
  size = 40,
  className,
}: {
  dims: [number, number, number];
  rotation?: number;
  size?: number;
  className?: string;
}) {
  const swapped = rotation === 90 || rotation === 270;
  const [rawW, h, rawD] = dims;
  const w = swapped ? rawD : rawW;
  const d = swapped ? rawW : rawD;
  const longest = Math.max(w, h, d, 1);
  const sx = w / longest;
  const sy = h / longest;
  const sz = d / longest;
  const project = (x: number, y: number, z: number): [number, number] => [(x * sx - z * sz) * 0.866, (x * sx + z * sz) * 0.5 - y * sy];

  const corner = {
    a: project(0, 0, 0),
    b: project(1, 0, 0),
    c: project(1, 0, 1),
    d: project(0, 0, 1),
    e: project(0, 1, 0),
    f: project(1, 1, 0),
    g: project(1, 1, 1),
    h: project(0, 1, 1),
  };
  const all = Object.values(corner);
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const pad = 0.16;
  const poly = (...points: [number, number][]) => points.map((p) => p.map((n) => n.toFixed(3)).join(",")).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      aria-hidden="true"
      className={cn("shrink-0 text-rose", className)}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.032"
      strokeLinejoin="round"
    >
      <polygon points={poly(corner.e, corner.f, corner.g, corner.h)} fillOpacity="0.3" />
      <polygon points={poly(corner.d, corner.c, corner.g, corner.h)} fillOpacity="0.16" />
      <polygon points={poly(corner.b, corner.c, corner.g, corner.f)} fillOpacity="0.07" />
    </svg>
  );
}

/* ── Real Add-on SVGs (Iconify game-icons) ─────────────── */

export function AddonSvgIcon({
  name,
  size = 16,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const entry = ADDON_SVGS[name] ?? ADDON_SVGS.combat_cat;
  if (!entry) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={entry.viewBox}
      aria-hidden="true"
      className={cn("shrink-0", className)}
      fill="currentColor"
    >
      <path d={entry.d} />
    </svg>
  );
}

/* ── Intelligent AI Provider Logo ──────────────────────── */

function monogram(name: string) {
  const letters = name
    .replace(/[^A-Za-z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function ProviderLogo({
  baseURL,
  name,
  model,
  enabled = true,
  size = 36,
  className,
}: {
  baseURL?: string;
  name?: string;
  model?: string;
  enabled?: boolean;
  size?: number;
  className?: string;
}) {
  const identity = resolveProviderIdentity({ baseURL, name, model });
  const embedded = identity.key ? PROVIDER_SVGS[identity.key] : undefined;
  const candidateKey = identity.remoteLogoUrls.join("|");
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateKey]);

  const iconSize = Math.round(size * 0.54);
  const remoteUrl = !embedded ? identity.remoteLogoUrls[candidateIndex] : undefined;

  return (
    <span
      aria-hidden="true"
      title={identity.brandName ? `${identity.brandName}${identity.rootDomain ? ` (${identity.rootDomain})` : ""}` : name}
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] border font-display text-[11px] font-semibold transition-colors",
        enabled ? "border-line-2 bg-panel-2 text-ink" : "border-line bg-panel-2/50 text-faint opacity-65",
        className,
      )}
    >
      {embedded ? (
        <span
          style={{ width: iconSize, height: iconSize }}
          className={cn("inline-flex shrink-0 items-center justify-center [&>svg]:size-full", embedded.monochrome && "text-ink")}
          dangerouslySetInnerHTML={{ __html: embedded.svg }}
        />
      ) : remoteUrl ? (
        <img
          key={remoteUrl}
          src={remoteUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          style={{ width: iconSize, height: iconSize }}
          className="shrink-0 select-none object-contain"
          onError={() => setCandidateIndex((i) => i + 1)}
        />
      ) : (
        <span className="text-mute">{monogram(name || identity.brandName || "?")}</span>
      )}
    </span>
  );
}



