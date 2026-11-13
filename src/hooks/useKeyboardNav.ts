import { useEffect, useRef } from "react";

export type KeyBinding = (event: KeyboardEvent) => void;

function isEditable(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}

function normalise(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  const key = event.key.toLowerCase();
  if (!["control", "meta", "alt", "shift"].includes(key)) parts.push(key);
  return parts.join("+");
}

/**
 * Tiny sequence-aware keyboard layer.
 * Bindings look like "mod+k", "g f", "shift+?" or "t". Plain keys are ignored
 * while an input is focused; modified shortcuts stay available.
 */
export function useKeyboardNav(bindings: Record<string, KeyBinding>) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    let prefix: string | null = null;
    let timer = 0;

    const resetPrefix = () => {
      prefix = null;
      if (timer) window.clearTimeout(timer);
      timer = 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const map = bindingsRef.current;
      const editable = isEditable(event.target);
      const canonical = normalise(event);
      const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

      if (canonical === "escape") {
        resetPrefix();
        return;
      }

      if (prefix && !hasModifier && !editable) {
        const sequence = `${prefix} ${event.key.toLowerCase()}`;
        const handler = map[sequence];
        resetPrefix();
        if (handler) {
          event.preventDefault();
          handler(event);
          return;
        }
      }

      if (map[canonical] && (hasModifier || !editable)) {
        resetPrefix();
        event.preventDefault();
        map[canonical](event);
        return;
      }

      if (hasModifier || editable) return;
      const key = event.key.toLowerCase();
      const opensSequence = Object.keys(map).some((candidate) => candidate.startsWith(`${key} `));
      if (opensSequence) {
        prefix = key;
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          prefix = null;
          timer = 0;
        }, 900);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
}
