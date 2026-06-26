/**
 * Script de importación del archivo HH Program (xlsx).
 * Extrae consultores, engagements, asignaciones semanales y ausencias.
 *
 * Uso: npm run db:import
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Tablas de mapeo
// ---------------------------------------------------------------------------

const RANK_MAP: Record<string, string> = {
  "Intern (CS)": "TRAINEE",
  "Staff/Assistant": "STAFF",
  Senior: "SENIOR",
  Manager: "MANAGER",
  "Senior Manager": "SENIOR_MANAGER",
  "Executive Director": "ASSOCIATED_PARTNER",
  "Partner/Principal": "PARTNER",
};

const MONTH_NUM: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sept: 9, oct: 10, nov: 11, dic: 12,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "22-jun" + FY + mes → Date UTC del lunes de esa semana */
function parseWeekDate(semana: string, fy: string): Date {
  const [dayStr, monthAbbr] = semana.split("-");
  const day = parseInt(dayStr, 10);
  const month = MONTH_NUM[monthAbbr.toLowerCase()];
  // FY26 = jul-2025..jun-2026  →  meses jun(6) del FY26 = 2026
  // FY27 = jul-2026..jun-2027  →  jul-dic = 2026, ene-jun = 2027
  const year = fy === "FY26" ? 2026 : month >= 7 ? 2026 : 2027;
  return new Date(Date.UTC(year, month - 1, day));
}

/** "Apellido, Nombre" → "Nombre Apellido" */
function normalizeConsultantName(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw;
}

/**
 * "Enel Chile S.A. - 12474357" → { name: "Enel Chile S.A.", code: "12474357" }
 * "Chile NonChargeable"        → { name: "Chile NonChargeable", code: null }
 */
function parseClientName(raw: string): { name: string; code: string | null } {
  const match = raw.match(/^(.+?)\s+-\s+([A-Z0-9]+)$/);
  if (match) return { name: match[1].trim(), code: match[2].trim() };
  return { name: raw.trim(), code: null };
}

