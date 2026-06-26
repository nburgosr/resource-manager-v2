"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { addWeeks, formatDay, getMonday } from "@/lib/week";

function refresh() {
  revalidatePath("/calendar");
  revalidatePath("/coverage");
}

function parseWeek(value: FormDataEntryValue | null): Date {
  return new Date(`${String(value)}T00:00:00.000Z`);
}

/** Crea o actualiza (por consultor + engagement + semana) las horas asignadas. */
export async function upsertAssignment(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const consultantId = String(formData.get("consultantId"));
  const engagementId = String(formData.get("engagementId"));
  const weekStart = parseWeek(formData.get("weekStart"));
  const hours = Number(formData.get("hours"));

  if (!consultantId || !engagementId || !Number.isFinite(hours) || hours <= 0) return;

  const assignment = await prisma.assignment.upsert({
    where: {
      consultantId_engagementId_weekStart: { consultantId, engagementId, weekStart },
    },
    create: { consultantId, engagementId, weekStart, hours },
    update: { hours },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "UPSERT",
      entity: "Assignment",
      entityId: assignment.id,
      details: JSON.stringify({ consultantId, engagementId, weekStart: String(formData.get("weekStart")), hours }),
    },
  });

  refresh();
}

/** Elimina una asignación. */
export async function deleteAssignment(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) return;

  await prisma.assignment.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { userId: admin.id, action: "DELETE", entity: "Assignment", entityId: id },
  });

  refresh();
}

/**
 * Crea o actualiza asignaciones para un rango de semanas.
 * weekStart = semana desde la que aplica.
 * weekEnd   = última semana (inclusive); si no se pasa, solo aplica weekStart.
 */
export async function upsertAssignmentRange(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const consultantId = String(formData.get("consultantId"));
  const engagementId = String(formData.get("engagementId"));
  const weekStart    = parseWeek(formData.get("weekStart"));
  const rawEnd       = formData.get("weekEnd");
  const weekEnd      = rawEnd
    ? getMonday(new Date(`${String(rawEnd)}T00:00:00.000Z`))
    : weekStart;
  const hours = Number(formData.get("hours"));

  if (!consultantId || !engagementId || !Number.isFinite(hours) || hours <= 0) return;
  if (weekEnd < weekStart) return;

  // Transacción para garantizar que todas las semanas se escriben o ninguna.
  const { ids, count } = await prisma.$transaction(
    async (tx) => {
      const ids: string[] = [];
      let cur = weekStart;
      let count = 0;
      while (cur <= weekEnd && count < 53) {
        const ws = new Date(cur.getTime());
        const a = await tx.assignment.upsert({
          where: { consultantId_engagementId_weekStart: { consultantId, engagementId, weekStart: ws } },
          create: { consultantId, engagementId, weekStart: ws, hours },
          update: { hours },
          select: { id: true },
        });
        ids.push(a.id);
        cur = addWeeks(cur, 1);
        count++;
      }
      return { ids, count };
    },
    { timeout: 15000 }
  );

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "UPSERT",
      entity: "Assignment",
      entityId: ids[0] ?? "range",
      details: JSON.stringify({
        consultantId, engagementId,
        weekStart: formatDay(weekStart),
        weekEnd: formatDay(weekEnd),
        hours,
        weeksCount: count,
      }),
    },
  });

  refresh();
}

/** Congela el estado de asignaciones de la semana en un snapshot histórico. */
export async function snapshotWeek(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const weekStart = parseWeek(formData.get("weekStart"));

  const assignments = await prisma.assignment.findMany({
    where: { weekStart },
    include: { consultant: true, engagement: true },
  });

  const snapshot = await prisma.weeklySnapshot.create({
    data: { weekStart, payload: JSON.stringify(assignments) },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "CREATE",
      entity: "WeeklySnapshot",
      entityId: snapshot.id,
      details: JSON.stringify({ weekStart: String(formData.get("weekStart")), count: assignments.length }),
    },
  });

  refresh();
}
