"use client";

import { useState } from "react";
import { RANKS, RANK_LABELS, type Rank } from "@/lib/constants";
import { updateConsultant, deleteConsultant } from "./actions";
import { SkillsTagInput } from "./SkillsTagInput";

interface Props {
  id: string;
  initialName: string;
  initialRank: string;
  initialStatus: string;
  initialSkills: string[];
}

export function ConsultantRow({
  id,
  initialName,
  initialRank,
  initialStatus,
  initialSkills,
}: Props) {
  const [name, setName] = useState(initialName);
  const [rank, setRank] = useState(initialRank);
  const [status, setStatus] = useState(initialStatus);
  const [skills, setSkills] = useState<string[]>(initialSkills);

  const isDirty =
    name !== initialName ||
    rank !== initialRank ||
    status !== initialStatus ||
    [...skills].sort().join(",") !== [...initialSkills].sort().join(",");

  const formId = `f-${id}`;

  return (
    <tr data-dirty={isDirty || undefined}>
      <td>
        <form id={formId} action={updateConsultant}>
          <input type="hidden" name="id" value={id} />
        </form>
        <input
          form={formId}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </td>
      <td>
        <select
          form={formId}
          name="rank"
          value={rank}
          onChange={(e) => setRank(e.target.value)}
        >
          {RANKS.map((r) => (
            <option key={r} value={r}>
              {RANK_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          form={formId}
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </td>
      <td>
        <SkillsTagInput
          consultantId={id}
          initialSkills={initialSkills}
          formId={formId}
          onTagsChange={setSkills}
        />
      </td>
      <td>
        <div className="consultant-actions">
          {isDirty && (
            <span
              className="unsaved-dot"
              title="Cambios sin guardar"
              aria-label="Cambios sin guardar"
            />
          )}
          <button form={formId} className="btn secondary" type="submit">
            Guardar
          </button>
          <button
            form={formId}
            className="btn danger"
            type="submit"
            formAction={deleteConsultant}
          >
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  );
}
