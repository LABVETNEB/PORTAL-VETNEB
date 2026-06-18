# PR-4 — Densidad enterprise en Tokens Admin

> Rama: `feat/admin-tokens-enterprise-density`  
> Base: `d1dc8dc feat(admin): compact overview and clinics dashboard density (#1041)`

## Objetivo

Convertir exclusivamente el módulo **Tokens** del Dashboard Administración en
una consola compacta, segura y operativa. El rediseño reemplaza la lista de
cards y el detalle inline por una tabla densa, paginación server-side y capas
dedicadas para alta, detalle y seguimiento, sin cambiar el contrato global
no-scroll.

## Estado previo detectado

- La lista llamaba a `getAdminParticularTokens({ limit: 8, offset: 0 })` y no
  ofrecía paginación.
- Cada carga de la lista disparaba un `Promise.all` con una consulta de
  seguimiento por token (N+1).
- La selección expandía un detalle grande dentro de cada fila visual.
- El alta compartía el viewport principal mediante un panel largo.
- El enmascarado ya era correcto: las respuestas de listado contienen
  `tokenLast4`; el token completo solo existe en la respuesta de creación.
- El endpoint existente acepta `clinicId`, `limit` y `offset`, pero su snapshot
  no expone `total`.
- El selector de clínicas cargaba el catálogo paginado de usuarios clínica en
  el montaje inicial.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `test/admin-tokens-enterprise-density.test.ts`
- `test/frontend-admin-particular-tokens.test.ts`
- `docs/implementation/admin-tokens-enterprise-density.md`

No se modificaron API, backend, base de datos, migraciones ni dependencias.

## Implementación

### Consola y tabla densa

- Header de 20 px con subtítulo de 12 px.
- Indicadores compactos limitados a la página actual: registros, activos,
  informes vinculados y número de página.
- Barra de operación de una línea con alta, filtro server-side por ID de clínica
  y actualización manual.
- Tabla de 13 px, header de 36 px, celdas con `py-1`, badges de 20 px y acciones
  de 28 px.
- Vista mobile como lista densa; no se fuerza una tabla ilegible.
- Estados de carga, error, éxito y vacío compactos.
- Detalle separado en `ModuleDialog`, con tabs Resumen y Seguimiento. Ya no se
  expande contenido dentro de una fila.
- Alta dividida en tres pasos dentro de `ModuleDialog`, por lo que el formulario
  no consume altura del App Shell.

### Paginación y page size

Se eligió `PAGE_SIZE = 9`, siguiendo la validación real de PR-3 para el viewport
mínimo 1366×768. Se envían `limit: PAGE_SIZE` y
`offset: page * PAGE_SIZE` al endpoint existente.

La API no devuelve `total`. Por eso:

- Anterior se habilita desde página 2.
- Siguiente se habilita cuando la página actual devuelve nueve registros.
- No se agrega selector 25/50/100.
- No se simula un total global ni se inventan datos.

Un total múltiplo exacto de nueve puede ofrecer una página siguiente vacía; es
una limitación residual del contrato actual y requiere que el endpoint exponga
`total` o `hasNextPage`.

## Contrato no-scroll

- `main.dashboard-main` conserva `overflow-hidden` sin cambios.
- No se agrega `overflow-y-auto`, `overflow-y-scroll` ni
  `data-dashboard-scroll-region`.
- La tabla usa nueve filas densas y paginación fija dentro del presupuesto de
  viewport.
- Alta y detalle se muestran en diálogos compactos, fuera del crecimiento
  vertical del módulo.
- La deuda 25/50/100 con scroll regional explícito continúa fuera de PR-4.

## Seguridad del token

- Lista, mobile y detalle muestran exclusivamente `****{tokenLast4}`.
- No se usa `tokenHash`, secretos, logs ni `dangerouslySetInnerHTML`.
- El token completo solo se renderiza en el diálogo necesario inmediatamente
  después de crearlo, con aviso de una sola visualización, copia manual y
  confirmación obligatoria antes de cerrar.
- El borrado conserva confirmación explícita con identificador enmascarado y
  estilo danger sobrio.
- No se agrega ningún fetch público ni endpoint que entregue el token completo.

## Seguimiento y N+1

El N+1 fue eliminado sin backend nuevo. La tabla no carga seguimiento por fila:

1. El operador abre un token.
2. Se consulta como máximo un seguimiento para ese `tokenId`.
3. El resultado, incluso vacío, se cachea por token durante la sesión del
   componente.
4. Un error ofrece reintento explícito.

No existe endpoint batch de tracking y no fue necesario crearlo para este PR.

El catálogo de clínicas usado por el alta sigue utilizando el contrato paginado
existente de usuarios clínica, pero ahora se carga de forma diferida solo al
abrir el diálogo de creación. Migrarlo a búsqueda server-side específica queda
como deuda separada porque el contrato actual no conserva todas las búsquedas
por localidad/usuario usadas por el selector.

## Tests y validaciones

Resultados finales:

- `pnpm --dir frontend lint`: OK.
- `pnpm --dir frontend typecheck`: OK.
- `pnpm --dir frontend build`: OK; build de producción completo.
- `pnpm test`: OK; 2782 aprobados, 0 fallos.
- Tests Admin Tokens nuevos y existentes: 23 aprobados, 0 fallos.
- Regresión shell horizontal + Admin Resumen/Clínicas: 24 aprobados, 0 fallos.
- E2E focal
  `dashboard-accessibility-keyboard.spec.ts --grep "Admin token workspace"`:
  2 aprobados, 0 fallos en Chromium.

No existe un caso E2E no-scroll dedicado a Admin Tokens. No se modificaron los
specs globales ni sus tolerancias; la validación específica de no-scroll con
datos densos queda para CI/PR de cobertura visual, mientras los contratos de
fuente fijan nueve filas y prohíben scroll vertical nuevo.

## No alcance

- Dashboard Clínica y Tokens Clínica.
- Informes, Auditoría, Usuarios, Sesiones, Resumen y Clínicas Admin.
- Login, web pública, Home, Pricing y SEO.
- Backend, DB, migraciones, secretos, `.env` y dependencias.
- Scroll regional y selector 25/50/100.
- Dependabot y PR-5 o posteriores.

## Riesgos residuales

1. El endpoint de listado no expone `total` ni `hasNextPage`.
2. El selector de clínica del alta conserva una carga paginada completa al
   abrirse; ya no penaliza la entrada a la consola, pero requiere un contrato de
   búsqueda más completo para eliminarse sin perder funcionalidad.
3. El fit final depende de mantener nueve filas y las métricas compactas; la
   ampliación a 25/50/100 requiere el PR de scroll regional.

## Próximos PRs

- PR futuro de infraestructura de scroll regional para 25/50/100.
- Contrato de tokens con `total` o `hasNextPage`.
- Búsqueda server-side de clínicas que cubra nombre, localidad, usuario e ID.
- PR-5 y posteriores según la secuencia aprobada, sin adelantarlos aquí.
