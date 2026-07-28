# M46 — Residual HTTP lib reclassification closeout

## 1. Identificación

- Milestone: M46, reclasificación residual de helpers HTTP bajo `server/lib`.
- Rama: `refactor/backend-modularization-m46-http-lib-reclassification`.
- Base y HEAD inicial:
  `4adb55a458e36d5905f8d0d497f5a5ef14b8512f`.
- Fecha: 2026-07-28.
- Decisión final: **M46 — completado** con tres `MOVE` y un `KEEP`.
- C5 — NOT_RUN.
- M47 — NOT_RUN.
- M48 — NOT_RUN.

## 2. Baseline

La rama, `HEAD`, `main` y `origin/main` coincidían exactamente en
`4adb55a458e36d5905f8d0d497f5a5ef14b8512f`. El working tree y el índice
estaban limpios, existía un único worktree activo en `C:/PORTAL-VETNEB` y
GitHub reportó cero PR abiertos. No se inspeccionó ni modificó el worktree
excluido `C:\PORTAL-VETNEB-sec-deps-orphaned-20260724`.

## 3. Auditoría GO / NO-GO

El recenso del HEAD actual encontró **27 archivos TypeScript bajo
`server/lib`** y cuatro candidatos HTTP residuales coherentes. Tres helpers
comparten ownership del hook HTTP global de Fastify y tienen blast radius
acotado; CORS conserva un fan-in transversal que hace inseguro moverlo.

La alternativa de mover los cuatro módulos proyectaba **50 paths lógicos**:
los 17 paths de la estrategia aprobada más `cors-headers.ts`, sus 30 rutas
runtime, su test dinámico y el guard de seguridad anclado. Superaba el límite
de 30 paths. La estrategia aprobada proyectó **17 paths lógicos** contando
cada rename 1:1 una sola vez:

- 3 módulos movidos;
- `server/fastify-app.ts`;
- 8 consumidores/anclas de test;
- guard M45 realineado y guard M46 nuevo;
- audit, inventario y este closeout.

No requiere shim, barrel, duplicación, cambio de firma ni cambio funcional.
Por esas razones la auditoría resultó **GO**.

## 4. Censo actual de candidatos

Fan-in cuenta archivos importadores runtime + test. Fan-out cuenta módulos
internos resueltos del repositorio; los imports type-only de Fastify/Node no
agregan carga runtime.

| Módulo inicial | LOC | Exports | Fan-in runtime/test | Fan-out | Side effects de carga | Decisión | Path final |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `server/lib/cors-headers.ts` | 143 | 8 | 30 / 1 | 1 (`env.ts`) | carga eager de `ENV`, que valida configuración | `KEEP` | `server/lib/cors-headers.ts` |
| `server/lib/api-request-id.ts` | 104 | 9 | 1 / 3 imports directos; 2 anclas adicionales | 1 (`api-response-security`) | ninguno; `randomUUID()` sólo se invoca por función | `MOVE` | `server/lib/http/api-request-id.ts` |
| `server/lib/api-response-security.ts` | 65 | 8 | 2 / 2 | 0 | ninguno; sólo constantes y funciones | `MOVE` | `server/lib/http/api-response-security.ts` |
| `server/lib/sensitive-response-cache.ts` | 19 | 3 | 1 / 2 | 0 | ninguno; sólo constante y funciones | `MOVE` | `server/lib/http/sensitive-response-cache.ts` |

Los cuatro candidatos usan imports estáticos; los imports dinámicos aparecen
únicamente en consumidores de test. No existe ningún import dinámico dentro
de los candidatos.

## 5. Consumidores y anclas

### CORS retenido

`cors-headers.ts` tiene 30 consumidores runtime exactos, todos rutas
Fastify:

`admin-audit`, `admin-auth`, `admin-clinics`,
`admin-failed-login-alerts`, `admin-particular-tokens`, `admin-pricing`,
`admin-report-access-tokens`, `admin-report-workflow`, `admin-reports`,
`admin-sessions`, `admin-study-tracking`, `admin-system-health`,
`admin-system-maintenance`, `admin-system-schema-health`,
`admin-users-roles`, `auth`, `clinic-public-profile`, `contact`,
`logistics-field-visits`, `logistics-route-events`,
`logistics-route-plans`, `logistics-sla`, `particular-auth`,
`particular-study-tracking`, `particular-tokens`,
`public-report-access`, `report-access-tokens`, `reports-status`,
`reports` y `study-tracking`.

