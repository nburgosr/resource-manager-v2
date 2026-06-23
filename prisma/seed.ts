import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getMonday } from "../src/lib/week";

const prisma = new PrismaClient();

async function main() {
  // Limpieza (orden respetando relaciones)
  await prisma.auditLog.deleteMany();
  await prisma.weeklySnapshot.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.staffingOverride.deleteMany();
  await prisma.staffingBase.deleteMany();
  await prisma.engagementLead.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.consultant.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.user.deleteMany();

  // --- Usuarios ---
  await prisma.user.createMany({
    data: [
      {
        email: "admin@example.com",
        name: "Administrador",
        role: "ADMIN",
        passwordHash: await bcrypt.hash("admin123", 10),
      },
      {
        email: "viewer@example.com",
        name: "Visualizador",
        role: "VIEWER",
        passwordHash: await bcrypt.hash("viewer123", 10),
      },
    ],
  });

  // --- Consultores ---
  const consultantsData = [
    { name: "Ana Soto", rank: "STAFF" },
    { name: "Bruno Díaz", rank: "STAFF" },
    { name: "Carla Méndez", rank: "SENIOR" },
    { name: "Diego Rojas", rank: "SENIOR_ESPECIALISTA" },
    { name: "Elena Vidal", rank: "MANAGER" },
    { name: "Felipe Núñez", rank: "SENIOR_MANAGER" },
    { name: "Gabriela Lara", rank: "ASSOCIATED_PARTNER" },
    { name: "Hernán Castro", rank: "PARTNER" },
  ];
  await prisma.consultant.createMany({ data: consultantsData });
  const consultants = await prisma.consultant.findMany();
  const byName = (n: string) => consultants.find((c) => c.name === n)!;

  // --- Feriados de ejemplo (Chile, 2026) ---
  await prisma.holiday.createMany({
    data: [
      { date: new Date("2026-06-29T00:00:00.000Z"), name: "San Pedro y San Pablo" },
      { date: new Date("2026-07-16T00:00:00.000Z"), name: "Virgen del Carmen" },
    ],
  });

  // --- Engagements ---
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0));

  const proyecto = await prisma.engagement.create({
    data: {
      name: "Plataforma de Datos — Banco XYZ",
      type: "CLIENT_PROJECT",
      engagementCode: "BXYZ-2026",
      status: "ACTIVE",
      startDate: start,
      endDate: end,
      partnerId: byName("Hernán Castro").id,
      leads: { create: [{ consultantId: byName("Elena Vidal").id }] },
      staffingBase: {
        create: [
          { rank: "STAFF", persons: 2, hours: 60, startDate: start, endDate: end },
          { rank: "SENIOR", persons: 1, hours: 30, startDate: start, endDate: end },
        ],
      },
    },
  });

  const iniciativaCode = await prisma.engagement.create({
    data: {
      name: "Acelerador GenAI interno",
      type: "INTERNAL_WITH_CODE",
      engagementCode: "INT-GENAI-01",
      status: "ACTIVE",
      startDate: start,
      endDate: end,
      partnerId: byName("Gabriela Lara").id,
      leads: { create: [{ consultantId: byName("Felipe Núñez").id }] },
      staffingBase: {
        create: [{ rank: "SENIOR_ESPECIALISTA", persons: 1, hours: 20, startDate: start, endDate: end }],
      },
    },
  });

  const propuesta = await prisma.engagement.create({
    data: {
      name: "Propuesta — Retail ABC",
      type: "COMMERCIAL_PROPOSAL",
      status: "ACTIVE",
      startDate: start,
      endDate: end,
      partnerId: byName("Gabriela Lara").id,
      leads: { create: [{ consultantId: byName("Elena Vidal").id }] },
      staffingBase: {
        create: [{ rank: "SENIOR", persons: 1, hours: 10, startDate: start, endDate: end }],
      },
    },
  });

  await prisma.engagement.create({
    data: {
      name: "Comunidad de práctica de Datos",
      type: "INTERNAL_NO_CODE",
      status: "ACTIVE",
      startDate: start,
      endDate: end,
      leads: { create: [{ consultantId: byName("Felipe Núñez").id }] },
    },
  });

  // --- Asignaciones de la semana actual ---
  const monday = getMonday(new Date());
  await prisma.assignment.createMany({
    data: [
      { consultantId: byName("Ana Soto").id, engagementId: proyecto.id, weekStart: monday, hours: 32 },
      { consultantId: byName("Bruno Díaz").id, engagementId: proyecto.id, weekStart: monday, hours: 41.2 },
      { consultantId: byName("Carla Méndez").id, engagementId: proyecto.id, weekStart: monday, hours: 20 },
      { consultantId: byName("Carla Méndez").id, engagementId: propuesta.id, weekStart: monday, hours: 10 },
      { consultantId: byName("Diego Rojas").id, engagementId: iniciativaCode.id, weekStart: monday, hours: 20 },
    ],
  });

  console.log("Seed completado.");
  console.log("  Usuarios: admin@example.com / admin123 — viewer@example.com / viewer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
