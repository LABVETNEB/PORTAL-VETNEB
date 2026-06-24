# Regression Strategy

Estrategia documental vigente para seleccionar validaciones de regresión en VETNEB.

## Propósito

Definir qué validar según el tipo de cambio, evitando tanto validación insuficiente como ejecución indiscriminada sin criterio.

## Regla principal

La validación debe seguir el riesgo real del PR.

Un PR debe declarar:

- Tipo de PR.
- Dominio afectado.
- Scope incluido.
- Scope excluido.
- Suites ejecutadas.
- Suites no ejecutadas y motivo.
- Riesgo residual.

## Matriz por tipo de PR

| Tipo de PR | Validación mínima | Validación adicional si aplica |
| --- | --- | --- |
| docs-only | `git diff --check` | Review de links, source of truth y contradicciones |
| backend-only | `pnpm test`, `pnpm build` | `pnpm typecheck`, `pnpm typecheck:test`, seguridad específica |
| frontend-only | `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build` | E2E focalizado por dominio |
| test-only | Suite afectada | Suite madre si cambia helper compartido |
| CI-only | Validación local de scripts y `gh pr checks --watch` | Dry-run o PR canary si aplica |
| dependency-only | Audit, build, tests afectados | E2E focalizado si toca frontend/runtime |
| migration-only | Tests de migración, compatibilidad y rollback | Backup/restore si aplica |
| security-only | Suite security específica | Public surface, auth/session, RBAC, no leakage |
| dashboard/mobile | Tests unitarios afectados | E2E visual/mobile/no-scroll correspondiente |

## Scripts vigentes observados

### Root

- `pnpm test`
- `pnpm build`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `pnpm security:public-surface`

### Frontend

- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`
- `pnpm --dir frontend e2e`
- `pnpm --dir frontend e2e:smoke`
- `pnpm --dir frontend e2e:admin-mobile`
- `pnpm --dir frontend e2e:visual-contract`
- `pnpm --dir frontend e2e:public-clinic`

## Estrategia E2E

| Dominio | Suite sugerida |
| --- | --- |
| Smoke general | `pnpm --dir frontend e2e:smoke` |
| Admin mobile/no-scroll | `pnpm --dir frontend e2e:admin-mobile` |
| Dashboard visual/no-scroll/contracts | `pnpm --dir frontend e2e:visual-contract` |
| Public/clinic journey | `pnpm --dir frontend e2e:public-clinic` |
| Cambio E2E amplio | `pnpm --dir frontend e2e` |

## Política de regresión

### P0

Ejecutar validación amplia si el PR toca:

- Auth/session.
- Tenant isolation.
- DB/migrations.
- Storage/report access.
- Public sensitive surface.
- CI workflows.
- Shared test helpers.
- Dashboard shell global.
- Package scripts.

### P1

Ejecutar validación focalizada si el PR toca:

- Un módulo dashboard.
- Una ruta API concreta.
- Un componente frontend con contrato existente.
- Una suite de tests específica.
- Documentación source-of-truth que afecta futuros PRs.

### P2

Validación documental o focalizada si el PR:

- Solo clasifica documentación.
- Añade plantillas.
- Añade runbooks.
- No toca runtime ni configuración.

## Reglas anti-regresión

1. No usar tests verdes como excusa para ignorar evidencia visual/manual.
2. No usar evidencia manual como reemplazo permanente de una suite necesaria.
3. No ampliar CI sin medir costo y cobertura.
4. No reducir cobertura sin ADR/RFC si el cambio es duradero.
5. No mezclar cambios de test helper con cambios funcionales grandes.
6. No tocar Playwright config en PR funcional.
7. No mezclar Dependabot con QA/regression fixes.

## PR body esperado

Todo PR con riesgo de regresión debe incluir:

- Comandos ejecutados.
- Resultado.
- Suite omitida y motivo, si aplica.
- Evidencia visual, si aplica.
- Riesgo residual.
- Follow-up si queda una brecha.

## Criterio de aceptación

Un PR está listo para merge cuando:

- El scope está cerrado.
- La validación ejecutada coincide con el riesgo.
- No hay flaky test sin clasificar.
- No hay regresión conocida sin follow-up.
- Checks de PR están verdes o el fallo está diagnosticado antes de continuar.
