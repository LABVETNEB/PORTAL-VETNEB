# M31 — Study Tracking: casos de uso, puertos y repository

**Estado:** implementado localmente, pendiente de revisión y merge.

- **Rama:** `refactor/backend-modularization-m31-study-tracking-use-cases-repository`
- **Base exacta:** `56df6d54c9fa1bc4e4f0c0901f976fd376eabb02`
  (`refactor(study-tracking): move domain modules (#1564)`)
- **Programa:** Fase G, milestone M31
- **Riesgo:** R2 estructural backend, autorizado para el milestone por el
  pedido actual. No hubo escrituras Git/GitHub.

## 1. Objetivo y exclusiones

M31 agrega los casos de uso de consulta y comando de Study Tracking, formaliza
los dos side effects reales mediante puertos de notificación y auditoría, y
mueve la persistencia completa a
`server/features/study-tracking/infrastructure`.

Quedan fuera M32 y M32b: no se adelgazan handlers ni se trasladan a application
la autenticación, validación HTTP, permisos, CORS, serialización, respuestas o
políticas de error. También quedan fuera M33, M34, M35 y M36. No se modifican
schema, migraciones, SQL, transacciones, endpoints, cookies, sesiones, auth,
roles, rate limits, frontend, dependencias, manifiestos, lockfiles, scripts o
CI.

## 2. Baseline y auditoría previa

El árbol inicial estaba limpio en la rama y base indicadas. Sólo aplica el
`AGENTS.md` raíz.

La auditoría canónica define M31 como:

- caso de uso de consulta;
- caso de uso de actualización;
- move de `server/db-study-tracking.ts` a infrastructure;
- puertos de notificación y auditoría sólo donde ya existen side effects:
  `study-tracking.fastify.ts` y `admin-study-tracking.fastify.ts`.

Las seis rutas que consumen persistencia mantienen el shim hasta la migración de
sus respectivos contextos. Las tres rutas propias de Study Tracking componen
application sin modificar el cuerpo de sus handlers.

## 3. Arquitectura resultante

```text
server/features/study-tracking/
  domain/                         # M30, sin cambios funcionales
  application/
    ports/
      study-tracking-query-repository.ts
      study-tracking-command-repository.ts
      study-tracking-notification-port.ts
      study-tracking-audit-port.ts
    study-tracking-query-use-cases.ts
    study-tracking-command-use-cases.ts
    study-tracking-side-effect-use-cases.ts
    index.ts
  infrastructure/
    study-tracking-repository.ts
    index.ts

server/db-study-tracking.ts       # shim temporal de una línea
server/routes/*study-tracking*    # composición; handlers intactos
```

### 3.1 Casos de uso

Las factories se separan por superficie para preservar los tres realms y no
inventar capacidades:

- clínica: consultas, creación/actualización y notificaciones clinic-scoped;
- admin: consultas globales o clinic-scoped, creación/actualización y
  notificaciones administrativas;
- particular: consulta y acknowledgements particular-token-scoped.

Cada método delega exactamente una vez, reenvía argumentos sin defaults ni
mutación, devuelve el resultado por identidad y propaga el error original.
Application no importa Fastify, DB, Drizzle, schema ni implementaciones
concretas.

### 3.2 Puertos de side effects

Sólo se crean dos:

- `StudyTrackingNotificationPort`, con
  `sendSpecialStainRequiredEmail`;
- `StudyTrackingAuditPort`, con `writeAuditLog`.

Se componen únicamente en las rutas clínica y admin. La ruta particular no
recibe esos puertos. La política preexistente se preserva: el handler sigue
resolviendo clínica/destinatarios, aislando el error SMTP y construyendo el
payload de auditoría; el orden persistencia → email/audit → respuesta no cambia.
No se agregan retries, outbox, compensación ni asincronía.

### 3.3 Repository

`server/db-study-tracking.ts` se mueve completo a
`infrastructure/study-tracking-repository.ts`. Sólo cambian los tres specifiers
relativos requeridos por la nueva profundidad.

| Evidencia | Baseline | Resultado M31 |
| --- | ---: | ---: |
| LOC | 295 | 295 |
| SHA-256 normalizado | `d7e4fb06e317ac9c77253ef3e11c14aa62d5df97afae19c209386f5bc105d10d` | `d7e4fb06e317ac9c77253ef3e11c14aa62d5df97afae19c209386f5bc105d10d` |
| Equivalencia tras normalizar imports | — | exacta |
| Transacciones | 0 | 0 |

Se preservan las 13 funciones públicas, queries Drizzle, filtros de tenant,
orden descendente, paginación, timestamps, nullability y resultados. El path
legacy queda como re-export de una línea al barrel canónico.