El consumidor dinámico dirigido es
`test/unit/infrastructure/cors-headers-shared-helper.test.ts`; el guard
`security-production-invariants.test.ts` también fija su path y las
variantes allow-null/block-null. M46 congela la lista exacta y el path
canónico `KEEP`.

### Helpers movidos

- `api-request-id`: `server/fastify-app.ts`;
  `test/helpers/api-request-id-contract.ts`;
  `api-request-id-observability-contract.test.ts`;
  `backend-api-nosniff-responses-contract.test.ts`; además
  `api-error-content-type-contract.test.ts` y
  `global-performance-resilience-contract.test.ts` inspeccionan su fuente.
- `api-response-security`: `server/fastify-app.ts` y el helper request ID;
  `fastify-app.test.ts` y `backend-api-nosniff-responses-contract.test.ts`;
  `global-performance-resilience-contract.test.ts` inspecciona su fuente.
- `sensitive-response-cache`: `server/fastify-app.ts`;
  `backend-api-no-store-cache-contract.test.ts` y
  `global-performance-resilience-contract.test.ts`;
  `global-e2e-production-readiness-contract.test.ts` fija su path.

Todos los imports y anclas apuntan al destino canónico. Los tres paths legacy
están ausentes y no hay shim.

## 6. Justificación de `cors-headers.ts`

`cors-headers.ts` tiene ownership HTTP, pero su costo de reclasificación es
desproporcionado: 30 rutas dependen directamente de él y dos guards fijan su
path o comportamiento. Además, es el único candidato que amplía carga eager
al importar `ENV`, cuyo módulo carga `dotenv/config` y valida configuración.

Moverlo no crea una frontera adicional que compense un PR de más de 30 paths.
El path actual queda como canónico retenido, no como deuda ambigua. El guard
M46 impide moverlo accidentalmente y congela sus 30 consumidores runtime.

## 7. Diseño de la frontera HTTP

`server/lib/http/` contiene exactamente tres helpers del hook HTTP global:
request ID, headers defensivos de respuesta y política de cache sensible.
No existe `index.ts`; los consumidores usan imports directos, por lo que no
se amplía carga eager ni se crea un ciclo mediante reexports.

La frontera no importa features, routes, middlewares, DB, Auth, sesiones,
cookies, email, Supabase ni frontend. `api-request-id` conserva su único
enlace interno a `api-response-security`; los otros dos módulos son hojas.

## 8. Revisión de seguridad

### CORS y trusted origin

No se modificó `cors-headers.ts`, ninguna ruta ni
`middlewares/trusted-origin.ts`. Permanecen exactos allowlist, normalización,
`Vary`, credentials, métodos, headers permitidos/expuestos, preflight,
allow-null, block-null y trusted-origin. Ningún origen fue agregado.

### Request ID

Se preservaron la aceptación exclusiva de `X-Request-ID` seguro, longitud
máxima 128, caracteres permitidos, fallback `crypto.randomUUID()`,
propagación a Fastify/raw reply, correlación en respuestas de error y
logging. El import global sigue siendo eager y está en el mismo orden.

### Headers de seguridad

El hook `onRequest` continúa ejecutando primero request ID y luego
`applyApiSecurityHeaders`, antes de trusted-origin y version-gate.
`X-Content-Type-Options: nosniff` y
`Referrer-Policy: no-referrer` mantienen nombres, valores, precedencia y la
regla `/api` o `/api/*`. CSP, HSTS y framing no son implementados por estos
helpers y permanecen intactos en sus superficies existentes.

### Cache de respuestas sensibles

El hook `onSend` sigue aplicando primero `Cache-Control: no-store` a
`/api/*` salvo `/api/public/*`, sin sobreescribir un header existente, y
después agrega request ID al body JSON de errores. El helper nunca agregó
`Pragma`, `Expires`, `private` ni `no-cache`; M46 conserva esa ausencia y no
agrega headers.

### Superficies y proxies

