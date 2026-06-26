import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import {
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_TYPE_PRIORITY,
  type EngagementType,
} from "@/lib/constants";
import { formatDay } from "@/lib/week";

export const dynamic = "force-dynamic";

const PRIORITY_COLOR: Record<number, string> = {
  1: "var(--p1)",
  2: "var(--p2)",
  3: "var(--p3)",
  4: "var(--p4)",
};

export default async function EngagementsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const engagements = await prisma.engagement.findMany({
    include: { partner: true, leads: { include: { consultant: true } } },
  });
  engagements.sort(
    (a, b) =>
      ENGAGEMENT_TYPE_PRIORITY[a.type as EngagementType] -
      ENGAGEMENT_TYPE_PRIORITY[b.type as EngagementType]
  );

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <h1 style={{ marginRight: "auto" }}>Engagements</h1>
        {isAdmin && (
          <a className="btn" href="/engagements/new">
            + Nuevo
          </a>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Code</th>
            <th>Vigencia</th>
            <th>Partner</th>
            <th>Leads</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {engagements.map((e) => {
            const priority = ENGAGEMENT_TYPE_PRIORITY[e.type as EngagementType];
            return (
              <tr key={e.id}>
                <td>
                  <a href={`/engagements/${e.id}`}>
                    {e.engagementName || e.name}
                  </a>
                  {e.engagementName && (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      {e.name}
                    </div>
                  )}
                </td>
                <td>
                  <span className="badge" style={{ background: PRIORITY_COLOR[priority] }}>
                    {ENGAGEMENT_TYPE_LABELS[e.type as EngagementType]}
                  </span>
                </td>
                <td>{e.engagementCode ?? "—"}</td>
                <td>
                  {formatDay(e.startDate)} → {formatDay(e.endDate)}
                </td>
                <td>{e.partner?.name ?? "—"}</td>
                <td>{e.leads.map((l) => l.consultant.name).join(", ") || "—"}</td>
                <td>{e.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
