"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { RANKS, type Rank } from "@/lib/constants";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function audit(userId: string, action: string, entityId: string, details?: unknown) {
  await prisma.auditLog.create({
    data: { userId, action, entity: "Consultant", entityId, details: details ? JSON.stringify(details) : null },
  });
}

function refresh() {
  revalidatePath("/consultants");
  revalidatePath("/calendar");
  revalidatePath("/coverage");
}

export async function createConsultant(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const name = str(formData.get("name"));
  const rank = str(formData.get("rank"));
  if (!name || !RANKS.includes(rank as Rank)) return;

  const c = await prisma.consultant.create({
    data: { name, rank, status: str(formData.get("status")) || "ACTIVE" },
  });
  await audit(admin.id, "CREATE", c.id, { name, rank });
  refresh();
}

export async function updateConsultant(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  const rank = str(formData.get("rank"));
  if (!id || !RANKS.includes(rank as Rank)) return;

  await prisma.consultant.update({
    where: { id },
    data: { name: str(formData.get("name")), rank, status: str(formData.get("status")) || "ACTIVE" },
  });
  await audit(admin.id, "UPDATE", id);
  refresh();
}

export async function deleteConsultant(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return;
  await prisma.consultant.delete({ where: { id } });
  await audit(admin.id, "DELETE", id);
  refresh();
}
