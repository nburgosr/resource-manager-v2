"use client";

import { useRef } from "react";
import { restoreBackup, deleteBackup } from "./actions";

interface Props {
  backupId: string;
  backupLabel: string;
}

export function RestoreButton({ backupId, backupLabel }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    const ok = window.confirm(
      `¿Restaurar la base de datos al respaldo "${backupLabel}"?\n\n` +
        "ADVERTENCIA: Esta acción eliminará todos los datos actuales " +
        "(consultores, engagements, asignaciones, ausencias, feriados) " +
        "y los reemplazará con los del respaldo.\n\n" +
        "Esta operación NO se puede deshacer. ¿Continuar?"
    );
    if (!ok) e.preventDefault();
  }

  return (
    <form ref={formRef} action={restoreBackup} onSubmit={handleSubmit} style={{ display: "inline" }}>
      <input type="hidden" name="backupId" value={backupId} />
      <button type="submit" className="btn danger">
        Restaurar
      </button>
    </form>
  );
}

export function DeleteBackupButton({ backupId }: { backupId: string }) {
  function handleSubmit(e: React.FormEvent) {
    if (!window.confirm("¿Eliminar este respaldo permanentemente?")) e.preventDefault();
  }
  return (
    <form action={deleteBackup} onSubmit={handleSubmit} style={{ display: "inline" }}>
      <input type="hidden" name="backupId" value={backupId} />
      <button type="submit" className="btn secondary">
        Eliminar
      </button>
    </form>
  );
}
