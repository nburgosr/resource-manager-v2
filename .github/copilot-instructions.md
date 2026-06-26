# Resource Manager v2 — Copilot Instructions

## Descripción del proyecto
Aplicación web para gestionar las asignaciones del equipo de consultoría en **Inteligencia Artificial y Datos** a proyectos, iniciativas internas y propuestas comerciales. El foco es planificar y visualizar semana a semana la carga de cada consultor, detectar desasignaciones y saber si cada proyecto/iniciativa tiene cubiertos los perfiles que necesita.

## Stack técnico
- **Framework**: Next.js 15 (App Router) con TypeScript
- **Base de datos**: SQLite (local) / PostgreSQL (producción) via Prisma ORM
- **Autenticación**: NextAuth v5 (beta)
- **Runtime**: Node.js

## Scripts disponibles
- `npm run dev` — Inicia el servidor de desarrollo en puerto 3000
- `npm run build` — Build de producción
- `npm run db:migrate` — Ejecuta migraciones de Prisma
- `npm run db:reset` — Reset de la base de datos
- `npm run db:seed` — Siembra datos de ejemplo
- `npm run db:studio` — Abre Prisma Studio

## Estructura del proyecto
```
src/
  auth.ts              # Configuración de NextAuth
  app/
    layout.tsx         # Layout raíz
    page.tsx           # Home (redirige a calendar)
    NavLinks.tsx       # Navegación principal
    globals.css        # Estilos globales
    api/auth/          # Endpoints de autenticación
    calendar/          # Vista principal de asignaciones semanales
    consultants/       # CRUD de consultores
    coverage/          # Cobertura de perfiles por proyecto
    engagements/       # CRUD de proyectos/iniciativas/propuestas
    history/           # Historial y snapshots semanales
    holidays/          # Gestión de feriados
    login/             # Página de login
  lib/
    authz.ts           # Autorización por roles
    constants.ts       # Constantes globales (horas/día, ranks, etc.)
    coverage.ts        # Lógica de cobertura de perfiles
    prisma.ts          # Cliente Prisma singleton
    week.ts            # Utilidades de semanas (ISO week numbers)
prisma/
  schema.prisma        # Esquema de la base de datos
  seed.ts              # Datos de ejemplo
  migrations/          # Historial de migraciones
```

## Roles y permisos
- **admin**: lectura y escritura completa
- **viewer**: solo lectura

Acceder a `src/lib/authz.ts` para la lógica de autorización. Usar `auth()` de `src/auth.ts` para obtener la sesión.

## Reglas de negocio clave

### Capacidad horaria
- Máximo semanal: **41,2 horas** por consultor
- Distribución: lunes–jueves **8,8 h/día**, viernes **6 h/día**
- Los feriados descuentan las horas del día festivo de la capacidad de esa semana

### Ranks de consultores
- Consultoría: `Staff`, `Senior`, `Senior Especialista`
- Gestión: `Manager`, `Senior Manager`, `Associated Partner`, `Partner`

### Tipos de engagement (prioridad descendente)
1. **Proyectos con cliente** (facturables)
2. **Iniciativas internas con engagement code**
3. **Propuestas comerciales**
4. **Iniciativas internas sin engagement code**

### Necesidad de perfiles
- Se define una **necesidad base** (personas + horas por rank) por engagement
- Se puede **sobrescribir por semana** puntual; el resto usa la base
- La cobertura se evalúa comparando consultores asignados contra la necesidad vigente

## Convenciones de código
- Server Components por defecto; usar `"use client"` solo cuando sea necesario
- Server Actions en archivos `actions.ts` dentro de cada carpeta de ruta
- Acceso a la BD solo desde Server Components o Server Actions (nunca desde Client Components)
- Validar sesión al inicio de cada Server Action con `auth()` y verificar rol con `authz.ts`
- Semanas identificadas por **ISO week number** (`YYYY-WNN`), usar utilidades de `src/lib/week.ts`
- Preferir `prisma.$transaction` para operaciones multi-tabla
