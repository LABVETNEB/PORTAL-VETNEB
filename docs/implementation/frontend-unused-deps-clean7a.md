# PR-CLEAN7A · frontend unused dependencies

## Estado base

- Repo: `C:\PORTAL-VETNEB`.
- Rama: `clean/remove-unused-frontend-deps-core`.
- HEAD: `2140f28 docs(audit): audit frontend dependency usage (#1174)`.
- Working tree inicial: limpio.

## Scope incluido

- Remover sólo `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
  `echarts-for-react` y `react-hook-form` de `frontend/package.json`.
- Regenerar `pnpm-lock.yaml`.
- Ajustar `test/package-scripts-contract.test.ts` sólo porque exigía esas cinco
  dependencias como contrato de manifest.
- Actualizar documentación rectora en `docs/audit`.

## Scope excluido

- Runtime frontend y backend.
- Radix.
- Dependencias `UNKNOWN`.
- DB, migraciones, workflows, Render, secrets, auth y seguridad productiva.
- Commit, push y PR.

## Auditoría previa

- `git grep` amplio encontró sólo manifiesto, tests de contrato/guardrails y
  documentación histórica.
- `git grep` de imports ES (`from "..."`) no encontró referencias reales.
- `git grep` de `require("...")` no encontró referencias reales.
- `test/package-scripts-contract.test.ts` declaraba esas dependencias como
  requeridas y por eso se actualizó.

## Cambios

- Se removieron las 5 dependencias con:
  `corepack pnpm --dir frontend remove @tanstack/react-query @tanstack/react-table echarts echarts-for-react react-hook-form`.
- El intento directo con `pnpm --dir frontend remove ...` falló por
  `ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF`; no aplicó cambios.
- `pnpm-lock.yaml` quedó regenerado por pnpm.
- Se ajustaron guardrails históricos de `test/frontend-dashboard-*.test.ts`
  para permitir `frontend/package.json` y `pnpm-lock.yaml` únicamente cuando el
  diff corresponde al cleanup PR-CLEAN7A: las 5 dependencias aprobadas ausentes,
  Radix y dependencias `UNKNOWN` presentes, y `package.json` raíz sin cambios.
- Ajuste post-CI PR #1175: el helper también acepta el caso de CI con diff de
  manifests vacío, porque el commit ya está aplicado en el checkout del workflow;
  mantiene las verificaciones de dependencias removidas/preservadas.

## Archivos modificados

- `frontend/package.json`.
- `pnpm-lock.yaml`.
- `test/package-scripts-contract.test.ts`.
- `test/helpers/clean7a-dependency-cleanup-scope.ts`.
- Guardrails históricos `test/frontend-dashboard-*.test.ts` que bloqueaban
  cualquier cambio de manifest/lockfile.
- `docs/audit/final-repo-cleanup-engineering-audit.md`.
- `docs/audit/frontend-dependencies-usage-audit.md`.
- `docs/implementation/frontend-unused-deps-clean7a.md`.

## Validaciones

- `pnpm typecheck`: falló antes de ejecutar por
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `corepack pnpm typecheck`: pasó.
- `corepack pnpm typecheck:test`: pasó.
- `node --experimental-strip-types --test test/package-scripts-contract.test.ts`:
  pasó 10/10.
- `corepack pnpm test`: ejecutado; 2877/2890 pasaron y 13 fallaron por
  guardrails históricas de PRs frontend que inspeccionan `git diff` y prohíben
  cambios en `frontend/package.json` o `pnpm-lock.yaml`.
- Tras ajustar esas guardrails al scope PR-CLEAN7A, `corepack pnpm test` pasó
  2890/2890.
- `corepack pnpm build`: pasó.
- `corepack pnpm security:public-surface`: pasó; mantuvo notas informativas
  existentes sobre identificadores uppercase en `frontend/src/proxy.ts`.
- `corepack pnpm --dir frontend lint`: pasó.
- `corepack pnpm --dir frontend typecheck`: pasó.
- `corepack pnpm --dir frontend build`: pasó.
- `node --experimental-strip-types --test test/architecture/security/security-production-invariants.test.ts`:
  pasó 11/11.

## Resultado

- Las cinco dependencias de PR-CLEAN7A ya no forman parte del manifest frontend.
- Radix y dependencias `UNKNOWN` permanecen sin cambios.
- No se modificó runtime frontend/backend.

## Riesgo residual

- Riesgo bajo-medio propio de cambio de manifest/lockfile.
- Los 13 fallos iniciales eran guardrails de scope histórico por detectar
  `frontend/package.json`/`pnpm-lock.yaml` modificados; quedaron cubiertos por
  un helper que sólo permite esos dos archivos si se confirma el cleanup
  PR-CLEAN7A, con Radix y dependencias `UNKNOWN` preservadas.

## Estado final

- Sin commit.
- Sin push.
- Sin PR.
