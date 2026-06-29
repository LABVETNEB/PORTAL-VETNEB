# Env version vars docs

> **Modo:** docs/env-example comments only.
> **Fecha:** 2026-06-29.
> **Rama:** `docs/env-version-vars-contract`.
> **HEAD base:** `da143ea docs(audit): normalize final cleanup status (#1180)`.

## Estado base

- Working tree inicial limpio.
- Rama esperada confirmada: `docs/env-version-vars-contract`.
- HEAD esperado confirmado: `da143ea docs(audit): normalize final cleanup status (#1180)`.

## Scope incluido

- Documentar en `.env.example` las variables backend del version gate:
  `APP_VERSION` y `CLIENT_MIN_VERSION`.
- Documentar en `frontend/.env.example` la variable build-time:
  `NEXT_PUBLIC_APP_VERSION`.
- Marcar P2-F como cerrado en los documentos de auditoría vigentes.

## Scope excluido

- No runtime frontend.
- No runtime backend.
- No lógica del version gate.
- No `package.json`, `frontend/package.json` ni `pnpm-lock.yaml`.
- No DB, migraciones, workflows, Render ni secrets.
- No cambios a `CORS_ORIGIN`, `NEXT_PUBLIC_SITE_URL` ni `NEXT_PUBLIC_API_URL`.

## Auditoría previa

- `server/lib/env.ts` acepta `APP_VERSION` y `CLIENT_MIN_VERSION`.
- `frontend/src/lib/app-version.ts` lee `NEXT_PUBLIC_APP_VERSION`.
- Los env examples no listaban explícitamente esas tres variables.
- Los tests de contrato relevantes inspeccionan `.env.example` y
  `frontend/.env.example` para evitar URLs o valores activos incorrectos.

## Cambios

- `.env.example` agrega un bloque breve de version gate con placeholders no
  secretos:
  `APP_VERSION=<version-token>` y `CLIENT_MIN_VERSION=<version-token>`.
- `frontend/.env.example` agrega `NEXT_PUBLIC_APP_VERSION=<version-token>` y
  aclara que es build-time y requiere rebuild al cambiar.
- Los documentos de auditoría marcan P2-F como cerrado y mantienen P2-C como
  pendiente separado.

## Archivos modificados

- `.env.example`
- `frontend/.env.example`
- `docs/audit/final-repo-cleanup-engineering-audit.md`
- `docs/audit/final-cleanup-current-status-snapshot.md`
- `docs/implementation/env-version-vars-docs.md`

## Validaciones

- `corepack pnpm typecheck` -> pasó.
- `corepack pnpm typecheck:test` -> pasó.
- `node --experimental-strip-types --test test/production-env-contracts.test.ts` -> pasó.
- `node --experimental-strip-types --test test/public-staging-config-contract.test.ts` -> pasó.
- `corepack pnpm test` -> pasó, 2890/2890.
- `corepack pnpm build` -> pasó.
- `corepack pnpm security:public-surface` -> pasó.
- `corepack pnpm --dir frontend lint` -> pasó.
- `corepack pnpm --dir frontend typecheck` -> pasó.
- `corepack pnpm --dir frontend build` -> pasó.
- `git diff --check` -> pasó; Git informó sólo avisos CRLF para `.env.example`
  y `frontend/.env.example`.

## Resultado

- P2-F queda cerrado como documentación explícita de env examples.
- No se agregaron secretos ni valores productivos reales nuevos.
- No se modificó lógica ni runtime.

## Riesgo residual

- Bajo: los placeholders son no secretos y sólo documentan variables ya usadas.
- El riesgo operativo restante es mantener alineado el mismo token entre
  frontend build-time y backend runtime durante un force update.

## Estado final

- Cambio acotado a docs/env examples.
- Sin commit, push ni PR.
