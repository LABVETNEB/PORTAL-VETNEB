# Hotfix de advisories de fast-uri, PostCSS y brace-expansion

## Estado base

- Fecha: 2026-08-05.
- Repositorio: `C:\PORTAL-VETNEB`.
- Rama: `security/fast-uri-postcss-advisories`.
- Base exacta: `45acfa79dad87432c932e8f381572602408fec6a`.
- Commit de implementación: `d9ffa3b432858c90a5f5142c1342f5764c7134a7`.
- El árbol y el índice estaban limpios antes de iniciar la remediación.
- `fast-uri` resolvía a `3.1.4` y `4.1.1`.
- PostCSS resolvía a `8.5.19`.
- `brace-expansion` resolvía a `5.0.8` para el toolchain de desarrollo.

## Scope incluido

- Actualización del override de `fast-uri` 3.x a la versión parcheada `3.1.5`.
- Actualización del override de `fast-uri` 4.x a la versión parcheada `4.1.2`.
- Actualización del override de PostCSS a la versión parcheada `8.5.23`.
- Actualización del override de `brace-expansion` a la versión parcheada `5.0.9`.
- Acotación del selector de `brace-expansion` al rango vulnerable real.
- Regeneración controlada de `pnpm-lock.yaml`.
- Realineación del contrato exacto de overrides de seguridad en
  `test/architecture/toolchain-contract.test.ts`.

## Scope excluido

- Runtime frontend y backend.
- `package.json` y `frontend/package.json`.
- Fastify, Next.js y cualquier upgrade major.
- Dependencias directas nuevas.
- Workflows, schema, migraciones, autenticación y configuración productiva.
- A01 y el PR #1637.
- Deploy y merge.

## Auditoría previa

- `pnpm audit --prod` detectó dos advisories high de `fast-uri` por confusión
  de host mediante un introductor de autoridad con barra invertida.
- La rama 3.x requería como mínimo `fast-uri@3.1.5`.
- La rama 4.x requería como mínimo `fast-uri@4.1.2`.
- PostCSS era vulnerable hasta `8.5.22`; la versión corregida mínima era
  `8.5.23`.
- Después de resolver los advisories productivos, `pnpm audit` detectó
  `brace-expansion@5.0.8` en dependencias de desarrollo del toolchain ESLint.
- El rango vulnerable de `brace-expansion` era `>=4.0.0 <5.0.9`; la versión
  corregida mínima era `5.0.9`.
- No se deshabilitó ningún audit ni se redujo su nivel de bloqueo.

## Cambios

- `pnpm-workspace.yaml`:
  - `"fast-uri@<3.1.5": "3.1.5"`.
  - `"fast-uri@>=4.0.0 <4.1.2": "4.1.2"`.
  - `"postcss@<=8.5.22": "8.5.23"`.
  - `"brace-expansion@>=4.0.0 <5.0.9": "5.0.9"`.

- `pnpm-lock.yaml`:
  - `fast-uri@3.1.4` fue reemplazado por `fast-uri@3.1.5`.
  - `fast-uri@4.1.1` fue reemplazado por `fast-uri@4.1.2`.
  - PostCSS `8.5.19` fue reemplazado por `8.5.23`.
  - `nanoid@3.3.12` fue reemplazado por `3.3.17` como dependencia transitiva
    de PostCSS `8.5.23`.
  - `brace-expansion@5.0.8` fue reemplazado por `5.0.9`.
  - `minimatch@3.1.5` volvió a resolver su dependencia nativa compatible
    `brace-expansion@1.1.18`, fuera del rango vulnerable de la rama 5.x.
  - `balanced-match@1.0.2` y `concat-map@0.0.1` se incorporaron únicamente
    como transitivas de `brace-expansion@1.1.18`.
  - No se agregaron dependencias directas ni upgrades major.

- `test/architecture/toolchain-contract.test.ts`:
  - Se actualizaron únicamente las expectativas literales correspondientes a
    los cuatro overrides remediados.
  - El guard conserva su estructura y sus assertions estrictas.

## Archivos de implementación

- `pnpm-workspace.yaml`.
- `pnpm-lock.yaml`.
- `test/architecture/toolchain-contract.test.ts`.
- `docs/implementation/security-fast-uri-postcss-brace-expansion-advisory-hotfix.md`.

## Validaciones

- `pnpm install --frozen-lockfile` — `PASSED`.
- Test dirigido de `test/architecture/toolchain-contract.test.ts` —
  `PASSED`; 8/8.
- `pnpm audit --prod` — `PASSED`; sin vulnerabilidades conocidas.
- `pnpm audit` — `PASSED`; sin vulnerabilidades conocidas.
- `pnpm validate:local` — `PASSED`; 4111 aprobados, 0 fallos y 1 omitido
  preexistente.
- `pnpm --dir frontend lint` — `PASSED`.
- `pnpm --dir frontend typecheck` — `PASSED`.
- `pnpm --dir frontend build` — `PASSED`.
- `pnpm security:public-surface` — `PASSED`.
- `git diff --check` — `PASSED`.
- Checks requeridos de #1638 — `PASSED` antes del commit documental.

## Resultado

El workspace queda con resoluciones parcheadas de:

- `fast-uri@3.1.5`;
- `fast-uri@4.1.2`;
- `postcss@8.5.23`;
- `brace-expansion@5.0.9`.

Las auditorías productiva y completa terminan con exit code 0. El cambio no
introduce upgrades major ni dependencias directas nuevas y no modifica código
de runtime.

## Riesgo residual

- `brace-expansion@1.1.18` permanece como dependencia legítima de
  `minimatch@3.1.5`. No pertenece al rango vulnerable
  `>=4.0.0 <5.0.9`.
- Los cambios afectan resoluciones transitivas y tooling. La instalación
  frozen, los audits, el contrato de arquitectura y la validación general
  reducen el riesgo de incompatibilidad.
- Los checks remotos posteriores al commit documental siguen siendo el gate
  definitivo previo al merge.

## Rollback

Revertir los commits del hotfix restaura los overrides, el guard y el lockfile
anteriores. No requiere migración de schema, datos, credenciales,
infraestructura ni configuración productiva.

## Estado final

Implementación y documentación listas para publicación. El PR debe permanecer
abierto y sin merge hasta que el hilo de revisión quede resuelto y los checks
requeridos posteriores al commit documental estén verdes.
