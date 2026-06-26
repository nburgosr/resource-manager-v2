import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { uploadXlsx, cancelPending } from "./actions";
import { PendingSubmit } from "./PendingSubmit";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(
    new Date(iso)
  );
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();

  const { error } = await searchParams;
  const pending = await prisma.pendingImport.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main>
      <h1>Importar datos desde xlsx</h1>
      <p className="subtitle">
        Sube un archivo HH&nbsp;Program en formato xlsx para previsualizar los cambios antes de
        aplicarlos.
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          <strong>Archivo no admitido</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{error}</p>
        </div>
      )}

      <section>
        <h2>Cargar archivo</h2>
        <form action={uploadXlsx} className="inline-form">
          <input type="file" name="file" accept=".xlsx" required />
          <PendingSubmit pendingText="Analizando archivo…">
            Analizar archivo →
          </PendingSubmit>
        </form>
      </section>

      {pending.length > 0 && (
        <section>
          <h2>Importaciones pendientes de confirmación</h2>
          <table>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Subido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id}>
                  <td>{p.filename}</td>
                  <td>{fmtDate(p.createdAt.toISOString())}</td>
                  <td className="import-row-actions">
                    <a className="btn secondary" href={`/import/${p.id}`}>
                      Ver preview
                    </a>
                    <form action={cancelPending} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn danger" type="submit">
                        Descartar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
