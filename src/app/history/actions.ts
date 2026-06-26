"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

// ---------------------------------------------------------------------------
// Tipos internos del payload
// ---------------------------------------------------------------------------

type BackupData = {
  consultants: object[];
  skills: object[];
  consultantSkills: object[];
  engagements: object[];
  engagementLeads: object[];
  staffingBase: object[];
  staffingOverrides: object[];
  assignments: object[];
  absences: object[];
  holidays: object[];
};

// Convierte strings ISO de vuelta a Date para los campos DateTime conocidos.
function toDates<T extends Record<string, unknown>>(
  records: object[],
  fields: string[]
): T[] {
  return (records as Record<string, unknown>[]).map((r) => {
    const copy = { ...r };
    for (const f of fields) {
      if (typeof copy[f] === "string") copy[f] = new Date(copy[f] as string);
    }
    return copy as T;
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
      if (data.holidays.length)
        await tx.holiday.createMany({
          data: toDates(data.holidays, ["date"]),
        });

      if (data.skills.length)
        await tx.skill.createMany({ data: data.skills as Parameters<typeof tx.skill.createMany>[0]["data"] });

      if (data.consultants.length)
        await tx.consultant.createMany({
          data: toDates(data.consultants, ["createdAt"]),
        });

      if (data.engagements.length)
        await tx.engagement.createMany({
          data: toDates(data.engagements, ["startDate", "endDate", "createdAt"]),
        });

      if (data.consultantSkills.length)
        await tx.consultantSkill.createMany({
          data: data.consultantSkills as Parameters<typeof tx.consultantSkill.createMany>[0]["data"],
        });

      if (data.engagementLeads.length)
        await tx.engagementLead.createMany({
          data: data.engagementLeads as Parameters<typeof tx.engagementLead.createMany>[0]["data"],
        });

      if (data.staffingBase.length)
        await tx.staffingBase.createMany({
          data: toDates(data.staffingBase, ["startDate", "endDate"]),
        });

      if (data.staffingOverrides.length)
        await tx.staffingOverride.createMany({
          data: toDates(data.staffingOverrides, ["weekStart"]),
        });

      if (data.assignments.length)
        await tx.assignment.createMany({
          data: toDates(data.assignments, ["weekStart", "createdAt", "updatedAt"]),
        });

      if (data.absences.length)
        await tx.absence.createMany({
          data: toDates(data.absences, ["weekStart", "createdAt"]),
        });
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
