/**
 * Consultas cacheadas para datos que cambian poco:
 * consultores activos y feriados.
 *
 * Se invalidan con revalidateTag("consultants") / revalidateTag("holidays")
 * desde las Server Actions que modifican esos datos.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export const getCachedActiveConsultants = unstable_cache(
  () => prisma.consultant.findMany({ where: { status: "ACTIVE" } }),
  ["active-consultants"],
  { tags: ["consultants"], revalidate: 60 }
);

export const getCachedHolidays = unstable_cache(
  async () => {
    const rows = await prisma.holiday.findMany();
    // Serializar date como string ISO para que el cache JSON funcione correctamente.
    return rows.map((h) => ({ ...h, date: h.date.toISOString() }));
  },
  ["holidays"],
  { tags: ["holidays"], revalidate: 3600 }
);
