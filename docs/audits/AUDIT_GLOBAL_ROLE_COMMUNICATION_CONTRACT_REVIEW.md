# Global Role Communication Contract Review

> Auditoría de comunicación entre roles — read-only. No se modificó código funcional,
> tests, workflows ni SEO. Solo se creó este reporte.

## Executive summary

- **Estado general:** La comunicación entre roles es **sólida en lo crítico de seguridad y privacidad**.
  Los límites de tenant para *contenido* de informes están bien resueltos (404 unificado para informe
  ajeno/inexistente), los errores no exponen stack traces ni secretos, los mensajes técnicos se
  sanitizan antes de llegar al particular, y las superficies de error/empty/loading tienen feedback
  accesible. Toda la validación local y la readiness de producción pasan.
- **Recomendación:** **GO WITH CONDITIONS.** No hay bloqueantes de lanzamiento nuevos. Las condiciones
  son de *consistencia de contrato y lenguaje*, no de seguridad: fijar con tests dos contratos frágiles
  (H2, H3) y unificar la terminología de ciclo de vida del informe (H1) en PRs de seguimiento.
- **Riesgo principal:** **Fragmentación de la terminología del ciclo de vida del informe** entre roles
  (H1): el mismo caso físico se comunica con 3 vocabularios distintos y distinta cantidad de etapas
  según la superficie (clínica vs admin vs particular). No es una falla de seguridad, pero es la mayor
  fuente de confusión inter-rol.
- **Top 10 acciones recomendadas:**
  1. Unificar/mapear explícitamente el vocabulario de estado/etapa entre `report_status` (4),
     `report_workflow` (5) y `study_tracking` (5) con una guía única por rol (H1).
  2. Lockear con test el contrato de strings de sesión particular frontend↔backend e incluir el 404
     `"Token particular no encontrado"` de `/me` en el set recuperable (H3).
  3. Unificar la divergencia informe-ajeno-vs-inexistente para `particularTokenId` en
     `study-tracking` (400 "no pertenece" vs 404) igual que se hizo con informes (H2).
  4. Normalizar acentos del copy de error de backend (logística usa español sin tildes) y corregir
     `"Origin no permitido"` → `"Origen no permitido"` (M1).
  5. Unificar el fraseo de permiso denegado (hoy 4 variantes para el mismo concepto) (M2).
  6. Renombrar/clarificar el permiso `canManageClinicUsers` que hoy gobierna también estado de
     informe, perfil público y tokens (M3).
  7. Unificar la preservación de `next` entre el proxy de borde y el redirect server-side (M4).
  8. Decidir y documentar explícitamente la política del 409 de acceso público (revela token válido
     pendiente + `currentStatus` interno) (M5).
  9. Detectar sesión activa en `/login` para no mostrar el formulario a usuarios ya autenticados (L1).
  10. Agregar tests de "lenguaje por rol" y de límites de divulgación que hoy faltan (ver sección de
      tests sugeridos).

---

## Scope

### Roles auditados
- Admin (administración VETNEB).
- Clínica / profesional (`clinic_owner`, `clinic_staff`).
- Particular (tutor con token).
- Público anónimo (sitio público, profesionales públicos, precios).
- Usuario con token de informe (`report_access_token` público).
- Sistema / backend (Fastify) y contrato de respuesta.
- Email / contacto.
- Storage/Supabase y CI/operación como consumidores de health/readiness.

### Superficies auditadas
- Login unificado admin/clínica, login particular por token, acceso por token de informe público.
- Dashboards admin / clínica / informes / logística (rutas, visitas, métricas, SLA).
- Particular content, profesionales públicos, contacto, precios.
- Informes públicos/privados, preview/download, estado/historial, study tracking, notificaciones.
- Páginas 404 / offline / PWA, health/readiness, email/contacto.

### Fuera de alcance (no auditado para cambio)
- SEO y copy público orientado a SEO.
- Rediseño visual, performance, layout.
- Implementación de fixes, migraciones, dependencias, producción destructiva.

