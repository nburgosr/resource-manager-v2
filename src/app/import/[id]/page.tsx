import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { RANK_LABELS, ENGAGEMENT_TYPE_LABELS, RANKS, type Rank, type EngagementType } from "@/lib/constants";
import type { ParsedXlsxData } from "@/lib/xlsx-parser";
import { confirmImport, cancelImport } from "./actions";
import { PendingSubmit } from "../PendingSubmit";

export const dynamic = "force-dynamic";

const fmtWeek = (iso: string) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso)
  );

// ── Tipos del diff ────────────────────────────────────────────────────────────

interface NewConsultant { name: string; rank: string }
interface RankChange { name: string; currentRank: string; newRank: string }
interface NewEngagement { name: string; type: string; code: string | null }
interface AssignmentChange {
  consultantName: string;
  engagementName: string;
  weekStart: string;
  newHours: number;
  currentHours: number | null; // null → nuevo
}
interface AbsenceChange {
  consultantName: string;
  weekStart: string;
  newHours: number;
  currentHours: number | null;
}

// ── Helpers de display ────────────────────────────────────────────────────────

function Badge({ type }: { type: "new" | "updated" }) {
  return <span className={`import-badge ${type}`}>{type === "new" ? "Nuevo" : "Actualizado"}</span>;
}

