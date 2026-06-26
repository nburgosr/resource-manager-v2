"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { getMonday } from "@/lib/week";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const toDate = (v: FormDataEntryValue | null) => new Date(`${str(v)}T00:00:00.000Z`);
const intval = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(v) || 0));
const floatval = (v: FormDataEntryValue | null) => Math.max(0, Number(v) || 0);

async function audit(userId: string, action: string, entity: string, entityId: string, details?: unknown) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, details: details ? JSON.stringify(details) : null },
  });
}

function refresh(engagementId?: string) {
  revalidatePath("/engagements");
  revalidatePath("/calendar");
  revalidatePath("/coverage");
  if (engagementId) revalidatePath(`/engagements/${engagementId}`);
}

// --- Engagement ---

export async function createEngagement(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const name = str(formData.get("name"));
  const type = str(formData.get("type"));
  if (!name || !type) return;

  const engagement = await prisma.engagement.create({
    data: {
      name,
      engagementName: str(formData.get("engagementName")) || null,
      type,
      engagementCode: str(formData.get("engagementCode")) || null,
      status: str(formData.get("status")) || "ACTIVE",
      startDate: toDate(formData.get("startDate")),
      endDate: toDate(formData.get("endDate")),
      partnerId: str(formData.get("partnerId")) || null,
    },
  });
  await audit(admin.id, "CREATE", "Engagement", engagement.id, { name, type });
  refresh(engagement.id);
  redirect(`/engagements/${engagement.id}`);
}

export async function updateEngagement(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return;

  await prisma.engagement.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      engagementName: str(formData.get("engagementName")) || null,
      type: str(formData.get("type")),
      engagementCode: str(formData.get("engagementCode")) || null,
      status: str(formData.get("status")) || "ACTIVE",
      startDate: toDate(formData.get("startDate")),
      endDate: toDate(formData.get("endDate")),
      partnerId: str(formData.get("partnerId")) || null,
    },
  });
  await audit(admin.id, "UPDATE", "Engagement", id);
  refresh(id);
}

export async function deleteEngagement(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return;
  await prisma.engagement.delete({ where: { id } });
  await audit(admin.id, "DELETE", "Engagement", id);
  refresh();
  redirect("/engagements");
}

// --- Liderazgo (managers/senior managers) ---

export async function addLead(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const engagementId = str(formData.get("engagementId"));
  const consultantId = str(formData.get("consultantId"));
  if (!engagementId || !consultantId) return;

  await prisma.engagementLead.upsert({
    where: { engagementId_consultantId: { engagementId, consultantId } },
    create: { engagementId, consultantId },
    update: {},
  });
  await audit(admin.id, "CREATE", "EngagementLead", `${engagementId}:${consultantId}`);
  refresh(engagementId);
}

export async function removeLead(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  const engagementId = str(formData.get("engagementId"));
  if (!id) return;
  await prisma.engagementLead.delete({ where: { id } });
  await audit(admin.id, "DELETE", "EngagementLead", id);
  refresh(engagementId);
}

// --- Necesidad base por rank ---

export async function setStaffingBase(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const engagementId = str(formData.get("engagementId"));
  const rank = str(formData.get("rank"));
  if (!engagementId || !rank) return;
  const persons = intval(formData.get("persons"));
  const hours = floatval(formData.get("hours"));

  if (persons === 0 && hours === 0) {
    await prisma.staffingBase.deleteMany({ where: { engagementId, rank } });
    await audit(admin.id, "DELETE", "StaffingBase", `${engagementId}:${rank}`);
    refresh(engagementId);
    return;
  }

  // Fechas: por defecto las del engagement si no se especifican.
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { startDate: true, endDate: true },
  });
  if (!engagement) return;
  const startDate = str(formData.get("startDate")) ? toDate(formData.get("startDate")) : engagement.startDate;
  const endDate = str(formData.get("endDate")) ? toDate(formData.get("endDate")) : engagement.endDate;

  await prisma.staffingBase.upsert({
    where: { engagementId_rank: { engagementId, rank } },
    create: { engagementId, rank, persons, hours, startDate, endDate },
    update: { persons, hours, startDate, endDate },
  });
  await audit(admin.id, "UPSERT", "StaffingBase", `${engagementId}:${rank}`, {
    persons,
    hours,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  });
  refresh(engagementId);
}

// --- Sobrescritura por semana ---

export async function setStaffingOverride(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const engagementId = str(formData.get("engagementId"));
  const rank = str(formData.get("rank"));
  const weekRaw = str(formData.get("weekStart"));
  if (!engagementId || !rank || !weekRaw) return;
  const weekStart = getMonday(toDate(formData.get("weekStart")));
  const persons = intval(formData.get("persons"));
  const hours = floatval(formData.get("hours"));

  await prisma.staffingOverride.upsert({
    where: { engagementId_weekStart_rank: { engagementId, weekStart, rank } },
    create: { engagementId, weekStart, rank, persons, hours },
    update: { persons, hours },
  });
  await audit(admin.id, "UPSERT", "StaffingOverride", `${engagementId}:${rank}`, {
    weekStart: weekStart.toISOString().slice(0, 10),
    persons,
    hours,
  });
  refresh(engagementId);
}

export async function deleteStaffingOverride(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  const engagementId = str(formData.get("engagementId"));
  if (!id) return;
  await prisma.staffingOverride.delete({ where: { id } });
  await audit(admin.id, "DELETE", "StaffingOverride", id);
  refresh(engagementId);
}