## 4. Composición runtime

Las rutas clínica y admin resuelven primero sus dependencias nativas, construyen
una vez las factories query/command/side-effect y exponen a los handlers el
mismo shape `deps`. La ruta particular conserva su resolución lazy existente y
envuelve sus capacidades query/command dentro de `resolveDeps`.

El diff de los tres adapters se limita a imports, renombre local del objeto de
dependencias y composición. Los handlers conservan byte por byte sus llamadas,
payloads, mensajes, status codes, serialización, auditoría y orden.

Los otros consumidores (`admin-reports`, `admin-particular-tokens` y
`particular-tokens`) atraviesan el shim. Sus migraciones pertenecen a milestones
posteriores.

## 5. Guards y tests

- Guard application: inventario exacto, imports default-deny, puertos type-only,
  consumo externo por barrel, composición única por ruta y side effects sólo en
  clínica/admin.
- Guard infrastructure: superficie pública, allowlist de imports, shim exacto,
  consumers runtime, marcadores de queries/paginación/timestamps y cero
  transporte/auth/email/auditoría.
- Guard domain M30 actualizado para reconocer las capas M31 y seguir prohibiendo
  dependencias inversas.
- Tres unit tests de casos de uso: consultas, comandos y side effects.
- Censo global de Study Tracking actualizado con los nuevos tests, guards,
  factories, puertos y repository.
- Contratos source-only de paginación y resiliencia reapuntados al repository
  canónico.

## 6. Allowlist real

### Productivo

- `server/db-study-tracking.ts`
- `server/features/study-tracking/README.md`
- `server/features/study-tracking/application/README.md`
- `server/features/study-tracking/application/index.ts`
- `server/features/study-tracking/application/ports/*.ts` (4)
- `server/features/study-tracking/application/*-use-cases.ts` (3)
- `server/features/study-tracking/infrastructure/README.md`
- `server/features/study-tracking/infrastructure/index.ts`
- `server/features/study-tracking/infrastructure/study-tracking-repository.ts`
- `server/routes/study-tracking.fastify.ts`
- `server/routes/admin-study-tracking.fastify.ts`
- `server/routes/particular-study-tracking.fastify.ts`

### Tests y documentación

- `test/architecture/study-tracking-domain-boundary-guard.test.ts`
- `test/architecture/study-tracking-application-boundary-guard.test.ts`
- `test/architecture/study-tracking-infrastructure-boundary-guard.test.ts`
- `test/unit/application/study-tracking/*.test.ts` (3)
- `test/unit/contracts/admin/admin-heavy-list-pagination-contract.test.ts`
- `test/unit/contracts/study-tracking/study-tracking-suite-completeness.test.ts`
- `test/unit/infrastructure/global-performance-resilience-contract.test.ts`
- `docs/implementation/m31-study-tracking-use-cases-repository.md`

## 7. Validaciones observadas

| Gate | Estado | Evidencia |
| --- | --- | --- |
| Cohorte M31 nueva | **PASSED** | 45/45, exit code 0 |
| Censo Study Tracking reintentado | **PASSED** | 7/7, exit code 0; se corrigió un marcador source-only sin tocar runtime |
| Regresión dirigida runtime/security/audit | **PASSED** | 140/140, exit code 0 |
| `pnpm validate:local` | **PASSED** | typecheck + typecheck:test + 3.620 tests: 3.619 pass, 1 skip, 0 fail + build; exit code 0 |
| `pnpm security:public-surface` | **PASSED** | cero findings públicos; dos markers server-only esperados; exit code 0 |
| `git diff --check` | **PASSED** | exit code 0 |

No se seleccionaron `pnpm audit --prod`, `pnpm audit`,
`validate:local:schema`, migraciones ni E2E porque no se modifican dependencias,
lockfiles, schema, DB real, frontend ni contratos visuales.

## 8. Riesgo residual y rollback

El riesgo residual se limita a la composición de wrappers y resolución del shim.
Queda cubierto por unit tests de delegación/identidad/error, tres adapters HTTP,
consumidores del shim, guards de frontera, contratos de ownership/auth/audit,
suite completa, typechecks y build.

El rollback consiste en devolver las 295 líneas al path raíz, retirar
application/infrastructure y restaurar el objeto `deps` directo de las tres
rutas. No requiere migración de datos, rollback de schema ni cambio de
configuración.

## 9. Estado final

M31 queda implementado localmente y no afirma PR, merge ni checks remotos
inexistentes. M32 (thin `study-tracking` + `particular-study-tracking`) y M32b
(thin `admin-study-tracking`) permanecen pendientes.