function HoursCell({ current, next }: { current: number | null; next: number }) {
  if (current === null) return <>{next.toFixed(1)} h</>;
  return (
    <>
      <span className="import-old">{current.toFixed(1)}</span>
      {" → "}
      <strong>{next.toFixed(1)} h</strong>
    </>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default async function ImportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const pending = await prisma.pendingImport.findUnique({ where: { id } });
  if (!pending) {
    return (
      <main>
        <h1>Importación no encontrada</h1>
        <p>Esta importación ya fue confirmada o descartada.</p>
        <a className="btn secondary" href="/import">← Volver</a>
      </main>
    );
  }

  const data: ParsedXlsxData = JSON.parse(pending.payload);
  const xlsxWeekStart = new Date(data.weekRange.start);
  const xlsxWeekEnd = new Date(data.weekRange.end);

  // ── Cargar estado actual de la DB ─────────────────────────────────────────

  const xlsxConsultantNames = data.consultants.map((c) => c.name);
  const xlsxEngagementNames = data.engagements.map((e) => e.name);
  const engagementNameByKey = new Map(data.engagements.map((e) => [e.engagementKey, e.name]));

  const [dbConsultants, dbEngagements, dbAssignments, dbAbsences] = await Promise.all([
    prisma.consultant.findMany(),
    prisma.engagement.findMany(),
    prisma.assignment.findMany({
      where: {
        weekStart: { gte: xlsxWeekStart, lte: xlsxWeekEnd },
        consultant: { name: { in: xlsxConsultantNames } },
      },
      include: { engagement: true, consultant: true },
    }),
    prisma.absence.findMany({
      where: {
        weekStart: { gte: xlsxWeekStart, lte: xlsxWeekEnd },
        consultant: { name: { in: xlsxConsultantNames } },
      },
      include: { consultant: true },
    }),
  ]);

  const dbConsultantByName = new Map(dbConsultants.map((c) => [c.name, c]));
  const dbEngagementByName = new Map(dbEngagements.map((e) => [e.name, e]));

  // Assignments: consultantId|engagementId|weekStart → hours
  const assignmentMap = new Map<string, number>();
  for (const a of dbAssignments) {
    const key = `${a.consultantId}|${a.engagementId}|${a.weekStart.toISOString().slice(0, 10)}`;
    assignmentMap.set(key, a.hours);
  }

  // Absences: consultantId|weekStart → hours
  const absenceMap = new Map<string, number>();
  for (const a of dbAbsences) {
    const key = `${a.consultantId}|${a.weekStart.toISOString().slice(0, 10)}`;
    absenceMap.set(key, a.hours);
  }

  // ── Calcular diff ─────────────────────────────────────────────────────────

  const rankIndex = (r: string) => RANKS.indexOf(r as Rank);

  const newConsultants: NewConsultant[] = [];
  const rankChanges: RankChange[] = [];

  for (const c of data.consultants) {
    const existing = dbConsultantByName.get(c.name);
    if (!existing) newConsultants.push({ name: c.name, rank: c.rank });
    else if (
      existing.rank !== c.rank &&
      rankIndex(c.rank) > rankIndex(existing.rank) // sólo ascensos
    ) {
      rankChanges.push({ name: c.name, currentRank: existing.rank, newRank: c.rank });
    }
  }

  const newEngagements: NewEngagement[] = [];
  for (const e of data.engagements) {
    if (!dbEngagementByName.has(e.name))
      newEngagements.push({ name: e.name, type: e.type, code: e.code });
  }

  const assignmentChanges: AssignmentChange[] = [];
  for (const a of data.assignments) {
    const consultantId = dbConsultantByName.get(a.consultantName)?.id;
    const engagementName = engagementNameByKey.get(a.engagementKey) ?? a.engagementKey;
    const engagementId = dbEngagementByName.get(engagementName)?.id;

    if (!consultantId || !engagementId) {
      // Consultor o engagement nuevo → la asignación será nueva
      assignmentChanges.push({
        consultantName: a.consultantName,
        engagementName,
        weekStart: a.weekStart,
        newHours: a.hours,
        currentHours: null,
      });
      continue;
    }

    const key = `${consultantId}|${engagementId}|${a.weekStart}`;
    const current = assignmentMap.get(key) ?? null;
    if (current === null || Math.abs(current - a.hours) > 0.05) {
      assignmentChanges.push({
        consultantName: a.consultantName,
        engagementName,
        weekStart: a.weekStart,
        newHours: a.hours,
        currentHours: current,
      });
    }
  }

  const absenceChanges: AbsenceChange[] = [];
  for (const a of data.absences) {
    const consultantId = dbConsultantByName.get(a.consultantName)?.id;
    if (!consultantId) {
      absenceChanges.push({ consultantName: a.consultantName, weekStart: a.weekStart, newHours: a.hours, currentHours: null });
      continue;
    }
    const key = `${consultantId}|${a.weekStart}`;
    const current = absenceMap.get(key) ?? null;
    if (current === null || Math.abs(current - a.hours) > 0.05) {
      absenceChanges.push({ consultantName: a.consultantName, weekStart: a.weekStart, newHours: a.hours, currentHours: current });
    }
  }

  // Agrupar asignaciones por consultor
  const assignmentByConsultant = new Map<string, AssignmentChange[]>();
  for (const c of assignmentChanges) {
    const list = assignmentByConsultant.get(c.consultantName) ?? [];
    list.push(c);
    assignmentByConsultant.set(c.consultantName, list);
  }

  const totalNew = assignmentChanges.filter((c) => c.currentHours === null).length;
  const totalUpdated = assignmentChanges.filter((c) => c.currentHours !== null).length;
  const unchanged = data.assignments.length - assignmentChanges.length;

  return (
    <main>
      <h1>Preview de importación</h1>
      <p className="subtitle">
        Archivo: <strong>{pending.filename}</strong> ·{" "}
        {fmtWeek(data.weekRange.start)} → {fmtWeek(data.weekRange.end)}
      </p>

      {/* ── Resumen ── */}
      <div className="import-summary">
        <div className="import-stat">
          <span className="import-stat-value">{newConsultants.length}</span>
          <span className="import-stat-label">Consultores nuevos</span>
        </div>
        <div className="import-stat">
          <span className="import-stat-value">{newEngagements.length}</span>
          <span className="import-stat-label">Engagements nuevos</span>
        </div>
        <div className="import-stat import-stat-new">
          <span className="import-stat-value">{totalNew}</span>
          <span className="import-stat-label">Asignaciones nuevas</span>
        </div>
        <div className="import-stat import-stat-updated">
          <span className="import-stat-value">{totalUpdated}</span>
          <span className="import-stat-label">Asignaciones actualizadas</span>
        </div>
        <div className="import-stat">
          <span className="import-stat-value">{unchanged}</span>
          <span className="import-stat-label">Sin cambios</span>
        </div>
        {absenceChanges.length > 0 && (
          <div className="import-stat">
            <span className="import-stat-value">{absenceChanges.length}</span>
            <span className="import-stat-label">Cambios en ausencias</span>
          </div>
        )}
      </div>

      {assignmentChanges.length === 0 && newConsultants.length === 0 && rankChanges.length === 0 && newEngagements.length === 0 && absenceChanges.length === 0 && (
        <section>
          <p className="unassigned">✓ No hay cambios. Los datos del archivo coinciden con la base de datos.</p>
        </section>
      )}

      {/* ── Consultores nuevos ── */}
      {newConsultants.length > 0 && (
        <section>
          <h2>Consultores nuevos ({newConsultants.length})</h2>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Rank</th></tr>
            </thead>
            <tbody>
              {newConsultants.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td><Badge type="new" /> {RANK_LABELS[c.rank as Rank] ?? c.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Cambios de rank ── */}
      {rankChanges.length > 0 && (
        <section>
          <h2>Cambios de rank ({rankChanges.length})</h2>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Rank actual</th><th>Nuevo rank</th></tr>
            </thead>
            <tbody>
              {rankChanges.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="import-old">{RANK_LABELS[c.currentRank as Rank] ?? c.currentRank}</td>
                  <td>{RANK_LABELS[c.newRank as Rank] ?? c.newRank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Engagements nuevos ── */}
      {newEngagements.length > 0 && (
        <section>
          <h2>Engagements nuevos ({newEngagements.length})</h2>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Tipo</th><th>Código</th></tr>
            </thead>
            <tbody>
              {newEngagements.map((e) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>{ENGAGEMENT_TYPE_LABELS[e.type as EngagementType] ?? e.type}</td>
                  <td>{e.code ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Cambios en asignaciones ── */}
      {assignmentChanges.length > 0 && (
        <section>
          <h2>Cambios en asignaciones ({assignmentChanges.length})</h2>
          <p className="subtitle">
            {totalNew} nuevas · {totalUpdated} actualizadas · {unchanged} sin cambios (no se muestran)
          </p>
          <div className="import-changes-list">
            {[...assignmentByConsultant.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([consultantName, changes]) => (
              <details key={consultantName} className="import-consultant-group">
                <summary>
                  <strong>{consultantName}</strong>
                  <span className="import-group-count">{changes.length} cambio{changes.length !== 1 ? "s" : ""}</span>
                  {changes.some((c) => c.currentHours !== null) && <Badge type="updated" />}
                  {changes.some((c) => c.currentHours === null) && <Badge type="new" />}
                </summary>
                <table>
                  <thead>
                    <tr><th>Engagement</th><th>Semana</th><th>Horas</th><th></th></tr>
                  </thead>
                  <tbody>
                    {changes
                      .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.engagementName.localeCompare(b.engagementName))
                      .map((c) => (
                        <tr key={`${c.engagementName}|${c.weekStart}`}>
                          <td>{c.engagementName}</td>
                          <td>{fmtWeek(c.weekStart)}</td>
                          <td><HoursCell current={c.currentHours} next={c.newHours} /></td>
                          <td><Badge type={c.currentHours === null ? "new" : "updated"} /></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ── Cambios en ausencias ── */}
      {absenceChanges.length > 0 && (
        <section>
          <h2>Cambios en ausencias ({absenceChanges.length})</h2>
          <table>
            <thead>
              <tr><th>Consultor</th><th>Semana</th><th>Horas</th><th></th></tr>
            </thead>
            <tbody>
              {absenceChanges.map((a) => (
                <tr key={`${a.consultantName}|${a.weekStart}`}>
                  <td>{a.consultantName}</td>
                  <td>{fmtWeek(a.weekStart)}</td>
                  <td><HoursCell current={a.currentHours} next={a.newHours} /></td>
                  <td><Badge type={a.currentHours === null ? "new" : "updated"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Acciones ── */}
      <section className="import-actions">
        <form action={confirmImport}>
          <input type="hidden" name="importId" value={id} />
          <PendingSubmit pendingText="Importando datos…">
            ✓ Confirmar e importar
          </PendingSubmit>
        </form>
        <form action={cancelImport}>
          <input type="hidden" name="importId" value={id} />
          <PendingSubmit className="btn danger" pendingText="Descartando…">
            Descartar
          </PendingSubmit>
        </form>
      </section>
    </main>
  );
}
