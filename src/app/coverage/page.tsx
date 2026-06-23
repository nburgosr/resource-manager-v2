import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_TYPE_PRIORITY,
  RANK_LABELS,
  type EngagementType,
  type Rank,
} from "@/lib/constants";
import { computeCoverage } from "@/lib/coverage";
import {
  addWeeks,
  formatDay,
  formatWeekRange,
  getMonday,
  parseWeekParam,
  weekdaysOf,
} from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireUser();

  const { week } = await searchParams;
  const monday = parseWeekParam(week);
  const friday = weekdaysOf(monday)[4];
  const prevWeek = formatDay(addWeeks(monday, -1));
  const nextWeek = formatDay(addWeeks(monday, 1));
  const currentMonday = getMonday(new Date());

  // Engagements vigentes en la semana (rango solapa la semana).
  const engagements = await prisma.engagement.findMany({
    where: { startDate: { lte: friday }, endDate: { gte: monday }, status: "ACTIVE" },
    include: {
      staffingBase: true,
      staffingOverrides: { where: { weekStart: monday } },
      assignments: { where: { weekStart: monday }, include: { consultant: true } },
    },
  });

  const rows = engagements
    .map((e) => {
      // La necesidad base solo aplica si su ventana de fechas solapa la semana.
      const applicableBase = e.staffingBase.filter(
        (b) => b.startDate <= friday && b.endDate >= monday
      );
      const coverage = computeCoverage(
        applicableBase,
        e.staffingOverrides,
        e.assignments.map((a) => ({ rank: a.consultant.rank, hours: a.hours }))
      );
      return { e, coverage };
    })
    .sort(
      (a, b) =>
        ENGAGEMENT_TYPE_PRIORITY[a.e.type as EngagementType] -
        ENGAGEMENT_TYPE_PRIORITY[b.e.type as EngagementType]
    );

  return (
    <main>
      <h1>Cobertura de perfiles por semana</h1>

      <div className="week-bar">
        <a href={`/coverage?week=${prevWeek}`}>← Semana anterior</a>
        <span className="range">{formatWeekRange(monday)}</span>
        <a href={`/coverage?week=${nextWeek}`}>Semana siguiente →</a>
        <a className="today" href={`/coverage?week=${formatDay(currentMonday)}`}>
          Hoy
        </a>
      </div>

      {rows.length === 0 && (
        <p className="unassigned">No hay engagements vigentes en esta semana.</p>
      )}

      {rows.map(({ e, coverage }) => {
        const statusClass = !coverage.hasNeeds ? "none" : coverage.covered ? "ok" : "gap";
        const statusLabel = !coverage.hasNeeds
          ? "Sin necesidad definida"
          : coverage.covered
            ? "Cubierto"
            : "No cubierto";

        return (
          <div className="cov-card" key={e.id}>
            <div className="cov-head">
              <span className="name">{e.name}</span>
              <span className="type">
                {ENGAGEMENT_TYPE_LABELS[e.type as EngagementType]}
                {e.engagementCode ? ` · ${e.engagementCode}` : ""}
              </span>
              <span className={`status ${statusClass}`}>{statusLabel}</span>
            </div>

            {coverage.hasNeeds && (
              <table className="cov-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Personas (asig. / req.)</th>
                    <th>Horas (asig. / req.)</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.ranks.map((r) => (
                    <tr key={r.rank}>
                      <td>
                        {RANK_LABELS[r.rank as Rank] ?? r.rank}
                        {r.source === "override" && (
                          <span className="tag-override">semana</span>
                        )}
                      </td>
                      <td className={r.asgPersons >= r.reqPersons ? "met" : "miss"}>
                        {r.asgPersons} / {r.reqPersons}
                      </td>
                      <td className={r.asgHours >= r.reqHours ? "met" : "miss"}>
                        {r.asgHours.toFixed(1)} / {r.reqHours.toFixed(1)}
                      </td>
                      <td className={r.covered ? "met" : "miss"}>
                        {r.covered ? "✓" : "✗ falta"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </main>
  );
}
