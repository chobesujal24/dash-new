// Isometric block icons rendered from the game's own models.
// Source: https://blockrender.dev (Minecraft Java 26.2 assets).
// Crops use item renders, which is how the inventory presents them.
const modules = import.meta.glob("./blocks/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function blockImage(id: string): string | undefined {
  return modules[`./blocks/${id}.png`];
}
