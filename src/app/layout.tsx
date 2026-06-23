import type { Metadata } from "next";
import "./globals.css";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/authz";
import NavLinks from "./NavLinks";

export const metadata: Metadata = {
  title: "Resource Manager — Consultoría IA & Datos",
  description: "Gestión de asignaciones del equipo de consultoría",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="es">
      <body>
        <nav className="topnav">
          <span className="brand">Resource Manager</span>
          {user && <NavLinks />}
          {user ? (
            <div className="nav-user">
              <span>
                {user.name} · {user.role === "ADMIN" ? "Administrador" : "Visualizador"}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit">Salir</button>
              </form>
            </div>
          ) : (
            <a href="/login" className="nav-link" style={{ marginLeft: "auto" }}>
              Entrar
            </a>
          )}
        </nav>
        {children}
      </body>
    </html>
  );
}
