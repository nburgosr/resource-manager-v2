"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function refresh() {
  revalidatePath("/holidays");
  revalidatePath("/calendar");
  revalidatePath("/coverage");
}

export async function addHoliday(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const dateStr = str(formData.get("date"));
  const name = str(formData.get("name"));
  if (!dateStr || !name) return;
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const holiday = await prisma.holiday.upsert({
    where: { date },
    create: { date, name },
    update: { name },
  });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: "UPSERT", entity: "Holiday", entityId: holiday.id, details: JSON.stringify({ date: dateStr, name }) },
  });
  refresh();
}

export async function deleteHoliday(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return;
  await prisma.holiday.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: "DELETE", entity: "Holiday", entityId: id },
  });
  refresh();
}
