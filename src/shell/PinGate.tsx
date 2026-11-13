import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Radio,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { verifyDashboardPin } from "../data/adapters";
import { SCHEMATIC_PRESETS, type View } from "../data/model";
import { VIEW_META } from "./Sidebar";
import { useConsole } from "../state/store";
import { Crest } from "../ui/art";
import { StatusDot } from "../ui/kit";
import { cn } from "../utils/cn";

const SANCTUARY_BACKDROP = SCHEMATIC_PRESETS[0].image;

const KEYPAD_KEYS = [
  { digit: "1", tag: "01" },
  { digit: "2", tag: "02" },
  { digit: "3", tag: "03" },
  { digit: "4", tag: "04" },
  { digit: "5", tag: "05" },
  { digit: "6", tag: "06" },
  { digit: "7", tag: "07" },
  { digit: "8", tag: "08" },
  { digit: "9", tag: "09" },
] as const;

const MODULE_OPTIONS: { id: View; code: string; label: string }[] = [
  { id: "fleet", code: "M-01", label: "Fleet" },
  { id: "grind", code: "M-02", label: "Grind" },
  { id: "build", code: "M-03", label: "Build" },
  { id: "addons", code: "M-04", label: "Add-ons" },
  { id: "providers", code: "M-05", label: "Providers" },
  { id: "settings", code: "M-06", label: "Settings" },
];

