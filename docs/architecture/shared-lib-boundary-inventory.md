# Shared / Lib Boundary Inventory

> **Tipo:** Inventario técnico **docs-only**. No implementa, no mueve archivos, no
> renombra, no toca código, CSS, tests, `package.json`, lockfiles, CI ni schema.
> Un único archivo nuevo bajo `docs/architecture/`.
> **Base:** `main` limpio · **HEAD:** `cdf4fb1` docs(architecture): define backend domain boundary adr (#1297).
> **Rama:** `docs/shared-lib-boundary-inventory`.
> **Documentos rectores:** [`docs/audit/repository-domain-architecture-audit.md`](../audit/repository-domain-architecture-audit.md) (ARCH-1) · [`docs/architecture/backend-boundary-adr.md`](./backend-boundary-adr.md) (ARCH-2).
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.
> **ID:** ARCH-3.

## Executive summary

Este inventario baja a **nivel de archivo** la clasificación que ARCH-1 hizo a
nivel de capa y que ARCH-2 fijó como contrato de dependencia. Objetivo: dejar
listo el terreno para el piloto **Logistics** (ARCH-4) sin tocar una línea de
código.

**Método.** Clasificación por *imports reales* (no por nombre): quién importa
`fastify` → adaptador http; quién importa `../db.ts` (runtime Drizzle) →
infrastructure; quién importa **sólo tipos** de `drizzle/schema.ts` → domain
puro; quién no importa nada de framework/persistencia → util/shared.

**Hallazgos clave.**

- **`server/lib/` es un cajón mixto confirmado (P2-A).** 40 archivos (~7.0k LOC)
  conviven sin frontera declarada: **~13 domain puros**, **5 adaptadores http**
  (importan `fastify`), **~14 infra** (email, supabase, env, logger, caches,
  rate-limits, observabilidad) y **~6 audit cross-cutting**. La separación es
  hoy invisible; el naming no la expresa.
- **`server/lib/logistics/` es el único mini-dominio real y está limpio.** Los 4
  archivos (`metrics`, `route-planning`, `sla-breach`, `time-window`, ~1.5k LOC)
  importan **exclusivamente tipos** de `drizzle/schema.ts`. Cero `fastify`, cero
  `db`. Cumplen ya la regla "domain sin framework" del ADR (ARCH-2).
- **`db-*` mezcla persistencia + dominio (P1-B) y sólo `db-logistics` importa
  dominio.** Ningún `db-*` importa a otro `db-*` (acoplamiento entre contextos =
  bajo). `db-logistics.ts` (1.322 LOC) importa `lib/logistics/{time-window,
  route-planning}`: es el único `db-*` que ya delega en helpers de dominio, lo
  que lo hace el candidato natural a repositorio del contexto.
- **Un único acoplamiento accidental domain→infra en backend (P2-B):**
  `lib/report-workflow-communication.ts` importa `../db.ts` **y** tipos de schema
  **y** dispara email — regla de dominio pegada a persistencia + side-effect.
  Pertenece a Reports, **no** a Logistics: fuera del piloto.
- **`frontend/src/lib/` mezcla shared real y dominio (P2-C).** api-client/utils/
  security son shared legítimo; `public-professionals`, `public-pricing-cache`,
  `dashboard-*`, `notification-destinations`, `*-hub-reset` son dominio en el
  cajón común.
- **No existe `shared/`, `utils/` ni `common/` a nivel repo.** El *shared kernel*
  de facto es `drizzle/schema.ts` (+ `relations.ts`); en frontend, `components/ui`
  y `types/index.ts`. Verificado: `ls shared utils common` → vacío.

**Conteo de candidatos** (detalle en las tablas):

| Categoría | Backend lib | Backend db | Frontend lib | Total |
|---|---|---|---|---|
| **domain** | 13 | 13 (mezclados en db-*) | 6 | — |
| **infrastructure** | 14 | 1 (`db.ts`) | 5 | — |
| **http / adaptador** | 5 | — | 3 (api client) | — |
| **shared kernel legítimo** | — | `drizzle/schema.ts` | `components/ui`, `types` | — |
| **acoplamiento accidental** | 1 (`report-workflow-communication`) | — | ~6 (dominio en `lib/`) | — |
| **audit / cross-cutting** | 6 | 1 (`db-audit`) | — | — |

**Logistics readiness: LISTO para ARCH-4** (read-only domain shell). Dominio ya
sub-paqueteado y puro, `db-logistics` autocontenido, ~30 tests de logística como
red de seguridad. Riesgo: **bajo**.

---

## Backend lib inventory

`server/lib/**` — 40 archivos, ~7.053 LOC. Clasificación por import real.

| Path | Clasificación | Responsabilidad | Imports críticos | Riesgo | Recomendación |
|---|---|---|---|---|---|
| `lib/logistics/metrics.ts` (829) | **domain** (Logistics) | Métricas de rutas/visitas/SLA | sólo tipos `drizzle/schema` | Bajo | **Piloto ARCH-4/5.** Mover a `features/logistics/domain/`. |
| `lib/logistics/route-planning.ts` (515) | **domain** (Logistics) | Heurística de planificación de rutas | sólo tipos `drizzle/schema` | Bajo | **Piloto.** Candidato #1 a `domain/` (ARCH-5, con su test). |
| `lib/logistics/sla-breach.ts` (111) | **domain** (Logistics) | Cálculo de breach de SLA | tipo `SlaTargetType` de schema | Bajo | **Piloto.** Helper puro chico, ideal primer move ARCH-5. |
| `lib/logistics/time-window.ts` (40) | **domain** (Logistics) | Ventanas horarias | sólo tipos schema | Bajo | **Piloto.** Puro; usado por `db-logistics`. |
| `lib/logistics-route-plans-cache.ts` (107) | **infrastructure** (Logistics) | Cache in-memory de planes | **ningún import** | Bajo | Va a `features/logistics/infrastructure/` (cache), no a domain. |
| `lib/report-status.ts` (64) | **domain** (Reports) | Máquina de estados de informe | tipo `ReportStatus` de schema | Bajo | Domain de Reports; migrar tras piloto. |
| `lib/report-study-types.ts` (69) | **domain** (Reports) | Catálogo de tipos de estudio | tipos schema | Bajo | Domain de Reports. |
| `lib/reports.ts` (105) | **domain** (Reports) | Reglas de informe | tipos schema | Bajo | Domain de Reports. |
| `lib/report-workflow-communication.ts` (57) | **acoplamiento accidental** (Reports) | Workflow + notificación | `../db.ts` **+** schema **+** email | **Medio** | **NO tocar en piloto (P2-B).** Reservar para contexto Reports con puertos. |
| `lib/report-access-token.ts` (171) | **domain** (Report Access) | Emisión/validación de token | tipos schema | Bajo | Domain de Report Access. |
| `lib/particular-token.ts` (133) | **domain** (Particular) | Tokens de particulares | tipos schema | Bajo | Domain de Particular. |
| `lib/study-tracking.ts` (648) | **domain** (Study Tracking) | Reglas de seguimiento | tipos schema | Bajo | Domain de Study Tracking. |
| `lib/token-study-tracking.ts` (155) | **domain** (Study Tracking) | Tracking por token | tipos schema | Bajo | Domain de Study Tracking. |
| `lib/permissions.ts` (57) | **domain / shared-kernel autorización** | Reglas de roles/permisos | tipo `ClinicUserRole` de schema | Medio | Transversal (autorización). **No mover al piloto**; tratar como kernel. |
| `lib/professional-bank-eligibility.ts` (124) | **domain** (Public Professionals) | Elegibilidad de banco | tipos schema | Bajo | Domain de Public Professionals. |
| `lib/audit.ts` (261) | **cross-cutting** (Audit) | Servicio de auditoría | tipos schema | Bajo/Medio | Transversal; ver ARCH-1 event-driven. No al piloto. |
| `lib/audit-log.ts` (462) | **cross-cutting** (Audit) | Log estructurado de auditoría | — | Bajo/Medio | Transversal. |
| `lib/admin-audit.ts` (20) | **cross-cutting** (Audit) | Wrapper audit admin | — | Bajo | Transversal. |
| `lib/clinic-audit.ts` (15) | **cross-cutting** (Audit) | Wrapper audit clínica | — | Bajo | Transversal. |
| `lib/particular-audit.ts` (11) | **cross-cutting** (Audit) | Wrapper audit particular | — | Bajo | Transversal. |
| `lib/api-request-id.ts` (104) | **http adapter** | Request-id de Fastify | `fastify` | Bajo | Va a `lib/http/` (naming, futuro). No al piloto. |
| `lib/api-response-security.ts` (65) | **http adapter** | Headers de seguridad de respuesta | `fastify` | Bajo | `lib/http/`. |
| `lib/cors-headers.ts` (143) | **http adapter** | CORS | `fastify` | Bajo | `lib/http/`. |
| `lib/fastify-admin-auth.ts` (354) | **http adapter / auth** | Guard admin sobre Fastify | `fastify` | **Alto (auth)** | **No tocar** salvo PR de seguridad dedicado. |
| `lib/sensitive-response-cache.ts` (19) | **http adapter** | Cache-control de respuestas sensibles | `fastify` | Bajo | `lib/http/`. |
| `lib/email.ts` (998) | **infrastructure** | Cliente de email/plantillas | cliente externo | Bajo | `lib/infra/` (naming). Puerto de notificación al extraer Reports. |
| `lib/supabase.ts` (200) | **infrastructure** | Cliente storage Supabase | SDK externo | Bajo | `lib/infra/`. |
| `lib/env.ts` (244) | **infrastructure** | Config/entorno | — | Medio (transversal) | `lib/infra/`. Kernel de config; no al piloto. |
| `lib/logger.ts` (22) | **infrastructure** | Logger | — | Bajo | `lib/infra/`. |
| `lib/rate-limit-store.ts` (207) | **infrastructure** | Store de rate-limit | — | Bajo | `lib/infra/`. |
| `lib/login-rate-limit.ts` (195) | **infrastructure** (Auth) | Rate-limit de login | — | Medio (auth) | Junto a Auth. No al piloto. |
| `lib/contact-rate-limit.ts` (48) | **infrastructure** (Contact) | Rate-limit de contacto | — | Bajo | `lib/infra/`. |
| `lib/public-professionals-rate-limit.ts` (9) | **infrastructure** | Rate-limit público | — | Bajo | `lib/infra/`. |
| `lib/public-report-access-rate-limit.ts` (4) | **infrastructure** | Rate-limit público | — | Bajo | `lib/infra/`. |
| `lib/report-access-token-rate-limit.ts` (4) | **infrastructure** | Rate-limit token | — | Bajo | `lib/infra/`. |
| `lib/public-pricing-cache.ts` (54) | **infrastructure** (Pricing) | Cache de precios públicos | — | Bajo | Infra de Pricing. |
| `lib/http-runtime.ts` (85) | **infrastructure / observabilidad** | Timing de runtime HTTP | `../db.ts` | Medio | `lib/infra/`. Importa `db` (observabilidad). |
| `lib/runtime-timing.ts` (26) | **infrastructure / observabilidad** | Métrica de timing | — | Bajo | `lib/infra/`. |
| `lib/schema-health.ts` (168) | **infrastructure** (Maintenance) | Health de schema | `../db.ts` + supabase | Medio | Infra de Maintenance. Importa `db`. |
| `lib/session-last-access.ts` (13) | **infrastructure / cross-cutting** (Auth) | Last-access de sesión | — | Medio (auth) | Junto a Auth/middlewares. No al piloto. |
| `lib/auth-security.ts` (47) | **domain / cross-cutting** (Auth) | Hashing/rehash | — | **Alto (security)** | **No tocar** salvo PR de seguridad. |
| `lib/http-types.ts` (36) | **shared** (contrato http) | Tipos http compartidos | — | Bajo | Shared técnico; dejar como está. |
| `lib/list-pagination.ts` (54) | **shared / util** | Paginación genérica | — | Bajo | Util técnico transversal; dejar como está. |

---

## Backend db inventory

`server/db*.ts` — 14 archivos (13 `db-*` + `db.ts`), ~5.976 LOC. **Todos** mezclan
queries Drizzle + mapping + validación de dominio (P1-B). **Ninguno `db-*` importa
a otro `db-*`** → acoplamiento entre contextos bajo.

| Path | Dominio probable | Responsabilidad | Mezcla detectada | Riesgo | Recomendación |
|---|---|---|---|---|---|
| `db.ts` (873) | **infra compartida** | Pool + cliente Drizzle | — (kernel de datos) | Medio | **Shared infra. No fragmentar.** Base de todos los repos. |
| `db-logistics.ts` (1.322) | **Logistics** | Persistencia de rutas/visitas/eventos/SLA | queries + mapping + **importa `lib/logistics/{time-window,route-planning}`** | Medio | **Piloto ARCH-4:** futuro `features/logistics/infrastructure/` (repositorio). Único `db-*` que ya usa dominio. |
| `db-public-professionals.ts` (756) | Public Professionals | Directorio público | persistencia + mapping | Bajo | Candidato temprano post-piloto. |
| `db-admin-clinics.ts` (694) | Clinics | Alta/edición de clínicas | persistencia + mapping + validación | Bajo | Candidato medio. |
| `db-audit.ts` (413) | **Audit (cross-cutting)** | Persistencia de auditoría | persistencia + mapping | Bajo/Medio | Transversal; no extraer como dominio. |
| `db-admin-users-roles.ts` (357) | Users / Roles | Cuentas y roles | persistencia + validación | Medio | Candidato tardío (ligado a permissions). |
| `db-study-tracking.ts` (295) | Study Tracking | Estado de estudios | persistencia + mapping | Bajo | Candidato medio. |
| `db-admin-sessions.ts` (286) | Sessions / Auth | Sesiones activas | persistencia | Medio (auth) | No separar de Auth aún. |
| `db-report-workflow.ts` (220) | Reports | Ciclo de vida del informe | persistencia + mapping | Medio (P2-B) | Con Reports; requiere puertos por el side-effect email. |
| `db-particular.ts` (204) | Particular Tokens | Tokens de particulares | persistencia | Medio (público) | Candidato medio; contract tests. |
| `db-report-access.ts` (168) | Report Access Tokens | Acceso público por token | persistencia | Medio (público) | Candidato medio; contract tests. |
| `db-pricing.ts` (160) | Pricing | Precios públicos/admin | persistencia | Bajo | Candidato temprano (pequeño, autocontenido). |
| `db-maintenance.ts` (122) | Maintenance / Health | Dry-run, schema-health | persistencia | Bajo | Candidato temprano (utilidad operativa). |
| `db-admin-failed-login-alerts.ts` (106) | Failed Login / Auth | Alertas de intentos fallidos | persistencia | Medio (auth) | Mantener junto a Auth. |

---

## Backend routes inventory

Rutas relevantes al piloto y a los candidatos tempranos. LOC real (`wc -l`). 34
rutas, ~25.5k LOC. Los god-handlers concentran la lógica que debería ser
application/domain (P1-A).

| Path | Dominio probable | LOC | Acoplamiento | Candidato a piloto | Recomendación |
|---|---|---|---|---|---|
| `routes/logistics-route-plans.fastify.ts` | **Logistics** | **2.241** | importa `db-logistics` + `lib/logistics/*` + `logistics-route-plans-cache` | **Sí (ARCH-6)** | God-handler #1. Extraer 1 application service detrás del contrato por-ruta. |
| `routes/logistics-field-visits.fastify.ts` | **Logistics** | 1.421 | importa `db-logistics` | **Sí** | God-handler; segundo objetivo de extracción. |
| `routes/logistics-route-events.fastify.ts` | **Logistics** | 1.008 | `db-logistics` | Sí | Event-sourcing ligero de dominio (datos, no bus). |
| `routes/logistics-sla.fastify.ts` | **Logistics** | 792 | `db-logistics` + `lib/logistics/sla-breach` | Sí | Menor; buen primer thin-handler. |
| `routes/admin-pricing.fastify.ts` | Pricing | 513 | `db-pricing` | Post-piloto | Contexto chico y autocontenido; 2º piloto posible. |
| `routes/public-pricing.fastify.ts` | Pricing | 136 | `db-pricing` + `public-pricing-cache` | Post-piloto | Ruta pública: **no cambiar path/contrato**. |
| `routes/public-professionals.fastify.ts` | Public Professionals | 479 | `db-public-professionals` | Post-piloto | Ruta pública estable. |
| `routes/admin-system-maintenance.fastify.ts` | Maintenance | 209 | `db-maintenance` + `schema-health` | Post-piloto | Utilidad operativa. |
| `routes/contact.fastify.ts` | Contact | 393 | `contact-rate-limit` + email | No | Autocontenido; dejar como está. |
| `routes/auth.fastify.ts` | **Auth** | 1.514 | auth-security + sessions + audit | **No (excluido)** | God-handler, pero **cross-cutting/security**: sólo PR dedicado. |
| `routes/admin-study-tracking.fastify.ts` | Study Tracking | 1.205 | `db-study-tracking` | Post-piloto | Candidato medio. |
| `routes/clinic-public-profile.fastify.ts` | Clinics | 1.316 | `db-admin-clinics` | Post-piloto | Ruta pública; contract tests. |

---

## Frontend lib inventory

`frontend/src/lib/**` — 18 archivos + `security/`. El seam HTTP está sano:
**ningún archivo importa `server/` ni `db`** (confirmado por ARCH-1). La mezcla es
shared-real vs dominio-en-cajón-común (P2-C).

| Path | Clasificación | Responsabilidad | Riesgo | Recomendación |
|---|---|---|---|---|
| `lib/api.ts` | **http / api client** | Cliente HTTP al backend | Bajo | **Shared legítimo.** Canal único; no mover. |
| `lib/api-error.ts` | **http / api client** | Normalización de errores HTTP | Bajo | Shared legítimo. |
| `lib/utils.ts` | **shared / util** | Utilidades design-system-agnostic | Bajo | Shared legítimo. |
| `lib/routes.ts` | **shared / presentation** | Constantes de rutas de navegación | Bajo | Shared de navegación; dejar. |
| `lib/seo.ts` | **presentation helper** | Metadata SEO | Bajo | Shared de presentación. |
| `lib/theme.ts` | **presentation helper** | Theming | Bajo | Shared de presentación. |
| `lib/security/csp-nonce.ts` | **infrastructure (cliente)** | Nonce CSP | Medio (security) | Shared de seguridad; **no tocar** sin PR de seguridad. |
| `lib/security/csp-policy.ts` | **infrastructure (cliente)** | Política CSP | Medio (security) | Ídem. |
| `lib/app-version.ts` | **infrastructure (cliente)** | Versión de app | Bajo | Shared de infra cliente. |
| `lib/app-shell-release.ts` | **infrastructure (cliente)** | Release del app-shell | Bajo | Shared de infra cliente. |
| `lib/client-version-error.ts` | **infrastructure (cliente)** | Error de versión de cliente | Bajo | Shared de infra cliente. |
| `lib/dashboard-server-auth.ts` | **application / infra (Dashboard)** | Auth server-side del dashboard | Medio | A `features/dashboard/` cuando escale el blueprint. |
| `lib/public-professionals.ts` | **acoplamiento accidental** (dominio) | Lógica de profesionales públicos | Bajo | Mover a `features/public-professionals/` (P2-C). |
| `lib/public-pricing-cache.ts` | **acoplamiento accidental** (dominio) | Cache de precios público | Bajo | Mover a `features/pricing/` (P2-C). |
| `lib/notification-destinations.ts` | **acoplamiento accidental** (dominio) | Destinos de notificación | Bajo | Mover a su feature (Reports/Notif). |
| `lib/admin-hub-reset.ts` | **acoplamiento accidental** (dominio Dashboard) | Reset del hub admin | Bajo | A `features/dashboard/`; casi duplica `clinic-hub-reset`. |
| `lib/clinic-hub-reset.ts` | **acoplamiento accidental** (dominio Dashboard) | Reset del hub clínica | Bajo | A `features/dashboard/`; consolidar con admin. |
| `lib/dashboard-last-module.ts` | **acoplamiento accidental** (dominio Dashboard) | Último módulo visitado | Bajo | A `features/dashboard/`. |
| `lib/admin-access-error.ts` | **presentation / dominio (Dashboard)** | Error de acceso admin | Bajo | A `features/dashboard/`. |

---

## Frontend features/components inventory

**`features/dashboard/` = blueprint vivo (único).** Declara `config / domain /
application / presentation` con reglas de frontera en su `README.md`. Estado real:

- **Con código real:** `config/dashboardModules.ts`,
  `application/dashboardModuleNavigation.ts`,
  `presentation/surfaces/DashboardStatusBadge.tsx` (re-export puro del impl en
  `components/dashboard/`).
- **Barrels vacíos (`export {}`):** `domain/`, `presentation/{shell,navigation,
  layout,admin,clinic}/index.ts`. El blueprint existe pero **no está probado en un
  segundo dominio** (P1-C).

**`components/` = Package by Layer.** Conteo real:

| Carpeta | Archivos | Clasificación |
|---|---|---|
| `components/ui/` | 10 | **Shared legítimo** (design system). No tocar. |
| `components/dashboard/` | 49 | Dominio Dashboard → destino `features/dashboard/presentation/`. |
| `components/public/` | 16 | Dominio Público → candidato a `features/<public>/presentation/`. |
| `components/layout/` | 3 | Presentación transversal. |
| `components/pwa/` | 2 | Infra cliente (PWA). |
| `components/theme/` | 1 | Presentación transversal. |
| `components/app-version/` | 1 | Infra cliente (versión). |

**Otros dominios candidatos (frontend):** el conjunto `components/public/` (16) +
`lib/public-professionals.ts` + `lib/public-pricing-cache.ts` sugiere un segundo
feature-package **público** (profesionales/precios) como blueprint tras cerrar la
cadena PRES del dashboard. **No** iniciar hasta ARCH-6.

---

## Shared kernel candidates

*Shared legítimo* = transversal, estable y **sin vocabulario de negocio**.

- **`drizzle/schema.ts` (1.196 LOC) + `relations.ts`** — **shared kernel temporal
  backend confirmado.** Fuente única de tipos/entidades que consumen `db-*` y los
  domain libs. **No fragmentar** (rompería Drizzle y migraciones 0000–0030). Es
  hoja: nada de negocio lo importa al revés.
- **`server/db.ts`** — infra de datos compartida (pool/cliente). No es dominio; no
  se mueve.
- **`server/lib/http-types.ts`, `list-pagination.ts`** — tipos/util técnicos
  transversales sin negocio → shared técnico.
- **`server/lib/env.ts`, `logger.ts`** — config/observabilidad cross-domain
  estables → shared infra (futuro `lib/infra/`).
- **`server/middlewares/**`** — infra transversal de auth/observabilidad. Shared,
  pero **congelado** (sólo PR de seguridad).
- **Frontend:** `components/ui/` (design system), `types/index.ts`,
  `context/AuthContext`, `lib/{api,api-error,utils}` → shared cliente legítimo.

**Tipos globales / schemas compartidos:** viven en `drizzle/schema.ts` (backend) y
`frontend/src/types/index.ts` (frontend). **No** existe `shared/` cross-package a
nivel repo (verificado). Las constantes cross-domain realmente estables son las de
`schema` + `types`; no hay bolsa de constantes suelta que promover.

---

## Accidental coupling candidates

Lógica con vocabulario de un contexto que quedó en el cajón común, o dependencia
cruzada de dirección incorrecta:

- **`server/lib/report-workflow-communication.ts` (P2-B)** — dominio de workflow
  que importa `../db.ts` + schema + email. **Único domain→infra invertido en
  backend.** Riesgo medio. Pertenece a Reports; separar puerto de datos y puerto
  de notificación al extraer ese contexto. **Fuera del piloto Logistics.**
- **`server/lib/` como cajón (P2-A)** — 40 archivos sin frontera domain/infra/http.
  No es dependencia rota, pero es "bolsa común": la frontera sólo existe por
  import, no por carpeta ni naming.
- **`frontend/src/lib/` dominio-en-shared (P2-C)** — `public-professionals`,
  `public-pricing-cache`, `notification-destinations`, `admin-hub-reset`,
  `clinic-hub-reset`, `dashboard-last-module`, `admin-access-error` son dominio en
  el cajón `lib/`. `admin-hub-reset` ≈ `clinic-hub-reset` (duplicación).
- **`components/dashboard` (49) + `components/public` (16)** — dominio en la capa
  `components/`, pendiente de mudar a `features/<domain>/presentation` cuando el
  blueprint escale.

**No son acoplamiento accidental** (aunque importen framework): los 5 adaptadores
http (`api-request-id`, `api-response-security`, `cors-headers`,
`fastify-admin-auth`, `sensitive-response-cache`) son transporte legítimo; y las
libs de auth/security (`auth-security`, `fastify-admin-auth`, `login-rate-limit`,
`session-last-access`) son cross-cutting congelado.

---

## Logistics pilot readiness

**Veredicto: LISTO para ARCH-4 (read-only domain shell). Riesgo bajo.**

**Paths candidatos**

- Domain (ya puro): `server/lib/logistics/{metrics,route-planning,sla-breach,
  time-window}.ts`.
- Infrastructure: `server/db-logistics.ts` (repositorio) +
  `server/lib/logistics-route-plans-cache.ts` (cache).
- Routes (application inline a extraer): `server/routes/logistics-route-plans`,
  `logistics-field-visits`, `logistics-route-events`, `logistics-sla`.
- Superficie futura: `server/features/logistics/index.ts`.

**Qué mover primero**

1. **ARCH-4:** crear `server/features/logistics/index.ts` que **re-exporta** lo ya
   existente (`lib/logistics/*`, `db-logistics`, cache). Sin mover archivos, sin
   tocar rutas. Establece la frontera de módulo.
2. **ARCH-5:** mover **un** helper puro — recomendado `sla-breach.ts` (111 LOC, el
   más chico y aislado) o `route-planning.ts` — a `features/logistics/domain/` con
   su test, comportamiento idéntico.

**Qué NO mover (todavía)**

- `report-workflow-communication.ts` (es de Reports, y con coupling P2-B).
- Cualquier `db-*` que no sea `db-logistics`.
- `permissions.ts`, `auth-security.ts`, `fastify-admin-auth.ts`, middlewares
  (cross-cutting / security).
- `drizzle/schema.ts` (shared kernel — no fragmentar).
- Rutas públicas y sus contratos.

**Tests requeridos (red de seguridad, ~30 archivos ya existentes)**

- Dominio: `logistics-route-planning`, `logistics-metrics(-suite-completeness)`,
  `logistics-sla-breach-runtime`, `logistics-sla-compliance`,
  `logistics-time-windows-schema`.
- Datos/infra: `logistics-db`, `logistics-route-plans-cache(-runtime)`,
  `logistics-route-event-aggregation`.
- Contrato por-ruta: `logistics-route-plans-api`, `logistics-field-visits-api`,
  `logistics-route-events-api`, `logistics-sla-routes-api`,
  `logistics-sla-routes-integration.fastify`, `logistics-rbac-permission-contract`,
  `logistics-audit-runtime`.
- Cada move va con `pnpm test` + `pnpm build` verdes en el **mismo PR** (P2-D).

**Riesgos**

- Bajo. Contexto autocontenido (`db-logistics` no importa otros `db-*`), dominio ya
  puro, tests densos. Riesgo real = guardrails de literal-de-fuente si un test fija
  una ruta/literal movido (actualizar en el mismo PR).

---

## Recommended actions

Secuencia de PRs chicos, uno por paso, siempre detrás de contratos existentes:

- **ARCH-4 — Logistics read-only domain shell.** Crear
  `server/features/logistics/index.ts` con re-exports de `lib/logistics/*`,
  `db-logistics` y `logistics-route-plans-cache`. **Sin** mover archivos ni tocar
  rutas/lógica. Establece la frontera de módulo. Riesgo bajo.
- **ARCH-5 — Extraer 1 helper de dominio puro.** Mover `sla-breach.ts` (o
  `route-planning.ts`) a `features/logistics/domain/` con su test; comportamiento
  idéntico. Valida "domain sin framework". Riesgo bajo.
- **ARCH-6 — Extraer 1 application service detrás de una ruta existente.** Sacar un
  caso de uso de `logistics-route-plans.fastify.ts` (2.241 LOC) a
  `features/logistics/application/`, detrás del contrato por-ruta; el handler queda
  thin. Valida "routes/http delega". Riesgo medio (contexto aislado).
- **ARCH-7 — Auditoría de eventos (opcional).** Sólo si ARCH-4..6 revelan fan-out
  real en logística. Si no aparece (el vocabulario "route-events" ya está modelado
  como **datos** persistidos, no como bus), documentar "no eventos" y cerrar —
  coherente con la conclusión event-driven de ARCH-1.

Cleanups de naming (`lib/{domain|infra|http}` backend, triaje `frontend/src/lib`)
quedan como trabajo de bajo riesgo separado; este inventario deja el mapa listo
para ejecutarlos con re-exports + guardrails cuando se decida.

---

## Guardrails

- **docs-only:** sin código, sin CSS, sin tests, sin deps/lockfiles/CI, sin
  stashes, sin `.claude`, sin worktrees.
- **No renames, no moves** en este PR: sólo inventario.
- **No event bus / outbox.** No DB / schema. No auth/security.
- No fragmentar `drizzle/schema.ts`. No romper rutas públicas.
- Único archivo nuevo: `docs/architecture/shared-lib-boundary-inventory.md`.

## Validation

- `git diff --check` — sin whitespace/conflict markers.
- `git status --short --untracked-files=all` — único cambio: este archivo.
- `git diff --stat` / `git diff --name-only` — confirman alcance docs-only.
- Clasificación derivada de imports reales (`grep` de `fastify` / `../db.ts` /
  `drizzle/schema`) y LOC reales (`wc -l`), no de suposiciones por nombre.

## Related PRs / documents

- [`docs/audit/repository-domain-architecture-audit.md`](../audit/repository-domain-architecture-audit.md) — ARCH-1 (documento rector).
- [`docs/architecture/backend-boundary-adr.md`](./backend-boundary-adr.md) — ARCH-2 (ADR de fronteras).
- `frontend/src/features/dashboard/README.md` — reglas de frontera espejo en frontend.
- `docs/logistics/MVP_DOMAIN.md` — documento de dominio del piloto.
- Próximos: ARCH-4 (Logistics shell), ARCH-5 (helper de dominio), ARCH-6
  (application service), ARCH-7 (eventos, opcional).
