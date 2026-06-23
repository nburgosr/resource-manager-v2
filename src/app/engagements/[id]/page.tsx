import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  ENGAGEMENT_TYPES,
  ENGAGEMENT_TYPE_LABELS,
  MANAGEMENT_RANKS,
  PARTNER_RANKS,
  RANKS,
  RANK_LABELS,
  type EngagementType,
  type Rank,
} from "@/lib/constants";
import { formatDay } from "@/lib/week";
import {
  addLead,
  deleteEngagement,
  deleteStaffingOverride,
  removeLead,
  setStaffingBase,
  setStaffingOverride,
  updateEngagement,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: {
      partner: true,
      leads: { include: { consultant: true } },
      staffingBase: true,
      staffingOverrides: { orderBy: [{ weekStart: "asc" }, { rank: "asc" }] },
    },
  });
  if (!engagement) notFound();

  const [partners, managers] = await Promise.all([
    prisma.consultant.findMany({ where: { rank: { in: PARTNER_RANKS }, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.consultant.findMany({ where: { rank: { in: MANAGEMENT_RANKS }, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  const baseByRank = new Map(engagement.staffingBase.map((b) => [b.rank, b]));
  const leadIds = new Set(engagement.leads.map((l) => l.consultantId));

  return (
    <main>
      <p>
        <a href="/engagements">← Engagements</a>
      </p>
      <h1>{engagement.name}</h1>

      {/* ---------- Datos generales ---------- */}
      <section>
        <h2>Datos generales</h2>
        {isAdmin ? (
          <form action={updateEngagement} className="form">
            <input type="hidden" name="id" value={engagement.id} />
            <label>
              Nombre
              <input name="name" defaultValue={engagement.name} required />
            </label>
            <div className="row">
              <label>
                Tipo
                <select name="type" defaultValue={engagement.type}>
                  {ENGAGEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ENGAGEMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Engagement code
                <input name="engagementCode" defaultValue={engagement.engagementCode ?? ""} />
              </label>
            </div>
            <div className="row">
              <label>
                Inicio
                <input type="date" name="startDate" defaultValue={formatDay(engagement.startDate)} required />
              </label>
              <label>
                Fin
                <input type="date" name="endDate" defaultValue={formatDay(engagement.endDate)} required />
              </label>
              <label>
                Estado
                <select name="status" defaultValue={engagement.status}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </label>
            </div>
            <label>
              Partner / Associated Partner responsable
              <select name="partnerId" defaultValue={engagement.partnerId ?? ""}>
                <option value="">(sin asignar)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {RANK_LABELS[p.rank as Rank]}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button className="btn" type="submit">
                Guardar cambios
              </button>
            </div>
          </form>
        ) : (
          <table>
            <tbody>
              <tr><th>Tipo</th><td>{ENGAGEMENT_TYPE_LABELS[engagement.type as EngagementType]}</td></tr>
              <tr><th>Code</th><td>{engagement.engagementCode ?? "—"}</td></tr>
              <tr><th>Vigencia</th><td>{formatDay(engagement.startDate)} → {formatDay(engagement.endDate)}</td></tr>
              <tr><th>Estado</th><td>{engagement.status}</td></tr>
              <tr><th>Partner</th><td>{engagement.partner?.name ?? "—"}</td></tr>
            </tbody>
          </table>
        )}
      </section>

      {/* ---------- Liderazgo ---------- */}
      <section>
        <h2>Liderazgo (Managers / Senior Managers)</h2>
        {engagement.leads.length === 0 && <p className="unassigned">Sin leads asignados.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {engagement.leads.map((l) => (
            <li key={l.id} className="inline-form" style={{ marginBottom: "0.35rem" }}>
              {l.consultant.name} · {RANK_LABELS[l.consultant.rank as Rank]}
              {isAdmin && (
                <form action={removeLead}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="engagementId" value={engagement.id} />
                  <button className="btn danger" type="submit">
                    Quitar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form action={addLead} className="inline-form">
            <input type="hidden" name="engagementId" value={engagement.id} />
            <select name="consultantId" required defaultValue="">
              <option value="" disabled>
                + Añadir lead…
              </option>
              {managers
                .filter((m) => !leadIds.has(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {RANK_LABELS[m.rank as Rank]}
                  </option>
                ))}
            </select>
            <button className="btn secondary" type="submit">
              Añadir
            </button>
          </form>
        )}
      </section>

      {/* ---------- Necesidad base por rank ---------- */}
      <section>
        <h2>Necesidad base por rank</h2>
        <p className="unassigned">
          Valor por defecto por rank. Las fechas acotan su vigencia (por defecto, las del
          engagement: {formatDay(engagement.startDate)} → {formatDay(engagement.endDate)}).
        </p>
        <table className="cov-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Personas</th>
              <th>Horas</th>
              <th>Inicio</th>
              <th>Fin</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {RANKS.map((rank) => {
              const b = baseByRank.get(rank);
              if (!isAdmin) {
                if (!b) return null;
                return (
                  <tr key={rank}>
                    <td>{RANK_LABELS[rank]}</td>
                    <td>{b.persons}</td>
                    <td>{b.hours}</td>
                    <td>{formatDay(b.startDate)}</td>
                    <td>{formatDay(b.endDate)}</td>
                  </tr>
                );
              }
              return (
                <tr key={rank}>
                  <td>{RANK_LABELS[rank]}</td>
                  <td colSpan={5}>
                    <form action={setStaffingBase} className="inline-form">
                      <input type="hidden" name="engagementId" value={engagement.id} />
                      <input type="hidden" name="rank" value={rank} />
                      <input className="mini" type="number" name="persons" min="0" step="1" defaultValue={b?.persons ?? 0} title="Personas" />
                      <input className="mini" type="number" name="hours" min="0" step="0.1" defaultValue={b?.hours ?? 0} title="Horas" />
                      <input type="date" name="startDate" defaultValue={formatDay(b?.startDate ?? engagement.startDate)} title="Inicio" />
                      <input type="date" name="endDate" defaultValue={formatDay(b?.endDate ?? engagement.endDate)} title="Fin" />
                      <button className="btn secondary" type="submit">
                        Guardar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ---------- Sobrescrituras por semana ---------- */}
      <section>
        <h2>Sobrescrituras por semana</h2>
        <p className="unassigned">Pisan la necesidad base solo en la semana indicada.</p>
        <table className="cov-table">
          <thead>
            <tr>
              <th>Semana (lunes)</th>
              <th>Rank</th>
              <th>Personas</th>
              <th>Horas</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {engagement.staffingOverrides.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="unassigned">
                  Sin sobrescrituras.
                </td>
              </tr>
            )}
            {engagement.staffingOverrides.map((o) => (
              <tr key={o.id}>
                <td>{formatDay(o.weekStart)}</td>
                <td>{RANK_LABELS[o.rank as Rank] ?? o.rank}</td>
                <td>{o.persons}</td>
                <td>{o.hours}</td>
                {isAdmin && (
                  <td>
                    <form action={deleteStaffingOverride}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="engagementId" value={engagement.id} />
                      <button className="btn danger" type="submit">
                        Eliminar
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {isAdmin && (
          <form action={setStaffingOverride} className="inline-form" style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="engagementId" value={engagement.id} />
            <input type="date" name="weekStart" required />
            <select name="rank" required defaultValue="">
              <option value="" disabled>
                Rank…
              </option>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABELS[r]}
                </option>
              ))}
            </select>
            <input className="mini" type="number" name="persons" min="0" step="1" placeholder="pers." />
            <input className="mini" type="number" name="hours" min="0" step="0.1" placeholder="horas" />
            <button className="btn secondary" type="submit">
              Añadir / actualizar
            </button>
          </form>
        )}
      </section>

      {/* ---------- Eliminar ---------- */}
      {isAdmin && (
        <section>
          <form action={deleteEngagement}>
            <input type="hidden" name="id" value={engagement.id} />
            <button className="btn danger" type="submit">
              Eliminar engagement
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
