// Cálculo de cobertura de perfiles por semana para un engagement.
//
// La necesidad de cada rank se toma de la sobrescritura de la semana si existe;
// en caso contrario, del valor base. Un rank está cubierto cuando las personas
// asignadas y las horas asignadas alcanzan lo requerido. El engagement está
// cubierto cuando todos los ranks con necesidad lo están.

import type { Rank } from "@/lib/constants";

export type StaffingNeed = { rank: string; persons: number; hours: number };
export type AssignedSlice = { rank: string; hours: number }; // una por consultor asignado

export type RankCoverage = {
  rank: Rank;
  reqPersons: number;
  reqHours: number;
  asgPersons: number;
  asgHours: number;
  source: "base" | "override";
  covered: boolean;
};

export type EngagementCoverage = {
  ranks: RankCoverage[];
  covered: boolean;
  hasNeeds: boolean;
};

export function computeCoverage(
  base: StaffingNeed[],
  overrides: StaffingNeed[],
  assigned: AssignedSlice[]
): EngagementCoverage {
  // Necesidad vigente: override pisa a base, por rank.
  const need = new Map<string, { persons: number; hours: number; source: "base" | "override" }>();
  for (const b of base) need.set(b.rank, { persons: b.persons, hours: b.hours, source: "base" });
  for (const o of overrides)
    need.set(o.rank, { persons: o.persons, hours: o.hours, source: "override" });

  // Asignado por rank: nº de consultores y suma de horas.
  const got = new Map<string, { persons: number; hours: number }>();
  for (const a of assigned) {
    const cur = got.get(a.rank) ?? { persons: 0, hours: 0 };
    cur.persons += 1;
    cur.hours += a.hours;
    got.set(a.rank, cur);
  }

  const ranks: RankCoverage[] = [...need.entries()].map(([rank, n]) => {
    const g = got.get(rank) ?? { persons: 0, hours: 0 };
    const covered = g.persons >= n.persons && g.hours >= n.hours;
    return {
      rank: rank as Rank,
      reqPersons: n.persons,
      reqHours: n.hours,
      asgPersons: g.persons,
      asgHours: g.hours,
      source: n.source,
      covered,
    };
  });

  const hasNeeds = ranks.length > 0;
  const covered = hasNeeds && ranks.every((r) => r.covered);
  return { ranks, covered, hasNeeds };
}
