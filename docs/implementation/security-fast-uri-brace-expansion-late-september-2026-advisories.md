# Hotfix de advisories de fast-uri y brace-expansion (fin de septiembre 2026)

## Estado base

- Fecha: 2026-09-30.
- Repositorio: `C:\PORTAL-VETNEB`.
- Rama: `test/test-global-08-admin` (PR #1795). La corrección se integra en
  la misma PR por orden explícita de Nico, en vez de una PR de dependencias
  separada (la rama auxiliar `security/fast-uri-late-september-2026-advisories`
  y su PR #1796, cerrada, no se usan).
- Base exacta: `78e00ecaa8f3f0ba7b5d626f7e858fcd5c58c884` (`origin/main`);
  head previo de #1795: `62ab28ad0934d060175126797dd2e766b8ae743f`.
- El árbol tracked y el índice estaban limpios antes de iniciar la remediación.
- `fast-uri` resolvía a `3.1.7` (vía `ajv@8.20.0`) y `4.1.4` (vía
  `@fastify/ajv-compiler@4.0.6` y `fast-json-stringify@7.0.1`), ambos bajo
  `fastify@5.12.4`.
- `brace-expansion` resolvía a `1.1.18` (vía
  `frontend > eslint-config-next > eslint-plugin-import|eslint-plugin-jsx-a11y > minimatch`)
  y `5.0.9` (vía `eslint`, `@typescript-eslint/*` y demás tooling con
  `minimatch`).

## Scope incluido

- Override de `fast-uri` 3.x a `3.1.8` y 4.x a `4.1.5`.
- Override de `brace-expansion` 5.x a `5.0.12` y alta del override de la línea
  1.x a `1.1.21`.
- Regeneración controlada de `pnpm-lock.yaml` (`pnpm install --lockfile-only`).
- Realineación de las expectativas literales de
  `SECURITY_OVERRIDE_LINES` en `test/architecture/toolchain-contract.test.ts`.

## Scope excluido

- Runtime frontend y backend.
- `package.json` y `frontend/package.json`.
- Fastify, AJV, ESLint y cualquier upgrade major o minor.
- Dependencias directas nuevas.
- Workflows, schema, migraciones, autenticación y configuración productiva.
- Los cambios de TEST-GLOBAL-08 admin que la misma PR #1795 ya contiene
  (15 specs de `test/unit/ui/admin/**`, `source-function-runner.ts` y el
  re-anclaje del censo 01B): esta corrección no los modifica.
- TEST-GLOBAL-08 frontend y public, y TEST-GLOBAL-09.
- Deploy y merge.

## Auditoría previa

- Backend CI de #1795 (head `62ab28ad`, run `36711819680`) falló en
  `Dependency security audit` antes de migraciones, typecheck, tests y build.
- Localmente, sobre `78e00eca`: `pnpm audit --prod` → 3 moderate (exit 1);
  `pnpm audit` → 9 (5 moderate, 4 high; exit 1). Advisories publicados el
  2026-09-29:
  - `GHSA-hrr3-gc8f-f4qj` (CVE-2026-86472, moderate): normalización
    inconsistente de mayúsculas del host vía octetos percent-encoded.
    Vulnerable `>=3.0.0 <3.1.8` y `>=4.0.0 <4.1.5`.
  - `GHSA-jvvf-x445-j334` (CVE-2026-86818, moderate): inyección de headers
    `mailto` por desincronización de nombres de campo percent-encoded.
    Vulnerable `>=4.1.3 <4.1.5`.
  - `GHSA-6j4f-fj2g-mc7p` (CVE-2026-102276, high): recursión no acotada en
    `parseCommaParts`. Vulnerable `<1.1.19` y `>=4.0.0 <5.0.10`.
  - `GHSA-qhr7-859c-m2p7` (CVE-2026-102278, high): recursión no acotada con
    grupos anidados. Vulnerable `<1.1.20` y `>=4.0.0 <5.0.11`.
  - `GHSA-q2hr-2g5m-vwhr` (CVE-2026-102277, moderate): expansión de tiempo
    cuadrático de `{a},b}`. Vulnerable `<1.1.21` y `>=4.0.0 <5.0.12`.
- Primeras versiones parcheadas en las líneas instaladas: `fast-uri` `3.1.8` y
  `4.1.5`; `brace-expansion` `1.1.21` y `5.0.12`. Todas publicadas el
  2026-09-14/15, fuera de la ventana de `minimumReleaseAge`. No hay líneas 2.x
  ni 3.x de `brace-expansion` instaladas.
- `npm diff` upstream: `fast-uri` sólo cambia `index.js`, `lib/schemes.js`
  (4.x) y tests de seguridad; `brace-expansion` 5.x sólo añade límites
  (`EXPANSION_MAX_DEPTH`, `EXPANSION_MAX_REWRITES`) y opciones opcionales
  (`maxDepth`, `maxRewrites`), sin retirar API.
- El repositorio no importa `fast-uri` ni `brace-expansion` directamente.
- No se deshabilitó ningún audit ni se redujo su nivel de bloqueo.

## Cambios

- `pnpm-workspace.yaml`:
  - `"brace-expansion@>=4.0.0 <5.0.9": "5.0.9"` →
    `"brace-expansion@>=4.0.0 <5.0.12": "5.0.12"`.
  - Nuevo `"brace-expansion@<1.1.21": "1.1.21"`.
  - `"fast-uri@<3.1.7": "3.1.7"` → `"fast-uri@<3.1.8": "3.1.8"`.
  - `"fast-uri@>=4.0.0 <4.1.4": "4.1.4"` → `"fast-uri@>=4.0.0 <4.1.5": "4.1.5"`.
- `pnpm-lock.yaml`: sólo `fast-uri` (3.1.7→3.1.8, 4.1.4→4.1.5) y
  `brace-expansion` (1.1.18→1.1.21, 5.0.9→5.0.12) cambian de versión.
- `test/architecture/toolchain-contract.test.ts`: sólo las expectativas
  literales de `SECURITY_OVERRIDE_LINES`; el guard conserva su estructura.

## Archivos de implementación

- `pnpm-workspace.yaml`.
- `pnpm-lock.yaml`.
- `test/architecture/toolchain-contract.test.ts`.
- `docs/implementation/security-fast-uri-brace-expansion-late-september-2026-advisories.md`.

## Validaciones

- `pnpm install --frozen-lockfile` — `PASSED`.
- `pnpm why fast-uri -r` — sólo `3.1.8` y `4.1.5`.
- `pnpm why brace-expansion -r` — sólo `1.1.21` y `5.0.12`.
- `pnpm audit --prod` — `PASSED`; sin vulnerabilidades conocidas.
- `pnpm audit` — `PASSED`; sin vulnerabilidades conocidas.
- `test/architecture/toolchain-contract.test.ts` — `PASSED`; 8/8.
- `pnpm typecheck` — `PASSED`.
- `pnpm typecheck:test` — `PASSED`.
- `pnpm lint:backend` — `PASSED` (0 errores).
- `pnpm test` — `BLOCKED`: 4706 tests, 4704 aprobados, 1 omitido
  preexistente; sólo falla
  `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`,
  que requiere la DB aislada `portal_vetneb_ci` (estado POST-03: launcher 0,
  DB 1).
- `pnpm build` — `PASSED`.
- `pnpm --dir frontend lint`, `typecheck` y `build` — `PASSED`.
- `pnpm security:public-surface` — `PASSED`.
- `git diff --check` — `PASSED`.
- Sobre el árbol combinado de #1795 (TEST-GLOBAL-08 admin + esta corrección):
  los 15 specs admin `PASSED` (173/173), las 15 mutation proofs admin siguen
  killed (P(admin) = 0/15) y el censo 01B `PASSED` (10/10). La corrección no
  mueve ninguna fila del censo.
- PR Governance: con lockfile y workspace en el diff, el scope primario
  detectado es `dependencies/lockfiles`; tests y documentación son categorías
  de soporte. El cuerpo de #1795 debe declarar sólo `dependencies`.

## Resultado

Resoluciones parcheadas de `fast-uri@3.1.8`, `fast-uri@4.1.5`,
`brace-expansion@1.1.21` y `brace-expansion@5.0.12`. Ambas auditorías terminan
con exit code 0, sin upgrades de Fastify/AJV/ESLint ni cambios de runtime.

## Riesgo residual

- `fast-uri` normaliza a minúsculas los hosts con escapes percent-encoded y
  endurece `mailto`; el repositorio no usa esas rutas directamente.
- `brace-expansion` corta expansiones patológicas por profundidad/reescrituras;
  sólo afecta a globs de tooling (ESLint/minimatch).
- Backend CI (con Postgres aislado) es el gate remoto definitivo para la suite
  completa, incluida la prueba 03B.

## Rollback

Revertir el commit squash de #1795 restaura overrides, guard y lockfile
anteriores y reintroduce los cinco advisories; revierte también, en la misma
operación, los oracles de TEST-GLOBAL-08 admin que viajan en esa PR. No
requiere migración de schema, datos, credenciales, infraestructura ni
configuración productiva.

## Estado final

Implementación y documentación integradas en #1795 y listas para publicación
en esa misma PR. Backend CI (con Postgres aislado) es el gate remoto que
confirma el cierre.
