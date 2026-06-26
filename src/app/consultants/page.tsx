import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { RANKS, RANK_LABELS, type Rank } from "@/lib/constants";
import { createConsultant } from "./actions";
import { SkillsProvider } from "./SkillsProvider";
import { ConsultantRow } from "./ConsultantRow";

export const dynamic = "force-dynamic";

export default async function ConsultantsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [allConsultants, allSkills] = await Promise.all([
    prisma.consultant.findMany({ include: { skills: { include: { skill: true } } } }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
  ]);
  const consultants = allConsultants;
  const skillNames = allSkills.map((s) => s.name);
  const rankIndex = (r: string) => {
    const i = RANKS.indexOf(r as Rank);
    return i === -1 ? RANKS.length : i;
  };
  consultants.sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank) || a.name.localeCompare(b.name));

  return (
    <main>
      <h1>Consultores</h1>

      <SkillsProvider initialSkills={skillNames}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rank</th>
              <th>Estado</th>
              <th>Skills</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {consultants.map((c) => {
              const consultantSkillNames = c.skills.map((cs) => cs.skill.name);
              if (!isAdmin) {
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{RANK_LABELS[c.rank as Rank] ?? c.rank}</td>
                    <td>{c.status}</td>
                    <td>
                      <div className="skill-pills-readonly">
                        {consultantSkillNames.map((s) => (
                          <span key={s} className="skill-pill">{s}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <ConsultantRow
                  key={c.id}
                  id={c.id}
                  initialName={c.name}
                  initialRank={c.rank}
                  initialStatus={c.status}
                  initialSkills={consultantSkillNames}
                />
              );
            })}
          </tbody>
        </table>
      </SkillsProvider>

      {isAdmin && (
        <section>
          <h2>Nuevo consultor</h2>
          <form action={createConsultant} className="inline-form">
            <input name="name" placeholder="Nombre" required />
            <select name="rank" defaultValue="STAFF">
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABELS[r]}
                </option>
              ))}
            </select>
            <select name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <button className="btn" type="submit">
              Añadir
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
