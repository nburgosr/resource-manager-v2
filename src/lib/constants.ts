// Valores enumerables del dominio (SQLite no soporta enums nativos en Prisma).

export const RANKS = [
  "TRAINEE",
  "STAFF",
  "SENIOR",
  "SENIOR_ESPECIALISTA",
  "MANAGER",
  "SENIOR_MANAGER",
  "ASSOCIATED_PARTNER",
  "PARTNER",
] as const;
export type Rank = (typeof RANKS)[number];

// Ranks de la capa de consultoría (asignables a horas de proyecto).
export const CONSULTING_RANKS: Rank[] = ["TRAINEE", "STAFF", "SENIOR", "SENIOR_ESPECIALISTA"];

// Ranks de la capa de gestión/ejecutiva.
export const MANAGEMENT_RANKS: Rank[] = ["MANAGER", "SENIOR_MANAGER"];
export const PARTNER_RANKS: Rank[] = ["ASSOCIATED_PARTNER", "PARTNER"];

// Orden de agrupación por rank para listados/subtablas: consultoría primero
// (Especialista → Senior → Staff) y luego la capa de gestión/ejecutiva.
export const RANK_GROUP_ORDER: Rank[] = [
  "SENIOR_ESPECIALISTA",
  "SENIOR",
  "STAFF",
  "TRAINEE",
  "MANAGER",
  "SENIOR_MANAGER",
  "ASSOCIATED_PARTNER",
  "PARTNER",
];

export const RANK_LABELS: Record<Rank, string> = {
  TRAINEE: "Trainee",
  STAFF: "Staff",
  SENIOR: "Senior",
  SENIOR_ESPECIALISTA: "Senior Especialista",
  MANAGER: "Manager",
  SENIOR_MANAGER: "Senior Manager",
  ASSOCIATED_PARTNER: "Associated Partner",
  PARTNER: "Partner",
};

// Tipos de engagement, ordenados de mayor a menor prioridad.
export const ENGAGEMENT_TYPES = [
  "CLIENT_PROJECT",
  "INTERNAL_WITH_CODE",
  "COMMERCIAL_PROPOSAL",
  "INTERNAL_NO_CODE",
] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  CLIENT_PROJECT: "Proyecto con cliente (facturable)",
  INTERNAL_WITH_CODE: "Iniciativa interna con engagement code",
  COMMERCIAL_PROPOSAL: "Propuesta comercial",
  INTERNAL_NO_CODE: "Iniciativa interna sin engagement code",
};

// Prioridad: 1 = más alta. Útil para ordenar y para colores en el calendario.
export const ENGAGEMENT_TYPE_PRIORITY: Record<EngagementType, number> = {
  CLIENT_PROJECT: 1,
  INTERNAL_WITH_CODE: 2,
  COMMERCIAL_PROPOSAL: 3,
  INTERNAL_NO_CODE: 4,
};

export const USER_ROLES = ["ADMIN", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];
