# Hotfix de advisories de multer y fast-uri (octubre 2026)

## Estado base

- Fecha: 2026-10-24.
- Repositorio: `C:\PORTAL-VETNEB`.
- Rama: `security/deps-multer-fast-uri-october-2026-advisories`, creada desde
  `origin/main` en `86199d6fb8ff98f7a222f16580a8b507cd1cb126`. PR de
  dependencias independiente, por autorización R2 explícita de Nico; no se
  mezcla con PR #1916.
- Backend CI de `main` (`86199d6f`) y de #1916 (`4c1f2df7`, run
  `40063145113`) fallan en `pnpm audit --prod` antes de migraciones,
  typecheck, tests y build.
- `multer` resolvía a `2.4.0` (dependencia directa, specifier `^2.4.0`).
- `fast-uri` resolvía a `3.1.8` (vía `ajv@8.20.0`) y `4.1.5` (vía
  `@fastify/ajv-compiler` y `fast-json-stringify`), ambos bajo
  `fastify@5.12.7`.

## Scope incluido

- Override de `fast-uri` 3.x a `3.1.9` y 4.x a `4.2.3`.
- `multer` `2.4.0` → `2.5.0` sólo por lockfile
  (`pnpm update multer --lockfile-only --no-save`): `^2.4.0` ya admite `2.5.0`.
- Regeneración controlada de `pnpm-lock.yaml` (`pnpm install --lockfile-only`).
- Realineación de las expectativas literales de `SECURITY_OVERRIDE_LINES` en
  `test/architecture/toolchain-contract.test.ts`.

## Scope excluido

- Runtime frontend y backend.
- `package.json` y `frontend/package.json`.
- Fastify, AJV y cualquier upgrade major.
- Dependencias directas nuevas.
- Workflows, schema, migraciones, autenticación y configuración productiva.
- PR #1916 y su corrección E2E B08.
- Deploy y merge.

## Auditoría previa

- Localmente, sobre `86199d6f`: `pnpm audit --prod` y `pnpm audit` → 9
  vulnerabilidades (1 high, 4 moderate, 4 low; exit 1). Advisories publicados
  el 2026-10-23:
  - `GHSA-q7qp-rjg7-q26m` (CVE-2026-113872, high): DoS de `multer` por un
    `fileFilter` asíncrono pendiente tras el teardown del request.
    Vulnerable `>=2.0.0 <2.5.0`.
  - `GHSA-w74x-v6f9-j3xg` (CVE-2026-110306, moderate): spoofing de scheme por
    decodificación percent-encoded. Vulnerable `>=3.0.0 <3.1.9` y
    `>=4.0.0 <4.2.3`.
  - `GHSA-wjr9-j795-jxcr` (CVE-2026-110180, moderate): confusión de host por
    canonicalización WHATWG no verificada. Vulnerable `>=3.1.3 <3.1.9` y
    `>=4.0.1 <4.2.3`.
  - `GHSA-xhq7-xmqj-769h` (CVE-2026-110095, low): equivalencia impropia de
    paths al normalizar referencias relativas. Vulnerable `>=3.0.0 <3.1.9` y
    `>=4.0.0 <4.2.3`.
  - `GHSA-333x-w4r6-6crp` (CVE-2026-110725, low): inyección de scheme por `:`
    sin escapar en el primer segmento de referencias sufijo. Vulnerable
    `>=3.0.0 <3.1.9` y `>=4.0.0 <4.2.3`.
- Primeras versiones parcheadas en las líneas instaladas: `multer` `2.5.0`
  (2026-10-22); `fast-uri` `3.1.9` y `4.2.3` (2026-10-19). Sin cambio de major.
- `npm diff multer@2.4.0..2.5.0`: sólo `lib/make-middleware.js` (listener de
  `error` tras teardown, `fieldSize` tratado como máximo permitido igual que
  `fileSize`/`parts`, no registrar para limpieza archivos que fallaron), más
  `package.json` y `README.md`. Sin cambios de API ni de dependencias.
- `multer` se usa en `server/routes/admin-reports.fastify.ts` y
  `server/routes/clinic-public-profile.fastify.ts`; ninguno configura
  `fieldSize`. El repositorio no importa `fast-uri` directamente.
