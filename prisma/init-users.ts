/**
 * Script de inicialización de usuarios para producción.
 * Crea o actualiza los usuarios admin y viewer a partir de variables de entorno.
 * Es idempotente: puede ejecutarse varias veces sin duplicar datos.
 *
 * Variables requeridas:
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 * Variables opcionales:
 *   ADMIN_NAME (default: "Administrador")
 *   VIEWER_EMAIL, VIEWER_PASSWORD, VIEWER_NAME (default: "Visualizador")
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Las variables de entorno ADMIN_EMAIL y ADMIN_PASSWORD son obligatorias."
    );
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: process.env.ADMIN_NAME ?? "Administrador",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
    update: {
      name: process.env.ADMIN_NAME ?? "Administrador",
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
  });
  console.log(`✓ Usuario admin: ${adminEmail}`);

  const viewerEmail = process.env.VIEWER_EMAIL;
  const viewerPassword = process.env.VIEWER_PASSWORD;

  if (viewerEmail && viewerPassword) {
    await prisma.user.upsert({
      where: { email: viewerEmail },
      create: {
        email: viewerEmail,
        name: process.env.VIEWER_NAME ?? "Visualizador",
        role: "VIEWER",
        passwordHash: await bcrypt.hash(viewerPassword, 12),
      },
      update: {
        name: process.env.VIEWER_NAME ?? "Visualizador",
        passwordHash: await bcrypt.hash(viewerPassword, 12),
      },
    });
    console.log(`✓ Usuario viewer: ${viewerEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