---

## Evidence

- **HEAD auditado:** `96f29a2 audit(production): add white box performance readiness review (#991)`
- **Rama:** `audit/global-role-communication-contract-review` (creada desde `main` limpio).
- **Estado git:** working tree limpio antes y después; `git diff --check` limpio; único archivo nuevo
  es este reporte. `frontend/next-env.d.ts` fue regenerado por el dev server de Playwright y revertido.
- **Validaciones ejecutadas (todas read-only):**

| Validación | Resultado |
| --- | --- |
| `pnpm audit --prod` | **No known vulnerabilities found** |
| `pnpm typecheck` | exit 0 |
| `pnpm typecheck:test` | exit 0 |
| `pnpm test` | **tests 2697 · pass 2697 · fail 0 · skipped 0 · todo 0 · cancelled 0** (~11.1s) |
| `pnpm build` | exit 0 (`dist/index.js` 864.5kb) |
| `pnpm --dir frontend lint` | exit 0 (eslint, sin findings) |
| `pnpm --dir frontend typecheck` | exit 0 |
| `pnpm --dir frontend build` | exit 0 (Compiled successfully) |
| `pnpm security:public-surface` | **PASS** — no public devtools exposure |
| `pnpm --dir frontend e2e dashboard-auth-redirect.spec.ts visual-smoke.spec.ts --project=chromium --workers=1` | **12 passed** (12.5s) |
| `node scripts/ops/verify-production-readiness.mjs --url https://api.vetneb.com.ar` | **PASS** — `/health` 200, database+storage up |

---

## Role communication map

| Rol | Superficie principal | Cookie/identidad | Endpoints clave | Mensajería propia |
| --- | --- | --- | --- | --- |
| Admin | `/dashboard/admin/*` | `admin_session_id` | `/api/admin/*` | "Admin no autenticado", "Sesión admin inválida/expirada", "Credenciales inválidas" |
| Clínica | `/dashboard`, `/dashboard/informes`, `/dashboard/logistica/*` | `app_session_id` | `/api/auth/*`, `/api/reports/*`, `/api/clinic/*`, `/api/particular-tokens`, `/api/logistics/*`, `/api/study-tracking` | "No autenticado", "Sesión inválida/expirada" (acentuado) / "Sesion invalida/expirada" (logística, sin acento) |
| Particular | `/particulares` | `particular_session_id` (token) | `/api/particular/auth/*`, `/api/particular/study-tracking/*` | "Particular no autenticado", "Sesión particular inválida/expirada", "Token particular inválido o inactivo" |
| Público token | `/api/public/report-access/:token` | sin sesión (token en path) | `/api/public/report-access/*` | 404 "Informe no encontrado" unificado; 409 pendiente |
| Público anónimo | `/`, `/profesionales`, `/precios`, `/contacto` | ninguna | `/api/public/*`, `/api/contact` | mensajes orientados a público; sanitizados |
| Backend/sistema | toda API | — | `/health`, `/api/health` | contrato `{ success, error, details?, path, requestId? }` |
| CI/ops | readiness | — | `/health` | PASS/exit-code |

---

## Backend communication contract findings

Contrato de respuesta uniforme (Fastify `setErrorHandler` + `onSend`): `{ success:false, error, details?, path }`,
y se inyecta `requestId` a errores ≥400 con cuerpo JSON. `>=500` colapsa a `"Error interno del servidor"`
(sin `details`), evitando fuga interna. **Bien.**

