# Resource Manager · Consultoría IA & Datos

Aplicación web para gestionar las asignaciones del equipo de consultoría a proyectos,
iniciativas internas y propuestas comerciales, con visión semanal por horas, cobertura de
perfiles e historial auditable. Ver el alcance funcional en [`PROMPT.md`](./PROMPT.md).

> Estado actual: autenticación por roles, calendario semanal (lectura + edición de
> asignaciones con auditoría y snapshots), matriz consultor × semana (ventana móvil fija
> de 6 meses, agrupada en subtablas por rank, con horas por celda y color por categoría),
> cobertura por semana, CRUD de engagements (datos,
> liderazgo, staffing base y sobrescrituras por semana), consultores, feriados e historial.
> Pendiente: importación CSV.

## Stack
- **Next.js** (App Router, TypeScript)
- **Prisma ORM** + **SQLite** (local; migrable a PostgreSQL)

## Requisitos
- Node.js 20+ (probado con 24) y npm.

## Arranque local
```bash
npm install                       # dependencias
npx prisma migrate dev --name init # crea la BD SQLite y aplica migraciones (corre el seed)
npm run dev                        # levanta la app en http://localhost:3000
```

Si ya tienes la BD creada y solo quieres recargar datos de ejemplo:
```bash
npm run db:seed
```

### Autenticación
La app exige inicio de sesión (Auth.js / NextAuth con credenciales). Las rutas
protegidas redirigen a `/login`. El rol determina los permisos:
- **Administrador**: puede crear/editar/eliminar asignaciones y guardar snapshots.
- **Visualizador**: solo lectura.

El secreto de sesión está en `AUTH_SECRET` (en `.env`); regéneralo para producción con
`openssl rand -base64 33`.

### Usuarios de ejemplo (seed)
| Rol           | Email                | Password   |
|---------------|----------------------|------------|
| Administrador | admin@example.com    | admin123   |
| Visualizador  | viewer@example.com   | viewer123  |

## Scripts útiles
| Comando             | Descripción                                    |
|---------------------|------------------------------------------------|
| `npm run dev`       | Servidor de desarrollo                         |
| `npm run build`     | Build de producción                            |
| `npm run db:migrate`| Crear/aplicar migraciones                      |
| `npm run db:reset`  | Reiniciar la BD y volver a sembrar             |
| `npm run db:seed`   | Cargar datos de ejemplo                        |
| `npm run db:studio` | Prisma Studio (explorar la BD en el navegador) |

## Modelo de datos (resumen)
- **User** — roles ADMIN / VIEWER.
- **Consultant** — rank (Staff…Partner), estado.
- **Engagement** — proyecto/iniciativa/propuesta, con tipo y prioridad, fechas (inicio/fin),
  partner responsable y leads (managers).
- **Assignment** — horas de un consultor en un engagement por semana (`weekStart` = lunes).
- **StaffingBase** / **StaffingOverride** — necesidad de perfiles por rank: valor base
  (con su propia ventana de fechas, por defecto la del engagement) y sobrescritura por
  semana puntual.
- **Holiday** — feriados que descuentan capacidad horaria.
- **WeeklySnapshot** / **AuditLog** — historial y auditoría.

Las reglas de capacidad horaria (41,2 h/semana, feriados) están en
[`src/lib/week.ts`](./src/lib/week.ts) y los valores enumerables en
[`src/lib/constants.ts`](./src/lib/constants.ts).
