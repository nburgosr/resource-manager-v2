import { PrismaClient } from "@prisma/client";

// Reutiliza una única instancia de PrismaClient en desarrollo para evitar
// agotar conexiones por el hot-reload de Next.js.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
