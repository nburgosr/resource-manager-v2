/**
 * Parser puro del archivo HH Program (xlsx) de EY — formato 2027.
 * Columnas de cabecera (fila 3):
 *   col[0] Ranks FY | col[1] Resource Name | col[2] Engagement category
 *   col[3] Client   | col[4] GFIS engagement name | col[5] Engagement number
 *   col[6..N-1] semanas | col[N] Total
 *
 * No tiene dependencias de Prisma; solo lee y estructura los datos.
 * Reutilizado por el script CLI (prisma/import-xlsx.ts) y el módulo web de importación.
 */
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface XlsxConsultant {
  xlsxName: string; // nombre original del xlsx
  name: string;     // nombre normalizado
  rank: string;     // constante de rank (TRAINEE, STAFF, …)
}

export interface XlsxEngagement {
  engagementKey: string; // clave interna: "<GFIS name>|<code>"
  clientName: string;    // nombre del cliente (col Client)
  name: string;          // nombre del engagement (col GFIS engagement name)
  code: string | null;   // código de engagement (col Engagement number) o null
  type: string;          // CLIENT_PROJECT | INTERNAL_WITH_CODE | INTERNAL_NO_CODE
  firstWeek: string;     // ISO date del primer lunes con horas
  lastWeek: string;      // ISO date del último lunes con horas
}

export interface XlsxAssignment {
  consultantName: string; // nombre normalizado
  engagementKey: string;  // clave del engagement
  weekStart: string;      // ISO date YYYY-MM-DD
  hours: number;
}

export interface XlsxAbsence {
  consultantName: string;
  weekStart: string;
  hours: number;
}

export interface ParsedXlsxData {
  consultants: XlsxConsultant[];
  engagements: XlsxEngagement[];
  assignments: XlsxAssignment[];
  absences: XlsxAbsence[];
  weekRange: { start: string; end: string };
}

// ---------------------------------------------------------------------------
// Cabeceras esperadas en el nuevo formato (fila 3, índices 0-5)
// ---------------------------------------------------------------------------

const EXPECTED_HEADERS = [
  "Ranks FY",
  "Resource Name",
  "Engagement category",
  "Client",
  "GFIS engagement name",
  "Engagement number",
] as const;

const WEEK_COL_START = 6;

// ---------------------------------------------------------------------------
// Tablas de mapeo
// ---------------------------------------------------------------------------

export const RANK_MAP: Record<string, string> = {
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

function parseWeekDate(semana: string, fy: string): string {
  const [dayStr, monthAbbr] = semana.split("-");
  const day = parseInt(dayStr, 10);
  const month = MONTH_NUM[monthAbbr.toLowerCase()];
  const year = fy === "FY26" ? 2026 : month >= 7 ? 2026 : 2027;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function normalizeConsultantName(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw;
}

function engagementType(category: string, code: string | null): string {
  if (category === "External Engagement") return "CLIENT_PROJECT";
  return code ? "INTERNAL_WITH_CODE" : "INTERNAL_NO_CODE";
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

export function parseHHProgram(ws: XLSX.WorkSheet): ParsedXlsxData {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  // ── Validar formato ────────────────────────────────────────────────────────
  const headerRow = rows[3] as (string | null)[];
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headerRow[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(
        `Formato de archivo no admitido. ` +
        `Se esperaba la columna ${i + 1} con el valor "${EXPECTED_HEADERS[i]}", ` +
        `pero se encontró "${headerRow[i] ?? "(vacío)"}".\n` +
        `Asegúrate de exportar el archivo HH Program con el formato actual de EY (6 columnas de cabecera).`
      );
    }
  }

  const fyRow    = rows[0] as (string | null)[];
  const semanaRow = rows[2] as (string | null)[];
  const WEEK_COL_END = headerRow.length - 2; // excluye columna "Total"

  // ── Columnas de semana ────────────────────────────────────────────────────
  const weekDates: string[] = [];
  for (let col = WEEK_COL_START; col <= WEEK_COL_END; col++) {
    const fy     = fyRow[col];
    const semana = semanaRow[col];
    if (semana && fy) weekDates.push(parseWeekDate(semana, fy));
  }

  if (weekDates.length === 0) {
    throw new Error("No se encontraron columnas de semana en el archivo.");
  }

  // ── Filas de detalle (leaf rows) ──────────────────────────────────────────
  // Leaf row: las 6 columnas de cabecera tienen valor y ninguna es "Total"
  const detailRows = rows.slice(4).filter((r) => {
    for (let i = 0; i < WEEK_COL_START; i++) {
      if (!r[i] || String(r[i]) === "Total") return false;
    }
    return !String(r[0]).startsWith("Applied");
  });

  // ── Consultores ───────────────────────────────────────────────────────────
  const consultantMap = new Map<string, XlsxConsultant>();
  for (const row of detailRows) {
    const xlsxName = String(row[1]);
    if (!consultantMap.has(xlsxName)) {
      consultantMap.set(xlsxName, {
        xlsxName,
        name: normalizeConsultantName(xlsxName),
        rank: RANK_MAP[String(row[0])] ?? "STAFF",
      });
    }
  }

  // ── Engagements ───────────────────────────────────────────────────────────
  const engagementMap = new Map<string, XlsxEngagement>();
  for (const row of detailRows) {
    const category       = String(row[2]);
    if (category === "Absence Engagement") continue;

    const clientName     = String(row[3]);
    const engagementName = String(row[4]);
    const rawCode        = row[5];
    const code           = rawCode !== null ? String(rawCode) : null;
    const engagementKey  = `${engagementName}|${code ?? ""}`;
    const type           = engagementType(category, code);

    for (let i = 0; i < weekDates.length; i++) {
      const rawHours = row[WEEK_COL_START + i] as number | null;
      if (!rawHours || rawHours <= 0) continue;
      const week = weekDates[i];
      const entry = engagementMap.get(engagementKey);
      if (!entry) {
        engagementMap.set(engagementKey, { engagementKey, clientName, name: engagementName, code, type, firstWeek: week, lastWeek: week });
      } else {
        if (week < entry.firstWeek) entry.firstWeek = week;
        if (week > entry.lastWeek)  entry.lastWeek  = week;
      }
    }
  }

  // ── Asignaciones + ausencias ──────────────────────────────────────────────
  const assignments: XlsxAssignment[] = [];
  const absenceAccum = new Map<string, XlsxAbsence>();

  for (const row of detailRows) {
    const consultantName = normalizeConsultantName(String(row[1]));
    const category       = String(row[2]);
    const engagementKey  = `${String(row[4])}|${row[5] !== null ? String(row[5]) : ""}`;

    for (let i = 0; i < weekDates.length; i++) {
      const rawHours = row[WEEK_COL_START + i] as number | null;
      if (!rawHours || rawHours <= 0) continue;
      const hours     = Math.round(rawHours * 10) / 10;
      const weekStart = weekDates[i];

      if (category === "Absence Engagement") {
        const key      = `${consultantName}|${weekStart}`;
        const existing = absenceAccum.get(key);
        if (existing) existing.hours = Math.round((existing.hours + hours) * 10) / 10;
        else absenceAccum.set(key, { consultantName, weekStart, hours });
      } else {
        assignments.push({ consultantName, engagementKey, weekStart, hours });
      }
    }
  }

  return {
    consultants: [...consultantMap.values()],
    engagements: [...engagementMap.values()],
    assignments,
    absences: [...absenceAccum.values()],
    weekRange: {
      start: weekDates[0],
      end:   weekDates[weekDates.length - 1],
    },
  };
}
