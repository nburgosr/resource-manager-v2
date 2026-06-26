import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { formatDay } from "@/lib/week";

export const dynamic = "force-dynamic";

const ENTITIES = [
  "Assignment",
  "Engagement",
  "EngagementLead",
  "StaffingBase",
  "StaffingOverride",
  "Consultant",
  "Holiday",
  "WeeklySnapshot",
] as const;

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Creación",
  UPSERT: "Alta/edición",
  UPDATE: "Edición",
  DELETE: "Eliminación",
  IMPORT: "Importación xlsx",
};

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(d);
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  await requireUser();
  const { entity } = await searchParams;
  const entityFilter = ENTITIES.includes(entity as (typeof ENTITIES)[number]) ? entity : undefined;

  const [logs, snapshots] = await Promise.all([
    prisma.auditLog.findMany({
      where: entityFilter ? { entity: entityFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: { user: true },
    }),
    prisma.weeklySnapshot.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main>
      <h1>Historial y auditoría</h1>

      <section>
        <h2>Snapshots semanales</h2>
        <p className="subtitle">Fotos del estado de asignaciones guardadas para consulta histórica.</p>
        {snapshots.length === 0 ? (
          <p className="unassigned">Aún no hay snapshots. Se generan desde el calendario (admin).</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Semana</th>
                <th>Guardado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td>{formatDay(s.weekStart)}</td>
                  <td>{formatDateTime(s.createdAt)}</td>
                  <td>
                    <a href={`/history/snapshot/${s.id}`}>Ver detalle</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Registro de cambios</h2>
        <div className="legend">
          <a href="/history" className={!entityFilter ? "btn secondary" : undefined}>
            Todos
          </a>
          {ENTITIES.map((e) => (
            <a
              key={e}
              href={`/history?entity=${e}`}
              className={entityFilter === e ? "btn secondary" : undefined}
            >
              {e}
            </a>
          ))}
        </div>

        {logs.length === 0 ? (
          <p className="unassigned">Sin registros para este filtro.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha (UTC)</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{formatDateTime(l.createdAt)}</td>
                  <td>{l.user?.name ?? "—"}</td>
                  <td>{ACTION_LABEL[l.action] ?? l.action}</td>
                  <td>{l.entity}</td>
                  <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    {l.details ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="subtitle">Mostrando hasta 150 registros más recientes.</p>
      </section>
    </main>
  );
}
