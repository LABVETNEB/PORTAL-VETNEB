# GLOBAL-SEARCH-1 — Motor y API de búsqueda global (Fase 1)

## 1. Estado base

- Base del motor: `server/` es idéntico entre `38ed8777` y `origin/main@f3010777`
  (`git diff --stat HEAD origin/main -- server` vacío al iniciar).
- Scope primario: **backend-only** (feature `server/features/global-search`, dos
  rutas, registro en `server/fastify-app.ts`, tests y realineación de guards).
- Fuera de alcance (Fase 2/3): toda la UI del dashboard, migraciones e índices.

## 2. Auditoría del buscador actual

| Pieza | Hallazgo |
| --- | --- |
| `frontend/src/components/dashboard/WorkspaceAppBar.tsx` | `WorkspaceModuleSearch` filtra en memoria `ADMIN_MODULE_NAV_LABELS`/`CLINIC_MODULE_NAV_LABELS` y navega con `?module=`. No consulta datos. Oculto `<768px` (`hidden md:block`). |
| `SuperSearchField.tsx` | Primitiva visual; sin estado de búsqueda ni I/O. |
| `DashboardTopbar.tsx` | Orquestador que inyecta slots; `WorkspaceAppBar` es presentation-pure (guard `dashboard-presentation-import-boundaries`). |
| `GET /api/reports/search` | Búsqueda de informes de clínica existente: `ILIKE` sin plegado de tildes y sin escape de `%`/`_`. Sólo informes. |
| `GET /api/admin/clinics?search=` | Búsqueda admin de clínicas existente. |
| Deep-link | No existe ruta por registro. Existe `buildNotificationDestination` (`frontend/src/lib/notification-destinations.ts`) con anclas `#report-<id>`, `#clinic-particular-token-<id>`, `#admin-particular-token-<id>`; sólo resuelve si la fila está en la página cargada. |
| DB | `immutable_unaccent` (migración 0007) disponible; índices trigram `reports_*_trgm` sobre columnas crudas (0004). |

## 3. Matriz de información buscable por rol (Fase 1)

Regla: sólo campos que el mismo actor ya lee por una superficie existente.

| Entidad | Clínica (`/api/search`) | Admin (`/api/admin/search`) | Campos buscables | Campos devueltos | Superficie de lectura existente |
| --- | --- | --- | --- | --- | --- |
| Informe (`report`) | sí, `auth.clinicId` | sí, todas / `clinicId` | `#id`, paciente, archivo, tipo de estudio | id, paciente, archivo, estado, tipo, fecha, clínica (admin) | `/api/reports`, `/api/admin/reports/*` |
| Token particular (`particular_token`) | sí | sí | `#id`, mascota, apellido tutor, últimos 4 | id, mascota, tutor, especie, `tokenLast4`, activo, fecha | `/api/particular-tokens`, `/api/admin/particular-tokens` |
| Seguimiento (`tracking_case`) | sí | sí | `#id`, paciente del informe, mascota/tutor del token (joins con la misma clínica) | id, etapa, recepción, entrega estimada, ids vinculados | `/api/study-tracking`, `/api/admin/study-tracking` |
| Clínica (`clinic`) | no | sí | `#id`, nombre, email de contacto | id, nombre, email, fecha | `/api/admin/clinics` |
| Usuario de clínica (`clinic_user`) | no | sí | `#id`, username | id, username, rol, clínica | `/api/admin/users-roles` |

Filtros server-side: `kinds`, `status` (estado de informe), `studyType`, `from`/`to`
(`created_at` del informe), `clinicId` (sólo admin, acota). Un filtro de informe
restringe las entidades a `report`; nunca se ignora en silencio.

Excluido por seguridad: `password_hash`, `token_hash`, `storage_path`,
`preview_url`, `download_url`, `payment_url`, `auth_pro_id`, `notes`,
`admin_contact_email`, `details_lesion`, cookies, sesiones. El contrato
`global-search-repository-sql.test.ts` lo verifica sobre el SQL generado.

No implementado (sin capacidad real hoy): contenido de PDFs (no hay indexación de
documentos), Logística (visitas/rutas: texto libre en `notes`), Perfil, auditoría,
sesiones y report access tokens. Ver §8.

## 4. Arquitectura

```text
route (auth + tenant) → application (createClinic/AdminGlobalSearch)
  → domain (parse, escape, rank, merge) → ports → infrastructure (Drizzle SQL)
```

- **Tenant**: el puerto de clínica recibe `clinicId` como primer argumento
  obligatorio y la ruta lo toma de `auth.clinicId`. `clinicId` en la query nunca
  autoriza: un valor ajeno es `403` antes de consultar (paridad con
  `/api/reports/search`).
- **SQL**: `immutable_unaccent(coalesce(col::text,'')) ILIKE immutable_unaccent($n) ESCAPE '\'`;
  el texto del usuario sólo viaja como parámetro, con `\ % _` escapados.
- **Relevancia**: rango 0 = `#id` exacto, 1 = título exacto, 2 = prefijo,
  3 = contiene; desempate por fecha desc, orden de entidad e id desc (total y
  determinista).
- **Paginación**: `limit` (1–25, default 5) por entidad, `offset` (≤500) sólo
  con una entidad; ventana `limit + 1` para `hasMore`, sin `COUNT`.
