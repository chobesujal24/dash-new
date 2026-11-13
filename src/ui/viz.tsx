import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Threat } from "../data/model";

/* Smooth path through points: Catmull-Rom converted to cubic Béziers. */
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

export function Sparkline({
  values,
  width = 132,
  height = 34,
  stroke = "var(--rose)",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const { line, area, lastX, lastY } = useMemo(() => {
    if (values.length < 2) return { line: "", area: "", lastX: 0, lastY: 0 };
    const min = Math.min(...values);
    const span = Math.max(1e-6, Math.max(...values) - min);
    const pad = 3;
    const points: [number, number][] = values.map((v, i) => [
      pad + (i / (values.length - 1)) * (width - pad * 2),
      height - pad - ((v - min) / span) * (height - pad * 2),
    ]);
    const path = smoothPath(points);
    const last = points[points.length - 1];
    return { line: path, area: `${path} L ${last[0]},${height} L ${points[0][0]},${height} Z`, lastX: last[0], lastY: last[1] };
  }, [values, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.12" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#sg-${id})`} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.15 }} />
      <motion.path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" initial={reducedMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
      {values.length >= 2 && (
        <>
          <circle cx={lastX} cy={lastY} r="5.5" fill={stroke} opacity="0.18" />
          <motion.circle cx={lastX} cy={lastY} r="2.3" fill={stroke} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: reducedMotion ? 0 : 0.7 }} />
        </>
      )}
    </svg>
  );
}

/* ── Radar ─────────────────────────────────────────────── */

export type RadarRange = 16 | 32 | 64;

/** Range colour shared by the radar and the threat ledger. */
export function rangeColor(distance: number) {
  if (distance <= 10) return "var(--danger)";
  return distance <= 20 ? "var(--warn)" : "var(--ok)";
}

export function Radar({
  threats,
  range,
  size = 216,
  active,
  onActive,
}: {
  threats: Threat[];
  range: RadarRange;
  size?: number;
  /** Username of the contact highlighted from the list. */
  active?: string | null;
  onActive?: (username: string | null) => void;
}) {
  const id = useId().replace(/:/g, "");
  const c = size / 2;
  const reach = c - 12;
  const rings = [1 / 3, 2 / 3, 1];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Player radar, ${threats.length} contact${threats.length === 1 ? "" : "s"} within ${range} metres`}
      style={{ display: "block", margin: "0 auto", maxWidth: "100%", height: "auto" }}
    >
      <defs>
        <radialGradient id={`rg-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--rose)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--rose)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`sw-${id}`} x1="0" y1="0" x2="1" y2="0">
          {/* The sweep is lighter on the day theme, where rose is a much stronger colour. */}
          <stop offset="0%" stopColor="var(--rose)" style={{ stopOpacity: "var(--sweep, 0.42)" }} />
          <stop offset="100%" stopColor="var(--rose)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx={c} cy={c} r={c - 1} fill={`url(#rg-${id})`} stroke="var(--line-2)" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const inner = i % 3 === 0 ? c - 6.5 : c - 4;
        const outer = c - 1.2;
        return (
          <line
            key={i}
            x1={c + Math.sin(a) * inner}
            y1={c - Math.cos(a) * inner}
            x2={c + Math.sin(a) * outer}
            y2={c - Math.cos(a) * outer}
            stroke="var(--line-2)"
            strokeWidth={i % 3 === 0 ? "1.2" : "0.8"}
          />
        );
      })}
      {rings.slice(0, 2).map((r) => (
        <circle key={r} cx={c} cy={c} r={(c - 1) * r} fill="none" stroke="var(--line)" strokeDasharray="2 2" />
      ))}
      <line x1={c} y1={14} x2={c} y2={size - 14} stroke="var(--line)" />
      <line x1={14} y1={c} x2={size - 14} y2={c} stroke="var(--line)" />

      {/* Cardinal compass labels */}
      <text x={c - 8} y={12} textAnchor="end" fontSize="8" fontWeight="600" fill="var(--faint)" fontFamily="var(--font-mono)">N</text>
      <text x={size - 9} y={c - 3} textAnchor="end" fontSize="8" fontWeight="600" fill="var(--faint)" fontFamily="var(--font-mono)">E</text>
      <text x={c + 8} y={size - 5} textAnchor="start" fontSize="8" fontWeight="600" fill="var(--faint)" fontFamily="var(--font-mono)">S</text>
      <text x={9} y={c - 3} textAnchor="start" fontSize="8" fontWeight="600" fill="var(--faint)" fontFamily="var(--font-mono)">W</text>

      <g className="radar-sweep">
        <path
          d={`M ${c},${c} L ${c},2 A ${c - 2} ${c - 2} 0 0 1 ${c + (c - 2) * Math.sin(0.9)} ${c - (c - 2) * Math.cos(0.9)} Z`}
          fill={`url(#sw-${id})`}
        />
        <line x1={c} y1={c} x2={c} y2={2} stroke="var(--rose)" strokeWidth="1.2" />
      </g>

      {rings.map((r) => (
        <text key={r} x={c + 4} y={c - (c - 1) * r + 11} fontSize="8.5" fill="var(--faint)" fontFamily="var(--font-mono)">
          {Math.round(range * r)}m
        </text>
      ))}

      {threats.map((t) => {
        const r = Math.min(1, t.distance / range) * reach;
        const x = c + Math.sin(t.bearing) * r;
        const y = c - Math.cos(t.bearing) * r;
        const color = rangeColor(t.distance);
        const on = active === t.username;
        return (
          <motion.g
            key={t.username}
            initial={false}
            animate={{ x, y }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            onMouseEnter={() => onActive?.(t.username)}
            onMouseLeave={() => onActive?.(null)}
          >
            <circle r="11" fill="transparent" />
            {on && <circle r="8.5" fill="none" stroke="var(--ink)" strokeWidth="1.2" />}
            {t.sneaking && <circle r="5.8" fill="none" stroke={color} strokeDasharray="2 2" />}
            <circle r="3.3" fill={color} stroke="var(--panel)" strokeWidth="1.4" />
            <text
              y="-9"
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="600"
              fill="var(--ink)"
              fontFamily="var(--font-sans)"
              style={{ paintOrder: "stroke", stroke: "var(--panel)", strokeWidth: 3 }}
            >
              {t.username}
            </text>
          </motion.g>
        );
      })}

      <circle cx={c} cy={c} r="4" fill="var(--rose)" stroke="var(--panel)" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Donut ─────────────────────────────────────────────── */

export function Donut({ value, size = 38, thickness = 4.5, tone = "var(--info)" }: { value: number; size?: number; thickness?: number; tone?: string }) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flexShrink: 0 }} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--panel-3)" strokeWidth={thickness} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.001, Math.min(1, value)) * circumference} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.7s ease-out" }}
      />
    </svg>
  );
}
