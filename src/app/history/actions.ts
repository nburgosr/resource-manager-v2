"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

// ---------------------------------------------------------------------------
// Tipos internos del payload
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

type BackupData = {
  consultants: AnyRecord[];
  skills: AnyRecord[];
  consultantSkills: AnyRecord[];
  engagements: AnyRecord[];
  engagementLeads: AnyRecord[];
  staffingBase: AnyRecord[];
  staffingOverrides: AnyRecord[];
  assignments: AnyRecord[];
  absences: AnyRecord[];
  holidays: AnyRecord[];
};

// Convierte strings ISO de vuelta a Date para los campos DateTime conocidos.
function toDates(records: AnyRecord[], fields: string[]): AnyRecord[] {
  return records.map((r) => {
    const copy = { ...r };
    for (const f of fields) {
      if (typeof copy[f] === "string") copy[f] = new Date(copy[f] as string);
    }
    return copy;
  });
}

// ---------------------------------------------------------------------------
// Crear respaldo
// ---------------------------------------------------------------------------

export async function createBackup(formData: FormData): Promise<void> {
  await requireAdmin();

  const raw = String(formData.get("label") ?? "").trim();
  const label =
    raw ||
    new Intl.DateTimeFormat("es", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date()) + " (UTC)";

  const [
    consultants,
    skills,
    consultantSkills,
    engagements,
    engagementLeads,
    staffingBase,
    staffingOverrides,
    assignments,
    absences,
    holidays,
  ] = await Promise.all([
    prisma.consultant.findMany(),
    prisma.skill.findMany(),
    prisma.consultantSkill.findMany(),
    prisma.engagement.findMany(),
    prisma.engagementLead.findMany(),
    prisma.staffingBase.findMany(),
    prisma.staffingOverride.findMany(),
    prisma.assignment.findMany(),
    prisma.absence.findMany(),
    prisma.holiday.findMany(),
  ]);

  const payload = JSON.stringify({
    version: 1,
    data: {
      consultants,
      skills,
      consultantSkills,
      engagements,
      engagementLeads,
      staffingBase,
      staffingOverrides,
      assignments,
      absences,
      holidays,
    },
  });

  await prisma.databaseBackup.create({ data: { label, payload } });
  revalidatePath("/history");
}

// ---------------------------------------------------------------------------
// Restaurar respaldo
// ---------------------------------------------------------------------------

export async function restoreBackup(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("backupId") ?? "").trim();
  if (!id) return;

  const backup = await prisma.databaseBackup.findUniqueOrThrow({ where: { id } });
  const { data }: { data: BackupData } = JSON.parse(backup.payload);

  await prisma.$transaction(
    async (tx) => {
      // 1. Borrar en orden (respetando FK)
      await tx.staffingOverride.deleteMany();
      await tx.staffingBase.deleteMany();
      await tx.assignment.deleteMany();
      await tx.absence.deleteMany();
      await tx.engagementLead.deleteMany();
      await tx.consultantSkill.deleteMany();
      await tx.engagement.deleteMany();
      await tx.consultant.deleteMany();
      await tx.skill.deleteMany();
      await tx.holiday.deleteMany();

      // 2. Restaurar en orden (respetando FK)
      // El cast "as any" es necesario porque el payload JSON tipado genéricamente
      // no satisface los tipos exactos de Prisma (ej. HolidayCreateManyInput).
      // La corrección de fechas mediante toDates garantiza el valor correcto en runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const asAny = (d: AnyRecord[]): any => d;

      if (data.holidays.length)
        await tx.holiday.createMany({ data: asAny(toDates(data.holidays, ["date"])) });

      if (data.skills.length)
        await tx.skill.createMany({ data: asAny(data.skills) });

      if (data.consultants.length)
        await tx.consultant.createMany({ data: asAny(toDates(data.consultants, ["createdAt"])) });

      if (data.engagements.length)
        await tx.engagement.createMany({ data: asAny(toDates(data.engagements, ["startDate", "endDate", "createdAt"])) });

      if (data.consultantSkills.length)
        await tx.consultantSkill.createMany({ data: asAny(data.consultantSkills) });

      if (data.engagementLeads.length)
        await tx.engagementLead.createMany({ data: asAny(data.engagementLeads) });

      if (data.staffingBase.length)
        await tx.staffingBase.createMany({ data: asAny(toDates(data.staffingBase, ["startDate", "endDate"])) });

      if (data.staffingOverrides.length)
        await tx.staffingOverride.createMany({ data: asAny(toDates(data.staffingOverrides, ["weekStart"])) });

      if (data.assignments.length)
        await tx.assignment.createMany({ data: asAny(toDates(data.assignments, ["weekStart", "createdAt", "updatedAt"])) });

      if (data.absences.length)
        await tx.absence.createMany({ data: asAny(toDates(data.absences, ["weekStart", "createdAt"])) });
    },
    { timeout: 60_000 }
  );

  redirect("/history?restored=1");
}

// ---------------------------------------------------------------------------
// Eliminar respaldo
// ---------------------------------------------------------------------------

export async function deleteBackup(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("backupId") ?? "").trim();
  if (id) await prisma.databaseBackup.delete({ where: { id } }).catch(() => {});
  revalidatePath("/history");
}