| Endpoint (representativo) | Actor | 401 | 403 | 404 | 409 | 429 | ¿Filtra info? | ¿Frontend lo entiende? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /api/auth/me` | Clínica | "No autenticado"/"Sesión inválida"/"Sesión expirada" | — | — | — | — | No | Sí (`getClinicSession` captura todo → null) |
| `GET /api/reports` | Clínica | sí | "No autorizado para consultar otra clinica" (cross-clinic) | — | — | — | No (scope propio) | Sí |
| `GET /api/reports/:id/{history,preview-url,download-url}` | Clínica | sí | — | "Informe no encontrado" (ajeno=inexistente) | — | — | **No (unificado ✓)** | Sí |
| `PATCH /api/reports/:id/status` | Clínica owner | sí | "No autorizado para cambiar el estado de informes" | "Informe no encontrado" | — | — | No | Sí |
| `GET /api/particular/auth/me` | Particular | "Particular no autenticado"/"Sesión particular inválida"/"…expirada"/"Token particular inválido o inactivo" | — | **"Token particular no encontrado"** (no recuperable en FE — H3) | — | — | No | Parcial (ver H3) |
| `POST /api/particular/auth/login` | Particular | "Token inválido" (inexistente=inactivo ✓) | — | — | — | rate-limit | **No (unificado ✓)** | Sí |
| `GET /api/particular/auth/report/{preview,download}-url` | Particular | sí | — | "Informe no encontrado" | "El token particular no tiene un informe vinculado" | — | No | Sí |
| `GET /api/public/report-access/:token` | Público token | — | — | "Informe no encontrado" (inválido/revocado/expirado unificados ✓) | "El informe todavía no está disponible…" + `currentStatus` (M5) | rate-limit | **Parcial (M5)** | Sí |
| `POST /api/study-tracking` (clínica) | Clínica owner | sí | "Solo administración puede crear seguimientos" / permiso | 404 "Token particular no encontrado" vs **400 "no pertenece a la clínica autenticada"** (H2) | — | — | **Sí (H2)** | n/a |
| `POST /api/contact` | Público | — | "Origen no permitido" | — | — | rate-limit (`CONTACT_RATE_LIMIT_ERROR_MESSAGE`) | No (502 sanitizado) | Sí |
| `POST /api/admin/auth/login` | Admin | "Credenciales inválidas" (usuario inexistente=password incorrecta ✓) | — | — | — | rate-limit | **No (sin enumeración ✓)** | Sí |
| `/api/logistics/*` | Clínica | "Sesion invalida"/"Sesion expirada" (**sin acento** — M1) | "Permisos insuficientes para logistica" (M2) | "…no encontrad{a,o}" | — | — | No | Sí |
| `GET /api/public/professionals/:id` | Público | — | "Origin no permitido" (**typo M1**) | "Perfil publico no encontrado" | — | rate-limit | No | Sí |

Observaciones de contrato:
- **Privacidad de informes:** `getClinicScopedReportById` devuelve `null` tanto para ajeno como inexistente
  → 404 "Informe no encontrado" indistinguible en clínica, particular y token público. Excelente. Solo
  los endpoints **admin** usan "El informe/token no pertenece…" (aceptable: admin ve todo).
- **Logs:** request-logger sanitiza la URL (`sanitizeUrlForLogs`) y `[API ERROR]` registra method/path/status/requestId,
  con `error` completo solo en servidor. Auditoría redacta claves sensibles.
- **Doble implementación de auth:** existen middlewares estilo Express (`server/middlewares/auth.ts`,
  `admin-auth.ts`, `particular-auth.ts`) y la auth inline Fastify dentro de cada ruta. La ruta viva es la
  Fastify; los middlewares Express parecen no estar en el path activo (drift risk — L4).

---

## Frontend communication findings

| Pantalla | Rol | Loading | Empty | Error | Acción principal | Feedback | Riesgo de confusión |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/login` | Admin/Clínica | botón "Iniciando sesión…" | n/a | `role="alert"` + mensaje backend | login unificado | `aria-busy`, cooldown rate-limit visible | No detecta sesión activa (L1) |
| `/particulares` | Particular | "Verificando sesión…" (`role=status`) | "No hay seguimiento…" | sanitizado (técnico→genérico) | login token / ver-descargar | `aria-live`, cooldown, paste hint | Vocabulario de etapas distinto al de clínica (H1) |
| `/dashboard` | Clínica | Suspense + skeletons | EmptyState | flags `*LoadError` por bloque | módulos | redirect 401 server-side | OK |
| `/dashboard/informes` | Clínica | LoadingState | EmptyState claro | `ErrorState` + reintento | seleccionar/descargar | StatusBadge, paginación con aria | Estados "Subido/Procesando/Listo/Entregado" ≠ tracking (H1) |
| `/dashboard/admin` | Admin | Suspense | "No hay eventos…" | `role=alert` por tarjeta | módulos admin | health detallado, audit redactado | OK (detalle operativo solo admin) |
| `/dashboard/logistica/*` | Clínica | LoadingState | EmptyState | ErrorState | rutas/visitas/métricas | mensajes backend sin acento (M1) | menor |
| `/not-found`, `/offline` | Público | n/a | n/a | copy claro, sin fuga | volver/contacto | a11y `aria-labelledby` | OK |

Positivos destacados:
- `ErrorState` (`role="alert"`, reintento), `EmptyState`, `LoadingState` (`role="status"` + `aria-live` + sr-only)
  consistentes y accesibles.
- `apiFetch` mapea 429→`RateLimitError` con `Retry-After`/`RateLimit-Reset` y mensaje con cuenta regresiva.
- `ParticularesContent.isTechnicalParticularAccessMessage` reemplaza mensajes con "backend/cors/logs/admin/HTTP NNN"
  por un genérico → el particular nunca ve jerga de infraestructura. Muy bien.
- `getSafeNextPath` en login bloquea open-redirect y bloquea saltar a rutas admin vía `next`.

---

## Admin flow findings

- Login admin unificado con clínica; rol y `redirectTo` los decide el backend; no hay enumeración de
  usuario ("Credenciales inválidas" para inexistente y password incorrecta).
- El dashboard admin distingue claramente **estado del sistema** (health, badges Operativo/Degradado/Caído)
  de **errores de lectura** (banner `role=alert` "No se pudo consultar el estado del sistema…").
- Acciones sensibles tienen contrato claro: borrado de clínica requiere `confirmClinicName`; revocar la
  propia sesión admin responde "No se puede revocar la sesión admin actual."
- Auditoría redacta metadata sensible (`password/token/secret/cookie/auth/hash/storage`) antes de render.
- El detalle operativo (CORS origins, destinatarios de contacto, memoria, versión) se muestra **solo** tras
  auth admin → aceptable.
- ¿Admin entiende qué pasó? Sí. ¿Distingue sistema vs usuario? Sí. ¿Sin secretos? Sí. ¿Confirmaciones? Sí.

## Clinic flow findings

- La clínica ve sus informes scoped, con estado vía `StatusBadge` y timeline derivado del estado.
- `canUploadReports = false` para **ambos** roles de clínica: la carga de informes es exclusiva de admin
  (`/api/admin/reports/upload`) y la UI clínica no ofrece "subir" → consistente, sin botón muerto.
- Cambiar estado de informe (`PATCH /:id/status`) está gateado por `canManageClinicUsers` (solo `clinic_owner`).
  El permiso funciona, pero su **nombre no comunica** que también gobierna informes/perfil/tokens (M3).
- No se filtra información de otra clínica: 403 "No autorizado para consultar otra clinica" sin revelar datos,
  y 404 unificado para informes ajenos.
- **Inconsistencia de lenguaje** entre informes (estado de informe) y logística (mensajes sin acento) y entre
  informes y seguimiento (etapas) — ver H1/M1.

## Particular/public flow findings

- El particular recibe solo su caso (token aislado, cookie separada). El copy lo refuerza explícitamente
  ("acceso limitado al caso vinculado al token… sin exponer información de clínicas, rutas, profesionales ni
  otros estudios").
- Errores técnicos se sanitizan; expiración de sesión muestra mensaje amable y reabre el formulario de token.
- El token público de informe: inválido/revocado/expirado → 404 idéntico (no revela existencia). El 409 de
  "informe no disponible" sí revela token válido + `currentStatus` interno (M5).
- "¿Qué hago si el token no funciona?" → mensaje claro + hint de pegado/manual + CTA de contacto. Bien.
- Detalle menor: los enlaces de tinción especial embeben IDs internos numéricos (clinicId/reportId/caseId)
  en el cuerpo de WhatsApp/email del particular (L2).

---

## Cross-role consistency findings

| ID | Inconsistencia | Evidencia | Impacto |
| --- | --- | --- | --- |
| X1 | Vocabulario de ciclo de vida del informe difiere por rol (3 sistemas) | `report-status.ts` (4) vs `AdminReportWorkflowStage` (5) vs `AdminStudyTrackingStage` (5); labels "Procesando" (clínica) vs "Procesamiento" (particular); "Entregado" vs "Informe disponible / Publicado" | Alto (H1) |
| X2 | 401 de sesión de clínica difiere por módulo: acentuado en reports/profile/audit, sin acento en logística | `reports.fastify.ts` "Sesión inválida" vs `logistics-*.fastify.ts` "Sesion invalida" | Medio (M1) |
| X3 | Permiso denegado con 4 fraseos distintos para el mismo concepto | reports-status / particular-tokens / report-access-tokens / logistics | Medio (M2) |
| X4 | Divulgación cross-tenant: informes unifican ajeno/inexistente, pero `particularTokenId` en study-tracking no | `study-tracking.fastify.ts:927-939` (400 vs 404) vs `getClinicScopedReportById` | Alto (H2) |
| X5 | Redirect a login: proxy preserva `next`, server-side lo descarta | `frontend/src/proxy.ts:33-37` vs `dashboard-server-auth.ts:9-11` | Medio (M4) |
| X6 | `"Origin no permitido"` (inglés) vs `"Origen no permitido"` | `public-professionals.fastify.ts:219` | Bajo (M1) |

---

## Language and terminology findings

Glosario operativo detectado (foco: el mismo concepto con términos distintos):

| Concepto | Términos/labels usados | Dónde | Recomendación |
| --- | --- | --- | --- |
| Ciclo de vida del estudio | `uploaded/processing/ready/delivered` · `sample_received/processing/evaluation/report_development/delivered` · `reception/processing/evaluation/report_development/delivered` | report-status / report-workflow / study-tracking | Una sola fuente de verdad + mapeo por rol |
| "Procesando" vs "Procesamiento" | clínica vs particular | utils.ts vs ParticularesContent | Unificar etiqueta |
| "Entregado" vs "Informe disponible / Publicado" | clínica vs particular | utils.ts vs ParticularesContent | Unificar concepto "entregado/disponible" |
| Sesión inválida | "Sesión inválida" / "Sesion invalida" | reports vs logística | Acentuar siempre |
| Inválido | "inválido" / "invalido" | admin/clinic vs reports/logística | Acentuar siempre |
| Clínica | "clínica" / "clinica" | admin-clinics vs reports/profile | Acentuar siempre |
| Origen | "Origen no permitido" / "Origin no permitido" | mayoría vs public-professionals | "Origen" |
| Informe / estudio / seguimiento / caso | mezclados según superficie | global | Definir uso por rol (informe=archivo, estudio/seguimiento=proceso, caso=tracking) |
| Permiso denegado | 4 fraseos | varias rutas | Plantilla única por familia |

**Objetivo recomendado:** una guía de lenguaje única por rol — clínica ve "estado del informe", particular ve
"estado del estudio", admin ve "etapa de workflow", con un **mapa explícito** entre los tres y acentuación
consistente en todo el copy de error.

---

## Privacy and disclosure findings

| ID | Superficie | Riesgo de filtración | Evidencia | Severidad | Recomendación |
| --- | --- | --- | --- | --- | --- |
| P1 | study-tracking clínica (`particularTokenId`) | Existencia de token de **otra** clínica (400 vs 404) | `study-tracking.fastify.ts:927-939` | Media (H2) | Unificar a "Token particular no encontrado" (scopear por clínica) |
| P2 | acceso público por token | 409 revela token válido pendiente + `currentStatus` interno a anónimo | `public-report-access.fastify.ts:380-385` | Media (M5) | Decidir: ¿404 hasta disponible? o documentar el tradeoff |
| P3 | particular special-stain | IDs internos numéricos en cuerpo de contacto | `ParticularesContent.tsx:158-181` | Baja (L2) | Omitir IDs internos del template |
| P4 | informe ajeno/inexistente (clínica/particular/token) | — (correctamente indistinguible) | `reports.fastify.ts:469-486`, public-report-access | OK | Mantener; agregar test que lo fije |
| P5 | login admin/particular | — (sin enumeración de usuario/token) | admin-auth 765-782, particular-auth 867-876 | OK | Mantener |
| P6 | errores ≥500, stack traces, secretos | — (colapsados/sanitizados) | fastify-app `setErrorHandler`; contact 502 | OK | Cubierto por tests existentes |

---

## Error-state communication matrix

| Código | Admin | Clínica | Particular | Público/token |
| --- | --- | --- | --- | --- |
| **401** | "Admin no autenticado" / "Sesión admin inválida" / "…expirada" / "Usuario admin de sesión no encontrado" | "No autenticado" / "Sesión inválida" / "…expirada" (logística sin acento: "Sesion invalida") | "Particular no autenticado" / "Sesión particular inválida" / "…expirada" / "Token particular inválido o inactivo" | n/a (token en path) |
| **403** | "Origen no permitido" | "No autorizado para consultar otra clinica" / "…cambiar el estado de informes" / "…administrar recursos de la clinica" / "Permisos insuficientes para logistica" | — | "Origen/Origin no permitido" |
| **404** | "Clínica no encontrada." / "Informe no encontrado" / "Ítem de precio no encontrado" | "Informe no encontrado" (unificado) / "Token particular no encontrado" | "Token particular no encontrado" (H3) / "Informe no encontrado" / "Seguimiento no encontrado…" | "Informe no encontrado" (unificado) / "Perfil publico no encontrado" |
| **409** | — | — | "El token particular no tiene un informe vinculado" | "El informe todavía no está disponible para acceso público" + `currentStatus` (M5) |
| **429** | rate-limit login (headers + Retry-After) | rate-limit login | rate-limit login/token | rate-limit acceso público / contacto |
| **500/502** | "Error interno del servidor" (genérico, + requestId) | idem | idem | contacto 502 "No se pudo enviar el mensaje…" (sanitizado) |

Consistencia 401/403/404: **correcta en seguridad**, con variaciones de **lenguaje** (acentos, fraseo de permiso)
que conviene unificar.

---

## Existing test coverage

| Área comunicacional | Tests existentes que la cubren | Cubre |
| --- | --- | --- |
| No fuga de secretos/stack en errores | `api-error-no-secrets-contract`, `api-error-no-stack-traces-contract`, `api-error-content-type-contract` | Sí |
| Disclosure / ownership | `security-response-disclosure-boundaries`, `security-cross-tenant-idor-contract`, `security-resource-ownership-boundaries`, `report-write-surface-ownership`, helper `report-foreign-access-scope` | Sí (informes) |
| Informe ajeno=inexistente (404) | `reports.fastify`, `public-report-access.fastify`, IMPLEMENTATION_REPORT_FOREIGN_ACCESS_404.md | Sí |
| Redirect 401 dashboard | `frontend-dashboard-server-401-redirect`, `frontend-login-next-redirect-boundary`, e2e `dashboard-auth-redirect` | Sí (parcial) |
| Empty/loading/feedback | `frontend-dashboard-empty-states`, `frontend-dashboard-action-feedback-focus-polish`, `frontend-dashboard-state-polish` | Sí |
| Acceso particular | `frontend-particulares-access-contract`, `particular-auth.fastify`, `particular-token` | Parcial (no fija el set recuperable) |
| Rate limit UX/aislamiento | `login-rate-limit-ux-safety`, `contact-rate-limit`, `security-rate-limit-cross-realm-isolation` | Sí |
| Redacción de logs | `security-sensitive-log-redaction-boundaries` | Sí |
| Cross-auth boundaries | `security-cross-auth-surface-boundaries`, `auth-session-boundaries` | Sí |
| Notificaciones por superficie | `frontend-notification-destinations`, `frontend-notifications-bell` | Sí |

---

## Missing tests suggested

> No implementados en esta auditoría. Solo propuesta.

1. **Contrato de strings de sesión particular (FE↔BE):** un test que afirme que cada 401 de
   `authenticateParticularUser` y `particular-study-tracking` está en `PARTICULAR_SESSION_RECOVERABLE_ERRORS` /
   `PARTICULAR_STUDY_TRACKING_RECOVERABLE_ERRORS`, **incluyendo** el 404 `"Token particular no encontrado"` de
   `/me` (H3).
2. **Indistinguibilidad de `particularTokenId` ajeno vs inexistente** en `study-tracking` clínica (H2).
3. **Consistencia de lenguaje de error:** test que verifique acentuación uniforme y prohíba `"Origin no permitido"`
   y variantes sin acento de "Sesión/inválido/clínica" en `server/routes/**` (M1).
4. **Mapa de vocabulario de ciclo de vida:** test que documente/valide el mapeo entre `REPORT_STATUSES`,
   `AdminReportWorkflowStage` y `AdminStudyTrackingStage` y sus labels por rol (H1).
5. **Plantilla única de permiso denegado:** test que valide el fraseo 403 por familia de recurso (M2).
6. **Consistencia de `next` en redirect de login** entre proxy y server-side (M4).
7. **Política del 409 público:** test que fije la decisión tomada para `public-report-access` (404 vs 409+status) (M5).

---

## Launch blockers

**Ninguno nuevo.** Todas las validaciones locales y la readiness de producción pasan; no hay fuga de secretos,
ni exposición de contenido cross-tenant, ni stack traces. Los hallazgos son de consistencia de contrato/lenguaje
y de límites de divulgación de baja sensibilidad.

## High-priority gaps

| ID | Hallazgo | Riesgo | Acción |
| --- | --- | --- | --- |
| H1 | Terminología del ciclo de vida fragmentada entre roles (3 vocabularios, distinto nº de etapas) | Confusión inter-rol; el particular y la clínica ven "el mismo caso" distinto | Fuente única + mapeo por rol + labels unificados |
| H2 | `particularTokenId` ajeno (400) distinguible de inexistente (404) en study-tracking clínica | Enumeración de existencia de tokens de otra clínica (autenticado) | Scopear/unificar a 404, como informes |
| H3 | Contrato frágil de strings de sesión particular FE↔BE; 404 de `/me` no recuperable | Edición de copy backend rompe silenciosamente la recuperación de sesión | Test de contrato + incluir el 404 en el set |

## Medium-priority gaps

| ID | Hallazgo | Acción |
| --- | --- | --- |
| M1 | Acentos inconsistentes (logística sin tildes) + `"Origin no permitido"` | Normalizar copy de error |
| M2 | 4 fraseos de permiso denegado para el mismo concepto | Plantilla única |
| M3 | `canManageClinicUsers` gobierna también estado de informe/perfil/tokens (nombre no comunica) | Renombrar o documentar contrato de permiso |
| M4 | `next` preservado por proxy pero descartado por redirect server-side | Unificar comportamiento |
| M5 | 409 público revela token válido pendiente + `currentStatus` interno a anónimo | Decidir/documentar política |

## Low-priority improvements

| ID | Hallazgo | Acción |
| --- | --- | --- |
| L1 | `/login` no detecta sesión activa (usuario ya logueado ve el formulario) | Redirigir a su dashboard si hay sesión |
| L2 | IDs internos numéricos en template de contacto del particular | Omitir IDs internos |
| L3 | Dead code en contact route (`extractSafeContactEmailErrorDiagnostics`) | Limpiar (no comunicacional) |
| L4 | Doble implementación de auth (Express middlewares vs Fastify inline) | Verificar y retirar la muerta para evitar drift |
| L5 | Fallback silencioso `[]` (`throwOnError` default false) en `getReports`/logística | Confiar en tests no-mock-fallback; documentar contrato |

---

## Suggested PR roadmap

Ordenado por riesgo y valor (cada uno mínimo, con tests, sin tocar SEO ni negocio sin test):

1. `test(communication): lock particular session/tracking error-string contract (FE↔BE)` — fija H3 + incluye
   el 404 de `/me` en el set recuperable.
2. `fix(security): unify foreign-vs-missing particular token disclosure in study-tracking` — resuelve H2
   (404 indistinguible), con test cross-tenant.
3. `fix(communication): normalize error copy accents and "Origen no permitido"` — M1, con test de lenguaje.
4. `refactor(communication): unify permission-denied messaging template` — M2.
5. `docs+fix(communication): single report-lifecycle vocabulary map across roles` — H1 (puede ser doc + labels,
   sin cambiar enums de negocio).
6. `fix(auth-ux): preserve next on server-side login redirect` — M4.
7. `fix(public): decide 409-vs-404 policy for public report access` — M5 (con test).
8. `chore(cleanup): remove dead contact diagnostics + retire unused Express auth middlewares` — L3/L4.

---

## Do-not-change list

- No SEO ni copy público orientado a SEO.
- No rediseño visual ni performance.
- No cambios de negocio sin test que los respalde.
- No exponer diferencia entre informe ajeno e inexistente (mantener 404 unificado).
- No mostrar mensajes internos/técnicos a particulares (mantener sanitización).
- No migraciones, dependencias, deploy ni escritura en producción.

---

## Go / No-Go recommendation

**GO WITH CONDITIONS.** El sistema está listo para operar: seguridad de comunicación, privacidad de contenido
y feedback de UI son sólidos, y todo (2697 tests, builds, e2e, readiness) pasa. No hay bloqueantes nuevos.
Las condiciones son de consistencia de contrato y lenguaje, no de seguridad: (1) lockear con test el contrato
de strings de sesión particular (H3); (2) unificar la divulgación de `particularTokenId` ajeno/inexistente (H2);
(3) unificar la terminología del ciclo de vida del informe entre roles (H1). El resto (M/L) son mejoras de
consistencia que pueden ir en PRs de seguimiento.

---

## Appendix: commands run

> Sin secretos. Solo comandos de validación read-only.

```text
git checkout main; git pull --ff-only; git fetch --prune; git status; git log -1 --oneline   # base 96f29a2, limpio
gh pr list --state open                                                                       # vacío
git branch -r --no-merged origin/main                                                          # vacío
git switch -c audit/global-role-communication-contract-review

pnpm typecheck                 # exit 0
pnpm typecheck:test            # exit 0
pnpm test                      # tests 2697 · pass 2697 · fail 0 · skipped 0 (~11.1s)
pnpm build                     # exit 0 — dist/index.js 864.5kb
pnpm --dir frontend typecheck  # exit 0
pnpm --dir frontend lint       # exit 0
pnpm --dir frontend build      # exit 0 — Compiled successfully
pnpm security:public-surface   # PASS — no public devtools exposure
pnpm audit --prod              # No known vulnerabilities found
pnpm --dir frontend e2e dashboard-auth-redirect.spec.ts visual-smoke.spec.ts --project=chromium --workers=1   # 12 passed
node scripts/ops/verify-production-readiness.mjs --url https://api.vetneb.com.ar               # PASS — /health 200, db+storage up

git checkout -- frontend/next-env.d.ts   # revertir regeneración del dev server de Playwright
git status --short --untracked-files=all # solo el reporte nuevo
git diff --check                         # limpio
```

_No se ejecutó `git add`, `git commit`, `git push`, `gh pr create`, `gh pr checks --watch` ni merge._
