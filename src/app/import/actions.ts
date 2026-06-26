"use server";

import * as XLSX from "xlsx";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { parseHHProgram } from "@/lib/xlsx-parser";

export async function uploadXlsx(formData: FormData): Promise<void> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws = wb.Sheets["Export"];
  if (!ws) throw new Error('Hoja "Export" no encontrada en el archivo.');

  const data = parseHHProgram(ws);

  const pending = await prisma.pendingImport.create({
    data: { filename: file.name, payload: JSON.stringify(data) },
  });

  redirect(`/import/${pending.id}`);
}

export async function cancelPending(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (id) await prisma.pendingImport.delete({ where: { id } });
  redirect("/import");
}
