"use client";

import { useEffect, useState, useTransition } from "react";
import { upsertAssignmentRange, deleteAssignment } from "./actions";

const PRIORITY_COLOR: Record<number, string> = {
  1: "#b8860b",
  2: "#0e7c7b",
  3: "#514b9e",
  4: "#7c7c86",
};

export type PanelEngagement = { id: string; name: string };

type AssignmentItem = {
  id: string;
  engagementId: string;
  engagementName: string;
  hours: number;
  priority: number;
};

export type PanelData = {
  consultantId: string;
  consultantName: string;
  weekStr: string;
  assignments: AssignmentItem[];
};

export function AssignmentPanel({
  engagements,
}: {
  engagements: PanelEngagement[];
}) {
  const [panel, setPanel] = useState<PanelData | null>(null);
  const [isPending, startTransition] = useTransition();

  // Delegación de clicks — abre el panel al hacer click en [data-panel]
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-panel]");
      if (!el) return;
      try {
        setPanel(JSON.parse(el.dataset.panel!));
      } catch {
        // ignore parse errors
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Escape cierra el panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setPanel(null);

  if (!panel) return null;

  const handleAdd = (fd: FormData) => {
    startTransition(async () => {
      await upsertAssignmentRange(fd);
      close();
    });
  };

  const handleDelete = (fd: FormData) => {
    startTransition(async () => {
      await deleteAssignment(fd);
      close();
    });
  };

  return (
    <>
      {/* Fondo oscuro */}
      <div className="panel-overlay" onClick={close} />

      {/* Panel slide-over */}
      <div
        className="panel-slide"
        role="dialog"
        aria-modal="true"
        aria-label={`Asignaciones de ${panel.consultantName}`}
      >
        <div className="panel-header">
          <div>
            <div className="panel-title">{panel.consultantName}</div>
            <div className="panel-subtitle">Semana del {panel.weekStr}</div>
          </div>
          <button className="panel-close" onClick={close} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="panel-body">
          {/* Asignaciones actuales */}
          {panel.assignments.length > 0 && (
            <div className="panel-section">
              <p className="panel-section-title">Esta semana</p>
              {panel.assignments.map((a) => (
                <div key={a.id} className="panel-row">
                  <span
                    className="panel-dot"
                    style={{ background: PRIORITY_COLOR[a.priority] ?? "#888" }}
                  />
                  <span className="panel-row-name">{a.engagementName}</span>
                  <span className="panel-row-hrs">{a.hours} h</span>
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className="panel-icon-btn danger"
                      title="Eliminar asignación"
                      disabled={isPending}
                    >
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para agregar */}
          <div className="panel-section">
            <p className="panel-section-title">
              {panel.assignments.length === 0 ? "Agregar asignación" : "Nueva asignación"}
            </p>
            <form action={handleAdd} className="panel-form">
              <input type="hidden" name="consultantId" value={panel.consultantId} />
              <input type="hidden" name="weekStart" value={panel.weekStr} />

              <label className="panel-label">Engagement</label>
              <select name="engagementId" required className="panel-select" defaultValue="">
                <option value="" disabled>
                  Seleccionar…
                </option>
                {engagements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>

              <label className="panel-label">Horas / semana</label>
              <input
                type="number"
                name="hours"
                step="0.1"
                min="0.1"
                max="41.2"
                className="panel-input"
                placeholder="ej. 8.8"
                required
              />

              <label className="panel-label">Aplicar hasta la semana del</label>
              <input
                type="date"
                name="weekEnd"
                defaultValue={panel.weekStr}
                min={panel.weekStr}
                className="panel-input"
              />
              <p className="panel-hint">
                Deja la fecha en la semana actual para asignar solo esta semana.
              </p>

              <button
                type="submit"
                className="btn panel-submit"
                disabled={isPending}
              >
                {isPending ? "Guardando…" : "Guardar asignación"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
