import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { formatDay } from "@/lib/week";
import { addHoliday, deleteHoliday } from "./actions";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });

  return (
    <main>
      <h1>Calendario de feriados</h1>
      <p className="subtitle">
        Los feriados (lunes a viernes) descuentan sus horas de la capacidad semanal.
      </p>

      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Nombre</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {holidays.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 3 : 2} className="unassigned">
                Sin feriados registrados.
              </td>
            </tr>
          )}
          {holidays.map((h) => (
            <tr key={h.id}>
              <td>{formatDay(h.date)}</td>
              <td>{h.name}</td>
              {isAdmin && (
                <td>
                  <form action={deleteHoliday}>
                    <input type="hidden" name="id" value={h.id} />
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
        <section>
          <h2>Nuevo feriado</h2>
          <form action={addHoliday} className="inline-form">
            <input type="date" name="date" required />
            <input name="name" placeholder="Nombre del feriado" required />
            <button className="btn" type="submit">
              Añadir
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
