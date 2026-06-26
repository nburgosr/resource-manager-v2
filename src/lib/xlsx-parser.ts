/**
 * Parser puro del archivo HH Program (xlsx) de EY.
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
  clientKey: string;   // clave original (ej. "Enel Chile S.A. - 12474357")
  name: string;        // nombre limpio
  code: string | null; // código de engagement o null
  type: string;        // CLIENT_PROJECT | INTERNAL_WITH_CODE | INTERNAL_NO_CODE
  firstWeek: string;   // ISO date del primer lunes con horas
  lastWeek: string;    // ISO date del último lunes con horas
}

export interface XlsxAssignment {
  consultantName: string; // nombre normalizado
  clientKey: string;      // clave de engagement
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
// Función principal
// ---------------------------------------------------------------------------

export function parseHHProgram(ws: XLSX.WorkSheet): ParsedXlsxData {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  const fyRow = rows[0];
  const semanaRow = rows[2];
  const WEEK_COL_START = 4;
  const WEEK_COL_END = (rows[3] as (string | number | null)[]).length - 2;

  // Columnas de semana
  const weekDates: string[] = [];
  for (let col = WEEK_COL_START; col <= WEEK_COL_END; col++) {
    const fy = fyRow[col] as string;
    const semana = semanaRow[col] as string;
    if (semana && fy) weekDates.push(parseWeekDate(semana, fy));
  }

  // Filas de detalle (excluye subtotales y cabeceras aplicadas)
  const detailRows = rows.slice(4).filter(
    (r) =>
      r[0] && r[1] && r[2] && r[3] &&
      r[3] !== "Total" && r[1] !== "Total" && r[2] !== "Total" &&
      !String(r[0]).startsWith("Applied")
  );

  // --- Consultores ---
  const consultantMap = new Map<string, XlsxConsultant>();
  for (const row of detailRows) {
    const xlsxName = row[1] as string;
    if (!consultantMap.has(xlsxName)) {
      consultantMap.set(xlsxName, {
        xlsxName,
        name: normalizeConsultantName(xlsxName),
        rank: RANK_MAP[row[0] as string] ?? "STAFF",
      });
    }
  }

  // --- Engagements ---
  const engagementMap = new Map<string, XlsxEngagement>();
  for (const row of detailRows) {
    const category = row[2] as string;
    if (category === "Absence Engagement") continue;
    const clientKey = row[3] as string;
    const { name, code } = parseClientName(clientKey);
    const type = engagementType(category, code);

    for (let i = 0; i < weekDates.length; i++) {
      const rawHours = row[WEEK_COL_START + i] as number | null;
      if (!rawHours || rawHours <= 0) continue;
      const week = weekDates[i];
      const entry = engagementMap.get(clientKey);
      if (!entry) {
        engagementMap.set(clientKey, { clientKey, name, code, type, firstWeek: week, lastWeek: week });
      } else {
        if (week < entry.firstWeek) entry.firstWeek = week;
        if (week > entry.lastWeek) entry.lastWeek = week;
      }
    }
  }

  // --- Asignaciones + ausencias ---
  const assignments: XlsxAssignment[] = [];
  const absenceAccum = new Map<string, XlsxAbsence>();

  for (const row of detailRows) {
    const xlsxName = row[1] as string;
    const category = row[2] as string;
    const clientKey = row[3] as string;
    const consultantName = normalizeConsultantName(xlsxName);

    for (let i = 0; i < weekDates.length; i++) {
      const rawHours = row[WEEK_COL_START + i] as number | null;
      if (!rawHours || rawHours <= 0) continue;
      const hours = Math.round(rawHours * 10) / 10;
      const weekStart = weekDates[i];

      if (category === "Absence Engagement") {
        const key = `${consultantName}|${weekStart}`;
        const existing = absenceAccum.get(key);
        if (existing) existing.hours = Math.round((existing.hours + hours) * 10) / 10;
        else absenceAccum.set(key, { consultantName, weekStart, hours });
      } else {
        assignments.push({ consultantName, clientKey, weekStart, hours });
      }
    }
  }

  return {
    consultants: [...consultantMap.values()],
    engagements: [...engagementMap.values()],
    assignments,
    absences: [...absenceAccum.values()],
    weekRange: {
      start: weekDates[0] ?? "",
      end: weekDates[weekDates.length - 1] ?? "",
    },
  };
}
