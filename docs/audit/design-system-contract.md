# VETNEB Design System Governance Contract

> **Tipo:** Contrato documental operativo docs-only.
> **PR:** PR-VIS-0 / Fase 0.
> **Hallazgo rector:** VIS-P1-001 (freeze documental).
> **Naturaleza:** Este documento congela reglas visuales y de gobierno antes de PR-VIS-1 y siguientes. No es una auditoría nueva, no reemplaza documentos rectores, no cambia severidades, no cambia hallazgos y no cambia conteos.

## 1. Naturaleza

Este contrato es un artefacto documental operativo. Su objetivo es dejar explícito cómo debe gobernarse el design system de VETNEB antes de ejecutar cambios visuales o de frontend derivados del roadmap.

PR-VIS-0 no implementa cambios productivos. No modifica frontend, backend, API, auth, DB, migraciones, tests, dependencias, lockfiles, workflows, CI, Playwright, CSS, tokens, componentes, dark mode, badges, filtros, `user-select` ni primitivas.

## 2. Autoridad

La autoridad documental queda distribuida así:

- `docs/audit/total-visual-engineering-audit.md` gobierna visual/frontend, incluyendo tokens, CSS, primitivas UI, contrato no-scroll, dashboards, deuda visual, baseline visual y PR-VIS-*.
- `docs/audit/total-software-engineering-audit.md` gobierna ingeniería dura, incluyendo backend, DB, seguridad, CI, testing, observabilidad, performance técnica y PR-ENG/SEC/OBS/LINT/COV relacionados.
- `docs/audit/total-engineering-roadmap.md` orquesta secuencia, dependencias, fases, gates y trazabilidad entre hallazgos VIS + ENG.

Este contrato queda subordinado a esos tres documentos. Si existe tensión entre este documento y los rectores, mandan los rectores. Si una regla visual necesita precisión adicional, se consulta primero `total-visual-engineering-audit.md`; si toca ingeniería dura, se consulta primero `total-software-engineering-audit.md`; si toca orden o dependencia, se consulta primero `total-engineering-roadmap.md`.

## 3. Scope De PR-VIS-0

PR-VIS-0 es exclusivamente:

- Freeze documental del contrato de gobernanza del design system.
- Cero cambios productivos.
- Base operativa para PR-VIS-1, PR-VIS-2, PR-VIS-4, PR-VIS-3 y PR-VIS-5.
- Trazabilidad de VIS-P1-001 en Fase 0 sin adelantar extracción de CSS ni refactors visuales.

PR-VIS-0 no cierra VIS-P1-001 completo. Sólo congela la parte documental. La extracción o reorganización de `globals.css` queda diferida al PR correspondiente indicado por el roadmap y condicionada a baseline/regresión cuando aplique.

## 4. Inventario Contractual Actual

El estado actual que este contrato preserva y gobierna es:

- Tokens semánticos existentes y marca `vetneb-*` como fuente preferente para color, marca y estados.
- Primitivas shadcn/Radix existentes como base UI ya instalada y vigente.
- App Shell single-viewport/no-scroll como activo productivo a preservar, especialmente en dashboards autenticados.
- Dashboards admin y clínica como software operativo, no como landing pages ni superficies decorativas.
- CSS global monolítico como deuda congelada, no como permiso para moverlo, partirlo o reordenarlo en este PR.

Este inventario no autoriza cambios visuales. Sólo fija el punto de partida para que los PRs siguientes no traten el sistema visual como implícito o libre de contrato.

## 5. Reglas De Gobierno

Todo PR visual/frontend derivado de este contrato debe cumplir:

- Una causa raíz por PR.
- No mega-PRs.
- No cambios globales de CSS antes de baseline/regresión cuando aplique.
- No colores crudos fuera de tokens.
- No duplicar mecanismos de theme.
- No crear variantes visuales ad-hoc.
- No romper el contrato no-scroll.
- Toda decisión debe contemplar mobile, tablet y desktop.
- Mantener separación entre admin, clínica, público y particular cuando el dominio lo requiera.
- Preservar foco visible, navegación por teclado, labels/ARIA cuando aplique, contraste razonable y estados loading/empty/error claros.
- Para dashboards y software administrativo, priorizar layout operativo, densidad legible, ausencia de overflow horizontal y acciones críticas visibles.

## 6. No-Go Explícitos

En PR-VIS-0 queda prohibido:

- Rediseño masivo.
- Cambiar apariencia productiva.
- Tocar frontend.
- Tocar backend.
- Tocar tests.
- Tocar API, auth, DB o migraciones.
- Tocar dependencias, `package.json`, lockfiles, workflows, CI, Playwright o configs.
- Modificar CSS, tokens, componentes, dark mode, badges, filtros, `user-select` o primitivas.
- Ejecutar screenshots, baselines, axe o cross-browser como parte de este PR.
- Cambiar severidades, hallazgos o conteos de las auditorías rectoras.
- Usar este contrato como reemplazo de `total-visual-engineering-audit.md`, `total-software-engineering-audit.md` o `total-engineering-roadmap.md`.

## 7. Criterios De Aceptación

PR-VIS-0 se acepta si:

- `git diff --check` queda verde.
- `git diff --name-only` muestra sólo `docs/**`.
- `docs/audit/design-system-contract.md` existe y contiene el contrato completo.
- Las referencias a `total-visual-engineering-audit.md`, `total-software-engineering-audit.md` y `total-engineering-roadmap.md` son coherentes.
- Las referencias a PR-VIS-0, VIS-P1-001 y Fase 0 son coherentes.
- Los conteos VIS 26 + ENG 26 quedan intactos.
- No se introduce auditoría nueva ni se re-derivan hallazgos.

## 8. Rollback

Rollback docs-only:

- Revertir `docs/audit/design-system-contract.md`.
- Revertir cualquier indexación mínima en `docs/audit/README.md` o `docs/SOURCES_OF_TRUTH.md`.

El rollback no requiere migración, deploy, rebuild, reinicio de servicios, invalidación de cache ni recuperación de datos porque no hay impacto runtime.

## 9. Siguiente PR

El siguiente PR visual recomendado es PR-VIS-1, sin adelantar implementación desde PR-VIS-0.

PR-VIS-1 debe abrirse con scope propio, validaciones propias y autorización acorde a los documentos rectores. Este contrato sólo deja congeladas las reglas de gobierno para que PR-VIS-1 y siguientes operen con una base explícita.

## 10. Estado Final Del Contrato

PR-VIS-0 queda definido como Fase 0 docs-only de gobernanza visual:

- No cambia producción.
- No cambia apariencia.
- No cambia conteos.
- No reemplaza rectores.
- Congela reglas para impedir drift, mega-PRs y cambios visuales sin contrato.