- No se deshabilitó ningún audit ni se redujo su nivel de bloqueo.

## Cambios

- `pnpm-workspace.yaml`:
  - `"fast-uri@<3.1.8": "3.1.8"` → `"fast-uri@<3.1.9": "3.1.9"`.
  - `"fast-uri@>=4.0.0 <4.1.5": "4.1.5"` → `"fast-uri@>=4.0.0 <4.2.3": "4.2.3"`.
- `pnpm-lock.yaml`: sólo `fast-uri` (3.1.8→3.1.9, 4.1.5→4.2.3) y `multer`
  (2.4.0→2.5.0) cambian de versión; el specifier de `multer` sigue en `^2.4.0`.
- `test/architecture/toolchain-contract.test.ts`: sólo las expectativas
  literales de `SECURITY_OVERRIDE_LINES`; el guard conserva su estructura.

## Archivos de implementación

- `pnpm-workspace.yaml`.
- `pnpm-lock.yaml`.
- `test/architecture/toolchain-contract.test.ts`.
- `docs/implementation/security-multer-fast-uri-october-2026-advisories.md`.

## Validaciones

- `pnpm install --frozen-lockfile` — `PASSED`.
- `pnpm why fast-uri -r` — sólo `3.1.9` y `4.2.3`.
- `pnpm why multer` — sólo `2.5.0`.
- `pnpm --filter ./frontend why fast-uri|multer` — sin resultados: el
  workspace frontend no resuelve ninguno de los dos paquetes.
- `pnpm audit --prod` — `PASSED`; sin vulnerabilidades conocidas.
- `pnpm audit` — `PASSED`; sin vulnerabilidades conocidas.
- `test/architecture/toolchain-contract.test.ts`,
  `test/unit/contracts/reports/report-management-route-policy.test.ts` y
  `test/unit/infrastructure/package-scripts-contract.test.ts` — `PASSED`; 22/22.
- `pnpm typecheck` — `PASSED`.
- `pnpm typecheck:test` — `PASSED`.
- `pnpm test` — `BLOCKED`: 5434 tests, 5432 aprobados, 1 omitido
  preexistente; sólo falla
  `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`,
  que requiere `DATABASE_URL`/`SUPABASE_DB_URL` para la DB aislada
  `portal_vetneb_ci`.
- `pnpm build` — `PASSED` (ejecutado aparte: `validate:local` lo encadena tras
  `pnpm test`).
- `pnpm db:migrate` — `BLOCKED`: sin DB local.
- Gates frontend (`lint`, `typecheck`, `build`, `security:public-surface`,
  `e2e:ci`) — `NOT_RUN`: el lockfile no cambia el importer `frontend`.
- `git diff --check` — `PASSED`.
- PR Governance (`classifyPath`): `pnpm-workspace.yaml` y `pnpm-lock.yaml` →
  `dependencies/lockfiles`; el test → `tests` y esta nota → `documentation`,
  ambas de soporte. El cuerpo de la PR debe marcar sólo `dependencies`.

## Resultado

Resoluciones parcheadas de `multer@2.5.0`, `fast-uri@3.1.9` y
`fast-uri@4.2.3`, sin upgrades de Fastify/AJV ni cambios de runtime propio.

## Riesgo residual

- `multer` 2.5.0 trata `fieldSize` como máximo permitido (un byte más que
  antes llega a busboy); las rutas del repositorio no configuran `fieldSize`.
- `fast-uri` endurece decodificación de scheme, canonicalización de host y
  normalización de referencias; el repositorio no usa esas rutas directamente.
- Backend CI (con Postgres aislado) es el gate remoto definitivo para la suite
  completa.

## Rollback

Revertir el commit squash de la PR restaura overrides, guard y lockfile
anteriores y reintroduce los cinco advisories. No requiere migración de
schema, datos, credenciales, infraestructura ni configuración productiva.

## Estado final

Implementación local validada, sin commit ni push. Tras su merge en `main`,
#1916 debe ponerse al día con su base para que `validate-backend` pueda pasar.
