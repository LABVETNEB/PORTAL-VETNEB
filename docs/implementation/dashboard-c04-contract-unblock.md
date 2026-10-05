# C04 · Resolución contractual docs-only del ordenamiento por columna

## Base y alcance

- Base: `main` / `origin/main` en `8f68c9d540c9b20fb9dbbd8244f6f1164277de95` (#1820, C07).
- Rama: `docs/dashboard-c04-contract-unblock-v2`, creada desde `main`, sin worktree adicional.
- Se preservan los untracked `frontend/AGENTS.md` y `frontend/CLAUDE.md`, los 5 stashes y el worktree principal.

Es una enmienda docs-only, la fase 1 de la secuencia de C04. No toca frontend runtime, backend, API, SQL, DB, schema, tests, workflows, dependencias, C05 ni C08+.

## Auditoría de la rama documental previa

| Campo | Valor |
|---|---|
| `DOC_BRANCH_EXISTS` | Sí: `docs/dashboard-c04-contract-unblock` |
| `DOC_HEAD` | `d3846be4ea2df1612151ed7456ba55832f820318` |
| `DOC_BASE` | `21971134` (#1818) |
| `DOC_AHEAD` / `DOC_BEHIND` | 1 / 2 (no incluye #1819 C06 ni #1820 C07) |
| `DOC_DIFF_PATHS` | rector + `docs/implementation/dashboard-c04-contract-unblock.md` |
| `DOC_STILL_VALID` | Parcial |

Lo que sigue vigente de esa rama:
- la excepción C04 en §7.8, §11 y §17;
- el contrato server-side de 7 puntos;
- la nota de P2-09 y R15.

Lo que quedó obsoleto:
- Afirma que C06 está BLOCKED en una rama local; C06 y C07 ya están COMPLETE en `main`.
- Deja NEXT_SLOT sin asignar; Nico ya fijó la secuencia de fases.
- No nombra el estado `BLOCKED_BY_SERVER_SORT_CONTRACT`.
- No prohíbe explícitamente el orden de ventana acotada.
- Exige móvil como gate fijo sin evidencia de cabeceras móviles.

Por eso el cambio se reimplementó sobre `main`. No hubo merge, rebase ni cherry-pick.

## Contradicciones resueltas

| ID | Contradicción en `main` | Resolución |
|---|---|---|
| A | §7.8, §11 y §17 prohíben cambiar el «ordenamiento» en cualquier PR del roadmap, aunque el objetivo de C04 (§50) es el ordenamiento por columna (P2-09). | Se agrega una excepción C04 única y estrecha. Sólo C04, en su PR de prerrequisito server-side y en su PR frontend, puede introducir orden por columna solicitado explícitamente, mediante un contrato global, estable y allowlisted. El PR de prerrequisito puede agregar parámetros de orden opcionales; sin ellos, todo es idéntico al histórico. Ningún otro PR puede invocar la excepción. |
| B | §50 dice `C04 = NEXT_SLOT`, mientras la Actualización C06 de la cabecera dice `C04 = BLOCKED`. | El estado único vigente es `C04 = BLOCKED_BY_SERVER_SORT_CONTRACT` en §50, en P2-09, en §54 y en las aclaraciones C05/C06. Los bloques históricos se aclaran, no se reescriben. |
| C | No había una prohibición explícita del orden falso. | §7.8 declara `frontend page-only sort = PROHIBITED` y `bounded-window sort presented as global = PROHIBITED`. |

## Evidencia de la auditoría (sobre `main @ 8f68c9d5`)

| Colección | Modelo de datos | Orden en cliente sería |
|---|---|---|
| Auditoría, Informes admin, Clínicas, Usuarios y roles, Sesiones, Intentos fallidos, visor de workflow | servidor, con `limit`/`offset` (con `total` o `hasMore`) | sólo de página |
| Logística rutas y visitas | servidor, con `offset`/`limit` en la URL y sin total | sólo de página |
| Tokens admin | ventana acotada + «Cargar más», sin total | sólo de ventana |
| Tokens clínica | ventana ≤ 36 (`TOKENS_FETCH_LIMIT_MAX`) | sólo de ventana |
| Informes clínica | ventana de 100. El endpoint tiene tope `parsePositiveInt(limit, 50, 100)` y no informa total ni `hasMore`, así que no se puede demostrar que la lista esté completa | sólo de ventana |
| Precios, Mantenimiento | formularios o tarjetas, sin cabecera de columnas | no aplica |

Ninguna ruta de `server/routes` en `main` acepta parámetros de orden. El grep de `sort|orderBy|direction` y de `query.(sort|order)` da 0 resultados.

## Cambios en el rector

| Sección | Cambio |
|---|---|
| Cabecera | Aclaraciones en los bloques C05 y C06. Nuevo bloque «Actualización C04 (contrato) · 2026-10-05». |
| §7.8 | Se conserva íntegra la prohibición. Se agregan: «Excepción C04 (única y estrecha)», «Ordenamientos prohibidos también para C04» y «Contrato de ordenamiento C04», con la precondición de desbloqueo. |
| §11 | El ordenamiento sigue siendo invariante salvo la excepción C04, y nunca puede ser sólo de página ni de ventana. |
| §17 | Se conserva la prohibición, salvo la excepción C04. La query, el submit, el ranking y la membresía de los superbuscadores no cambian. |
| §30 (P2-09) | Nota: lo resuelve C04; hoy BLOCKED_BY_SERVER_SORT_CONTRACT. |
| §50 | C04 pasa de NEXT_SLOT a `BLOCKED_BY_SERVER_SORT_CONTRACT`. Dependencias: C01 + el contrato server-side. |
| §54 | «C01–C03: gates propios», más los criterios de C04 separados en (a) prerrequisito backend-only y (b) frontend. |
| §59 / §60 | Nuevo riesgo R15 y su mitigación. |

## Precondición de desbloqueo

C04 frontend se desbloquea sólo cuando existe en `main` un contrato server-side de ordenamiento global, estable y allowlisted para al menos un adopter real, con paginación consistente. Eso significa, como mínimo:
- un endpoint real;
- una clave ordenable;
- dirección ascendente y descendente;
- orden global;
- paginación estable;
- todo validado sobre `main` después de la integración.

Los nombres de los parámetros no se fijan aquí; los define el PR backend según la convención real del repositorio.

## Secuencia

1. **Esta enmienda (docs-only).**
2. PR backend-only del contrato. Debe reauditar la rama local `feat/dashboard-c04-server-sort-contract` (`dff443d4`) contra `main`, sin transportar historial.
3. Validación del contrato publicado, sobre `main`.
4. PR frontend de C04 (orden global real).
5. C05 sigue BLOCKED y separado.

## Estado del roadmap

| Slot | Estado |
|---|---|
| C01–C03, C06, C07 | COMPLETE (sin cambios) |
| C04 | **BLOCKED_BY_SERVER_SORT_CONTRACT** |
| C05 | BLOCKED, con R13 activo (sin cambios) |
| C08+ | NOT_STARTED |
| NEXT_SLOT | prerrequisito server-side de C04 (fase 2) |

## Validación

- Guard que lee el rector (`test/unit/ui/dashboard/dashboard-operational-contract-baseline.test.ts`): ver el reporte de cierre. No se agregaron, quitaron ni renumeraron encabezados `### <n>`.
- `git diff --check`: ver el reporte de cierre.
- No se ejecutaron Playwright, build ni la suite completa, porque el cambio es docs-only.

## Hallazgo preexistente fuera de scope

§55 asocia `PR-BUG-01` (la política de renderizado de la barra) al hallazgo `P2-09`, que es el de ordenamiento. Parece un identificador mal asignado y no se corrigió aquí.

## Riesgo residual

La excepción es documental. Su cumplimiento real depende de los tests del PR backend (default histórico, allowlist, estabilidad y paginación) y del PR frontend (que no haya orden local presentado como global).

## Rollback

Revertir los dos archivos de documentación. No hay runtime, datos ni backend que revertir.
