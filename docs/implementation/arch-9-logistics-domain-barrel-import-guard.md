# ARCH-9 · Guardrail de imports al barrel de Logistics domain

## Objetivo

Agregar un guardrail test-only para impedir que consumidores backend runtime
fuera de `server/features/logistics/domain` importen archivos internos de esa
capa. El punto de entrada permitido para runtime es
`server/features/logistics/domain/index.ts` o una ruta relativa equivalente que
resuelva a ese `index.ts`.

## Alcance incluido

- Ajuste mínimo del guardrail existente
  `test/logistics-domain-boundary-guard.test.ts`.
- Documentación de entrega en
  `docs/implementation/arch-9-logistics-domain-barrel-import-guard.md`.
- Sin snapshots frágiles; el test recorre imports reales bajo `server/**/*.ts`.

## Alcance excluido

- Sin cambios de runtime.
- Sin backend funcional, API, auth, DB, schema ni migraciones.
- Sin dependencias, `package.json`, lockfiles ni CI.
- Sin stashes, sin `.claude/worktrees`, sin `git add`, commit, push, PR, merge
  ni comandos `gh`.

## Auditoría previa

- Base limpia: `git status --short --untracked-files=all` no mostró cambios.
- Rama local: `test/logistics-domain-barrel-import-guard-arch9`.
- HEAD local: `81cf61e refactor(logistics): add domain barrel (#1304)`.
- Guardrails existentes inspeccionados: ya existía
  `test/logistics-domain-boundary-guard.test.ts`, que valida pureza interna del
  domain, pero no cubría consumidores runtime externos.
- Referencias actuales inspeccionadas: `server/db-logistics.ts` importa desde
  `./features/logistics/domain/index.ts`; los imports directos a
  `pagination.ts` y `route-plan-field-visits.ts` aparecen en tests unitarios
  bajo `test/`, que están permitidos.
- Scripts reales confirmados en `package.json`: `pnpm test` y `pnpm build`.

## Regla protegida

Consumidores backend runtime bajo `server/**/*.ts`, excluyendo
`server/features/logistics/domain/**`, no pueden importar archivos `.ts`
internos de `server/features/logistics/domain` distintos de `index.ts`.

## Permitidos

- Imports relativos internos dentro de `server/features/logistics/domain`.
- El propio `server/features/logistics/domain/index.ts` puede importar y
  re-exportar archivos internos.
- Tests unitarios bajo `test/**/*.test.ts` pueden importar helpers internos para
  validarlos directamente.
- Consumidores runtime pueden importar desde una ruta que resuelva a
  `server/features/logistics/domain/index.ts`.

## Prohibidos

- Imports runtime directos desde `server/**/*.ts` hacia
  `server/features/logistics/domain/pagination.ts`.
- Imports runtime directos desde `server/**/*.ts` hacia
  `server/features/logistics/domain/route-plan-field-visits.ts`.
- Imports runtime directos desde `server/**/*.ts` hacia cualquier otro archivo
  `.ts` interno del domain distinto de `index.ts`.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `test/logistics-domain-boundary-guard.test.ts` | Agrega el caso `"Logistics runtime consumers import logistics domain through the public barrel"`, con resolución de imports relativos a archivos `.ts` y `index.ts`. |
| `docs/implementation/arch-9-logistics-domain-barrel-import-guard.md` | Documenta objetivo, alcance, regla, validaciones y cierre ARCH-9. |

## Validaciones

Comandos ejecutados:

```powershell
git status --short --untracked-files=all
git branch --show-current
git log -1 --oneline
rg -n "guardrail|barrel|restricted import|no-restricted|domain/index|features/logistics/domain" -S test tests server frontend package.json pnpm-workspace.yaml
Get-Content -Raw -LiteralPath package.json
Get-Content -Raw -LiteralPath test\logistics-domain-boundary-guard.test.ts
Get-Content -Raw -LiteralPath test\logistics-domain-barrel.test.ts
rg -n "features/logistics/domain|domain/pagination|domain/route-plan-field-visits|domain/index" server test -S
rg --files docs\implementation
cmd.exe /c dir /b server\features\logistics\domain
Get-Content -Raw -LiteralPath docs\implementation\logistics-domain-shell.md
Get-Content -Raw -LiteralPath docs\implementation\arch-8-logistics-domain-barrel.md
Get-Content -Raw -LiteralPath server\features\logistics\domain\index.ts
Get-Content -Raw -LiteralPath server\db-logistics.ts
pnpm test
pnpm build
```

git diff --check
git status --short --untracked-files=all
git diff --stat
git diff --name-only
```

## Resultados

- `pnpm test`: OK. `tests 2983`, `pass 2983`, `fail 0`.
- `pnpm build`: OK. `dist\index.js 838.3kb`, `Done in 137ms`.
- `git diff --check`: OK, exit 0.
- `git status --short --untracked-files=all`: muestra sólo
  `test/logistics-domain-boundary-guard.test.ts` modificado y este documento
  nuevo.
- `git diff --stat`: sólo reporta cambios tracked en
  `test/logistics-domain-boundary-guard.test.ts`.
- `git diff --name-only`: sólo reporta
  `test/logistics-domain-boundary-guard.test.ts` porque este documento todavía
  está untracked.

## Riesgos residuales

- Bajo. Es un guardrail textual test-only que no modifica código ejecutado por
  runtime.
- El test cubre imports `from`, `require(...)` e `import(...)` con specifier
  literal. No intenta resolver expresiones dinámicas no literales, que no son
  el patrón esperado para imports TypeScript de backend.

## Estado final

Implementación test-only + doc completa. Confirmación de scope: no deps, no
lockfiles, no CI, no DB/schema/migrations, no API, no auth y no runtime
behavior.