export function PinGate({ embedded = false }: { embedded?: boolean }) {
  const view = useConsole((s) => s.view);
  const setView = useConsole((s) => s.setView);
  const clusterTarget = useConsole((s) => s.clusterTarget);
  const bots = useConsole((s) => s.bots);
  const unlockDash = useConsole((s) => s.unlockDash);
  const setShowLanding = useConsole((s) => s.setShowLanding);

  const [code, setCode] = useState<string>("");
  const [revealDigits, setRevealDigits] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeTick, setShakeTick] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeBotsCount = bots.filter((b) => b.state === "active" || b.state === "warning").length;

  const applyCodeValue = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "").slice(0, 4);
    setCode(digitsOnly);
    if (error) setError(null);

    if (digitsOnly.length === 4) {
      const check = verifyDashboardPin(digitsOnly);
      if (check.ok) {
        unlockDash(digitsOnly);
      } else {
        setError(check.message);
        setShakeTick((t) => t + 1);
      }
    }
  };

  const handleDigitPress = (digit: string) => {
    if (code.length >= 4) {
      applyCodeValue(digit);
    } else {
      applyCodeValue(code + digit);
    }
  };

  const handleBackspace = () => {
    setCode((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setCode("");
    setError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const check = verifyDashboardPin(code);
    if (!check.ok) {
      setError(check.message);
      setShakeTick((t) => t + 1);
      inputRef.current?.focus();
      return;
    }
    unlockDash(code);
  };

  // Allow direct physical keyboard numeric entry without requiring manual input focus first
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && target !== inputRef.current && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (target === inputRef.current) return;

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        setCode((prev) => {
          const next = prev.length >= 4 ? event.key : prev + event.key;
          if (next.length === 4) {
            const check = verifyDashboardPin(next);
            if (check.ok) {
              queueMicrotask(() => unlockDash(next));
            } else {
              queueMicrotask(() => {
                setError(check.message);
                setShakeTick((t) => t + 1);
              });
            }
          } else {
            queueMicrotask(() => setError(null));
          }
          return next;
        });
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setCode((prev) => prev.slice(0, -1));
        setError(null);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setCode("");
        setError(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [unlockDash]);

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-y-auto bg-canvas p-4 text-ink sm:p-6 lg:p-8",
        embedded ? "h-full min-h-[620px]" : "min-h-dvh",
      )}
    >
      {/* Subtle Sanctuary Architectural Backdrop inside the Security Vault */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={SANCTUARY_BACKDROP}
          alt=""
          className="size-full scale-105 object-cover opacity-[0.14] blur-[2px]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 38%, rgba(20, 18, 16, 0.45) 0%, var(--bg-canvas) 82%)",
          }}
        />
      </div>

      {!embedded && (
        <div className="relative z-10 mb-5 flex w-full max-w-[860px] flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowLanding(true)}
            className="lp-neu-btn inline-flex h-9 items-center gap-2 px-3.5 text-[12px] font-medium text-mute hover:text-ink"
          >
            <ArrowLeft size={13.5} />
            <span>Back to Sanctuary Landing</span>
          </button>

          <div className="flex items-center gap-2 font-mono text-[11px] text-mute num">
            <StatusDot tone="ok" />
            <span>World Socket · {clusterTarget}</span>
          </div>
        </div>
      )}

      {/* Two-Column Glass-Neumorphic Sanctuary Security Gate Chassis */}
      <div className="lp-glass-card relative z-10 w-full max-w-[860px] overflow-hidden p-5 sm:p-7 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Column (5 Cols): Sanctuary Security Seal, Target Module & Telemetry Brief */}
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              {/* Top Hardware Seal Header */}
              <div className="flex items-center justify-between gap-3">
                <span className="lp-neu-well inline-flex items-center gap-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-gold">
                  <Lock size={11} />
                  <span>Security Seal · ENI-01</span>
                </span>

                <span className="lp-neu-well inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10.5px] text-mute">
                  <StatusDot tone="warn" />
                  <span>Sealed</span>
                </span>
              </div>

              {/* Sculpted Medallion Socket & Heading */}
              <div className="mt-5 flex items-center gap-3.5">
                <div className="lp-neu-socket relative size-14 shrink-0 p-2">
                  <Crest size={38} />
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-line-2 bg-panel text-gold"
                  >
                    <KeyRound size={10.5} />
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-[20px] font-semibold leading-tight text-ink sm:text-[21px]">
                    Supervisor Authorization
                  </h2>
                  <p className="mt-0.5 font-mono text-[10.5px] tracking-[0.04em] text-faint">
                    MINDSERVER COMMAND VAULT
                  </p>
                </div>
              </div>

              <p className="mt-3.5 text-[13px] leading-relaxed text-mute">
                Authenticate with your 4-digit supervisor passcode to unseal live bot actuators, schematic builders, and{" "}
                <strong className="font-medium text-ink">{VIEW_META[view].title}</strong> controls.
              </p>

              {/* Target Module Switcher */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                    Target Module on Unlock
                  </span>
                  <span className="font-mono text-[10.5px] text-gold">{VIEW_META[view].title}</span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Target module on unlock">
                  {MODULE_OPTIONS.map((mod) => {
                    const active = view === mod.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        data-active={active}
                        onClick={() => setView(mod.id)}
                        className="lp-neu-btn flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium text-ink"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 rounded-full transition-colors",
                            active ? "bg-gold" : "bg-line-2",
                          )}
                        />
                        <span className="truncate">{mod.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Read-Only Sanctuary Telemetry Ledger */}
            <div className="lp-neu-well mt-5 space-y-2 p-3.5 font-mono text-[11px] num">
              <div className="flex items-center justify-between text-mute">
                <span className="inline-flex items-center gap-1.5 text-faint">
                  <Radio size={12} className="text-ok" />
                  <span>WORLD SOCKET</span>
                </span>
                <span className="font-semibold text-ink">{clusterTarget}</span>
              </div>
              <div className="flex items-center justify-between text-mute">
                <span className="text-faint">ACTIVE CREW</span>
                <span className="text-ink">
                  {activeBotsCount} / {bots.length} Agents Online
                </span>
              </div>
              <div className="flex items-center justify-between text-mute">
                <span className="text-faint">ACTUATOR BUS</span>
                <span className="text-gold">Write-Protected</span>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): 4-Stage Passcode Tumbler & Sculpted Hardware Keypad */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col justify-between lg:col-span-7"
          >
            <div>
              {/* Recessed 4-Stage Passcode Tumbler Well */}
              <motion.div
                key={shakeTick}
                animate={shakeTick > 0 ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
                transition={{ duration: 0.32 }}
                className="lp-neu-well p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="supervisor-passcode-input"
                    className="font-mono text-[10.5px] uppercase tracking-wider text-faint"
                  >
                    4-Stage Security Tumbler
                  </label>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10.5px] text-mute num">
                      {code.length} / 4 Entered
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevealDigits((v) => !v)}
                      aria-label={revealDigits ? "Mask digits" : "Reveal digits"}
                      className="inline-flex items-center gap-1 font-mono text-[10.5px] text-mute transition-colors hover:text-ink"
                    >
                      {revealDigits ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{revealDigits ? "Mask" : "Show"}</span>
                    </button>
                  </div>
                </div>

                {/* Accessible Screen-Reader / Keyboard Input */}
                <input
                  ref={inputRef}
                  id="supervisor-passcode-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  value={code}
                  onChange={(e) => applyCodeValue(e.target.value)}
                  aria-label="Supervisor passcode"
                  className="sr-only"
                />

                {/* 4 Sculpted Tumbler Cells */}
                <div
                  onClick={() => inputRef.current?.focus()}
                  className="mt-3 grid cursor-pointer grid-cols-4 gap-2.5 sm:gap-3"
                >
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const char = code[slotIdx];
                    const isFilled = Boolean(char);
                    const isCurrent = code.length === slotIdx || (code.length === 4 && slotIdx === 3);

                    return (
                      <div
                        key={slotIdx}
                        className={cn(
                          "relative flex h-16 flex-col items-center justify-center rounded-xl border transition-all num",
                          isFilled
                            ? "border-gold/55 bg-panel-2 text-ink shadow-sm"
                            : isCurrent
                              ? "border-line-2 bg-panel/75 text-mute"
                              : "border-line bg-panel/35 text-faint",
                        )}
                      >
                        <span className="absolute left-2 top-1.5 font-mono text-[9px] text-faint num">
                          0{slotIdx + 1}
                        </span>

                        {isFilled ? (
                          revealDigits ? (
                            <span className="font-mono text-[22px] font-semibold text-ink num">
                              {char}
                            </span>
                          ) : (
                            <span
                              aria-label="Digit entered"
                              className="size-3 rounded-full bg-gold shadow-[0_0_10px_rgba(216,182,124,0.45)]"
                            />
                          )
                        ) : (
                          <span className="h-0.5 w-3.5 rounded-full bg-line-2" />
                        )}

                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-x-3 bottom-1.5 h-[2px] rounded-full transition-colors",
                            isFilled
                              ? "bg-gold"
                              : isCurrent
                                ? "bg-line-2"
                                : "bg-transparent",
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2 font-mono text-[11.5px] text-danger"
                >
                  {error}
                </p>
              )}

              {/* Sculpted 3x4 Hardware Keypad */}
              <div
                className="mt-3.5 grid grid-cols-3 gap-2 sm:gap-2.5"
                role="group"
                aria-label="Passcode numeric keypad"
              >
                {KEYPAD_KEYS.map(({ digit, tag }) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigitPress(digit)}
                    className="lp-neu-btn group relative flex h-12 items-center justify-center px-3 font-mono text-[17px] font-semibold text-ink transition-transform active:scale-[0.97] num"
                  >
                    <span className="absolute left-2.5 top-1.5 font-mono text-[8.5px] font-normal text-faint">
                      {tag}
                    </span>
                    <span className="group-hover:text-gold">{digit}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleClear}
                  className="lp-neu-btn flex h-12 items-center justify-center font-mono text-[11.5px] font-medium text-mute transition-transform hover:text-ink active:scale-[0.97]"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => handleDigitPress("0")}
                  className="lp-neu-btn group relative flex h-12 items-center justify-center px-3 font-mono text-[17px] font-semibold text-ink transition-transform active:scale-[0.97] num"
                >
                  <span className="absolute left-2.5 top-1.5 font-mono text-[8.5px] font-normal text-faint">
                    00
                  </span>
                  <span className="group-hover:text-gold">0</span>
                </button>

                <button
                  type="button"
                  onClick={handleBackspace}
                  aria-label="Backspace digit"
                  className="lp-neu-btn inline-flex h-12 items-center justify-center text-mute transition-transform hover:text-ink active:scale-[0.97]"
                >
                  <Delete size={16} />
                </button>
              </div>
            </div>

            {/* Submit CTA & Session Footer */}
            <div className="mt-4 space-y-3">
              <button
                type="submit"
                className="lp-neu-cta inline-flex h-11 w-full items-center justify-center gap-2 px-5 text-[13px] font-semibold"
              >
                <Unlock size={14.5} />
                <span>Unlock Operations Console</span>
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 font-mono text-[10.5px] text-faint">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={12.5} className="text-ok" />
                  <span>Session-scoped supervisor lock</span>
                </span>
                <span>Keyboard 0–9 or tactile keypad</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
