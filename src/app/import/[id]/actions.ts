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
  // Se usa upsert para manejar conflictos de forma atómica en PostgreSQL.
  let upsertedAssignments = 0;

  for (const a of data.assignments) {
    const consultantId = consultantIdMap.get(a.consultantName);
    const engagementId = engagementIdByClientKey.get(a.clientKey);
    if (!consultantId || !engagementId) continue;

    const weekStart = new Date(a.weekStart);
    await prisma.assignment.upsert({
      where: { consultantId_engagementId_weekStart: { consultantId, engagementId, weekStart } },
      create: { consultantId, engagementId, weekStart, hours: a.hours },
      update: { hours: a.hours },
    });
    upsertedAssignments++;
  }

  // ── 4. Ausencias ──────────────────────────────────────────────────────────
  let upsertedAbsences = 0;

  for (const a of data.absences) {
    const consultantId = consultantIdMap.get(a.consultantName);
    if (!consultantId) continue;
    const weekStart = new Date(a.weekStart);

    await prisma.absence.upsert({
      where: { consultantId_weekStart: { consultantId, weekStart } },
      create: { consultantId, weekStart, hours: a.hours },
      update: { hours: a.hours },
    });
    upsertedAbsences++;
  }

  // ── 5. Audit log ──────────────────────────────────────────────────────────
  // Registro resumen de la importación
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "IMPORT",
      entity: "Import",
      entityId: id,
      details: JSON.stringify({
        filename: pending.filename,
        upsertedAssignments,
        upsertedAbsences,
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
