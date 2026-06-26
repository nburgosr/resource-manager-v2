"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";

// ── Colores (hardcoded porque recharts no acepta CSS vars) ──────────────────
const SUCCESS = "#1c8a4d";
const EY_DARK = "#2e2e38";
const BORDER = "#e6e6ea";
const MUTED = "#6e6e76";

// ── Tipos exportados (los consume page.tsx) ─────────────────────────────────
export type TrendPoint = {
  label: string;
  pct: number;
  assigned: number;
  capacity: number;
  current: boolean;
};

// Punto para gráficos multi-línea: label + un campo numérico por rank o por tipo
export type RankTrendPoint = { label: string; [rankKey: string]: number | string };
export type TypeTrendPoint = { label: string; [typeKey: string]: number | string };

export type LineConfig = { key: string; label: string; color: string };

// ── Tooltips personalizados ─────────────────────────────────────────────────
function TrendTooltip({
  active, payload, label,
}: { active?: boolean; payload?: { payload: TrendPoint }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      <div style={{ fontWeight: 600 }}>{d.pct.toFixed(1)}% utilización</div>
      <div className="chart-tooltip-muted">
        {d.assigned.toFixed(1)} h / {d.capacity.toFixed(1)} h cap.
      </div>
    </div>
  );
}

function MultiLineTooltip({
  active, payload, label, suffix = "%",
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; name: string }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const nonZero = [...payload]
    .filter((p) => (p.value as number) > 0)
    .sort((a, b) => (b.value as number) - (a.value as number));
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {nonZero.length === 0 ? (
        <div className="chart-tooltip-muted">Sin asignaciones</div>
      ) : (
        nonZero.map((p) => (
          <div
            key={String(p.dataKey)}
            style={{ color: p.color, fontSize: "0.8rem", lineHeight: 1.6 }}
          >
            {p.name}: <strong>{(p.value as number).toFixed(1)}{suffix}</strong>
          </div>
        ))
      )}
    </div>
  );
}

// ── Gráfico de tendencia global ────────────────────────────────────────────
export function TrendChart({ data }: { data: TrendPoint[] }) {
  // Índice de la semana actual para el ReferenceLine
  const currentIdx = data.findIndex((d) => d.current);
  const currentLabel = currentIdx >= 0 ? data[currentIdx].label : undefined;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 12, right: 24, bottom: 0, left: -4 }}>
        <defs>
          <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={EY_DARK} stopOpacity={0.18} />
            <stop offset="95%" stopColor={EY_DARK} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          interval={3}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          width={38}
        />

        <Tooltip content={<TrendTooltip />} cursor={{ stroke: BORDER, strokeWidth: 1 }} />

        {/* Línea de referencia en 80% */}
        <ReferenceLine
          y={80}
          stroke={SUCCESS}
          strokeDasharray="5 4"
          label={{ value: "80%", position: "insideTopRight", fontSize: 10, fill: SUCCESS, dy: -4 }}
        />

        {/* Semana actual */}
        {currentLabel && (
          <ReferenceLine
            x={currentLabel}
            stroke={EY_DARK}
            strokeDasharray="3 3"
            label={{ value: "hoy", position: "insideTopRight", fontSize: 10, fill: MUTED, dy: -4 }}
          />
        )}

        <Area
          type="monotone"
          dataKey="pct"
          stroke={EY_DARK}
          strokeWidth={2}
          fill="url(#utilGrad)"
          dot={false}
          activeDot={{ r: 4, fill: EY_DARK, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico de tendencia por rank (multi-línea) ─────────────────────────────
export function RankTrendChart({
  data,
  lines,
}: {
  data: RankTrendPoint[];
  lines: LineConfig[];
}) {
  const currentLabel = data.find((d) => !!d.current)?.label;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 12, right: 24, bottom: 0, left: -4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          interval={3}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        <Tooltip
          content={<MultiLineTooltip />}
          cursor={{ stroke: BORDER, strokeWidth: 1 }}
        />
        <ReferenceLine
          y={80}
          stroke={SUCCESS}
          strokeDasharray="5 4"
          label={{ value: "80%", position: "insideTopRight", fontSize: 10, fill: SUCCESS, dy: -4 }}
        />
        {currentLabel && (
          <ReferenceLine
            x={currentLabel}
            stroke={EY_DARK}
            strokeDasharray="3 3"
            label={{ value: "hoy", position: "insideTopRight", fontSize: 10, fill: MUTED, dy: -4 }}
          />
        )}
        {lines.map((l) => (
          <Line
            key={l.key}
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "0.75rem", paddingTop: "8px" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico de tendencia por tipo de engagement (multi-línea) ───────────────
export function TypeTrendChart({
  data,
  lines,
}: {
  data: TypeTrendPoint[];
  lines: LineConfig[];
}) {
  const currentLabel = data.find((d) => !!d.current)?.label;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 12, right: 24, bottom: 0, left: -4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          interval={3}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        <Tooltip
          content={<MultiLineTooltip />}
          cursor={{ stroke: BORDER, strokeWidth: 1 }}
        />
        {currentLabel && (
          <ReferenceLine
            x={currentLabel}
            stroke={EY_DARK}
            strokeDasharray="3 3"
            label={{ value: "hoy", position: "insideTopRight", fontSize: 10, fill: MUTED, dy: -4 }}
          />
        )}
        {lines.map((l) => (
          <Line
            key={l.key}
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "0.75rem", paddingTop: "8px" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
