# PR Readiness Review Checklist

Checklist documental para preparar y revisar PRs en VETNEB.

## Antes de crear rama

- [ ] `main` está limpio.
- [ ] `main` está actualizado con `origin/main`.
- [ ] Se leyó `docs/SOURCES_OF_TRUTH.md`.
- [ ] Se leyó `docs/audit/README.md`.
- [ ] Se verificó `docs/HISTORICAL_DOCUMENTATION.md` si hay documentos antiguos o ambiguos.
- [ ] El scope del PR está definido.
- [ ] El no-scope del PR está definido.
- [ ] No hay Dependabot mezclado con trabajo funcional/documental.

## Clasificación del PR

Marcar uno:

- [ ] docs-only
- [ ] frontend-only
- [ ] backend-only
- [ ] test-only
- [ ] CI-only
- [ ] dependency-only
- [ ] migration-only
- [ ] mixed scope autorizado explícitamente

## Scope incluido

-

## Scope excluido

-

## Riesgos

| Riesgo | Aplica | Nota |
| --- | --- | --- |
| Frontend/runtime | yes/no |  |
| Backend/API | yes/no |  |
| Auth/session/security | yes/no |  |
| DB/migrations/data | yes/no |  |
| CI/workflows | yes/no |  |
| Dependencies/lockfiles | yes/no |  |
| Mobile/responsive | yes/no |  |
| Production/ops | yes/no |  |

## Validaciones requeridas

Completar solo lo que aplique.

| Scope | Validación |
| --- | --- |
| docs-only | `git diff --check` |
| backend | `pnpm test`, `pnpm build` |
| frontend | `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build` |
| e2e | scripts `pnpm --dir frontend e2e:*` correspondientes |
| security | `pnpm security:public-surface` o suite específica vigente |
| CI | `gh pr checks --watch` |
| dependencies | `pnpm audit`, lockfile review |
| migration | tests de compatibilidad, rollback y data impact |

## Rollback

- [ ] Rollback trigger definido.
- [ ] Rollback steps definidos.
- [ ] Data impact definido.
- [ ] Si hay migración, compatibilidad backward definida.
- [ ] Si hay CI/workflow, revert directo del workflow definido.
- [ ] Si hay dependency update, versión anterior identificada.

## PR body mínimo

- [ ] Summary.
- [ ] Scope.
- [ ] No-scope.
- [ ] Validation.
- [ ] Rollback.
- [ ] Data impact, si aplica.
- [ ] Screenshots/evidence, si aplica.
- [ ] Links a ADR/RFC, si aplica.

## Revisión final antes de push

- [ ] `git status --short --untracked-files=all` revisado.
- [ ] `git diff --name-only` revisado.
- [ ] `git diff --stat` revisado.
- [ ] `git diff --check` limpio.
- [ ] No hay archivos fuera del scope.
- [ ] No hay secretos.
- [ ] No hay cambios generados accidentalmente.

## Checks posteriores

- [ ] PR creado.
- [ ] `gh pr checks --watch` ejecutado.
- [ ] Checks verdes o fallo diagnosticado.
- [ ] Merge solo con estado limpio y scope confirmado.
