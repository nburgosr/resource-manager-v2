import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type AppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
};

/** Usuario actual o null. Centraliza el acceso a la sesión. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as { id?: string; name?: string | null; email?: string | null; role?: string };
  return { id: u.id ?? "", name: u.name, email: u.email, role: u.role ?? "VIEWER" };
}

/** Exige sesión; si no hay, redirige a /login. Para páginas protegidas. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige rol ADMIN. Para server actions de escritura. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") throw new Error("No autorizado: se requiere rol ADMIN.");
  return user;
}
