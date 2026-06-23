// Lógica de semanas y capacidad horaria.
//
// Capacidad semanal máxima: 41,2 h
//   Lunes a jueves: 8,8 h/día  → 35,2 h
//   Viernes:        6,0 h/día  →  6,0 h
// Los feriados (lun-vie) descuentan las horas de ese día.

export const DAILY_HOURS = {
  // 0 = domingo … 6 = sábado
  1: 8.8, // lunes
  2: 8.8, // martes
  3: 8.8, // miércoles
  4: 8.8, // jueves
  5: 6.0, // viernes
} as const;

export const MAX_WEEKLY_HOURS = 41.2;

/** Devuelve el lunes (UTC, 00:00) de la semana que contiene `date`. */
export function getMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // retrocede hasta el lunes
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** Las 5 fechas (lun-vie) de la semana cuyo lunes es `monday`. */
export function weekdaysOf(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

/** Compara dos fechas por día (ignora la hora). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Capacidad horaria de un consultor para la semana que inicia en `monday`,
 * descontando los feriados que caigan de lunes a viernes.
 */
export function weeklyCapacity(monday: Date, holidays: Date[]): number {
  return weekdaysOf(monday).reduce((total, day) => {
    const isHoliday = holidays.some((h) => isSameDay(h, day));
    if (isHoliday) return total;
    const hours = DAILY_HOURS[day.getUTCDay() as keyof typeof DAILY_HOURS] ?? 0;
    return total + hours;
  }, 0);
}

/** Formato corto YYYY-MM-DD (UTC) para etiquetas. */
export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Devuelve el lunes desplazado `n` semanas (n puede ser negativo). */
export function addWeeks(monday: Date, n: number): Date {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d;
}

/**
 * Interpreta el parámetro de semana (YYYY-MM-DD) y devuelve siempre el lunes
 * correspondiente. Si no es válido, usa la semana actual.
 */
export function parseWeekParam(value?: string | null): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return getMonday(parsed);
  }
  return getMonday(new Date());
}

const WEEKDAY_LABEL = ["lun", "mar", "mié", "jue", "vie"];

/** Rango legible de la semana, p.ej. "9 – 13 jun 2026". */
export function formatWeekRange(monday: Date): string {
  const days = weekdaysOf(monday);
  const friday = days[4];
  const fmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });
  const year = friday.getUTCFullYear();
  return `${fmt.format(monday)} – ${fmt.format(friday)} ${year}`;
}

export { WEEKDAY_LABEL };

/** Número de semana ISO-8601 (la semana 1 es la que contiene el primer jueves). */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // jueves de esta semana
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/**
 * Semanas ISO de un año: cada una con su lunes, su número de semana y el mes
 * (0-11) al que pertenece según su jueves (día representativo de la semana ISO).
 */
export function weeksOfISOYear(year: number): { monday: Date; week: number; month: number }[] {
  const monday = getMonday(new Date(Date.UTC(year, 0, 4))); // semana que contiene el 4 de enero
  const out: { monday: Date; week: number; month: number }[] = [];
  while (true) {
    const thursday = new Date(monday);
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    if (thursday.getUTCFullYear() > year) break;
    out.push({ monday: new Date(monday), week: getISOWeek(monday), month: thursday.getUTCMonth() });
    monday.setUTCDate(monday.getUTCDate() + 7);
  }
  return out;
}

/** Nombre corto del día/mes en español (UTC). */
export function monthName(year: number, month: number): string {
  return new Intl.DateTimeFormat("es", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1))
  );
}
