const MAC_PLATFORM = /Mac|iPhone|iPad|iPod/i;

export const IS_MAC =
  typeof navigator !== "undefined" &&
  MAC_PLATFORM.test(navigator.platform || navigator.userAgent || "");

/** The modifier glyph/label that matches the host the dashboard runs on. */
export const MOD_LABEL = IS_MAC ? "⌘" : "Ctrl";

/** Render a shortcut for display, keeping "Ctrl" as one keycap on Windows/Linux. */
export function shortcutLabel(key: string): string {
  return IS_MAC ? `⌘${key}` : `Ctrl ${key}`;
}
