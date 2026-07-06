# Repository Domain Architecture Audit

> **Tipo:** Auditoría técnica **docs-only**. No implementa, no mueve archivos, no toca código, CSS, tests, `package.json`, lockfiles ni CI.
> **Base:** `main` limpio · **HEAD:** `ca335c0` refactor(dashboard): introduce surface status badge primitive (#1295)
> **Rama:** `audit/repository-domain-architecture`
> **Alcance de escritura:** exclusivamente `docs/audit/`.
> **Modelo / esfuerzo:** Claude Opus 4.8 · xhigh.
> **ID:** ARCH-1.

Esta auditoría extiende, al **repositorio completo**, la línea de trabajo que ya
cerró la foundation del dashboard (#1288–#1295: CSS modularizado, composition
root, `features/dashboard/` con fronteras de presentación, catálogo de módulos,
helpers de navegación y el primitive de surface/status badge). El objetivo es
decidir, con evidencia de paths e imports, **si la arquitectura real del repo
soporta —o puede evolucionar con bajo riesgo hacia— una estructura por
dominios/capacidades de negocio**, sin caer en sobreingeniería.

---

## Executive summary

**Estado real.** VETNEB es un **monolito modular emergente**. El backend es
**Package by Layer dominante** (`server/routes/` + `server/db-*.ts` +
`server/lib/` + `server/middlewares/`) con una **agrupación por feature que hoy
existe sólo como convención de nombres** (`admin-*`, `logistics-*`,
`particular-*`, `public-*`, `clinic-*`, `reports*`). El frontend es un **híbrido
intencional**: Next.js App Router (routing por carpeta, naturalmente orientado a
feature) + `components/` y `lib/` organizados por capa técnica + **una única
isla real de Package by Feature**, `frontend/src/features/dashboard/`, que ya
declara fronteras `config / domain / application / presentation`.

**¿Package by Feature ya existe?** Parcialmente y de forma **asimétrica**. En
frontend existe *intencionalmente* pero **aplicado a un solo dominio**
(dashboard) y todavía en su mayoría como barrels vacíos (`export {}`). En backend
existe *sólo por convención de nombres*; el único sub-paquete de dominio real es
`server/lib/logistics/`.

**¿Clean / Hexagonal?** **Emergiendo, no consolidado.** El seam más limpio ya
existe y es fuerte: **el frontend nunca importa `server/`** — toda comunicación
pasa por HTTP vía `@/lib/api`. Las libs de dominio puras
(`server/lib/report-status.ts`, `permissions.ts`, `logistics/*`) importan **sólo
tipos de `drizzle/schema.ts`**, no Fastify. Pero **falta la capa
application/servicio en backend**: la lógica de dominio vive inline dentro de
handlers HTTP grandes (`server/routes/logistics-route-plans.fastify.ts` = 2.241
LOC, `auth.fastify.ts` = 1.514 LOC) y dentro de los `db-*.ts` (persistencia +
mapeo/validación mezclados).

**¿DDD / Bounded Contexts aplica?** **Sí, como lente de organización, no como
reescritura.** Hay ~14–16 contextos delimitados reconocibles por su vocabulario
y ya alineados end-to-end (route ↔ `db-*` ↔ lib ↔ test). Cada `db-*.ts` es
**auto-contenido** (ningún `db-*` importa a otro): la cohesión por contexto ya es
alta y el acoplamiento entre contextos en la capa de datos es bajo. Esto hace la
migración por contexto **viable e incremental**, no un big-bang.

**¿Event-driven conviene ahora?** **No como bus.** Existen dos side-effects
transversales reales —**auditoría** (16 call-sites) y **email/notificaciones**
(5 call-sites)— hoy resueltos con llamadas síncronas inline y **cubiertos por
contratos por-ruta** (audit, session-last-access, runtime-timing). Introducir un
bus o outbox rompería esa testabilidad por-ruta y agregaría una capa sin retorno.
Recomendación: **seguir síncrono**; a lo sumo, mucho más adelante, un *dispatcher
de dominio in-process y síncrono* para consolidar la duplicación de auditoría —
sólo si un PR previo lo justifica con evidencia.

**Conteo de hallazgos:** **P0: 0 · P1: 3 · P2: 4 · P3: 3.**

---

## Current repository structure

Monorepo pnpm (`pnpm-workspace.yaml`) con backend Fastify + frontend Next.js
(App Router) + Drizzle/Postgres, y una batería de tests enorme en la raíz.

```
PORTAL-VETNEB/
  server/                         # Backend Fastify — Package by Layer
    index.ts, bootstrap.ts, preflight.ts, fastify-app.ts
    db.ts                         # pool/cliente Drizzle (infra de datos)
    db-*.ts                       # 14 módulos de acceso a datos por feature (~5.1k LOC)
    routes/*.fastify.ts           # 34 rutas HTTP por feature (~25.5k LOC)
    middlewares/*.ts              # auth, admin-auth, particular-auth, clinic-permissions,
                                  #   error-handler, request-logger, trusted-origin, version-gate
    lib/                          # 50+ módulos: dominio + infra + adaptadores http MEZCLADOS
      logistics/                  # <- único sub-paquete de dominio real (metrics,
                                  #      route-planning, sla-breach, time-window)
    utils/async-handler.ts
  drizzle/
    schema.ts                     # 1.196 LOC — modelo de datos único (Shared Kernel de facto)
    relations.ts, migrations/     # 0000..0030 (31 migraciones)
  frontend/
    src/
      app/                        # Next App Router (routing = feature por carpeta)
        (públicas)               # servicios, precios, clinicas, particulares,
                                  #   profesionales, contacto, citologia-*, histopatologia-*, ...
        dashboard/               # admin/ · informes/ · logistica/ + controllers y *.actions.ts
        api/                     # build-info, security (CSP)
        login/, offline/
      features/dashboard/         # <- única isla Package by Feature (config/domain/
                                  #      application/presentation) — mayormente barrels
      components/                 # Package by Layer: dashboard(49) · public(16) · ui(10) ·
                                  #   layout · pwa · theme · app-version
      lib/                        # api client + utils + dominio-ish (flat, mezclado)
      hooks/, context/AuthContext, types/index.ts, styles/, proxy.ts
    e2e/                          # Playwright: no-scroll, visual-regression, parity, a11y
  test/                           # ~410 tests planos (backend + frontend-*) por feature+contrato
  docs/                           # 469 archivos: audit(211) · implementation(143) · pr-history(62) ...
  scripts/, .github/, drizzle.config.ts, tsconfig.json
```

Distribución de archivos rastreados (git): `docs 469 · test 420 · frontend 332 ·
server 105 · drizzle 38 · scripts 19`.

---

## Architecture classification

Clasificación por capa:

| Capa | Clasificación | Evidencia |
|------|---------------|-----------|
| **Backend** | **Package by Layer dominante** + Package by Feature *por convención de nombres* | Carpetas raíz `routes/`, `lib/`, `middlewares/` y familia `db-*.ts` son capas. La pertenencia a feature vive en el **prefijo del nombre** (`admin-clinics.fastify.ts` ↔ `db-admin-clinics.ts` ↔ `test/admin-clinics.fastify.test.ts`), no en carpetas. Único sub-paquete de dominio: `server/lib/logistics/`. |
| **Frontend** | **Hybrid intencional** (App Router + Package by Layer + isla Package by Feature) | `app/` es routing por carpeta; `components/` y `lib/` son por capa; `features/dashboard/{config,domain,application,presentation}` es el único feature-package, declarado en su `README.md` con reglas de frontera. |
| **Repo global** | **Monolito modular emergente** | Contextos cohesivos alineados end-to-end, seam HTTP frontend↔backend limpio, y un piloto de fronteras (dashboard) ya mergeado; falta capa application en backend y generalización del blueprint. |

**Por qué NO es cada alternativa:**

- **No es Clean/Hexagonal consolidado:** no hay carpetas `domain/application/
  infrastructure` en backend; la lógica de negocio está inline en handlers HTTP
  (god-handlers de 1.000–2.241 LOC) y en `db-*.ts`.
- **No es Package by Feature pleno:** la feature sólo es un prefijo de nombre en
  backend, y en frontend está aplicada a un solo dominio.
- **No es Hybrid accidental:** el híbrido frontend es **deliberado y
  documentado** (`features/dashboard/README.md`, auditoría PRES-1, boundaries
  PRES-2). La convención de nombres backend es consistente, no caótica.

**Veredicto:** *Monolito modular emergente, Package-by-Layer dominante, con un
piloto intencional de Clean/Package-by-Feature en el dashboard frontend.*

---

## Candidate bounded contexts

Contextos reconocibles por vocabulario propio, alineados route ↔ `db-*` ↔ lib ↔
test. Cohesión = qué tan concentrado está el contexto; Acoplamiento = cuánto
depende de otros contextos / de infra compartida.

| Contexto | Paths actuales (representativos) | Responsabilidad | Cohesión | Acoplamiento | Riesgo | Recomendación |
|----------|----------------------------------|-----------------|----------|--------------|--------|---------------|
| **Auth** | `routes/auth`, `routes/admin-auth`, `routes/particular-auth`, `middlewares/{auth,admin-auth,particular-auth}`, `lib/auth-security`, `lib/session-last-access` | Login, sesión, hashing/rehash, cookies | Alta | Medio (transversal a todo) | **Alto (security)** | **No tocar salvo PR dedicado.** Documentar frontera, no reubicar. |
| **Users / Roles** | `routes/admin-users-roles`, `db-admin-users-roles`, `lib/permissions` | Cuentas, roles, permisos | Alta | Medio (permissions es transversal) | Medio | Candidato tardío; `permissions.ts` es shared kernel de autorización. |
| **Clinics** | `routes/admin-clinics`, `routes/clinic-public-profile`, `routes/clinic-audit`, `db-admin-clinics`, `lib/clinic-audit` | Alta de clínicas, perfil público B2B | Alta | Bajo | Bajo | Buen candidato medio. |
| **Reports / Informes** | `routes/reports`, `routes/reports-status`, `routes/admin-reports`, `routes/admin-report-workflow`, `lib/{reports,report-status,report-study-types,report-workflow-communication}`, `db-report-workflow` | Ciclo de vida del informe diagnóstico | Alta | Medio (email + audit + storage) | Medio | Contexto central; extraer tras un piloto exitoso. |
| **Report Access Tokens** | `routes/report-access-tokens`, `routes/admin-report-access-tokens`, `routes/public-report-access`, `lib/{report-access-token,report-access-token-rate-limit}`, `db-report-access` | Acceso público a informe por token | Alta | Bajo/Medio | Medio (público) | Candidato medio; superficie pública, requiere contract tests. |
| **Particular Tokens** | `routes/particular-tokens`, `routes/admin-particular-tokens`, `routes/particular-auth`, `lib/particular-token`, `db-particular` | Tokens de acceso de particulares | Alta | Bajo/Medio | Medio (público) | Candidato medio. |
| **Study Tracking** | `routes/study-tracking`, `routes/admin-study-tracking`, `routes/particular-study-tracking`, `lib/{study-tracking,token-study-tracking}`, `db-study-tracking` | Seguimiento de estado de estudios | Alta | Medio | Bajo | Candidato medio. |
| **Logistics** | `routes/logistics-*` (4), `db-logistics`, **`lib/logistics/*`**, `lib/logistics-route-plans-cache` | Rutas, visitas de campo, SLA, eventos | **Muy alta** | **Bajo** | Bajo | **Mejor piloto.** Ya tiene sub-paquete de dominio y `docs/logistics/MVP_DOMAIN.md`. |
| **Pricing** | `routes/admin-pricing`, `routes/public-pricing`, `lib/public-pricing-cache`, `db-pricing` | Precios públicos y edición admin | Alta | Bajo | Bajo | Candidato temprano (pequeño, autocontenido). |
| **Audit** | `lib/{audit,admin-audit,clinic-audit,particular-audit,audit-log}`, `db-audit`, `routes/*-audit` | Registro de acciones críticas | Media (dispersa por call-sites) | **Alto (16 productores)** | Bajo/Medio | Transversal; ver *Event-driven suitability*. |
| **Public Professionals** | `routes/public-professionals`, `db-public-professionals`, `lib/professional-bank-eligibility` | Directorio público de profesionales | Alta | Bajo | Bajo | Candidato temprano. |
| **Sessions** | `routes/admin-sessions`, `db-admin-sessions`, `lib/session-last-access` | Sesiones activas / last-access | Alta | Medio (ligado a Auth) | Medio | Subcontexto de Auth; no separar aún. |
| **Maintenance / Health** | `routes/admin-system-{health,maintenance,schema-health}`, `db-maintenance`, `lib/schema-health` | Salud del sistema, dry-run, schema | Alta | Bajo | Bajo | Candidato temprano; utilidad operativa. |
| **Failed Login / Rate Limit** | `routes/admin-failed-login-alerts`, `db-admin-failed-login-alerts`, `lib/*rate-limit*` | Alertas de intentos fallidos, rate limiting | Media | Medio (ligado a Auth) | Medio | Mantener junto a Auth. |
| **Email / Notifications** | `lib/email`, `lib/notification-destinations` (front), `routes` que envían | Envío de correo, destinos | Media (dispersa) | **Alto (5 productores)** | Bajo | Transversal; ver *Event-driven suitability*. |
| **Contact** | `routes/contact`, `lib/contact-rate-limit` | Formulario de contacto público | Alta | Bajo | Bajo | Autocontenido; dejar como está. |

**Lectura:** los contextos con **cohesión alta + acoplamiento bajo + riesgo bajo**
(**Logistics, Pricing, Public Professionals, Maintenance/Health, Contact**) son
los candidatos naturales para un piloto de reorganización por dominio. Los
transversales (**Auth, Permissions, Audit, Email**) NO deben extraerse: son
kernel/cross-cutting.

---

## Dependency direction audit

Dirección ideal: `presentation → application → domain → infrastructure` (las
capas externas dependen de las internas; el dominio no depende de nada externo).

### Dónde se cumple

- **Seam HTTP frontend↔backend (fuerte).** `frontend/**` **no importa** `server/`
  ni `db` en ningún archivo (grep vacío). El frontend consume el backend sólo por
  HTTP (`@/lib/api`) y Server Actions (`"use server"`, p.ej.
  `app/dashboard/informes/informes.actions.ts`). No hay UI importando lógica
  backend ni queries DB acopladas a componentes.
- **Dominio puro sin framework.** `server/lib/report-status.ts`, `permissions.ts`,
  `particular-token.ts`, `report-access-token.ts`, `study-tracking.ts` y todo
  `server/lib/logistics/*` importan **sólo tipos de `drizzle/schema.ts`**, nunca
  `fastify`. La lógica de dominio no conoce el transporte HTTP.
- **Frontend dashboard declara la dirección.** `features/dashboard/README.md` fija
  reglas correctas: `config`/`domain` no importan React; `application` no renderiza
  JSX; `presentation` no importa `@/lib/api` directo.
- **Cohesión de datos.** Ningún `server/db-*.ts` importa a otro `db-*` → los
  contextos no se acoplan entre sí en la capa de persistencia.

### Dónde se rompe

- **Falta la capa application en backend (P1).** Los handlers HTTP importan
  `db-*` directamente (`routes/*` → `../db-*`) sin servicio intermedio. La lógica
  de negocio (validación, orquestación, reglas) vive **inline en el handler**:
  `logistics-route-plans.fastify.ts` (2.241 LOC), `auth.fastify.ts` (1.514),
  `logistics-field-visits.fastify.ts` (1.421), `clinic-public-profile.fastify.ts`
  (1.316). *Impacto:* la regla de negocio no es reutilizable fuera de HTTP ni
  testeable sin levantar la ruta; es el principal desvío de Clean/Hexagonal.
- **`db-*` mezcla persistencia + dominio (P1).** Los ~5.1k LOC de `db-*.ts`
  combinan queries Drizzle con mapeo y validación de dominio. *Impacto:* “domain”
  e “infrastructure” comparten archivo; no hay puerto/repositorio explícito.
- **Dominio → infraestructura puntual (P2).** `server/lib/report-workflow-
  communication.ts` (dominio de workflow) importa `../db` y dispara email:
  acopla una regla de dominio a persistencia + side-effect. También
  `lib/schema-health.ts` y `lib/http-runtime.ts` importan `db`.
- **Adaptadores HTTP etiquetados como “lib” (P2).** `lib/api-request-id.ts`,
  `api-response-security.ts`, `cors-headers.ts`, `fastify-admin-auth.ts`,
  `sensitive-response-cache.ts` importan `fastify`. No es “dominio importando
  infra”, pero confirma que `server/lib/` es un cajón mixto (dominio + infra +
  adaptadores http) sin frontera declarada.

**Resumen de dirección:** el **eje horizontal** (frontend↔backend) está limpio;
el **eje vertical dentro del backend** (HTTP → aplicación → dominio → datos) está
**colapsado en 2 capas** (handler+db) en vez de 4. Ese colapso es la deuda
arquitectónica central.

---

## Frontend findings

1. **Isla feature única y asimétrica.** `features/dashboard/` es el único
   feature-package y sus capas están, por diseño, **mayormente como barrels
   vacíos** (`presentation/{shell,navigation,layout,admin,clinic}/index.ts` =
   `export {}`). Lo real ya extraído: `config/dashboardModules.ts`,
   `application/dashboardModuleNavigation.ts`, `presentation/surfaces/
   DashboardStatusBadge.tsx` (re-export puro del impl en `components/dashboard/`).
   *Riesgo:* el blueprint existe pero **no está probado en un segundo dominio**;
   si se congela así, se vuelve documentación sin tracción.
2. **Tres árboles para el dashboard.** El código real sigue repartido en
   `app/dashboard/` (rutas + controllers + `*.actions.ts`), `components/dashboard/`
   (49 impls) y `lib/` (helpers `dashboard-*`, `admin-hub-reset` ≈
   `clinic-hub-reset`). La auditoría PRES-1 ya documentó god-routes (admin
   `page.tsx` ≈ 813 LOC) y controllers duplicados admin/clínica. La foundation
   PRES-2..5 preparó el destino sin migrar aún.
3. **`components/` es Package by Layer.** `dashboard(49) · public(16) · ui(10) ·
   layout · pwa · theme`. `ui/` es design-system legítimo (compartido); `public/`
   y `dashboard/` son de dominio y podrían mudarse a `features/<domain>/
   presentation` cuando el blueprint escale.
4. **`lib/` frontend mezclado (P2).** Conviven design-system-agnostic
   (`utils.ts`, `api.ts`, `api-error.ts`), infra de cliente (`security/`,
   `app-version`, `client-version-error`) y dominio (`public-professionals.ts`,
   `public-pricing-cache.ts`, `notification-destinations.ts`, `dashboard-*`).
5. **Boundary HTTP correcto.** Server Actions y `@/lib/api` son el único canal a
   backend; no hay fuga de lógica servidor a componentes.

---

## Backend findings

1. **Convención de nombres = feature implícita (fortaleza).** El triplete
   `routes/<f>.fastify.ts` ↔ `db-<f>.ts` ↔ `test/<f>*.test.ts` hace que cada
   contexto sea **rastreable end-to-end** pese a estar en carpetas por capa. Es la
   base que hace barata una futura reorganización por feature.
2. **God-handlers HTTP (P1).** 7 rutas superan 1.000 LOC (máx. 2.241). Mezclan
   parseo, autorización, reglas de negocio, side-effects (audit/email) y
   serialización. Es donde vive la lógica que debería ser “application/domain”.
3. **`db-*` auto-contenidos (fortaleza).** Ningún `db-*` importa a otro → cohesión
   por contexto alta, acoplamiento entre contextos bajo en la capa de datos. Ideal
   para migración incremental por contexto.
4. **`lib/` sin frontera (P2).** 50+ módulos mezclan **dominio puro**
   (`report-status`, `permissions`, `logistics/*`), **infra**
   (`email`, `supabase`, `logger`, `env`, `rate-limit-store`) y **adaptadores http**
   (`cors-headers`, `api-response-security`, `fastify-admin-auth`). Es el objetivo
   natural del primer cleanup docs+low-risk.
5. **Shared kernel real: `drizzle/schema.ts` (1.196 LOC).** Es la fuente única de
   tipos/entidades que consumen `db-*` y las libs de dominio. Correctamente
   compartido; **no** debe fragmentarse por contexto (rompería Drizzle y las
   migraciones 0000–0030). Es infraestructura/kernel legítima.
6. **Logistics ya es un mini-dominio.** `lib/logistics/{metrics,route-planning,
   sla-breach,time-window}` + `db-logistics` + `docs/logistics/MVP_DOMAIN.md`:
   único contexto con lógica de dominio sub-paquetada y documento de dominio.

---

## Shared/common findings

| Zona | Contenido | Veredicto |
|------|-----------|-----------|
| `drizzle/schema.ts` + `relations.ts` | Modelo de datos único | **Shared kernel legítimo.** No fragmentar. |
| `server/lib/` (dominio) | `report-status`, `permissions`, `report-study-types`, `particular-token`, `report-access-token`, `study-tracking`, `logistics/*` | **Debería vivir en `domain/` de su contexto**; hoy en cajón común. |
| `server/lib/` (infra) | `email`, `supabase`, `logger`, `env`, `http-runtime`, `rate-limit-store`, `runtime-timing` | **Infra compartida legítima.** Mover a `lib/infra/` (naming), no a dominio. |
| `server/lib/` (adaptadores http) | `cors-headers`, `api-request-id`, `api-response-security`, `fastify-admin-auth`, `sensitive-response-cache` | **Adaptadores de transporte.** Mover a `lib/http/` (naming). |
| `server/middlewares/` | auth/security/observabilidad | **Infra transversal legítima.** No tocar sin PR de seguridad dedicado. |
| `server/utils/async-handler.ts` | helper genérico | Utilidad técnica legítima. |
| `frontend/src/lib/` | api client + utils + dominio + infra cliente | **Acoplamiento accidental parcial:** dominio (`public-professionals`, `public-pricing-cache`, `dashboard-*`) debería ir a `features/<domain>`; `ui`/`api`/`utils` quedan como shared. |
| `frontend/src/components/ui` | design system | **Shared legítimo.** |
| `frontend/src/types/index.ts`, `context/AuthContext` | tipos y auth cliente | Shared legítimo (transversal). |

**Regla derivada:** *shared legítimo* = lo verdaderamente transversal y sin
vocabulario de negocio (schema, ui, api-client, logger, env, auth-context).
*Acoplamiento accidental* = lógica con vocabulario de un contexto que quedó en el
cajón común (`report-status`, `public-professionals`, `dashboard-*`).

---

## Event-driven suitability

> **Principio:** no se recomienda bus/outbox por dogma. Sólo se evalúa dónde hay
> un beneficio concreto que supere el costo de indirección y la pérdida de
> testabilidad por-ruta que hoy da valor.

| Evento candidato | Productor(es) | Consumidor(es) | Beneficio | Riesgo | Recomendación |
|------------------|---------------|----------------|-----------|--------|---------------|
| **Acción crítica → auditoría** | 16 call-sites (`routes/admin-*`, `auth`, `logistics-*`, `study-tracking`, `report-access`...) | `db-audit` / `lib/audit` | Quitaría la llamada `recordAudit(...)` duplicada en cada handler | Rompe contratos por-ruta (audit, session-last-access, runtime-timing); un bus asíncrono pierde orden/garantía transaccional | **Seguir síncrono.** *Opcional futuro y sólo si un PR lo justifica:* dispatcher de dominio **in-process y síncrono** (no bus, no async) para centralizar los 16 call-sites. Prioridad baja. |
| **Mutación → email/notificación** | 5 call-sites (`contact`, `particular-tokens`, `admin-particular-tokens`, `study-tracking`, `admin-study-tracking`) | `lib/email` | Desacoplaría envío del handler | Hoy no hay fan-out multi-consumer; email ya está aislado en `lib/email`. Un event log agrega complejidad sin segundo consumidor | **Evitar eventos por ahora.** Si crece el fan-out (SMS/push/webhook), reconsiderar con outbox. |
| **Creación/uso de token** | `particular-tokens`, `report-access-tokens` | audit + email | Combina los dos anteriores | Igual que arriba | **Sin eventos**; el patrón inline síncrono es suficiente y testeado. |
| **Cambio de rol** | `admin-users-roles` | audit | Trazabilidad | Bajísimo volumen; inline es trivial | **Sin eventos.** |
| **Eventos de sesión / last-access** | middlewares auth | `session-last-access` | — | Ya es cross-cutting middleware, camino correcto | **Sin eventos** (ya resuelto como middleware). |
| **Route events (logística)** | `logistics-route-events` | `db-logistics` agregación | Dominio con “event” en su vocabulario | Ya modelado como **datos de dominio persistidos**, no como bus técnico | **Mantener como está** (event-sourcing ligero de dominio, no infra de mensajería). |
| **Mantenimiento / health** | `admin-system-*` | dashboards admin | Observabilidad | Pull/consulta encaja mejor que push | **Sin eventos.** |

**Conclusión event-driven:** **no introducir event bus ni outbox ahora.** El único
caso con duplicación real (auditoría, 16 productores) se resuelve mejor —si algún
día se resuelve— con un **dispatcher síncrono in-process**, y aún así es P3/opcional
porque los contratos por-ruta actuales dan más valor que la deduplicación.

---

## Severity findings

### P0 — Riesgo crítico operativo/security/build

**Ninguno.** No se detectó dependencia rota, fuga de seguridad estructural ni
riesgo de build derivado de la arquitectura. El seam frontend↔backend, las
fronteras de auth (middlewares) y el shared kernel de schema están sanos y
fuertemente testeados. *(Esta auditoría es estructural; no reemplaza a las
auditorías de seguridad dedicadas.)*

### P1 — Deuda que bloquea escalabilidad/mantenibilidad

**P1-A · Ausencia de capa application/servicio en backend (lógica de dominio en god-handlers HTTP).**
- **Evidencia:** `routes/logistics-route-plans.fastify.ts` (2.241 LOC),
  `auth.fastify.ts` (1.514), `logistics-field-visits.fastify.ts` (1.421),
  `clinic-public-profile.fastify.ts` (1.316), `admin-study-tracking.fastify.ts`
  (1.205); handlers importan `db-*` directo.
- **Impacto:** reglas de negocio no reutilizables ni testeables fuera de HTTP;
  Clean/Hexagonal imposible sin este corte.
- **Recomendación:** extraer *services* (application) por contexto, empezando por
  el más cohesivo, **detrás de los contratos existentes** y sin cambiar rutas.
- **PR sugerido:** ARCH-4 (piloto Logistics).
- **Scope seguro:** un solo contexto; sin tocar rutas públicas, DB ni auth.
- **Paths candidatos:** `server/routes/logistics-*`, `server/db-logistics.ts`,
  `server/lib/logistics/*`.

**P1-B · Feature es sólo convención de nombres; sin frontera de módulo en backend.**
- **Evidencia:** contextos dispersos por capa (`routes/` + `db-*` + `lib/`), unidos
  sólo por prefijo de nombre; único sub-paquete real `lib/logistics/`.
- **Impacto:** no hay barrera que impida acoplar contextos a futuro; el
  “bounded context” es implícito y frágil.
- **Recomendación:** formalizar 1 contexto piloto en `server/features/<ctx>/`
  como reorganización fina detrás de contratos (no big-bang).
- **PR sugerido:** ARCH-4.
- **Scope seguro:** mover/reexportar dentro de un contexto con tests verdes.
- **Paths candidatos:** Logistics (mejor), luego Pricing / Public Professionals.

**P1-C · Blueprint `features/` frontend aplicado a un solo dominio.**
- **Evidencia:** `frontend/src/features/dashboard/` existe; ningún otro dominio lo
  usa; barrels mayormente vacíos.
- **Impacto:** riesgo de que el patrón quede como documentación sin adopción;
  divergencia entre `app/`, `components/` y `features/`.
- **Recomendación:** completar la migración dashboard PRES-3..6 **antes** de
  generalizar, y sólo después pilotar un 2º dominio frontend.
- **PR sugerido:** cadena PRES existente, luego ARCH-6 (2º dominio frontend).
- **Scope seguro:** extracciones behavior-preserving con DOM/clases/`data-*` intactos.
- **Paths candidatos:** `frontend/src/features/dashboard/**`, `components/dashboard/**`.

### P2 — Mejoras importantes, no bloqueantes

**P2-A · `server/lib/` es un cajón mixto (dominio + infra + adaptadores http).**
- **Evidencia:** dominio (`report-status`, `permissions`, `logistics/*`) junto a
  infra (`email`, `supabase`, `logger`, `env`) y adaptadores fastify
  (`cors-headers`, `api-response-security`, `fastify-admin-auth`).
- **Impacto:** frontera domain/infra invisible; dificulta razonar dependencias.
- **Recomendación:** reagrupar por **naming** (`lib/domain|infra|http`) o mover
  dominio a su contexto; empezar docs-only + moves de bajo riesgo con tests.
- **PR sugerido:** ARCH-3. **Scope seguro:** reubicación con re-export/tests verdes.
- **Paths candidatos:** `server/lib/**`.

**P2-B · Dominio → infraestructura en `report-workflow-communication.ts`.**
- **Evidencia:** importa `../db` y dispara email dentro de lógica de workflow.
- **Impacto:** regla de dominio acoplada a persistencia + side-effect.
- **Recomendación:** al extraer el service de Reports, separar puerto de datos y
  puerto de notificación.
- **PR sugerido:** ARCH-4+ (contexto Reports). **Scope seguro:** contexto Reports.
- **Paths candidatos:** `server/lib/report-workflow-communication.ts`, `db-report-workflow.ts`.

**P2-C · `frontend/src/lib/` mezcla dominio y shared.**
- **Evidencia:** `public-professionals.ts`, `public-pricing-cache.ts`,
  `dashboard-*` junto a `api.ts`/`utils.ts`.
- **Impacto:** acoplamiento accidental; dominio fuera de su feature.
- **Recomendación:** triaje docs-only; mover dominio a `features/<domain>` cuando
  el blueprint escale. **PR sugerido:** ARCH-3/ARCH-6.
- **Scope seguro:** empezar por doc + inventario; mover con test update.
- **Paths candidatos:** `frontend/src/lib/**`.

**P2-D · Tests con guardrails de literal-de-fuente acoplan test↔ubicación.**
- **Evidencia:** helpers como `test/helpers/read-dashboard-css-source.ts` y tests
  que fijan literales por texto exacto de fuente (p.ej. invariantes de dashboard).
- **Impacto:** **protegen** comportamiento pero **encarecen** reubicar código: al
  mover un literal se rompe el guardrail y hay que actualizarlo en el mismo PR.
- **Recomendación:** tratar la actualización del guardrail como parte del scope de
  cada PR de migración; no migrar sin leer su guardrail.
- **PR sugerido:** transversal a ARCH-3/4/6. **Scope seguro:** PR que mueve +
  actualiza su guardrail juntos.
- **Paths candidatos:** `test/**` + `test/helpers/**`.

### P3 — Limpieza/documentación/naming

**P3-A · Sin ADRs de frontera backend.** `docs/governance/adr-template.md` existe
pero no hay ADR que fije las reglas de dependencia backend (como sí hace
`features/dashboard/README.md` en frontend). *Recom.:* ARCH-2 escribe 1 ADR de
fronteras. *Paths:* `docs/governance/`.

**P3-B · `db-*.ts` planos sin índice por contexto.** *Recom.:* documento-mapa
contexto→archivos (esta auditoría es la base). *Paths:* `docs/audit/`.

**P3-C · Volumen documental alto (469 archivos, 211 en `audit/`).** Riesgo de
drift documental. *Recom.:* índice/curación, no borrar. *Paths:* `docs/`.

---

## Recommended migration strategy

Principio rector: **reorganizar, no reescribir**; **1 contexto por PR**;
**siempre detrás de los contratos existentes**; **sin big-bang**, sin freeze
largo, sin mover carpetas sin tests verdes.

**Qué migrar primero**
1. **Docs + ADR de fronteras** (ARCH-2): fija reglas de dependencia backend
   (espejo del `README` de dashboard) para que toda migración posterior tenga un
   contrato explícito. Riesgo nulo.
2. **Cleanup de `lib/` compartido** (ARCH-3): reagrupar por naming
   `domain|infra|http` en backend y triaje de `frontend/src/lib`. Bajo riesgo,
   alto retorno de claridad. Requiere actualizar guardrails que lean rutas.
3. **Piloto de un contexto backend** (ARCH-4): **Logistics** — ya tiene
   `lib/logistics/`, `db-logistics`, tests densos y `docs/logistics/MVP_DOMAIN.md`.
   Extraer un *service* (application) y agrupar bajo `server/features/logistics/`
   con re-exports, sin cambiar rutas ni DB.

**Qué NO tocar**
- **Auth / security / middlewares**: sólo PR dedicado y revisado (P1-A los excluye
  del piloto a propósito).
- **`drizzle/schema.ts` y migraciones**: shared kernel; no fragmentar.
- **Rutas públicas** (`public-*`, `contact`, perfiles): no cambiar paths ni contratos.
- **CSS / diseño visual**: fuera de todo PR de arquitectura.

**Qué requiere pruebas**
- Todo move de código va con **tests verdes + guardrail actualizado en el mismo
  PR** (P2-D). Los contratos por-ruta (audit, session-last-access, runtime-timing)
  son la red de seguridad que habilita reorganizar sin romper comportamiento.

**Qué requiere auditoría adicional**
- Extraer **Reports** (P2-B: acoplamiento dominio→infra) merece su propia
  mini-auditoría antes de tocarlo, por su centralidad y side-effects.
- Cualquier cambio en **Auth** requiere auditoría de seguridad dedicada.

**Qué puede esperar**
- Generalizar `features/` frontend a un 2º dominio: **después** de cerrar la
  cadena PRES del dashboard.
- Cualquier idea de eventos: **esperar** evidencia de fan-out real.

---

## Proposed target architecture

Propuesta **realista y opcional**, sujeta a que cada contexto la habilite con
tests. No se impone contra Next App Router ni contra el backend actual.

**Backend — por contexto, incremental (piloto Logistics primero):**

```
server/
  features/
    logistics/
      domain/          # reglas puras (hoy lib/logistics/*: metrics, route-planning,
                       #   sla-breach, time-window) — sin fastify, sólo tipos de schema
      application/     # services/casos de uso (hoy inline en routes/*.fastify.ts)
      infrastructure/  # repositorio (hoy db-logistics.ts) + cache
      routes/          # thin handlers (parseo + auth + delegación al service)
      index.ts         # superficie pública del contexto
  lib/
    infra/             # email, supabase, logger, env, rate-limit-store  (renombrado)
    http/              # cors-headers, api-response-security, fastify-admin-auth (renombrado)
  middlewares/         # auth/security — SIN CAMBIOS
drizzle/schema.ts      # SHARED KERNEL — SIN CAMBIOS (no fragmentar)
```

Restricciones respetadas: `db.ts` + `drizzle/schema.ts` siguen siendo infra/kernel
compartida; `routes/` puede migrar a `features/<ctx>/routes/` **sólo** si el
registro de rutas Fastify y los contract-tests siguen verdes.

**Frontend — App Router intacto, lógica en `features/`:**

```
frontend/src/
  app/<route>/                 # SOLO routing/composición (Next lo exige) — page/layout/actions
  features/<domain>/
    config/  domain/  application/  presentation/   # patrón ya vivo en features/dashboard/
    index.ts
  components/ui/               # design system compartido — SIN CAMBIOS
  lib/                         # api-client, utils, seguridad cliente (shared real)
```

Restricción respetada: `app/` **no** se reemplaza (App Router necesita la carpeta
de rutas); `features/<domain>` recibe la lógica que hoy vive en `components/` y
`lib/`. Es exactamente el blueprint que `features/dashboard/README.md` ya declara.

**Nota de honestidad arquitectónica:** esta estructura **sólo conviene si se
adopta contexto por contexto con retorno medible**. Crear las 4 carpetas vacías en
todos los contextos de una vez sería *abstracción vacía* (anti-patrón que estos
guardrails prohíben).

---

## Guardrails

- **No mover código sin test verde** que fije el comportamiento; y actualizar el
  guardrail de literal-de-fuente en el **mismo PR** (P2-D).
- **No mezclar rediseño visual con arquitectura.** CSS y UX premium van en PRs
  separados de cualquier reorganización.
- **No tocar auth/security/middlewares** sin PR dedicado y auditoría de seguridad.
- **No introducir event bus/outbox** sin un caso de fan-out real y medido.
- **No crear abstracciones vacías** (carpetas/barrels por dogma): sólo materializar
  una capa cuando hay código real que la habita.
- **No migrar todo de una vez.** 1 contexto por PR, detrás de contratos.
- **No romper rutas públicas** (`public-*`, `contact`, perfiles): paths y contratos
  estables.
- **No cambiar el schema de DB** ni fragmentar `drizzle/schema.ts`; no tocar
  migraciones.
- **No tocar deps / lockfiles / CI** salvo PR dedicado.

---

## Next recommended PRs

| PR | Título | Tipo | Alcance | Riesgo |
|----|--------|------|---------|--------|
| **ARCH-2** | ADR de fronteras de dependencia backend + mapa contexto→archivos | **docs-only** | `docs/governance/`, `docs/audit/` | Nulo |
| **ARCH-3** | Cleanup `server/lib` (naming `domain\|infra\|http`) + triaje `frontend/src/lib` | small refactor + docs | `server/lib/**`, `frontend/src/lib/**`, guardrails | Bajo |
| **ARCH-4** | Piloto contexto **Logistics** → `server/features/logistics/{domain,application,infrastructure,routes}` (detrás de contratos) | refactor acotado | `logistics-*`, `db-logistics`, `lib/logistics` | Medio (contexto aislado) |
| **ARCH-5** | Event audit — **sólo si** ARCH-4 revela fan-out real; si no, documentar “no eventos” y cerrar | docs / condicional | `docs/audit/` | Bajo |
| **ARCH-6** | 2º dominio frontend a `features/` (tras cerrar cadena PRES dashboard) | refactor behavior-preserving | `features/**`, `components/**` | Medio |

**Cuándo volver a UX premium:** después de **ARCH-3** (fronteras compartidas
limpias) y del cierre de la cadena PRES del dashboard. El rediseño premium
(PR-UX) no debe iniciarse sobre `lib/` mixto ni antes de que el dashboard tenga su
presentación migrada, para no mezclar riesgo visual con riesgo estructural.

---

### Confirmaciones de cierre

- **Archivo creado:** `docs/audit/repository-domain-architecture-audit.md`.
- **Clasificación arquitectónica:** *Monolito modular emergente* — backend
  **Package by Layer dominante** (feature por convención de nombres), frontend
  **híbrido intencional** con isla **Package by Feature** en `features/dashboard/`;
  Clean/Hexagonal **emergiendo** (seam HTTP limpio, dominio puro parcial) pero sin
  capa application en backend; DDD **aplica como lente** (14–16 contextos).
- **Conteo:** **P0: 0 · P1: 3 · P2: 4 · P3: 3.**
- **Event-driven:** **no** ahora (ni bus ni outbox); único candidato futuro y
  opcional: dispatcher síncrono in-process para auditoría.
- **Confirmación docs-only:** sí. Sin cambios de código, CSS, tests, `package.json`,
  lockfiles, CI ni backend/frontend funcional. Único archivo nuevo bajo `docs/audit/`.
