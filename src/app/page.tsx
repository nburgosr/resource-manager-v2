import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  ENGAGEMENT_TYPES,
  ENGAGEMENT_TYPE_LABELS,
  RANK_GROUP_ORDER,
  RANK_LABELS,
  type EngagementType,
  type Rank,
} from "@/lib/constants";
import { getMonday, addWeeks, weeklyCapacity, formatDay, parseWeekParam, formatWeekRange, isSameDay } from "@/lib/week";
import { ChartsSection } from "./ChartsSection";
import type { TrendPoint, RankTrendPoint, TypeTrendPoint, LineConfig } from "./DashboardCharts";

export const dynamic = "force-dynamic";

// Colores hex por tipo (recharts no acepta CSS vars)
const TYPE_COLOR_HEX: Record<EngagementType, string> = {
  CLIENT_PROJECT: "#b8860b",
  INTERNAL_WITH_CODE: "#0e7c7b",
  COMMERCIAL_PROPOSAL: "#514b9e",
  INTERNAL_NO_CODE: "#7c7c86",
};

// Colores de línea por rank
const RANK_LINE_COLORS: Record<string, string> = {
  TRAINEE: "#94a3b8",
  STAFF: "#3b82f6",
  SENIOR: "#10b981",
  SENIOR_ESPECIALISTA: "#f59e0b",
  MANAGER: "#f97316",
  SENIOR_MANAGER: "#ef4444",
  ASSOCIATED_PARTNER: "#8b5cf6",
  PARTNER: "#ec4899",
};

// Labels cortos para gráficos
const TYPE_SHORT: Record<EngagementType, string> = {
  CLIENT_PROJECT: "Cliente",
  INTERNAL_WITH_CODE: "Interno c/ código",
  COMMERCIAL_PROPOSAL: "Propuesta",
  INTERNAL_NO_CODE: "Interno s/ código",
};

