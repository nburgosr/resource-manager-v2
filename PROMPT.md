# Prompt para desarrollo: App web de gestión de asignaciones de consultoría

## Contexto y objetivo
Necesito desarrollar una **aplicación web** para gestionar las asignaciones del equipo de consultoría en **Inteligencia Artificial y Datos** a proyectos, iniciativas internas y propuestas comerciales. El foco es **planificar y visualizar semana a semana** la carga de cada consultor, detectar desasignaciones y saber si cada proyecto/iniciativa tiene cubiertos los perfiles que necesita, manteniendo un **historial auditable**.

## Stack y despliegue
- Stack web moderno: **frontend en React/Next.js** y **base de datos relacional** (PostgreSQL, o SQLite para correr localmente).
- **Despliegue local por ahora** (debe levantarse fácilmente en una máquina; deja preparado el camino para desplegar en nube más adelante).
- Justifica brevemente las decisiones técnicas y entrega instrucciones claras de instalación y ejecución local.

## Usuarios y permisos
Por ahora solo **2 roles/usuarios**:
- **Administrador**: lee y modifica toda la data.
- **Visualizador**: solo lectura, sin posibilidad de hacer cambios.

Implementa autenticación simple pero dejando el modelo de roles **preparado para escalar** a más usuarios en el futuro.

## Modelo de datos

### Consultores
- Atributos: nombre, rank, estado.
- **Ranks de consultoría**: Staff, Senior, Senior Especialista.
- **Ranks de gestión/ejecutivos**: Manager, Senior Manager, Associated Partner, Partner.

### Capacidad horaria (regla clave)
- Cada consultor tiene un **máximo semanal de 41,2 horas asignables**.
- Distribución diaria: **lunes a jueves 8,8 h/día**, **viernes 6 h/día**.
- Debe existir un **calendario de feriados**: en una semana con feriados, las horas del/los día(s) festivo(s) se **descuentan del máximo** disponible de ese consultor para esa semana.
- La app debe mostrar para cada consultor y semana: horas disponibles, horas asignadas y **diferencia (sobre/sub-asignación)**.

### Proyectos, iniciativas y propuestas
Tipos de trabajo, con su orden de **prioridad** (de mayor a menor):
1. **Proyectos con cliente** (facturables) — máxima prioridad.
2. **Iniciativas internas con engagement code.**
3. **Propuestas comerciales.**
4. **Iniciativas internas sin engagement code** — menor prioridad.

Atributos comunes:
- Nombre, tipo (de los 4 anteriores), engagement code (cuando aplique), estado (activo/cerrado).
- **Fecha de inicio y fecha de fin, ambas modificables.** El calendario debe poder mostrar solo los elementos activos en cada semana.
- **Liderazgo**: uno o más **Managers y/o Senior Managers** a cargo, y **un único Partner o Associated Partner** responsable.

### Necesidad de perfiles y cobertura
Cada proyecto/iniciativa/propuesta debe permitir anotar la necesidad de perfiles **expresable de dos formas (ambas)**:
- **Número de personas por rank** (ej.: 2 Staff + 1 Senior), y
- **Horas requeridas por rank** (ej.: 40 h de Staff + 20 h de Senior).

**Modelo de definición:**
- Se define una **necesidad base (por defecto)** por rank para cada proyecto/iniciativa/propuesta (en personas y en horas).
- Esa necesidad base aplica automáticamente a todas las semanas de vigencia del elemento.
- Para **semanas puntuales** se puede **sobrescribir** la necesidad (ej.: una semana concreta requiere 3 Staff en lugar de 2). La sobrescritura aplica solo a esa semana; el resto sigue usando la base.
- La interfaz debe indicar claramente cuándo una semana usa el valor por defecto y cuándo tiene un valor sobrescrito (y permitir **volver al valor base**).

**Evaluación de cobertura:**
- Para **cada semana**, se compara la necesidad vigente (base o sobrescrita) contra los consultores vinculados y sus horas asignadas en esa semana.
- Se calcula el estado **cubierto / no cubierto por semana**, detallando el **faltante por rank** tanto en **personas** como en **horas**.

## Funcionalidades y vistas

1. **Calendario semanal de asignaciones** (vista principal):
   - Una fila por consultor, vista por semana.
   - Mostrar en qué **proyectos** e **iniciativas internas** trabaja cada consultor y **destacar visualmente a los desasignados**.
   - Distinguir por color/etiqueta el **tipo de trabajo** según las 4 prioridades.
   - Mostrar **horas asignadas vs. capacidad** (considerando feriados) y alertar sobre sobre/sub-asignación.
   - Permitir **navegar entre semanas** (anterior/siguiente) y crear/editar asignaciones por semana (solo Administrador).

2. **Gestión del listado** de proyectos, iniciativas internas y propuestas comerciales:
   - CRUD completo (solo Administrador), con tipo, prioridad, fechas, liderazgo, engagement code.
   - Definición de la **necesidad de perfiles** (personas y horas por rank), con valor base y sobrescritura por semana.
   - **Vinculación de consultores** y visualización del **estado de cobertura por semana** (cubierto / faltante por rank).

3. **Gestión de consultores**: alta/edición, rank, estado.

4. **Calendario de feriados**: administración de feriados que impactan la capacidad semanal.

5. **Importación de datos por CSV** (a desarrollar más adelante): el equipo entregará un CSV con los datos (consultores, proyectos, etc.). Diseña una **interfaz de carga/importación desde CSV** con validación y previsualización. *(Nota: el archivo aún no está disponible; deja la funcionalidad preparada y, cuando se entregue, ajustaremos el mapeo de columnas.)*

## Historial y auditoría
- **Snapshot semanal**: guardar el estado completo de las asignaciones de cada semana, consultable hacia atrás en el tiempo.
- **Log de cambios**: registrar **quién** hizo **qué** cambio y **cuándo** (creación/edición/eliminación de asignaciones, proyectos, etc.).
- El Visualizador debe poder consultar semanas históricas; solo el Administrador modifica.

## Entregables esperados
- Aplicación funcional con las vistas descritas.
- Esquema de base de datos y migraciones.
- Datos de ejemplo (seed) para poder probar sin el CSV real.
- Instrucciones de instalación y ejecución local.
- Código organizado y comentado donde aporte claridad.

## Sugerencia: empieza por
1. Modelo de datos + esquema BD.
2. Autenticación y roles.
3. CRUD de consultores y proyectos.
4. Lógica de capacidad horaria (incluyendo feriados).
5. Calendario semanal.
6. Cobertura de perfiles.
7. Historial/auditoría.
8. Importación CSV.

## Supuestos
- La necesidad de perfiles se define con un **valor base por rank** (personas y horas), **sobrescribible en semanas puntuales**.
- La cobertura se evalúa **por semana** (personas y horas por rank).
- Un consultor puede estar asignado a **varios** elementos en la misma semana (repartiendo horas).
