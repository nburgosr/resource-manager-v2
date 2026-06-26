import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  ENGAGEMENT_TYPES,
  ENGAGEMENT_TYPE_LABELS,
  PARTNER_RANKS,
  RANK_LABELS,
  type Rank,
} from "@/lib/constants";
import { formatDay, getMonday } from "@/lib/week";
import { createEngagement } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEngagementPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/engagements");

  const partners = await prisma.consultant.findMany({
    where: { rank: { in: PARTNER_RANKS }, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const today = formatDay(getMonday(new Date()));

  return (
    <main>
      <p>
        <a href="/engagements">← Engagements</a>
      </p>
      <h1>Nuevo engagement</h1>

      <form action={createEngagement} className="form">
        <label>
          Cliente / Nombre en sistema
          <input name="name" required placeholder="Nombre tal como figura en el xlsx" />
        </label>

        <label>
          Nombre del engagement
          <input name="engagementName" placeholder="Nombre descriptivo (opcional)" />
          <small style={{ color: "var(--muted)" }}>Si se completa, se usará este nombre en el calendario y la matriz.</small>
        </label>

        <div className="row">
          <label>
            Tipo
            <select name="type" defaultValue={ENGAGEMENT_TYPES[0]}>
              {ENGAGEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENGAGEMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Engagement code
            <input name="engagementCode" placeholder="(opcional)" />
          </label>
        </div>

        <div className="row">
          <label>
            Inicio
            <input type="date" name="startDate" defaultValue={today} required />
          </label>
          <label>
            Fin
            <input type="date" name="endDate" defaultValue={today} required />
          </label>
          <label>
            Estado
            <select name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">ACTIVE</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
        </div>

        <label>
          Partner / Associated Partner responsable
          <select name="partnerId" defaultValue="">
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
            Crear engagement
          </button>
        </div>
      </form>
    </main>
  );
}
