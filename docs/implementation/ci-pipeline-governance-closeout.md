# CI/CD Pipeline Governance Closeout

| Campo | Valor |
| --- | --- |
| Control | `ERM-CTRL-013` — CI/CD Pipeline Governance |
| Gap relacionado | `ERM-CI-001` |
| Owner | CI owner |
| Estado propuesto | `IMPLEMENTED` |
| Fecha de verificación | 2026-07-12 |
| Alcance | Documentación y evidencia de configuración existente |
| Fuera de alcance | Cambios de workflows, branch protection, producto, DB, dependencias o runtime |

## 1. Objetivo

Cerrar operativamente `ERM-CTRL-013` mediante un mapa verificable de los checks de pull request, su aplicabilidad por tipo de cambio y evidencia positiva y negativa del gate requerido que protege `main`.

Este cierre no convierte todos los jobs condicionales en required checks globales. Distingue explícitamente entre:

- el check global requerido por branch protection;
- los workflows condicionales que se ejecutan según paths;
- integraciones externas que pueden aparecer como `SKIPPED`.

## 2. Fuentes efectivas

- `.github/workflows/pr-governance.yml`
- `.github/workflows/backend-ci.yml`
- `.github/workflows/frontend-ci.yml`
- `docs/ops/CI_PR_CHECKS_RUNBOOK.md`
- `docs/review-governance.md`
- `docs/implementation/branch-protection-governance-closeout.md`
- `docs/audit/branch-protection-governance-closeout-audit.md`

## 3. Mapa efectivo de checks

| Check / integración | Alcance | Disparador | Requerido para merge | Evidencia |
| --- | --- | --- | --- | --- |
| `validate-pr-governance` | Todos los PR hacia `main` | `pull_request` a `main` | Sí, strict required check | PR #1447 falló; PR #1448 y #1449 pasaron |
| `validate-backend` | Backend, tests, scripts, configuración y cambios no ignorados | `pull_request` a `main`, excepto docs/Markdown; también pushes configurados | Condicional por workflow; no es el contexto global requerido documentado | `.github/workflows/backend-ci.yml`; tests de contrato del workflow |
| `validate-frontend` | Frontend y archivos de dependencia/workspace definidos | `pull_request` a `main` por paths | Condicional por workflow; no es el contexto global requerido documentado | `.github/workflows/frontend-ci.yml` |
| Supabase Preview | Paths administrados por la integración | Integración externa | Puede aparecer `SKIPPED` cuando no aplica | Rollup de PRs docs-only |

## 4. Gate global requerido

`main` exige el contexto exacto `validate-pr-governance` con status checks estrictos y enforcement para administradores.

El job valida, entre otros aspectos:

- integridad del diff;
- política de archivos sensibles;
- detección de secretos;
- Markdown y enlaces locales;
- metadata mínima del PR;
- clasificación y declaración de scope.

La protección y el nombre exacto del contexto fueron cerrados previamente en `ERM-CTRL-015`.

## 5. Evidencia negativa

La PR #1447 fue creada como canaria negativa con metadata deliberadamente incompleta.

Resultado:

- head: `533b1ab0fa6c58bf75a8171e16116c47dcbb918c`;
- workflow: `PR Governance`;
- run: `29212530876`;
- conclusión: `failure`;
- PR cerrada sin merge;
- rama canaria eliminada y ausencia verificada.

Esta prueba demuestra que un PR inválido no obtiene el check requerido necesario para mergear a `main`.

## 6. Evidencia positiva

La PR #1448 fue una entrega docs-only válida con contrato de PR completo.

Resultado:

- head: `6ea8bf29f9f72e7cb0c3bfcf0180a0f6bf39ec29`;
- workflow: `PR Governance`;
- run: `29212737354`;
- conclusión: `success`;
- squash merge: `6a96a6f11b1e9e8296d48a2992f4716601e20ecd`.

La PR #1449 repitió la ruta positiva:

- head: `2116a47d28bcc7b1d6d6faa577edc4aeb3a34788`;
- workflow run: `29213010708`;
- conclusión: `success`;
- squash merge: `5f929b358e8b742bad6e54ac750625bd599babe4`.

## 7. Workflows condicionales

### Backend CI

El workflow `Backend CI`:

- corre en PR hacia `main`;
- ignora `docs/**` y `**/*.md`;
- usa Postgres 16 efímero;
- instala con lockfile congelado;
- ejecuta auditoría de dependencias, migraciones, typecheck, typecheck de tests, tests y build;
- usa `contents: read`.

### Frontend CI

El workflow `Frontend CI`:

- corre por paths frontend, manifests y workspace definidos;
- ejecuta lint, typecheck, build, auditoría de superficie pública y suites E2E estratificadas;
- publica reporte Playwright solo al fallar;
- usa `contents: read`.

Estos workflows complementan el gate global. Su aplicabilidad depende del diff y no debe interpretarse como ausencia de CI cuando un PR docs-only los omite.

## 8. Runbook operativo

`docs/ops/CI_PR_CHECKS_RUNBOOK.md` queda actualizado para:

- incluir `PR Governance` como check global requerido;
- distinguir required check global de CI condicional;
- documentar cuándo Backend CI y Frontend CI aplican;
- prohibir merge con estados pendientes o fallidos;
- eliminar el ejemplo destructivo basado en `git reset --hard`;
- usar sincronización segura mediante `git pull --ff-only` y cleanup verificado.

## 9. Criterio de cierre

`ERM-CTRL-013` puede declararse `IMPLEMENTED` porque:

1. existe un mapa explícito de checks y aplicabilidad;
2. existe un required check global protegido;
3. existe evidencia negativa de fallo cerrada sin merge;
4. existen rutas positivas fusionadas con el mismo gate;
5. Backend CI y Frontend CI tienen triggers y gates observables;
6. el runbook operativo refleja el estado vigente;
7. existe owner y revisión periódica.

`ERM-CI-001` queda cerrado operativamente con fecha 2026-07-12. El gap register histórico permanece inmutable.

## 10. Revisión y reapertura

Revisar mensualmente y ante cambios en:

- nombres de jobs o workflows;
- branch protection o rulesets;
- triggers o filtros de paths;
- permisos de Actions;
- política de merge;
- integraciones externas de checks.

Reabrir el control si:

- `validate-pr-governance` deja de ser requerido;
- un PR inválido puede mergearse sin el gate;
- el nombre del contexto requerido deriva del job real;
- el runbook deja de coincidir con los workflows;
- se debilitan triggers o validaciones sin evidencia compensatoria.

## 11. Rollback

Trigger:

- evidencia incorrecta;
- mapa de checks incompleto;
- transición de control inválida;
- enlaces rotos o contradicción con branch protection.

Acciones:

1. revertir el squash commit del PR de cierre;
2. restaurar `ERM-CTRL-013` a `PARTIAL / 2 / P1`;
3. reabrir `ERM-CI-001` operativamente;
4. restaurar la versión anterior del runbook;
5. retirar los registros de closeout si la evidencia queda invalidada.

Impacto en datos, runtime y producto: ninguno.