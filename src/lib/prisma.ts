import { PrismaClient } from "@prisma/client";

// Reutiliza una única instancia de PrismaClient en desarrollo para evitar
// agotar conexiones por el hot-reload de Next.js.
// En producción (Vercel serverless) cada función tiene su propio proceso;
// el singleton evita crear múltiples pools dentro de la misma instancia.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