- **Sin duplicados**: clave `kind:id` en la fusión.
- **Destino**: el hit devuelve ids (`target.reportId`, `particularTokenId`,
  `studyTrackingCaseId`, `clinicId`, `clinicUserId`), no URLs; la UI resuelve la
  navegación (Fase 2).
- **Cache/logs**: `no-store` por `applySensitiveApiNoStoreHeaders`; el logger
  registra la plantilla de ruta, no la query; los errores devuelven 500 genérico.
- Sin dependencias cross-feature (M45), sin Elasticsearch, embeddings ni servicios
  externos.

## 5. Archivos

- `server/features/global-search/**` (domain, application, infrastructure, README).
- `server/routes/clinic-global-search.fastify.ts`, `server/routes/admin-global-search.fastify.ts`.
- `server/fastify-app.ts` (registro `/api/search`, `/api/admin/search`).
- Tests: `test/unit/domain/global-search/global-search-domain.test.ts`,
  `test/unit/infrastructure/global-search-repository-sql.test.ts`,
  `test/integration/adapters/controllers/global-search.fastify.test.ts`,
  `test/integration/app/global-search-postgres-isolation.fastify.test.ts`.
- Realineación in-scope: M45 (feature e inventario 149→156), M46 (consumidores
  de `cors-headers` 30→32), M48 (censo LOC y barrels) y su certificación.
- `docs/security/RBAC_MATRIX.md` (fila de búsqueda global).

## 6. Pruebas de permisos y aislamiento

| Caso | Test | Evidencia |
| --- | --- | --- |
| Sin sesión → 401 sin consultar | `global-search.fastify.test.ts` | ruta real vía `createFastifyApp` |
| Clínica A no ve títulos de B (mismo nombre en B) | ídem + `global-search-postgres-isolation` | memoria y SQL real |
| `clinicId` ajeno → 403 antes de consultar | ídem | 0 llamadas al repositorio |
| Clínica no pide entidades admin | ídem | `kinds=clinic_user` → 400 |
| Cookie de clínica no autentica admin | ídem | 401 |
| Admin multi-entidad y `clinicId` acota | ídem + SQL real | grupos y hits |
| Tenant es el primer predicado parametrizado | `global-search-repository-sql.test.ts` | SQL generado por Drizzle |
| Joins de seguimiento con la misma clínica | ídem | `left join ... clinic_id = clinic_id` |
| Inyección SQL / comodines | ídem + SQL real | parámetro escapado; `%%%%` no devuelve filas |
| Tildes/mayúsculas | domain + ruta + SQL real | `nandu perez` = `ÑANDÚ PÉREZ` |
| Registro fuera de la primera página | ruta + SQL real | informe más antiguo de 2.000 |
| Paginación sin duplicados | ruta + SQL real | `hasMore`, offsets 0/25/50 |
| Error interno sin filtrar detalles | ruta | 500 genérico |

`global-search-postgres-isolation` sigue el patrón de E2E-GLOBAL-03B: exige la DB
aislada `portal_vetneb_ci` (servicio Postgres de `backend-ci`) y falla al cargar
sin ella.

## 7. Rendimiento

Presupuesto elegido: p95 de búsqueda rápida de clínica (3 entidades) < 750 ms
del lado del servidor sobre 4.000 informes (2.000 por clínica), medido en el
test SQL real y emitido como diagnóstico. Las expresiones
`immutable_unaccent(col)` no usan los índices trigram existentes: dentro de un
tenant el plan parte de `reports_clinic_id_idx`; la búsqueda admin sin
`clinicId` recorre la tabla. La optimización (índices de expresión
`gin (immutable_unaccent(col) gin_trgm_ops)`) es migración R2 de Fase 3 y
requiere evidencia de `EXPLAIN` en un dataset representativo.

## 8. Riesgos residuales y no cubierto

- La UI (Fase 2) no existe todavía: el criterio de aceptación de punta a punta
  **no** está cumplido con esta fase.
- Sin rate limit específico en los GET de búsqueda (paridad con
  `/api/reports/search`); el cliente debe aplicar debounce y cancelación.
- Deep-link fuera de la página cargada: las anclas actuales no seleccionan un
  registro que no esté en la página; requiere diseño en Fase 2.
- Sin evidencia runtime en staging (§17): BLOCKED hasta autorización.
- Logística, Perfil, auditoría, sesiones y report access tokens: Fase 3, tras
  decidir campos indexables.

## 9. Plan de PRs

1. **GLOBAL-SEARCH-1 (este cambio, backend-only)** — motor, API, tests, guards.
2. **GLOBAL-SEARCH-2 (frontend-only)** — cliente API tipado, hook con debounce y
   `AbortController`, sustitución de `WorkspaceModuleSearch` por un slot inyectado
   desde `DashboardTopbar`, combobox accesible (Ctrl/Cmd+K, flechas, Escape),
   resultados por categoría, vista completa con filtros, móvil, claro/oscuro,
   navegación a registro vía `buildNotificationDestination` + selección por id
   fuera de página, E2E (`visual-contract`, `admin-mobile`, axe G11), mock
   backend ledger (E2E-GLOBAL-11).
3. **GLOBAL-SEARCH-3 (backend)** — entidades restantes autorizadas, índices de
   expresión con `EXPLAIN`, relevancia y alto volumen.