// Colores CSS vars para tablas (acepta CSS vars)
const TYPE_COLOR: Record<EngagementType, string> = {
  CLIENT_PROJECT: "var(--p1)",
  INTERNAL_WITH_CODE: "var(--p2)",
  COMMERCIAL_PROPOSAL: "var(--p3)",
  INTERNAL_NO_CODE: "var(--p4)",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireUser();

  const { week } = await searchParams;
  const monday = parseWeekParam(week);
  const currentMonday = getMonday(new Date());
  const isPast = monday < currentMonday;
  const isFuture = monday > currentMonday;
  const isCurrentWeek = isSameDay(monday, currentMonday);

  const prevWeek = formatDay(addWeeks(monday, -1));
  const nextWeek = formatDay(addWeeks(monday, 1));

  // 26 semanas desde la semana actual (6 meses aprox.)
  const WEEKS = 26;
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addWeeks(monday, i));

  const [consultants, holidays, assignments, absences, trendAssignments] =
    await Promise.all([
      prisma.consultant.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
      }),
      prisma.holiday.findMany(),
      prisma.assignment.findMany({
        where: { weekStart: monday },
        include: {
          engagement: { select: { type: true } },
          consultant: { select: { rank: true } },
        },
      }),
      prisma.absence.findMany({
        where: { weekStart: monday },
        select: { consultantId: true, hours: true },
      }),
      // Horas asignadas por semana para los gráficos de tendencia (incluye rank y tipo)
      prisma.assignment.findMany({
        where: { weekStart: { in: weekStarts } },
        select: {
          weekStart: true,
          hours: true,
          consultant: { select: { rank: true } },
          engagement: { select: { type: true } },
        },
      }),
    ]);

  const holidayDates = holidays.map((h) => h.date);
  const baseCapacity = weeklyCapacity(monday, holidayDates);

  // Ausencias de esta semana por consultor
  const absenceMap = new Map<string, number>();
  for (const a of absences) {
    absenceMap.set(a.consultantId, (absenceMap.get(a.consultantId) ?? 0) + a.hours);
  }

  const effectiveCap = (id: string) =>
    Math.max(0, baseCapacity - (absenceMap.get(id) ?? 0));

  // Capacidad total del equipo (neta de ausencias)
  const totalCapacity = consultants.reduce((sum, c) => sum + effectiveCap(c.id), 0);

  // Horas asignadas esta semana
  const totalAssigned = assignments.reduce((sum, a) => sum + a.hours, 0);

  // % utilización global
  const utilPct = totalCapacity > 0 ? (totalAssigned / totalCapacity) * 100 : 0;

  // ── Por rank ──
  const byRank = new Map<string, { count: number; capacity: number; assigned: number }>();
  for (const c of consultants) {
    const entry = byRank.get(c.rank) ?? { count: 0, capacity: 0, assigned: 0 };
    entry.count += 1;
    entry.capacity += effectiveCap(c.id);
    byRank.set(c.rank, entry);
  }
  for (const a of assignments) {
    const entry = byRank.get(a.consultant.rank);
    if (entry) entry.assigned += a.hours;
  }

  // ── Por tipo de engagement ──
  const byType = new Map<string, number>();
  for (const a of assignments) {
    byType.set(a.engagement.type, (byType.get(a.engagement.type) ?? 0) + a.hours);
  }

  // ── Consultores desasignados ──
  const assignedIds = new Set(assignments.map((a) => a.consultantId));
  const unassigned = consultants.filter((c) => !assignedIds.has(c.id));

  // ── Datos para gráficos ─────────────────────────────────────────────────

  // Agrupar asignaciones de tendencia por semana
  type TrendEntry = { rank: string; type: string; hours: number };
  const trendByWeek = new Map<string, TrendEntry[]>();
  for (const a of trendAssignments) {
    const key = formatDay(a.weekStart);
    const list = trendByWeek.get(key) ?? [];
    list.push({ rank: a.consultant.rank, type: a.engagement.type, hours: a.hours });
    trendByWeek.set(key, list);
  }

  const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const activeRankKeys = RANK_GROUP_ORDER.filter((r) => byRank.has(r));

  function weekLabel(ws: Date) {
    const d = ws.getUTCDate().toString().padStart(2, "0");
    const m = MONTHS_ES[ws.getUTCMonth()];
    return `${d} ${m}`;
  }

  // current marker: índice donde cae la semana actual dentro del rango de tendencia
  const trendData: TrendPoint[] = weekStarts.map((ws) => {
    const cap = weeklyCapacity(ws, holidayDates) * consultants.length;
    const entries = trendByWeek.get(formatDay(ws)) ?? [];
    const assigned = entries.reduce((s, e) => s + e.hours, 0);
    const pct = cap > 0 ? (assigned / cap) * 100 : 0;
    return {
      label: weekLabel(ws),
      pct: Math.round(pct * 10) / 10,
      assigned: Math.round(assigned * 10) / 10,
      capacity: Math.round(cap * 10) / 10,
      current: isSameDay(ws, currentMonday),
    };
  });

  // Tendencia por rank: % asignado / capacidad del rank
  const rankTrendData: RankTrendPoint[] = weekStarts.map((ws) => {
    const entries = trendByWeek.get(formatDay(ws)) ?? [];
    const point: Record<string, string | number> = { label: weekLabel(ws), current: isSameDay(ws, currentMonday) ? 1 : 0 };
    for (const rank of activeRankKeys) {
      const count = byRank.get(rank)?.count ?? 0;
      const cap = weeklyCapacity(ws, holidayDates) * count;
      const assigned = entries.filter((e) => e.rank === rank).reduce((s, e) => s + e.hours, 0);
      point[rank] = cap > 0 ? Math.round((assigned / cap) * 1000) / 10 : 0;
    }
    return point as RankTrendPoint;
  });

  // Tendencia por tipo: % de la capacidad total del equipo
  const typeTrendData: TypeTrendPoint[] = weekStarts.map((ws) => {
    const entries = trendByWeek.get(formatDay(ws)) ?? [];
    const totalCap = weeklyCapacity(ws, holidayDates) * consultants.length;
    const point: Record<string, string | number> = { label: weekLabel(ws), current: isSameDay(ws, currentMonday) ? 1 : 0 };
    for (const type of ENGAGEMENT_TYPES) {
      const assigned = entries.filter((e) => e.type === type).reduce((s, e) => s + e.hours, 0);
      point[type] = totalCap > 0 ? Math.round((assigned / totalCap) * 1000) / 10 : 0;
    }
    return point as TypeTrendPoint;
  });

  const activeRanksConfig: LineConfig[] = activeRankKeys.map((r) => ({
    key: r,
    label: RANK_LABELS[r as Rank],
    color: RANK_LINE_COLORS[r] ?? "#888",
  }));

  const typeLinesConfig: LineConfig[] = ENGAGEMENT_TYPES.map((t) => ({
    key: t,
    label: TYPE_SHORT[t],
    color: TYPE_COLOR_HEX[t],
  }));

  return (
    <main>
      <h1>Resumen</h1>

      {/* ── Navegación de semana ── */}
      <div className="week-nav" style={{ marginBottom: "1rem" }}>
        <a className="btn-outline" href={`/?week=${prevWeek}`}>← Semana anterior</a>
        {!isCurrentWeek && (
          <a className="btn-outline today" href="/">Hoy</a>
        )}
        <a className="btn-outline" href={`/?week=${nextWeek}`}>Semana siguiente →</a>
      </div>

      <p className="subtitle">
        Semana del <strong>{formatWeekRange(monday)}</strong>
        {isPast && <span className="badge" style={{ marginLeft: "0.5rem", background: "var(--muted)", fontSize: "0.72rem" }}>pasada</span>}
        {isFuture && <span className="badge" style={{ marginLeft: "0.5rem", background: "var(--p2)", fontSize: "0.72rem" }}>futura</span>}
        {" · "}{consultants.length} consultores activos
      </p>

      {/* ── KPIs globales ── */}
      <div className="kpi-grid">
        <KpiCard
          value={`${utilPct.toFixed(1)}%`}
          label="Utilización global"
          sub={`${totalAssigned.toFixed(1)} h asignadas / ${totalCapacity.toFixed(1)} h disponibles`}
          pct={utilPct}
          accent
        />
        <KpiCard
          value={`${totalAssigned.toFixed(1)} h`}
          label="Horas asignadas"
          sub="suma del equipo esta semana"
        />
        <KpiCard
          value={`${totalCapacity.toFixed(1)} h`}
          label="Capacidad efectiva"
          sub="neta de ausencias"
        />
        <KpiCard
          value={String(unassigned.length)}
          label="Sin asignación"
          sub={`de ${consultants.length} consultores activos`}
          warn={unassigned.length > 0}
        />
      </div>

      {/* ── Utilización por rank (tabla) ── */}
      <section>
        <h2>Utilización por rank</h2>
        <table className="kpi-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th className="num-col">Consultores</th>
              <th className="num-col">Asignado</th>
              <th className="num-col">Capacidad</th>
              <th style={{ minWidth: 220 }}>Utilización</th>
            </tr>
          </thead>
          <tbody>
            {RANK_GROUP_ORDER.filter((r) => byRank.has(r)).map((rank) => {
              const d = byRank.get(rank)!;
              const pct = d.capacity > 0 ? (d.assigned / d.capacity) * 100 : 0;
              const barColor =
                pct >= 80 ? "var(--success)" : pct >= 50 ? "#f59e0b" : "var(--danger)";
              return (
                <tr key={rank}>
                  <td>
                    <strong>{RANK_LABELS[rank as Rank]}</strong>
                  </td>
                  <td className="num-col">{d.count}</td>
                  <td className="num-col">{d.assigned.toFixed(1)} h</td>
                  <td className="num-col">{d.capacity.toFixed(1)} h</td>
                  <td>
                    <UtilBar pct={pct} color={barColor} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── Horas por tipo de asignación (tabla) ── */}
      <section>
        <h2>Horas por tipo de asignación</h2>
        <table className="kpi-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="num-col">Horas</th>
              <th style={{ minWidth: 220 }}>% del total asignado</th>
            </tr>
          </thead>
          <tbody>
            {ENGAGEMENT_TYPES.map((type) => {
              const hours = byType.get(type) ?? 0;
              const pct = totalAssigned > 0 ? (hours / totalAssigned) * 100 : 0;
              return (
                <tr key={type}>
                  <td>
                    <span className="badge" style={{ background: TYPE_COLOR[type] }}>
                      {ENGAGEMENT_TYPE_LABELS[type]}
                    </span>
                  </td>
                  <td className="num-col">{hours.toFixed(1)} h</td>
                  <td>
                    <UtilBar pct={pct} color={TYPE_COLOR[type]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── Gráficos de tendencia ── */}
      <ChartsSection
        trend={trendData}
        rankTrend={rankTrendData}
        typeTrend={typeTrendData}
        activeRanks={activeRanksConfig}
        typeLines={typeLinesConfig}
      />

      {/* ── Consultores sin asignación ── */}
      <section>
        <h2>
          Sin asignación esta semana{" "}
          <span className="unassigned">({unassigned.length})</span>
        </h2>
        {unassigned.length === 0 ? (
          <p className="kpi-ok">
            ✓ Todos los consultores activos tienen al menos una asignación esta semana.
          </p>
        ) : (
          <div className="unassigned-grid">
            {RANK_GROUP_ORDER.map((rank) => {
              const members = unassigned.filter((c) => c.rank === rank);
              if (!members.length) return null;
              return (
                <div key={rank} className="unassigned-group">
                  <div className="unassigned-rank-label">
                    {RANK_LABELS[rank as Rank]}
                    <span className="unassigned"> {members.length}</span>
                  </div>
                  {members.map((c) => (
                    <div key={c.id} className="unassigned-name">
                      {c.name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

/* ────────────────────────────────────────────────────── */

function KpiCard({
  value,
  label,
  sub,
  pct,
  accent,
  warn,
}: {
  value: string;
  label: string;
  sub?: string;
  pct?: number;
  accent?: boolean;
  warn?: boolean;
}) {
  const borderColor =
    accent && pct !== undefined
      ? pct >= 80
        ? "var(--success)"
        : pct >= 50
        ? "#f59e0b"
        : "var(--danger)"
      : warn
      ? "var(--danger)"
      : undefined;

  return (
    <div
      className="kpi-card"
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
    >
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function UtilBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="util-bar-wrap">
      <div
        className="util-bar-track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="util-bar-fill"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
      <span className="util-pct">{pct.toFixed(1)}%</span>
    </div>
  );
}
