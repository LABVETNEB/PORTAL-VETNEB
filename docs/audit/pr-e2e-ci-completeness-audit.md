# PR-E2E-CI-COMPLETENESS Audit

## Metadata

| Campo | Valor |
| --- | --- |
| Plan | Plan B slot 6/18 |
| PR consolidado | `PR-E2E-CI-COMPLETENESS` |
| Absorbe | `PR-CI-3` |
| Brecha | `GAP-TEST-1` |
| Rama | `ci/pr-e2e-ci-completeness` |
| Base | `main@b7332c9d877e4ddc7b6dc4faf74aeaea9fbe6aac` |
| Riesgo autorizado | R2 — workflows, contratos y documentación del slot |
| Lifecycle status | `PENDING_LIVE_EVIDENCE` |
| PR auxiliares | 0 |
| Slots restantes después del merge | 12 |

## Baseline y causa raíz

El baseline se capturó con working tree limpio, sin PRs abiertas, en el commit
esperado. Los 72 specs tracked estaban catalogados exactamente una vez y la
partición era correcta, pero la ejecución automática no lo era:

| Cohorte | Specs | Ruta automática antes |
| --- | ---: | --- |
| `ci` | 43 | `Frontend CI` → `e2e:ci` |
| `extended` | 24 | Ninguna |
| `evidence` | 2 | Ninguna |
| `visual-linux` | 3 | Ninguna completa; existía un workflow manual con lista literal |
| `full` | 72 | Ninguna |

La causa raíz fue separar correctamente la taxonomía sin completar su
orquestación durable: el catálogo demostraba
`ci ∪ extended ∪ evidence ∪ visual-linux == full`, pero ningún contrato
relacionaba esa unión con comandos descubiertos estructuralmente en workflows
automáticos.

## Diseño e implementación

Se adoptó el [RFC de completitud E2E](./pr-e2e-ci-completeness-rfc.md):

1. `Frontend CI` conserva el gate rápido `e2e:ci` de 43 specs y reconoce el
   workflow de completitud como impacto frontend.
2. `E2E Completeness` se dispara por cambios focales de PR, dispatch manual y
   schedule semanal sobre Ubuntu.
3. El job instala el workspace congelado, verifica catálogo, construye con el
   fixture local, audita superficie pública, instala Chromium y ejecuta una
   única invocación `e2e:full` contra el bundle de producción.
4. Los artifacts se suben solo ante fallo; teardown, higiene de source y
   limpieza de outputs se ejecutan siempre.
5. Un contrato parser-backed deriva eventos, jobs y comandos desde YAML, cruza
   cohortes con el catálogo y prueba rutas negativas mediante mutación en
   memoria.

No se modificaron catálogo, runner, Playwright config, manifests, lockfile,
specs funcionales, fixtures, helpers ni snapshots.

## Cobertura antes y después

| Cohorte | Specs | Ruta workflow después | Evento |
| --- | ---: | --- | --- |
| `ci` | 43 | `Frontend CI` → `e2e:ci` | Todo PR a `main`; push focalizado |
| `extended` | 24 | `E2E Completeness` → `e2e:full` | PR focalizado; dispatch; schedule |
| `evidence` | 2 | `E2E Completeness` → `e2e:full` | PR focalizado; dispatch; schedule |
| `visual-linux` | 3 | `E2E Completeness` → `e2e:full` en Ubuntu | PR focalizado; dispatch; schedule |
| `full` | 72 | `E2E Completeness` → `e2e:full` | PR focalizado; dispatch; schedule |

```text
BEFORE: 43/72 specs con ruta automática completa
AFTER:  72/72 specs con ruta automática completa
```

## Contratos positivos y negativos

La prueba positiva local deriva `ci` desde `frontend-ci.yml`, `full` desde
`e2e-completeness.yml` y verifica que la cobertura resultante coincide
exactamente con los 72 paths de `full`.

Las pruebas negativas no crean archivos persistentes ni PRs auxiliares:

- reemplazar en memoria `e2e:full` por `e2e:ci` deja exactamente 29 specs sin ruta;
- `extended`, `evidence` y `visual-linux` quedan demostrablemente descubiertas
  si se elimina el full gate;
- un spec ficticio catalogado en `extended/full` sin workflow automático es
  reportado como faltante;
- el contrato existente rechaza catálogos incompletos o duplicados en memoria;
- workflow security parsea YAML y rechaza permisos o actions fuera de policy.

## Workflow security

El workflow declara `permissions: contents: read`, concurrency con cancelación,
timeout explícito, Node 24, PNPM 11.13.0, instalación frozen y únicamente
actions allowlisted pinneadas a SHA completa. El flag
`VETNEB_E2E_PRODUCTION_RUNNER=1` aparece una sola vez, después del build y solo
en el step `e2e:full`.

## Evidencia local

| Validación | Estado |
| --- | --- |
| Contratos focales de catálogo, workflows, production runner y workflow security | `PASSED` — 79/79 |
| Resto de gates obligatorios del slot | `PENDING` |
| `e2e:full` real Linux | `PENDING_LIVE_EVIDENCE` |

## Evidencia remota

| Evidencia | Estado |
| --- | --- |
| PR única | `PENDING` |
| Head SHA | `PENDING` |
| `e2e-full-completeness` run/job | `PENDING_LIVE_EVIDENCE` |
| Required checks y heavies | `PENDING_LIVE_EVIDENCE` |
| Review threads | `PENDING` |
| Merge state | `PENDING` |

No se declarará cierre hasta observar el job completo exitoso en esta misma PR.

## Rollback

Revertir en conjunto el workflow de completitud, la ampliación del detector
frontend, los contratos y la documentación de este slot. No hay rollback de
datos, settings, required checks, producción ni staging.

## Riesgos residuales

- La suite completa añade consumo semanal y en PRs que cambian su
  infraestructura; no aumenta el costo de PRs normales sin impacto E2E.
- Firefox/WebKit permanecen fuera de alcance y siguen siendo una brecha
  distinta.
- Los hallazgos funcionales que revele `e2e:full` deben corregirse sin debilitar
  assertions ni snapshots.

## Estado del slot

```text
PLAN B SLOT 6/18: PENDING_LIVE_EVIDENCE
PR-E2E-CI-COMPLETENESS: PENDING_LIVE_EVIDENCE
PR-CI-3: pending live evidence
GAP-TEST-1: pending live evidence
PR AUXILIARES: 0
SLOTS RESTANTES DESPUÉS DEL MERGE: 12
```
