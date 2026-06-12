# Security Esbuild Audit Fix

## Scope

Correccion de auditoria de seguridad para esbuild.

## Problem

`pnpm audit --prod` fallaba por vulnerabilidades de esbuild. La dependencia
directa usaba `0.28.0`, mientras que `drizzle-kit` y `@esbuild-kit/core-utils`
resolvian versiones `0.25.x` afectadas.

## Dependency paths

- `.>esbuild`
- `.>drizzle-kit>esbuild`
- `.>drizzle-kit>@esbuild-kit/esm-loader>@esbuild-kit/core-utils>esbuild`

## Implementation

- Se actualizo la dependencia directa `esbuild` a `0.28.1`.
- Se reemplazo el override historico limitado por `pnpm.overrides.esbuild:
  0.28.1`.
- Se regenero `pnpm-lock.yaml` con PNPM.
- No se actualizo `drizzle-kit` ni ninguna dependencia no relacionada.

## Why this approach

- La actualizacion directa corrigio el path raiz y el usado por `tsx`, pero
  `drizzle-kit` y `@esbuild-kit/core-utils` conservaron resoluciones `0.25.x`.
- El override global es la correccion minima que unifica los tres paths en la
  version corregida sin ampliar el alcance a un upgrade de `drizzle-kit`.

## Validation

- `pnpm audit --prod`: pasa, sin vulnerabilidades conocidas.
- `pnpm test`: 2644 de 2657 tests pasan; 13 guardrails historicos de PRs
  visuales fallan porque ejecutan `git diff --name-only` y prohiben cambios en
  `package.json` y `pnpm-lock.yaml`.
- `pnpm build`: pasa.
- `pnpm security:public-surface`: pasa.
- `pnpm --dir frontend lint`: pasa.
- `pnpm --dir frontend typecheck`: pasa.
- `pnpm --dir frontend build`: pasa.

## Out of scope

- Sin cambios visuales.
- Sin cambios de layout.
- Sin cambios frontend publicos.
- Sin cambios dashboard/backend funcionales.
