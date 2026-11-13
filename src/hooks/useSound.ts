import { useCallback, useRef } from "react";

export type SoundKind = "tap" | "ok" | "warn";

const NOTES: Record<SoundKind, number[]> = {
  tap: [587.33, 698.46],
  ok: [659.25, 783.99, 987.77],
  warn: [440, 392],
};

/** Short WebAudio cues. Purely optional — never throws when audio is blocked. */
export function useSound(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);

  return useCallback(
    (kind: SoundKind = "tap") => {
      if (!enabled) return;
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = context.current ?? new Ctor();
        context.current = ctx;
        if (ctx.state === "suspended") void ctx.resume();
        NOTES[kind].forEach((frequency, index) => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = index % 2 ? "triangle" : "sine";
          oscillator.frequency.value = frequency;
          const start = ctx.currentTime + index * 0.055;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.028, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
          oscillator.connect(gain).connect(ctx.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.47);
        });
      } catch {
        /* audio is optional */
      }
    },
    [enabled],
  );
}