function engagementType(category: string, code: string | null): string {
  if (category === "External Engagement") return "CLIENT_PROJECT";
  return code ? "INTERNAL_WITH_CODE" : "INTERNAL_NO_CODE";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const filePath = path.join(process.cwd(), "data (26).xlsx");
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Export"];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  // --- Parsear columnas de semana (cols 4..N-2, la última es Total) ---
  const fyRow = rows[0];
  const semanaRow = rows[2];
  const WEEK_COL_START = 4;
  const WEEK_COL_END = rows[3].length - 2; // excluye columna "Total"

  const weekDates: Date[] = [];
  for (let col = WEEK_COL_START; col <= WEEK_COL_END; col++) {
    const fy = fyRow[col] as string;
    const semana = semanaRow[col] as string;
    if (semana && fy) weekDates.push(parseWeekDate(semana, fy));
  }
  console.log(`Semanas detectadas: ${weekDates.length} (${weekDates[0].toISOString().slice(0,10)} → ${weekDates.at(-1)!.toISOString().slice(0,10)})`);

  // --- Filas de detalle: rank + consultor + categoría + cliente (todos presentes, cliente ≠ "Total") ---
  const detailRows = rows.slice(4).filter(
    (r) =>
      r[0] && r[1] && r[2] && r[3] &&
      r[3] !== "Total" && r[1] !== "Total" && r[2] !== "Total" &&
      !String(r[0]).startsWith("Applied")
  );

  // ---------------------------------------------------------------------------
  // 1. Consultores
  // ---------------------------------------------------------------------------
  type ConsultantEntry = { xlsxName: string; name: string; rank: string };
  const consultantIndex = new Map<string, ConsultantEntry>();
  for (const row of detailRows) {
    const xlsxName = row[1] as string;
    if (!consultantIndex.has(xlsxName)) {
      consultantIndex.set(xlsxName, {
        xlsxName,
        name: normalizeConsultantName(xlsxName),
        rank: RANK_MAP[row[0] as string] ?? "STAFF",
      });
    }
  }

  console.log(`\nImportando ${consultantIndex.size} consultores...`);
  const consultantIdMap = new Map<string, string>(); // xlsxName → id en BD
  for (const { xlsxName, name, rank } of consultantIndex.values()) {
    const existing = await prisma.consultant.findFirst({ where: { name } });
    const record = existing
      ? await prisma.consultant.update({ where: { id: existing.id }, data: { rank } })
      : await prisma.consultant.create({ data: { name, rank } });
    consultantIdMap.set(xlsxName, record.id);
    console.log(`  ${existing ? "↺" : "+"} ${name} (${rank})`);
  }

  // ---------------------------------------------------------------------------
  // 2. Engagements (excluye Absence Engagement)
  // ---------------------------------------------------------------------------
  type EngagementEntry = {
    clientKey: string;
    name: string;
    code: string | null;
    type: string;
    firstWeek: Date;
    lastWeek: Date;
  };
  const engagementIndex = new Map<string, EngagementEntry>();

  for (const row of detailRows) {
    const category = row[2] as string;
    if (category === "Absence Engagement") continue;
    const clientKey = row[3] as string;
    const { name, code } = parseClientName(clientKey);
    const type = engagementType(category, code);

    for (let i = 0; i < weekDates.length; i++) {
        const rawHours = row[WEEK_COL_START + i] as number | null;
        if (!rawHours || rawHours <= 0) continue;
        const hours = Math.round(rawHours * 10) / 10;
      const week = weekDates[i];
      const entry = engagementIndex.get(clientKey);
      if (!entry) {
        engagementIndex.set(clientKey, { clientKey, name, code, type, firstWeek: week, lastWeek: week });
      } else {
        if (week < entry.firstWeek) entry.firstWeek = week;
        if (week > entry.lastWeek) entry.lastWeek = week;
      }
    }
  }

  console.log(`\nImportando ${engagementIndex.size} engagements...`);
  const engagementIdMap = new Map<string, string>(); // clientKey → id en BD
  for (const { clientKey, name, code, type, firstWeek, lastWeek } of engagementIndex.values()) {
    const existing = await prisma.engagement.findFirst({ where: { name } });
    const record = existing
      ? await prisma.engagement.update({
          where: { id: existing.id },
          data: { type, engagementCode: code, startDate: firstWeek, endDate: lastWeek },
        })
      : await prisma.engagement.create({
          data: { name, type, engagementCode: code, startDate: firstWeek, endDate: lastWeek },
        });
    engagementIdMap.set(clientKey, record.id);
    console.log(`  ${existing ? "↺" : "+"} [${type}] ${name}${code ? ` (${code})` : ""}`);
  }

  // ---------------------------------------------------------------------------
  // 3. Asignaciones y ausencias
  // ---------------------------------------------------------------------------
  // Acumula ausencias por (consultantId, weekStart) para consolidar múltiples
  // clientes non-chargeable en un solo registro.
  const absenceAccum = new Map<string, { consultantId: string; weekStart: Date; hours: number }>();

  let assignmentsCreated = 0;
  let assignmentsUpdated = 0;

  for (const row of detailRows) {
    const xlsxName = row[1] as string;
    const category = row[2] as string;
    const clientKey = row[3] as string;
    const consultantId = consultantIdMap.get(xlsxName);
    if (!consultantId) continue;

    for (let i = 0; i < weekDates.length; i++) {
      const hours = row[WEEK_COL_START + i] as number | null;
      if (!hours || hours <= 0) continue;
      const weekStart = weekDates[i];

      if (category === "Absence Engagement") {
        const key = `${consultantId}|${weekStart.toISOString()}`;
        const existing = absenceAccum.get(key);
        if (existing) existing.hours += hours;
        else absenceAccum.set(key, { consultantId, weekStart, hours });
      } else {
        const engagementId = engagementIdMap.get(clientKey);
        if (!engagementId) continue;
        const existing = await prisma.assignment.findUnique({
          where: { consultantId_engagementId_weekStart: { consultantId, engagementId, weekStart } },
        });
        if (existing) {
          await prisma.assignment.update({ where: { id: existing.id }, data: { hours } });
          assignmentsUpdated++;
        } else {
          await prisma.assignment.create({ data: { consultantId, engagementId, weekStart, hours } });
          assignmentsCreated++;
        }
      }
    }
  }

  console.log(`\nAsignaciones: +${assignmentsCreated} creadas, ↺${assignmentsUpdated} actualizadas`);

  // Persistir ausencias consolidadas
  let absencesCreated = 0;
  let absencesUpdated = 0;
  for (const { consultantId, weekStart, hours } of absenceAccum.values()) {
    const existing = await prisma.absence.findUnique({
      where: { consultantId_weekStart: { consultantId, weekStart } },
    });
    if (existing) {
      await prisma.absence.update({ where: { id: existing.id }, data: { hours } });
      absencesUpdated++;
    } else {
      await prisma.absence.create({ data: { consultantId, weekStart, hours } });
      absencesCreated++;
    }
  }
  console.log(`Ausencias:    +${absencesCreated} creadas, ↺${absencesUpdated} actualizadas`);
  console.log("\n✅ Importación completada.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
