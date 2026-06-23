import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_TYPE_PRIORITY,
  RANK_GROUP_ORDER,
  RANK_LABELS,
  type EngagementType,
  type Rank,
} from "@/lib/constants";
import { getMonday, weeklyCapacity, formatDay } from "@/lib/week";

export const dynamic = "force-dynamic";

const PRIORITY_COLOR: Record<number, string> = {
  1: "var(--p1)",
  2: "var(--p2)",
  3: "var(--p3)",
  4: "var(--p4)",
};

export default async function Home() {
  await requireUser();

  const [consultants, engagements, holidays, assignments, users] = await Promise.all([
    prisma.consultant.findMany({ orderBy: { name: "asc" } }),
    prisma.engagement.findMany({ orderBy: { startDate: "asc" } }),
    prisma.holiday.findMany(),
    prisma.assignment.count(),
    prisma.user.count(),
  ]);

  const monday = getMonday(new Date());
  const holidayDates = holidays.map((h) => h.date);
  const capacity = weeklyCapacity(monday, holidayDates);

  return (
    <main>
      <h1>Resumen</h1>
      <p className="subtitle">
        Equipo de Consultoría en IA &amp; Datos · semana actual{" "}
        <strong>{formatDay(monday)}</strong> · capacidad teórica{" "}
        <strong>{capacity.toFixed(1)} h</strong>
      </p>

      <div className="grid">
        <Stat n={consultants.length} label="Consultores" />
        <Stat n={engagements.length} label="Engagements" />
        <Stat n={assignments} label="Asignaciones" />
        <Stat n={holidays.length} label="Feriados" />
        <Stat n={users} label="Usuarios" />
      </div>

      <section>
        <h2>Consultores</h2>
        {RANK_GROUP_ORDER.map((rank) => {
          const members = consultants.filter((c) => c.rank === rank);
          if (members.length === 0) return null;
          return (
            <div key={rank} style={{ marginBottom: "1.25rem" }}>
              <h3>
                {RANK_LABELS[rank]} <span className="unassigned">({members.length})</span>
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      <section>
        <h2>Engagements (por prioridad)</h2>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Code</th>
              <th>Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {[...engagements]
              .sort(
                (a, b) =>
                  ENGAGEMENT_TYPE_PRIORITY[a.type as EngagementType] -
                  ENGAGEMENT_TYPE_PRIORITY[b.type as EngagementType]
              )
              .map((e) => {
                const priority = ENGAGEMENT_TYPE_PRIORITY[e.type as EngagementType];
                return (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: PRIORITY_COLOR[priority] }}
                      >
                        {ENGAGEMENT_TYPE_LABELS[e.type as EngagementType] ?? e.type}
                      </span>
                    </td>
                    <td>{e.engagementCode ?? "—"}</td>
                    <td>
                      {formatDay(e.startDate)} → {formatDay(e.endDate)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>

    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="card">
      <div className="num">{n}</div>
      <div className="label">{label}</div>
    </div>
  );
}
