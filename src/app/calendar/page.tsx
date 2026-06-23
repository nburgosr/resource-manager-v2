import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  CONSULTING_RANKS,
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_TYPE_PRIORITY,
  RANK_GROUP_ORDER,
  RANK_LABELS,
  type EngagementType,
  type Rank,
} from "@/lib/constants";
import {
  addWeeks,
  formatDay,
  formatWeekRange,
  getMonday,
  parseWeekParam,
  weekdaysOf,
  weeklyCapacity,
} from "@/lib/week";
import { deleteAssignment, snapshotWeek, upsertAssignment } from "./actions";

export const dynamic = "force-dynamic";

const PRIORITY_COLOR: Record<number, string> = {
  1: "var(--p1)",
  2: "var(--p2)",
  3: "var(--p3)",
  4: "var(--p4)",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const { week } = await searchParams;
  const monday = parseWeekParam(week);
  const weekStr = formatDay(monday);
  const friday = weekdaysOf(monday)[4];
  const prevWeek = formatDay(addWeeks(monday, -1));
  const nextWeek = formatDay(addWeeks(monday, 1));
  const currentMonday = getMonday(new Date());

  const [consultants, holidays, assignments, activeEngagements] = await Promise.all([
    prisma.consultant.findMany({ where: { status: "ACTIVE" } }),
    prisma.holiday.findMany(),
    prisma.assignment.findMany({ where: { weekStart: monday }, include: { engagement: true } }),
    prisma.engagement.findMany({
      where: { startDate: { lte: friday }, endDate: { gte: monday }, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);

  const capacity = weeklyCapacity(monday, holidays.map((h) => h.date));

  const byConsultant = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = byConsultant.get(a.consultantId) ?? [];
    list.push(a);
    byConsultant.set(a.consultantId, list);
  }

  // Agrupa consultores por rank (ordenados por nombre dentro de cada grupo).
  const byRank = new Map<Rank, typeof consultants>();
  for (const c of consultants) {
    const list = byRank.get(c.rank as Rank) ?? [];
    list.push(c);
    byRank.set(c.rank as Rank, list);
  }
  for (const list of byRank.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const renderConsultantRow = (c: (typeof consultants)[number]) => {
    const items = (byConsultant.get(c.id) ?? []).sort(
      (a, b) =>
        ENGAGEMENT_TYPE_PRIORITY[a.engagement.type as EngagementType] -
        ENGAGEMENT_TYPE_PRIORITY[b.engagement.type as EngagementType]
    );
    const total = items.reduce((sum, a) => sum + a.hours, 0);
    const isConsulting = CONSULTING_RANKS.includes(c.rank as Rank);
    const unassigned = isConsulting && total === 0;
    const over = total > capacity;
    const pct = capacity > 0 ? Math.min(100, (total / capacity) * 100) : 0;

    return (
      <tr key={c.id} className={unassigned ? "row-unassigned" : undefined}>
        <td className="cal-consultant">{c.name}</td>
        <td>
          {items.length === 0 && (
            <span className="unassigned">
              {unassigned ? "⚠ Desasignado" : "Sin asignaciones"}
            </span>
          )}

          {items.map((a) => {
            const priority = ENGAGEMENT_TYPE_PRIORITY[a.engagement.type as EngagementType];
            const color = PRIORITY_COLOR[priority];

            if (!isAdmin) {
              return (
                <div key={a.id} className="chip" style={{ borderLeftColor: color }}>
                  <span>{a.engagement.name}</span>
                  <span className="hrs">{a.hours} h</span>
                </div>
              );
            }

            return (
              <form key={a.id} action={upsertAssignment} className="chip" style={{ borderLeftColor: color }}>
                <input type="hidden" name="consultantId" value={c.id} />
                <input type="hidden" name="engagementId" value={a.engagementId} />
                <input type="hidden" name="weekStart" value={weekStr} />
                <input type="hidden" name="id" value={a.id} />
                <span>{a.engagement.name}</span>
                <input
                  className="hrs-input"
                  type="number"
                  name="hours"
                  defaultValue={a.hours}
                  step="0.1"
                  min="0.1"
                />
                <button type="submit" title="Guardar horas">
                  ✓
                </button>
                <button type="submit" formAction={deleteAssignment} title="Eliminar">
                  ✕
                </button>
              </form>
            );
          })}

          {isAdmin && (
            <form action={upsertAssignment} className="add-form">
              <input type="hidden" name="consultantId" value={c.id} />
              <input type="hidden" name="weekStart" value={weekStr} />
              <select name="engagementId" required defaultValue="">
                <option value="" disabled>
                  + Añadir engagement…
                </option>
                {activeEngagements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <input
                className="hrs-input"
                type="number"
                name="hours"
                step="0.1"
                min="0.1"
                placeholder="h"
              />
              <button type="submit">+</button>
            </form>
          )}
        </td>
        <td className={over ? "cap over" : "cap"}>
          <span className="total">
            {total.toFixed(1)} / {capacity.toFixed(1)} h
          </span>
          <div className="meter">
            <span style={{ width: `${pct}%` }} />
          </div>
          {over && <div className="unassigned">Sobre-asignado</div>}
        </td>
      </tr>
    );
  };

  return (
    <main>
      <h1>Calendario semanal</h1>

      <div className="week-bar">
        <a href={`/calendar?week=${prevWeek}`}>← Semana anterior</a>
        <span className="range">{formatWeekRange(monday)}</span>
        <a href={`/calendar?week=${nextWeek}`}>Semana siguiente →</a>
        <a className="today" href={`/calendar?week=${formatDay(currentMonday)}`}>
          Hoy
        </a>
        <a className="today" href={`/calendar/matrix?start=${weekStr}`}>
          Vista matriz
        </a>
        <span className="unassigned" style={{ marginLeft: "auto" }}>
          Capacidad: <strong>{capacity.toFixed(1)} h</strong>
        </span>
        {isAdmin && (
          <form action={snapshotWeek}>
            <input type="hidden" name="weekStart" value={weekStr} />
            <button className="today" type="submit">
              Guardar snapshot
            </button>
          </form>
        )}
      </div>

      <div className="legend">
        {(Object.keys(ENGAGEMENT_TYPE_LABELS) as EngagementType[]).map((t) => (
          <span key={t}>
            <span
              className="dot"
              style={{ background: PRIORITY_COLOR[ENGAGEMENT_TYPE_PRIORITY[t]] }}
            />
            {ENGAGEMENT_TYPE_LABELS[t]}
          </span>
        ))}
        {!isAdmin && <span className="unassigned">Modo solo lectura (Visualizador)</span>}
      </div>

      {RANK_GROUP_ORDER.map((rank) => {
        const members = byRank.get(rank) ?? [];
        if (members.length === 0) return null;
        return (
          <section key={rank}>
            <h2>
              {RANK_LABELS[rank]} <span className="unassigned">({members.length})</span>
            </h2>
            <table className="cal-table">
              <thead>
                <tr>
                  <th className="cal-consultant">Consultor</th>
                  <th>Asignaciones de la semana</th>
                  <th className="cap">Carga</th>
                </tr>
              </thead>
              <tbody>{members.map((c) => renderConsultantRow(c))}</tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
