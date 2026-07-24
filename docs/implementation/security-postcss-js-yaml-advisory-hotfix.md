# Hotfix de advisories de PostCSS y js-yaml

## Estado base

- Fecha: 2026-07-24.
- Repositorio: `C:\PORTAL-VETNEB`.
- Rama: `chore/security-postcss-8-5-17`.
- Base exacta: `9ef2621875429b788a0260aae65dd7eb3753db23`.
- El árbol y el índice estaban limpios antes del hotfix.
- PostCSS resolvía a `8.5.14` en `frontend > next > postcss`.
- js-yaml resolvía a `5.2.1` como dependencia de desarrollo del workspace raíz.

## Scope incluido

- Override de PostCSS para cubrir el rango vulnerable `<=8.5.17`.
- Override de js-yaml para cubrir el rango vulnerable `<=5.2.1`.
- Regeneración controlada de `pnpm-lock.yaml` con PNPM `11.13.0`.
- Actualización del contrato exacto de overrides de seguridad.
- Exclusión puntual `minimumReleaseAgeExclude` para `js-yaml@5.2.2`, publicada
  el 2026-07-23 y requerida por PNPM para aplicar inmediatamente el parche.

## Scope excluido

- Runtime frontend y backend.
- `frontend/package.json`, Next, Tailwind y eslint-config-next.
- Workflows, schema, migraciones, auth y configuración productiva.
- M35 y su documentación de cierre.
- Cualquier dependencia distinta de PostCSS y js-yaml.
- Deploy y merge.

## Auditoría previa

- `pnpm audit --prod` detectó PostCSS `<=8.5.17` en
  `frontend > next > postcss`; la versión corregida mínima informada fue
  `8.5.18`.
- El workspace ya declaraba y resolvía PostCSS `8.5.19`, por lo que se eligió
  esa versión para consolidar dos resoluciones en una.
- Tras corregir PostCSS, `pnpm audit` detectó js-yaml `>=5.0.0 <=5.2.1`; la
  versión corregida mínima informada fue `5.2.2`.
- No se deshabilitó ningún audit ni se redujo su nivel de bloqueo.

## Cambios

- `pnpm-workspace.yaml`:
  - `"postcss@<=8.5.17": "8.5.19"`.
  - `"js-yaml@<=5.2.1": "5.2.2"`.
  - Exclusión de edad limitada exactamente a `js-yaml@5.2.2`.
- `pnpm-lock.yaml`:
  - PostCSS `8.5.14` fue reemplazado por `8.5.19`.
  - js-yaml `5.2.1` fue reemplazado por `5.2.2`.
  - Se eliminó `nanoid@3.3.16`, nodo usado exclusivamente por el PostCSS
    retirado.
  - No cambiaron otras resoluciones ni importers no relacionados.
- `test/architecture/toolchain-contract.test.ts`:
  - Actualiza las dos entradas exactas de `SECURITY_OVERRIDE_LINES`.

## Archivos

- `pnpm-workspace.yaml`.
- `pnpm-lock.yaml`.
- `test/architecture/toolchain-contract.test.ts`.
- `docs/implementation/security-postcss-js-yaml-advisory-hotfix.md`.

## Validaciones

- `pnpm install --frozen-lockfile` — `PASSED`.
- `pnpm why postcss -r` — `PASSED`; una resolución: `8.5.19`.
- `pnpm list postcss -r` — `PASSED`.
- `pnpm why js-yaml -r` — `PASSED`; una resolución: `5.2.2`.
- `pnpm list js-yaml -r` — `PASSED`.
- `pnpm audit --prod` — `PASSED`; sin vulnerabilidades conocidas.
- `pnpm audit` — `PASSED`; sin vulnerabilidades conocidas.
- `pnpm exec tsx --test test/architecture/toolchain-contract.test.ts` —
  `PASSED`; 8/8.
- `pnpm typecheck` — `PASSED`.
- `pnpm typecheck:test` — `PASSED`.
- `pnpm validate:local` — `PASSED`; 3668 aprobados, 0 fallos, 1 omitido, y
  build backend correcto.
- `pnpm --dir frontend lint` — `PASSED`.
- `pnpm --dir frontend typecheck` — `PASSED`.
- `pnpm --dir frontend build` — `PASSED`.
- `pnpm security:public-surface` — `PASSED`.
- `git diff --check` — `PASSED`.

## Resultado

El workspace queda con una única resolución segura de PostCSS (`8.5.19`) y
una única resolución segura de js-yaml (`5.2.2`). Ambos audits obligatorios
terminan con exit code 0. El lockfile queda acotado a las dos remediaciones y
sus nodos estrictamente derivados, sin cambios runtime.

## Riesgo residual

- `js-yaml@5.2.2` se publicó menos de 24 horas antes de la remediación. La
  excepción de edad está limitada al paquete y versión exactos; no desactiva
  la política para ninguna otra dependencia.
- El hotfix modifica resoluciones transitivas y de tooling. Los contratos,
  typechecks, tests, audits y builds reducen el riesgo de incompatibilidad,
  pero los checks remotos siguen siendo el gate definitivo previo al merge.

## Rollback

Revertir el commit del hotfix restaura los overrides y el lockfile anteriores.
No requiere migración de schema, datos, credenciales ni infraestructura.

## Estado final

Implementación local validada y lista para publicación. El PR debe permanecer
abierto, no draft y sin merge hasta que todos los checks requeridos estén
verdes.
