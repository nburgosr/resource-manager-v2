import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { RANK_LABELS, type Rank } from "@/lib/constants";
import { formatDay } from "@/lib/week";

export const dynamic = "force-dynamic";

type SnapshotItem = {
  id: string;
  hours: number;
  consultant?: { name?: string; rank?: string };
  engagement?: { name?: string; type?: string };
};

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const snapshot = await prisma.weeklySnapshot.findUnique({ where: { id } });
  if (!snapshot) notFound();

  let items: SnapshotItem[] = [];
  try {
    items = JSON.parse(snapshot.payload) as SnapshotItem[];
  } catch {
    items = [];
  }

  const totalHours = items.reduce((sum, i) => sum + (i.hours ?? 0), 0);

  return (
    <main>
      <p>
        <a href="/history">← Historial</a>
      </p>
      <h1>Snapshot — semana {formatDay(snapshot.weekStart)}</h1>
      <p className="subtitle">
        {items.length} asignaciones · {totalHours.toFixed(1)} h en total · guardado{" "}
        {new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(
          snapshot.createdAt
        )}{" "}
        (UTC)
      </p>

      {items.length === 0 ? (
        <p className="unassigned">El snapshot no contiene asignaciones.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Consultor</th>
              <th>Rank</th>
              <th>Engagement</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.consultant?.name ?? "—"}</td>
                <td>
                  {i.consultant?.rank
                    ? RANK_LABELS[i.consultant.rank as Rank] ?? i.consultant.rank
                    : "—"}
                </td>
                <td>{i.engagement?.name ?? "—"}</td>
                <td>{i.hours} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