Las respuestas públicas, privadas, exitosas y de error siguen atravesando
los mismos hooks globales. `ENV.trustProxy`, sanitización de logs, payloads,
status codes y orden de registro Fastify no cambiaron. El guard de superficie
pública y los guards de seguridad de workflows fueron revisados; M46 no toca
frontend, workflows, CI ni sus políticas.

## 9. TDD — RED

Primero se creó
`test/architecture/backend-modularization-m46-http-lib-reclassification.test.ts`
con el inventario destino y se ejecutó junto con M45 antes de mover archivos.
Resultado real: **18 tests; 13 pass, 5 fail, exit code 1**. Los cinco fallos
fueron causales: directorio/destinos ausentes, exports/imports no
inspeccionables en destino, consumidores aún legacy y closeout inexistente.
M45 pasó sus 11 tests. El RED no fue reconstruido.

## 10. GREEN

El guard M46 congela:

- cuatro candidatos y sus decisiones `MOVE`/`KEEP`;
- tres paths canónicos y tres paths legacy ausentes;
- archivos exactos bajo `server/lib/http`;
- exports, imports runtime/type-only y carga eager exactos;
- cero dependencias prohibidas;
- consumidores importadores exactos;
- cero literales legacy bajo `server/**` y `test/**`;
- 30 consumidores runtime exactos de CORS;
- documentación M46 y estados C5/M48;
- ausencia de Git, ramas, worktrees y `child_process`.

La evidencia GREEN y los gates integrales ejecutados sobre el diff se
registran en la tabla de validaciones.

## 11. Archivos modificados

- Move 1:1 de tres helpers a `server/lib/http/`.
- Realineación de `server/fastify-app.ts`.
- Realineación de ocho archivos de test/anclas.
- Guard M46 nuevo y ajuste del marcador vigente en el guard M45.
- Actualización puntual del audit rector, inventario y este closeout.

No se modificó la implementación de los tres módulos: los blobs Git de cada
origen y destino son idénticos.

## 12. Validaciones

| Comando | Estado | Resultado | Exit code |
| --- | --- | --- | ---: |
| RED M45 + M46 | `FAILED` esperado | 18 tests; 13 pass, 5 fail | 1 |
| GREEN M45 + M46 | `PASSED` | 18 tests; 18 pass, 0 fail | 0 |
| `pnpm typecheck` | `PASSED` | TypeScript de producción sin errores | 0 |
| primer `pnpm typecheck:test` | `FAILED` | el guard nuevo usaba `modifiers` sobre `Statement`; corregido con las APIs de TypeScript para modifiers | 1 (`tsc`: 2) |
| reintento `pnpm typecheck:test` | `PASSED` | TypeScript de tests sin errores | 0 |
| primer intento de suites dirigidas | `FAILED` | PowerShell entregó la lista como un único argumento; no ejecutó tests | 1 |
| reintento suites dirigidas HTTP/CORS/security | `PASSED` | 176 tests; 176 pass, 0 fail | 0 |
| `pnpm validate:local` | `PASSED` | 3.928 tests; 3.927 pass, 1 skip, 0 fail; build generado correctamente | 0 |
| `pnpm security:public-surface` | `PASSED` | sin exposición pública; dos marcadores informativos server-only existentes | 0 |
| `git diff --check` | `PASSED` | sin errores de whitespace en el diff trackeado | 0 |

## 13. Riesgo residual

`cors-headers.ts` permanece deliberadamente en `server/lib` por blast
radius, con path y consumidores protegidos. La frontera HTTP es cerrada y
requiere modificar el guard para admitir cualquier módulo futuro. C5 y M48
siguen sin ejecutar.

## 14. Rollback

Revertir conjuntamente los tres renames, los imports/anclas, los guards y la
documentación. No hay shim, datos, schema, migraciones, configuración,
dependencias ni efectos compensatorios.

## 15. Estado Git/GitHub

- HEAD: `4adb55a458e36d5905f8d0d497f5a5ef14b8512f`, sin modificar.
- Stage: NOT_RUN; índice vacío.
- Commit: NOT_RUN.
- Push: NOT_RUN.
- PR: NOT_RUN.
- Merge: NOT_RUN.
- M48: NOT_RUN.
