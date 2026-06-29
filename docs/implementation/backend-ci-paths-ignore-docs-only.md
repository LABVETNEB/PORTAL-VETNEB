# Backend CI · `paths-ignore` docs-only (P3-G)

> **Modo:** CI-only + docs.
> **Fecha:** 2026-06-29.
> **Rama:** `ci/backend-paths-ignore-docs-only`.
> **HEAD base:** `def7cd1 chore(cleanup): remove orphaned historical artifacts (#1183)`.
> **Documento rector:** `docs/audit/final-repo-cleanup-engineering-audit.md` (§10, hallazgo P3-G).

## Problema

`.github/workflows/backend-ci.yml` no tenía `paths:`/`paths-ignore:`, por lo que
`validate-backend` (postgres + migraciones + typecheck + test + build, ~15 min)
corría también en PRs estrictamente docs-only (por ejemplo, ediciones de
`docs/audit/*.md`), generando ruido y consumo de minutos de CI sin valor.

## Cambio aplicado

Se agregó `paths-ignore` únicamente al trigger `pull_request` de
`.github/workflows/backend-ci.yml`:

```yaml
on:
  pull_request:
    branches:
      - main
    paths-ignore:
      - 'docs/**'
      - '**/*.md'
  push:
    branches:
      - main
      - chore/**
      - feat/**
      - fix/**
      - refactor/**
      - ci/**
      - test/**
      - codex/**
```

El trigger `push` **no** se modificó: las ramas de trabajo (`feat/**`, `fix/**`,
etc.) siguen disparando `backend-ci` en cada push, igual que antes.

## Por qué sólo `docs/**` y `**/*.md`

GitHub Actions omite el job sólo cuando **todos** los archivos del diff del PR
coinciden con `paths-ignore`. Cualquier archivo fuera de esos dos patrones
(p. ej. `server/**`, `test/**`, `package.json`, `pnpm-lock.yaml`,
`.github/workflows/**`, `drizzle/**`, `scripts/**`, `.env.example`,
`frontend/**`) sigue disparando `validate-backend` con normalidad, incluso si
el mismo PR también toca `docs/**` o algún `.md`.

Se excluyeron deliberadamente de `paths-ignore`:

- `.env.example` y `frontend/.env.example` — varios tests de contrato backend
  los leen directamente (`test/smoke-env-contract.test.ts`,
  `test/production-env-contracts.test.ts`,
  `test/global-e2e-production-readiness-contract.test.ts`, entre otros).
- `package.json`, `pnpm-lock.yaml` — cambios de dependencias.
- `.github/workflows/**` — cambios al propio pipeline de CI.
- `server/**`, `test/**`, `drizzle/**`, `scripts/**`, `frontend/**` — código y
  artefactos que `validate-backend` debe seguir cubriendo.

## Verificación de tests de contrato

Se revisó con `git grep` qué tests leen `.env.example`/`docs/` para confirmar
que ninguno depende de que el job corra a partir de un cambio en `docs/**` o
`*.md` exclusivamente; todos esos tests corren igual dentro del job cuando éste
se dispara por cualquier otro archivo (server/test/package/lock/workflow/env),
y el job nunca se salta si el PR toca algo fuera de `docs/**`/`*.md`.

## Qué sigue disparando `validate-backend` en PRs a `main`

- `server/**`
- `test/**`
- `package.json`
- `pnpm-lock.yaml`
- `.github/workflows/**`
- `drizzle/**`
- `scripts/**`
- `.env.example`
- `frontend/**` (y cualquier otro archivo no cubierto por `docs/**`/`**/*.md`)

## Qué deja de disparar `validate-backend`

- PRs a `main` cuyo diff completo está compuesto exclusivamente por archivos
  bajo `docs/**` y/o archivos `*.md` en cualquier carpeta (por ejemplo, README
  raíz, `docs/audit/*.md`, `docs/implementation/*.md`).

## `frontend-ci.yml`

Sin cambios. Se leyó sólo como referencia de un `paths:` ya correcto
(`frontend/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`,
`.github/workflows/frontend-ci.yml`).

## Validaciones ejecutadas

- `corepack pnpm typecheck` — OK.
- `corepack pnpm typecheck:test` — OK.
- `corepack pnpm test` — 2890 tests, 0 fallos.
- `corepack pnpm build` — OK (`dist/index.js`, 836.8kb).
- `corepack pnpm --dir frontend lint` — OK.
- `corepack pnpm --dir frontend typecheck` — OK.
- `corepack pnpm --dir frontend build` — OK (25 rutas generadas, sin drift en
  `frontend/next-env.d.ts`).
- `git diff --check` — sin conflictos de whitespace.

## Alcance respetado

- No se tocó runtime frontend ni backend.
- No se tocó `package.json` ni `pnpm-lock.yaml`.
- No se tocó DB ni migraciones.
- No se tocó Render ni secrets.
- No se tocó `frontend-ci.yml` ni `app-version-force-update.yml`.
- Sin commit, sin push, sin PR.
