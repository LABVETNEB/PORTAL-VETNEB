# Cierre P2-C — `docs/notes/todo.md` contradictorio con la arquitectura actual

> **Modo:** docs-only.
> **Fecha:** 2026-06-29.
> **Rama:** `docs/cleanup-legacy-todo-note`.
> **HEAD base:** `509a465 docs(env): document version gate env examples (#1181)`.
> **Documento rector:** `docs/audit/final-repo-cleanup-engineering-audit.md` (P2-C).

## Hallazgo

`docs/notes/todo.md` mezclaba contenido histórico de una arquitectura
**tRPC + Google Sheets** (`CONTROL_CLINICAS`, `REGISTRO_INFORMES`, carga
Excel/CSV, `SESIONES_ACTIVAS`) que nunca correspondió al sistema real
(Fastify REST + Supabase/Postgres + Drizzle + Next.js App Router) con una
sección de logística operativa vigente.

## Acción

- Se creó [`docs/archive/legacy-trpc-sheets-todo.md`](../archive/legacy-trpc-sheets-todo.md)
  con el contenido histórico completo (autenticación, Google Sheets, base de
  datos, API tRPC, UI, visor de PDF, búsqueda/filtrado, pruebas, despliegue),
  marcado explícitamente como **archivado / no usar como fuente vigente**.
- `docs/notes/todo.md` quedó reducido a:
  - una nota breve que referencia el archivo histórico y `docs/SOURCES_OF_TRUTH.md`;
  - la sección **Logística operativa**, sin modificaciones de contenido.
- Se actualizó `docs/audit/final-repo-cleanup-engineering-audit.md` (secciones
  §3, §4, §5, §7, §14, §17) marcando P2-C como cerrado y referenciando el
  archivo nuevo.
- Se actualizó `docs/audit/final-cleanup-current-status-snapshot.md` moviendo
  P2-C de "Pendientes reales" a "Bloques cerrados".

## Verificación de referencias

`git grep` confirmó que ninguna ruta de código, test, workflow o script
referenciaba `docs/notes/todo.md` por contenido tRPC/Sheets antes del cambio.
La única referencia activa a `docs/notes/todo.md` fuera de los documentos de
auditoría es `docs/logistics/ROLLING_ROADMAP.md:39` ("Reference in
`docs/notes/todo.md`"), que sigue siendo válida porque la sección de
logística se preservó sin cambios de contenido.

## Scope

- Docs-only.
- No se tocó runtime frontend/backend, `package.json`, `pnpm-lock.yaml`, DB,
  migraciones, workflows, Render ni secrets.
- No se eliminó contenido histórico sin archivarlo.
- No commit, no push, no PR.
