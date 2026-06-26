import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/authz";
import { formatDay } from "@/lib/week";
import { createBackup } from "./actions";
import { RestoreButton, DeleteBackupButton } from "./BackupControls";

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
  searchParams: Promise<{ entity?: string; restored?: string }>;
}) {
  await requireUser();
  const { entity, restored } = await searchParams;
  const entityFilter = ENTITIES.includes(entity as (typeof ENTITIES)[number]) ? entity : undefined;

  // Solo admins pueden ver/gestionar respaldos
  let isAdmin = false;
  try { await requireAdmin(); isAdmin = true; } catch { /* viewer */ }

  const [logs, snapshots, backups] = await Promise.all([
    prisma.auditLog.findMany({
      where: entityFilter ? { entity: entityFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: { user: true },
    }),
    prisma.weeklySnapshot.findMany({ orderBy: { createdAt: "desc" } }),
    isAdmin ? prisma.databaseBackup.findMany({ orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);

  return (
    <main>
      <h1>Historial y auditoría</h1>

      {restored && (
        <div className="alert alert-success" role="alert">
          <strong>Base de datos restaurada correctamente.</strong>
        </div>
      )}

      {/* ── Respaldos de emergencia (solo admin) ──────────────────────────── */}
      {isAdmin && (
        <section>
          <h2>Respaldos de base de datos</h2>
          <p className="subtitle">
            Guarda el estado completo de la base de datos y restáuralo en caso de emergencia.
            Los respaldos incluyen consultores, engagements, asignaciones, ausencias y feriados.
          </p>

          <form action={createBackup} className="inline-form" style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              name="label"
              placeholder="Descripción del respaldo (opcional)"
              style={{ minWidth: "280px" }}
            />
            <button type="submit" className="btn">
              Crear respaldo ahora
            </button>
          </form>

          {backups.length === 0 ? (
            <p className="unassigned">Aún no hay respaldos creados.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Creado (UTC)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td>{b.label}</td>
                    <td>{formatDateTime(b.createdAt)}</td>
                    <td className="import-row-actions">
                      <RestoreButton backupId={b.id} backupLabel={b.label} />
                      <DeleteBackupButton backupId={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

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
