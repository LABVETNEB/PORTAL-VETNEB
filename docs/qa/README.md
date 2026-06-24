# VETNEB QA

Base documental vigente para estrategia de calidad, flaky tests y regresiones.

## Propósito

Este directorio define cómo clasificar fallos, decidir qué suite ejecutar y evitar que un test inestable o una regresión visual/operativa se gestione de forma improvisada.

Es una base docs-only. No modifica tests, fixtures, helpers, package scripts, Playwright config, CI, frontend, backend, API, auth, DB, migraciones, dependencias ni lockfiles.

## Fuentes relacionadas

| Fuente | Uso |
| --- | --- |
| `docs/SOURCES_OF_TRUTH.md` | Mapa vigente de fuentes por dominio |
| `docs/governance/pr-readiness-review-checklist.md` | Checklist de PR readiness y validación |
| `docs/audit/e2e-ci-layering-strategy-audit.md` | Estrategia vigente de layering E2E |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Runbook de checks de PR |
| `package.json` | Scripts backend/root vigentes |
| `frontend/package.json` | Scripts frontend/E2E vigentes |

## Documentos de este directorio

| Documento | Propósito |
| --- | --- |
| `flaky-test-policy.md` | Política para detectar, clasificar y resolver flaky tests |
| `regression-strategy.md` | Estrategia de regresión por tipo de cambio y dominio afectado |

## Principios

1. Un fallo rojo no se ignora.
2. Un flaky test no se desactiva sin evidencia, owner y plan.
3. Un test inestable se trata como deuda de calidad, no como ruido.
4. Una regresión visual/mobile debe reproducirse con evidencia concreta.
5. No mezclar fixes de tests con cambios funcionales salvo autorización explícita.
6. No modificar CI, package scripts ni Playwright config dentro de PR-QA1.
7. Todo cambio futuro de suites debe tener PR propio y validación local previa.

## Estado

Este directorio nace como PR-QA1 docs-only.
