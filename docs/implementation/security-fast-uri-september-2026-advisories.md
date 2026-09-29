# Hotfix de advisories de fast-uri (septiembre 2026)

## Estado base

- Fecha: 2026-09-28.
- Repositorio: `C:\PORTAL-VETNEB`.
- Rama: `security/fast-uri-september-2026-advisories`.
- Base exacta: `4e5491ecafd50d5a43338f21bff770d5e12fab26` (`origin/main`).
- El árbol y el índice estaban limpios antes de iniciar la remediación.
- `fast-uri` resolvía a `3.1.6` (vía `ajv@8.20.0`) y `4.1.3` (vía
  `@fastify/ajv-compiler@4.0.6` y `fast-json-stringify@7.0.1`), ambos bajo
  `fastify@5.12.4`.

## Scope incluido

- Actualización del override de `fast-uri` 3.x a la versión parcheada `3.1.7`.
- Actualización del override de `fast-uri` 4.x a la versión parcheada `4.1.4`.
- Regeneración controlada de `pnpm-lock.yaml` (`pnpm install --lockfile-only`).
- Realineación de los dos literales de `fast-uri` en el contrato exacto de
  overrides de seguridad de `test/architecture/toolchain-contract.test.ts`.

## Scope excluido

- Runtime frontend y backend.
- `package.json` y `frontend/package.json`.
- Fastify, AJV y cualquier upgrade major o minor.
- Dependencias directas nuevas.
- Workflows, schema, migraciones, autenticación y configuración productiva.
- El PR #1789 (TEST-GLOBAL-05A), que sólo expuso el fallo al volver a
  ejecutar `Dependency security audit` en Backend CI.
- Deploy y merge.

## Auditoría previa

- `pnpm audit --prod` y `pnpm audit` detectaron 4 vulnerabilidades `high`,
  todas de `fast-uri`, publicadas el 2026-09-28:
  - `GHSA-qw65-cvwx-89v3` (CVE-2026-84292): authority injection vía un puerto
    no validado en `serialize`. Vulnerable `>=3.0.0 <3.1.7` y
    `>=4.0.0 <4.1.4`.
  - `GHSA-58mr-gqgx-xq4g` (CVE-2026-84394): host confusion vía un corchete sin
    cerrar en la autoridad de la URI. Vulnerable `=3.1.6` y `=4.1.3`.
- Primera versión parcheada según GitHub Advisory Database para ambos
  advisories: `3.1.7` (línea 3.x) y `4.1.4` (línea 4.x). Ambas publicadas en
  el registry el 2026-09-02, fuera de la ventana de `minimumReleaseAge`.
- El repositorio no importa `fast-uri` directamente; tampoco declara schemas
  con `$ref`, `$id` ni formatos `uri`/`url` en `server/`.
- El diff upstream `3.1.6..3.1.7` y `4.1.3..4.1.4` se limita a los dos fixes:
  `serialize` rechaza puertos no numéricos y un host con `[` sin cerrar se
  trata como malformado. No hay cambios de API.
- No se deshabilitó ningún audit ni se redujo su nivel de bloqueo.

## Cambios

- `pnpm-workspace.yaml`:
  - `"fast-uri@<3.1.6": "3.1.6"` → `"fast-uri@<3.1.7": "3.1.7"`.
  - `"fast-uri@>=4.0.0 <4.1.3": "4.1.3"` → `"fast-uri@>=4.0.0 <4.1.4": "4.1.4"`.

- `pnpm-lock.yaml` (regenerado con `pnpm install --lockfile-only`):
  - `fast-uri@3.1.6` fue reemplazado por `fast-uri@3.1.7`.
  - `fast-uri@4.1.3` fue reemplazado por `fast-uri@4.1.4`.
  - Las integridades coinciden con `dist.integrity` del registry.
  - Ningún otro paquete cambió de versión.

- `test/architecture/toolchain-contract.test.ts`:
  - Se actualizaron únicamente las dos expectativas literales de `fast-uri`
    en `SECURITY_OVERRIDE_LINES`.
  - El guard conserva su estructura y sus assertions estrictas.

## Archivos de implementación

- `pnpm-workspace.yaml`.
- `pnpm-lock.yaml`.
- `test/architecture/toolchain-contract.test.ts`.
- `docs/implementation/security-fast-uri-september-2026-advisories.md`.

## Validaciones

- `pnpm install --frozen-lockfile` (`CI=true`) — `PASSED`.
- `pnpm why fast-uri -r` — sólo `fast-uri@3.1.7` y `fast-uri@4.1.4`; 0
  referencias a `3.1.6`/`4.1.3` en el lockfile.
- `pnpm audit --prod` — `PASSED`; sin vulnerabilidades conocidas.
- `pnpm audit` — `PASSED`; sin vulnerabilidades conocidas.
- `test/architecture/toolchain-contract.test.ts` — `PASSED`; 8/8.
- Guards relacionados (supply chain, backend CI workflow, quality gate
  impact, PR single scope, clean, Fastify app) — `PASSED`; 153/153.
- `pnpm validate:local` — `BLOCKED`: `typecheck` y `typecheck:test`
  `PASSED`; `pnpm test` corre 4703 tests (4701 aprobados, 1 omitido
  preexistente) y sólo falla
  `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`,
  que requiere `DATABASE_URL` o `SUPABASE_DB_URL` para la DB aislada
  `portal_vetneb_ci`; el `build` encadenado queda `NOT_RUN`.
- `pnpm build` (ejecutado aparte) — `PASSED`.
- Gates frontend — `NOT_RUN`: `fast-uri` no pertenece al grafo del
  workspace `frontend`.
- `git diff --check` — `PASSED`.

## Resultado

El workspace queda con resoluciones parcheadas de:

- `fast-uri@3.1.7`;
- `fast-uri@4.1.4`.

Las auditorías productiva y completa terminan con exit code 0. El cambio no
introduce upgrades de Fastify ni dependencias directas nuevas y no modifica
código de runtime.

## Riesgo residual

- Los parches endurecen `serialize` (puerto no numérico → `TypeError`) y el
  parseo de hosts con corchetes. El repositorio no usa esas rutas de forma
  directa; el efecto posible se limita a URIs malformadas.
- Backend CI (con Postgres aislado) es el gate remoto definitivo para la suite
  completa, incluida la prueba 03B.

## Rollback

Revertir el commit del hotfix restaura los overrides, el guard y el lockfile
anteriores. El rollback reintroduciría los advisories `GHSA-qw65-cvwx-89v3` y
`GHSA-58mr-gqgx-xq4g`. No requiere migración de schema, datos, credenciales,
infraestructura ni configuración productiva.

## Estado final

Implementación y documentación listas para publicación. El PR debe fusionarse
antes de actualizar #1789 contra `main`.
