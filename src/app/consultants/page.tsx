import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { RANKS, RANK_LABELS, type Rank } from "@/lib/constants";
import { createConsultant, deleteConsultant, updateConsultant } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConsultantsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const consultants = await prisma.consultant.findMany();
  const rankIndex = (r: string) => {
    const i = RANKS.indexOf(r as Rank);
    return i === -1 ? RANKS.length : i;
  };
  consultants.sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank) || a.name.localeCompare(b.name));

  return (
    <main>
      <h1>Consultores</h1>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Rank</th>
            <th>Estado</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {consultants.map((c) => {
            if (!isAdmin) {
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{RANK_LABELS[c.rank as Rank] ?? c.rank}</td>
                  <td>{c.status}</td>
                </tr>
              );
            }
            return (
              <tr key={c.id}>
                <td colSpan={4}>
                  <form action={updateConsultant} className="inline-form">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" defaultValue={c.name} required />
                    <select name="rank" defaultValue={c.rank}>
                      {RANKS.map((r) => (
                        <option key={r} value={r}>
                          {RANK_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <select name="status" defaultValue={c.status}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <button className="btn secondary" type="submit">
                      Guardar
                    </button>
                    <button className="btn danger" type="submit" formAction={deleteConsultant}>
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {isAdmin && (
        <section>
          <h2>Nuevo consultor</h2>
          <form action={createConsultant} className="inline-form">
            <input name="name" placeholder="Nombre" required />
            <select name="rank" defaultValue="STAFF">
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABELS[r]}
                </option>
              ))}
            </select>
            <select name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <button className="btn" type="submit">
              Añadir
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
