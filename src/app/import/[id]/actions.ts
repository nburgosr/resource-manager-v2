"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { RANKS, type Rank } from "@/lib/constants";
import type { ParsedXlsxData } from "@/lib/xlsx-parser";

const rankIndex = (r: string) => RANKS.indexOf(r as Rank);

export async function confirmImport(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("importId") ?? "").trim();
  if (!id) return;

  const pending = await prisma.pendingImport.findUniqueOrThrow({ where: { id } });
  const data: ParsedXlsxData = JSON.parse(pending.payload);

  // ── 1. Consultores ────────────────────────────────────────────────────────
  const consultantIdMap = new Map<string, string>(); // normalizedName → dbId
  for (const c of data.consultants) {
    const existing = await prisma.consultant.findFirst({ where: { name: c.name } });
    if (existing) {
      // Solo actualizar rank si es un ascenso (nunca degradar)
      if (existing.rank !== c.rank && rankIndex(c.rank) > rankIndex(existing.rank)) {
        await prisma.consultant.update({ where: { id: existing.id }, data: { rank: c.rank } });
      }
      consultantIdMap.set(c.name, existing.id);
    } else {
      const created = await prisma.consultant.create({ data: { name: c.name, rank: c.rank } });
      consultantIdMap.set(c.name, created.id);
    }
  }

  // ── 2. Engagements ────────────────────────────────────────────────────────
  const engagementIdByClientKey = new Map<string, string>(); // clientKey → dbId
  for (const e of data.engagements) {
    const existing = await prisma.engagement.findFirst({ where: { name: e.name } });
    const startDate = new Date(e.firstWeek);
    const endDate = new Date(e.lastWeek);
    if (existing) {
      await prisma.engagement.update({
        where: { id: existing.id },
        data: {
          type: e.type,
          engagementCode: e.code,
          startDate: existing.startDate < startDate ? existing.startDate : startDate,
          endDate: existing.endDate > endDate ? existing.endDate : endDate,
        },
      });
      engagementIdByClientKey.set(e.clientKey, existing.id);
    } else {
      const created = await prisma.engagement.create({
        data: { name: e.name, type: e.type, engagementCode: e.code, startDate, endDate },
      });
      engagementIdByClientKey.set(e.clientKey, created.id);
    }
  }

  // ── 3. Asignaciones ───────────────────────────────────────────────────────
  let newAssignments = 0;
  const updatedAssignments: Array<{ id: string; oldHours: number; newHours: number; engagementName: string; weekStart: string; consultantName: string }> = [];

  for (const a of data.assignments) {
    const consultantId = consultantIdMap.get(a.consultantName);
    const engagementId = engagementIdByClientKey.get(a.clientKey);
    if (!consultantId || !engagementId) continue;

    const weekStart = new Date(a.weekStart);
    const existing = await prisma.assignment.findUnique({
      where: { consultantId_engagementId_weekStart: { consultantId, engagementId, weekStart } },
      include: { engagement: true },
    });

    if (!existing) {
      await prisma.assignment.create({ data: { consultantId, engagementId, weekStart, hours: a.hours } });
      newAssignments++;
    } else if (Math.abs(existing.hours - a.hours) > 0.05) {
      await prisma.assignment.update({ where: { id: existing.id }, data: { hours: a.hours } });
      updatedAssignments.push({
        id: existing.id,
        oldHours: existing.hours,
        newHours: a.hours,
        engagementName: existing.engagement.name,
        weekStart: a.weekStart,
        consultantName: a.consultantName,
      });
    }
  }

  // ── 4. Ausencias ──────────────────────────────────────────────────────────
  let newAbsences = 0;
  let updatedAbsences = 0;

  for (const a of data.absences) {
    const consultantId = consultantIdMap.get(a.consultantName);
    if (!consultantId) continue;
    const weekStart = new Date(a.weekStart);

    const existing = await prisma.absence.findUnique({
      where: { consultantId_weekStart: { consultantId, weekStart } },
    });
    if (!existing) {
      await prisma.absence.create({ data: { consultantId, weekStart, hours: a.hours } });
      newAbsences++;
    } else if (Math.abs(existing.hours - a.hours) > 0.05) {
      await prisma.absence.update({ where: { id: existing.id }, data: { hours: a.hours } });
      updatedAbsences++;
    }
  }

  // ── 5. Audit log ──────────────────────────────────────────────────────────
  // Registro individual por cada asignación modificada
  for (const u of updatedAssignments) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "UPDATE",
        entity: "Assignment",
        entityId: u.id,
        details: JSON.stringify({
          consultantName: u.consultantName,
          engagementName: u.engagementName,
          weekStart: u.weekStart,
          oldHours: u.oldHours,
          newHours: u.newHours,
          source: "import",
        }),
      },
    });
  }

  // Registro resumen de la importación
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "IMPORT",
      entity: "Import",
      entityId: id,
      details: JSON.stringify({
        filename: pending.filename,
        newConsultants: data.consultants.filter((c) => !consultantIdMap.has(c.name)).length,
        newEngagements: data.engagements.filter((e) => !engagementIdByClientKey.has(e.clientKey)).length,
        newAssignments,
        updatedAssignments: updatedAssignments.length,
        newAbsences,
        updatedAbsences,
      }),
    },
  });

  // ── 6. Eliminar pending import ────────────────────────────────────────────
  await prisma.pendingImport.delete({ where: { id } });

  redirect("/history");
}

export async function cancelImport(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("importId") ?? "").trim();
  if (id) await prisma.pendingImport.delete({ where: { id } }).catch(() => {});
  redirect("/import");
}
