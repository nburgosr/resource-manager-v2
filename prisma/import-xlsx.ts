/**
 * Script de importación del archivo HH Program (xlsx) — formato 2027.
 * Columnas de cabecera (fila 3):
 *   col[0] Ranks FY | col[1] Resource Name | col[2] Engagement category
 *   col[3] Client   | col[4] GFIS engagement name | col[5] Engagement number
 *   col[6..N-1] semanas | col[N] Total
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

// Cabeceras esperadas en el nuevo formato
const EXPECTED_HEADERS = [
  "Ranks FY",
  "Resource Name",
  "Engagement category",
  "Client",
  "GFIS engagement name",
  "Engagement number",
];

const WEEK_COL_START = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "22-jun" + FY → Date UTC del lunes de esa semana */
function parseWeekDate(semana: string, fy: string): Date {
  const [dayStr, monthAbbr] = semana.split("-");
  const day = parseInt(dayStr, 10);
  const month = MONTH_NUM[monthAbbr.toLowerCase()];
  const year = fy === "FY26" ? 2026 : month >= 7 ? 2026 : 2027;
  return new Date(Date.UTC(year, month - 1, day));
}

/** "Apellido, Nombre" → "Nombre Apellido" */
function normalizeConsultantName(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw;
}

function engagementType(category: string, code: string | null): string {
  if (category === "External Engagement") return "CLIENT_PROJECT";
  return code ? "INTERNAL_WITH_CODE" : "INTERNAL_NO_CODE";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const filePath = path.join(process.cwd(), "data (27).xlsx");
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Export"];
  if (!ws) throw new Error('Hoja "Export" no encontrada.');

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  // --- Validar formato ---
  const headerRow = rows[3] as (string | null)[];
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headerRow[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(
        `Formato no admitido. Col ${i} esperaba "${EXPECTED_HEADERS[i]}", encontró "${headerRow[i] ?? "(vacío)"}".`
      );
    }
  }

  // --- Parsear columnas de semana (cols 6..N-2, la última es Total) ---
  const fyRow = rows[0];
  const semanaRow = rows[2];
  const WEEK_COL_END = rows[3].length - 2;

  const weekDates: Date[] = [];
  for (let col = WEEK_COL_START; col <= WEEK_COL_END; col++) {
    const fy = fyRow[col] as string;
    const semana = semanaRow[col] as string;
    if (semana && fy) weekDates.push(parseWeekDate(semana, fy));
  }
  console.log(`Semanas detectadas: ${weekDates.length} (${weekDates[0].toISOString().slice(0,10)} → ${weekDates.at(-1)!.toISOString().slice(0,10)})`);

  // --- Filas de detalle: las 6 columnas presentes y ninguna es "Total" ---
  const detailRows = rows.slice(4).filter((r) => {
    for (let i = 0; i < WEEK_COL_START; i++) {
      if (!r[i] || String(r[i]) === "Total") return false;
    }
    return !String(r[0]).startsWith("Applied");
  });

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
    engagementKey: string;
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
    const engagementName = String(row[4]);
    const rawCode        = row[5];
    const code           = rawCode !== null ? String(rawCode) : null;
    const engagementKey  = `${engagementName}|${code ?? ""}`;
    const type           = engagementType(category, code);

    for (let i = 0; i < weekDates.length; i++) {
        const rawHours = row[WEEK_COL_START + i] as number | null;
        if (!rawHours || rawHours <= 0) continue;
      const week = weekDates[i];
      const entry = engagementIndex.get(engagementKey);
      if (!entry) {
        engagementIndex.set(engagementKey, { engagementKey, name: engagementName, code, type, firstWeek: week, lastWeek: week });
      } else {
        if (week < entry.firstWeek) entry.firstWeek = week;
        if (week > entry.lastWeek) entry.lastWeek = week;
      }
    }
  }

  console.log(`\nImportando ${engagementIndex.size} engagements...`);
  const engagementIdMap = new Map<string, string>(); // engagementKey → id en BD
  for (const { engagementKey, name, code, type, firstWeek, lastWeek } of engagementIndex.values()) {
    const existing = await prisma.engagement.findFirst({ where: { name } });
    const record = existing
      ? await prisma.engagement.update({
          where: { id: existing.id },
          data: { type, engagementCode: code, startDate: firstWeek, endDate: lastWeek },
        })
      : await prisma.engagement.create({
          data: { name, type, engagementCode: code, startDate: firstWeek, endDate: lastWeek },
        });
    engagementIdMap.set(engagementKey, record.id);
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
    const engagementKey = `${String(row[4])}|${row[5] !== null ? String(row[5]) : ""}`;
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
        const engagementId = engagementIdMap.get(engagementKey);
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
