/**
 * The console's art lives in ./embedded as text modules (data URIs), so the
 * single-file build never depends on binary files being on disk.
 *
 * Every lookup is optional. If a module is missing the UI falls back to drawn
 * artwork (see ui/art.tsx) instead of rendering a broken image.
 */
import * as blocksMod from "./embedded/blocks";
import * as brandMod from "./embedded/brand";
import * as heroDayMod from "./embedded/hero-day";
import * as heroNightMod from "./embedded/hero-night";

type Loose = Record<string, unknown>;

const modules: Record<string, Loose> = {
  "./embedded/blocks.ts": blocksMod as Loose,
  "./embedded/brand.ts": brandMod as Loose,
  "./embedded/hero-day.ts": heroDayMod as Loose,
  "./embedded/hero-night.ts": heroNightMod as Loose,
};

const mod = (name: string): Loose => modules[`./embedded/${name}.ts`] ?? {};
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const table = (value: unknown): Loose => (value && typeof value === "object" ? (value as Loose) : {});

const blocks = table(mod("blocks").blocks);
const brand = mod("brand");
const avatars = table(brand.avatars);

/** Isometric block render for a Minecraft block id, when one is embedded. */
export const blockTexture = (name: string): string | undefined => text(blocks[name]);

export const CREST = text(brand.crest);

export const AVATARS = {
  eni: "/src/assets/images/yozakura_avatar_eni_1794487237022.jpg",
  miner: "/src/assets/images/yozakura_avatar_miner_1794487239226.jpg",
  grinder: "/src/assets/images/yozakura_avatar_scout_1794487237138.jpg",
  builder: "/src/assets/images/yozakura_avatar_builder_1794487240139.jpg",
};

export const FALLBACK_AVATARS = {
  eni: text(avatars.eni),
  miner: text(avatars.miner),
  grinder: text(avatars.grinder),
  builder: text(avatars.builder),
};

export const HERO = {
  night: text(mod("hero-night").heroNight),
  day: text(mod("hero-day").heroDay),
};
