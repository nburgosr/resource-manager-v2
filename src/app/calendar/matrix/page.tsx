import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_TYPE_PRIORITY,
  RANK_LABELS,
  type EngagementType,
  type Rank,
} from "@/lib/constants";
import {
  addWeeks,
  formatDay,
  getISOWeek,
  getMonday,
  isSameDay,
  parseWeekParam,
  weeklyCapacity,
} from "@/lib/week";

export const dynamic = "force-dynamic";

// Ventana fija de 6 meses.
const WINDOW_WEEKS = 26;

// Subtablas por rank, en el orden pedido: Especialista → Senior → Staff.
const GROUP_ORDER: Rank[] = ["SENIOR_ESPECIALISTA", "SENIOR", "STAFF"];

const PRIORITY_COLOR: Record<number, string> = {
  1: "var(--p1)",
  2: "var(--p2)",
  3: "var(--p3)",
  4: "var(--p4)",
};

const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  await requireUser();
  const { start } = await searchParams;

  const startMonday = parseWeekParam(start);
  const currentMonday = getMonday(new Date());

  const columns = Array.from({ length: WINDOW_WEEKS }, (_, i) => addWeeks(startMonday, i));
  const lastMonday = columns[columns.length - 1];

  const [consultants, holidays, assignments] = await Promise.all([
    prisma.consultant.findMany({ where: { status: "ACTIVE", rank: { in: GROUP_ORDER } } }),
    prisma.holiday.findMany(),
    prisma.assignment.findMany({
      where: { weekStart: { gte: startMonday, lte: lastMonday } },
      include: { engagement: true },
    }),
  ]);

  const holidayDates = holidays.map((h) => h.date);
  const capacityByWeek = new Map(columns.map((m) => [formatDay(m), weeklyCapacity(m, holidayDates)]));

  // consultor -> semana -> (tipo -> horas)
  type CellMap = Map<string, Map<string, number>>;
  const grid = new Map<string, CellMap>();
  for (const a of assignments) {
    const wk = formatDay(a.weekStart);
    const perWeek = grid.get(a.consultantId) ?? new Map();
    const perType = perWeek.get(wk) ?? new Map<string, number>();
    perType.set(a.engagement.type, (perType.get(a.engagement.type) ?? 0) + a.hours);
    perWeek.set(wk, perType);
    grid.set(a.consultantId, perWeek);
  }

  // Agrupa por rank.
  const byRank = new Map<Rank, typeof consultants>();
  for (const c of consultants) {
    const list = byRank.get(c.rank as Rank) ?? [];
    list.push(c);
    byRank.set(c.rank as Rank, list);
  }
  for (const list of byRank.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const prevStart = formatDay(addWeeks(startMonday, -WINDOW_WEEKS));
  const nextStart = formatDay(addWeeks(startMonday, WINDOW_WEEKS));

  const renderCell = (consultantId: string, isAssignable: boolean, m: Date) => {
    const wk = formatDay(m);
    const perType = grid.get(consultantId)?.get(wk);
    const total = perType ? [...perType.values()].reduce((s, h) => s + h, 0) : 0;
    const capacity = capacityByWeek.get(wk) ?? 0;
    const over = total > capacity;
    const unassigned = isAssignable && total === 0;

    if (total === 0) {
      return (
        <td key={wk} className={unassigned ? "mx-cell mx-unassigned" : "mx-cell"}>
          <span className="mx-empty">{unassigned ? "—" : ""}</span>
        </td>
      );
    }

    const segments = [...perType!.entries()].sort(
      (a, b) =>
        ENGAGEMENT_TYPE_PRIORITY[a[0] as EngagementType] -
        ENGAGEMENT_TYPE_PRIORITY[b[0] as EngagementType]
    );

    return (
      <td key={wk} className="mx-cell">
        <span className={over ? "mx-hrs over" : "mx-hrs"}>{total.toFixed(1)}</span>
        <div className="mx-bar" title={`${total.toFixed(1)} h de ${capacity.toFixed(1)} h`}>
          {segments.map(([type, h]) => (
            <span
              key={type}
              style={{
                width: `${(h / total) * 100}%`,
                background: PRIORITY_COLOR[ENGAGEMENT_TYPE_PRIORITY[type as EngagementType]],
              }}
            />
          ))}
        </div>
      </td>
    );
  };

  const weekHeader = (
    <tr>
      <th className="mx-consultant">Consultor</th>
      {columns.map((m) => (
        <th key={formatDay(m)} className={isSameDay(m, currentMonday) ? "mx-week current" : "mx-week"}>
          <a href={`/calendar?week=${formatDay(m)}`}>
            <span className="wk">S{getISOWeek(m)}</span>
            <span className="dt">{shortDate(m)}</span>
          </a>
        </th>
      ))}
    </tr>
  );

  return (
    <main className="wide">
      <h1>Matriz de asignación · 6 meses</h1>

      <div className="week-bar">
        <a href={`/calendar/matrix?start=${prevStart}`}>← 6 meses</a>
        <span className="range">
          {shortDate(startMonday)} – {shortDate(lastMonday)}
        </span>
        <a href={`/calendar/matrix?start=${nextStart}`}>6 meses →</a>
        <a className="today" href={`/calendar/matrix?start=${formatDay(currentMonday)}`}>
          Hoy
        </a>
        <a className="today" href="/calendar" style={{ marginLeft: "auto" }}>
          Vista semanal →
        </a>
      </div>

      <div className="legend">
        {(Object.keys(ENGAGEMENT_TYPE_LABELS) as EngagementType[]).map((t) => (
          <span key={t}>
            <span className="dot" style={{ background: PRIORITY_COLOR[ENGAGEMENT_TYPE_PRIORITY[t]] }} />
            {ENGAGEMENT_TYPE_LABELS[t]}
          </span>
        ))}
        <span>
          <span className="dot" style={{ background: "rgba(239,68,68,0.5)" }} />
          Desasignado
        </span>
      </div>

      {GROUP_ORDER.map((rank) => {
        const members = byRank.get(rank) ?? [];
        return (
          <section key={rank}>
            <h2>
              {RANK_LABELS[rank]} <span className="unassigned">({members.length})</span>
            </h2>
            <div className="matrix-scroll">
              <table className="matrix">
                <thead>{weekHeader}</thead>
                <tbody>
                  {members.length === 0 && (
                    <tr>
                      <td className="mx-consultant unassigned">Sin consultores</td>
                      {columns.map((m) => (
                        <td key={formatDay(m)} className="mx-cell" />
                      ))}
                    </tr>
                  )}
                  {members.map((c) => (
                    <tr key={c.id}>
                      <td className="mx-consultant">{c.name}</td>
                      {columns.map((m) => renderCell(c.id, true, m))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}
