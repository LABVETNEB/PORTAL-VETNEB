# C26 — Registro de decisiones de gobierno (RM-01)

## Estado base, autorización y alcance

- Rama `docs/dashboard-rm01-c26-decisions-20261029`, sobre `main@504bc2c955ff4ab2c4a5ecd665e900bd8c2375f2` (#1940). `origin/main` coincide a la fecha de esta revisión. Fecha del registro: 2026-10-29.
- Riesgo: R0 (lecturas) y R1 docs-only (este archivo). Sin R2 ni R3. Sin código, tests, baselines, catálogo, CI ni documentos rectores modificados.
- Origen: RM-01 de `dashboard-drv-comparative-measurement.md` §17.11; decisiones de §17.10; camino crítico de §17.12; criterios de §17.13.
- Fuentes leídas: rector `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` (§50, §54, §56.5–§56.7, §57, §58, §62, §63), `dashboard-drv-c26-readiness.md` (§7, §8, §9, tabla de correcciones) y `dashboard-drv-comparative-measurement.md` (§17.7–§17.13). La propuesta v2 (`PROPOSED`, fuera de `main`) sólo se cita a través de esas actas.
- Convención de este documento: **hecho comprobado** (con fuente y método), **recomendación de la auditoría**, **decisión aprobada** (ninguna hasta el §6) y **operación pendiente**.

## 1. Estado de autorización

**Ninguna de las cuatro decisiones está aprobada.** Verificación: `git grep` de `D-11` y `D-01(c)` en `docs/` devuelve sólo las dos actas anteriores, que las registran como PENDIENTES, y la hoja de ruta FSM, donde `D-xx` son defectos de navegación sin relación (§8, DV-B). Ninguna PR fusionada posterior a la auditoría (#1934–#1940) formaliza alguna.

Las «recomendaciones» son las de la auditoría. **No son autorizaciones.** Una decisión pasa a «aprobada» sólo cuando Nico completa su fila del §6 con fecha, alternativa y texto, en un commit de este archivo. El estado se mantiene en **PROPOSED** hasta entonces.

| Decisión | Tema | Estado | Aprueba |
| --- | --- | --- | --- |
| D-11 | Iniciar C26 con C25 en PARTIAL | PROPOSED; pendiente de autorización | Nico |
| D-01(c) | Criterio de cierre de C26 | PROPOSED; pendiente de autorización | Nico |
| D-12 / G12 | Lectura de G12 (§54 vs §58) | PROPOSED; pendiente de autorización. La delegación R3 para ejecutar G12 **no está solicitada ni otorgada** | Nico (decisión documental); Nico, con delegación específica (ejecución R3) |
| D-§57 | Subconjunto de estados de regresión visual | PROPOSED; pendiente de autorización | Nico |

## 2. D-11 — Iniciar C26 con C25 en PARTIAL

**Hechos comprobados.**
- Rector §50 y §54: C26 depende de C25.
- C25 = PARTIAL (measurement §17.8): D1–D5 cerrados; D6 parcial (#1929; quedan V1, V2 con R13, F1, T1, X3, M1, Q1); D7 pendiente (1 252 de 1 842 controles < 44 px en teléfono); D8 parcial (fila 40 cerrada en #1923; cabecera 32/44 contra 36, R13); portales a `body` en forced-colors pendientes.
- G11 está PASSED en CI (measurement §17.8, punto 1). Readiness §7.1 dice lo contrario (DV-A, §8).

| Alternativa | Efecto | Costo / riesgo |
| --- | --- | --- |
| (a) Iniciar C26 con D6/D7/D8 como deuda registrada | No toca A02/A03; deja rector §62.16 en FAILED en el acta | Excepción escrita a §50 |
| (b) Completar antes D7 + D8 + D6-V1/V2 | Cumple §50 literal | 3 o más PR con R13 y rebaseline A02/A03; RM-12 estimado en 16–32 h, alta incertidumbre |

**Recomendación de la auditoría:** (a), registrada en el acta de C26.

**Alcance de la decisión (cláusula obligatoria).** Aprobar (a) autoriza únicamente **iniciar** C26 con deuda de C25 registrada. **No** equivale a declarar C25 terminado, cerrado ni «completo». C25 permanece PARTIAL en toda acta, tabla y resumen que se publique mientras D6, D7 y D8 no cumplan el criterio «C25 completo» de measurement §17.13. Cualquier redacción que presente C25 como cerrado por haberse aprobado D-11 es un cierre falso (riesgo RC-2).

**Riesgos y dependencias.**
- Con (a), §62.16 (táctiles ≥ 44 px) queda FAILED en el acta de programa y el programa no puede cerrarse hasta RM-12.
- Con (b), el camino crítico pasa por RM-12 → RM-13 → RM-14 antes de RM-04 (§17.12).
- Independiente de D-01(c): se puede aprobar una sin la otra.

**Criterios de aceptación (medibles).**
1. El texto aprobado queda en el repositorio con fecha y alternativa elegida.
2. Con (a): el acta de C26 enumera D6, D7 y D8 con sus cifras medidas al iniciar C26, declara C25 = PARTIAL y §62.16 = FAILED. 0 apariciones de «C25 completo» o «C25 cerrado» en el acta.
3. Con (b): D7 = 0 controles < 44 px en teléfono salvo excepciones escritas; D8 cabecera 36 ± 1; D6 sin gaps efectivos de 6 px fuera de excepciones decididas; A02, A03, A05 y A08 en PASSED (measurement §17.13, «C25 completo»).

**Estado: PROPOSED; pendiente de autorización.**

## 3. D-01(c) — Criterio de cierre de C26

**Hechos comprobados.**
- Rector §54, fila C26: cierre «Gates de §58 verdes». Rector §62: 20 criterios de cierre **del programa**, que sólo puede cerrarse cuando se cumplen simultáneamente.
- §62.16 (táctiles ≥ 44 px) y §62.17 (tolerancias de §46) dependen de trabajo de C25 que C26 no ejecuta (readiness, tabla de correcciones, fila I-10).
- La sonda de rendimiento de §56.7 está NOT_AVAILABLE: 0 archivos con `PerformanceObserver`, `layout-shift` o `longtask` en `frontend/e2e` (measurement §17.8, punto 5).

| Alternativa | Efecto | Costo / riesgo |
| --- | --- | --- |
| (c) Cerrar C26 contra los gates de §58; registrar §62 en un acta de programa aparte, sin reescribirlo | Medible hoy; lectura literal de §54 | §62.15–§62.18 quedan con su estado real, posiblemente FAILED |
| Exigir todo §56.6 y §62 para cerrar C26 | C26 y programa coinciden | Exige D7 y RM-10 antes; RM-12 es el camino más largo |
| (b) Reescribir §62 para cerrar el programa | — | **Rechazada** por la auditoría (RC-3): cierre falso |

**Recomendación de la auditoría:** (c). Separar los controles **no elimina ningún requisito obligatorio**: cada uno de los 20 criterios de §62 mantiene su exigencia y su estado canónico; sólo cambia en qué acta se evalúa.

**Reparto de controles (propuesto).**

| Pertenece a | Controles | Fuente |
| --- | --- | --- |
| **Cierre técnico C26** (acta C26) | Gates de §58 aplicables a C26 (G1–G11) con estado canónico y SHA; RM-04 con registro por superficie; RM-05 con capturas aprobadas del subconjunto D-§57; G11 42/42 sobre el head de C26; los cuatro required checks en SUCCESS sobre ese head; E2E Completeness sin flaky sobre ese head | rector §54, §58; measurement §17.13 |
| **Rollout posterior** (D-12) | G12 | rector §58 («Tras C26») |
| **Evaluación del programa DRV** (acta de programa §62, aparte) | §62.1–§62.14 y §62.17 con la evidencia de sus PRs de origen; §62.16 (D7); §62.18 y §62.20 | rector §62 |
| **Compartidos** (se registran en ambas actas con la misma evidencia) | §62.15 (axe; = G11); §62.19 (CI verde; = required checks sobre el head de C26) | rector §58, §62 |

**Consecuencia sobre §62.18 («regresión visual aprobada manualmente»).** Con el subconjunto de D-§57, C26 sólo aprueba 5 de los 9 estados de §57. §62.18 **no** puede registrarse PASSED completo: se registra PASSED sólo para el subconjunto aprobado y NOT_RUN para los estados excluidos, hasta que se capturen. Quien apruebe D-§57 debe aceptar esta consecuencia.

**Riesgos y dependencias.** Riesgo RC-2: prohibido declarar C26 completo con un gate sin estado canónico. Depende de la lectura de G12 (§4). Desbloquea RM-06.

**Criterios de aceptación (medibles).**
1. El acta de C26 lista cada gate de §58 con estado canónico (PASSED, FAILED, BLOCKED, NOT_RUN, NOT_AVAILABLE; AGENTS §6) y SHA del head evaluado.
2. El acta de programa lista los 20 criterios de §62 con estado canónico, sin editar el texto de §62.
3. Cada criterio de §62 figura en exactamente una acta, salvo los dos compartidos, que figuran en ambas con evidencia idéntica.
4. «C26 completo» sólo se declara si se cumple todo el bloque «Cierre técnico C26» de la tabla anterior.

**Estado: PROPOSED; pendiente de autorización.**

## 4. D-12 / G12 — Lectura de G12 y rollout

**Hechos comprobados.**
- Rector §54: C26 cierra con «Gates de §58 verdes». Rector §58: G12 «Tras C26». Tensión sin resolver en el rector (readiness §7.2).
- G12 exige: deploy Live en el commit esperado, las 21 superficies con tenants y usuarios de prueba, evidencia sanitizada, auditoría sin secretos, sin incremento de 4xx/5xx en 48 h.
- Precondiciones reales ausentes (readiness §7.2; measurement §17.7): entorno de staging nombrado como no productivo, tenants de prueba (Clinic A/B), fuente de métricas 4xx/5xx (`docs/ops/METRICS_BASELINE.md` es documental) y delegación R3. G12 es R3 (AGENTS §3.1).

| Alternativa | Efecto | Costo / riesgo |
| --- | --- | --- |
| G12 dentro del cierre de C26 | C26 no cierra sin una operación R3 | C26 queda imposible de cerrar hasta que existan entorno y delegación |
| **G12 como gate de rollout posterior** | C26 cierra con el resto de §58; G12 sigue visible | Riesgo de leer «C26 cerrado» como «listo para producción» |

**Recomendación de la auditoría:** gate de rollout posterior, con G12 BLOCKED explícito en el acta.

**Aprobación documental ≠ autorización operativa.**

| | Aprobación documental (esta decisión) | Autorización operativa R3 (ejecutar G12) |
| --- | --- | --- |
| Qué es | Elegir la lectura de §54/§58 y escribirla | Operación sobre entorno remoto con datos de prueba |
| Clase (AGENTS §3.1) | R1 docs | R3 |
| Quién | Nico, en este archivo | Nico, con delegación específica y actual |
| Debe nombrar | La lectura elegida | Entorno, target, operador, commit/deploy y ventana de 48 h |
| Estado | PROPOSED | **No solicitada ni otorgada** |

Aprobar la decisión **no** delega la ejecución (AGENTS §3.2, §13: autorizar el diseño no delega su ejecución). Tampoco la autoriza una aprobación de C26.

**Estado canónico de G12 en el acta de C26: BLOCKED.** Justificación conforme a AGENTS: §6 reserva BLOCKED para una operación seleccionada que no puede ejecutarse por una precondición realmente ausente (entorno, autorización, permiso externo) y reserva NOT_RUN para lo no seleccionado en este cambio; §17 manda reportar BLOCKED cuando staging no está disponible o autorizado y prohíbe simular PASSED. G12 está en la lista de gates de §58 y sus precondiciones faltan de verdad, por lo que NOT_RUN ocultaría la causa. **NOT_RUN sólo sería correcto** si Nico excluyera G12 expresamente del alcance del acta de C26, y entonces el acta debe seguir nombrando las precondiciones ausentes. En ambos casos G12 nunca figura PASSED sin acta R3 ejecutada.

**Criterios de aceptación (medibles).**
1. El acta de C26 contiene una fila G12 con estado BLOCKED y cada precondición ausente nombrada, o PASSED sólo con acta R3 que cite entorno, commit/deploy, timestamp UTC y artefactos sanitizados (AGENTS §17).
2. 0 frases del acta que declaren el sistema «recuperable», «validado en staging» o «listo para producción» sin esa acta.
3. La lectura elegida queda escrita junto con D-01(c).

**Estado: PROPOSED; pendiente de autorización.**

## 5. D-§57 — Subconjunto de regresión visual

**Hechos comprobados en esta rama.**
- Rector §57: 21 × 13 × 2 × 9 = **4 914** capturas nominales; aprobación manual lado a lado; sin aprobación automática.
- Inventario vigente, leído en `frontend/e2e/helpers/dashboard-geometry-matrix.ts`: `DASHBOARD_GEOMETRY_SURFACE_COUNT = 21`, `DASHBOARD_GEOMETRY_VIEWPORT_COUNT = 13`, `DASHBOARD_GEOMETRY_COMBINATION_COUNT = 273`. El spec `dashboard-g11-axe-matrix.spec.ts` exige en ejecución que la cardinalidad coincida con la constante.
- **Superficies (21):** admin 11 = `admin-hub`, `admin-resumen`, `admin-informes`, `admin-estado`, `admin-clinicas`, `admin-tokens`, `admin-precios`, `admin-sesiones`, `admin-usuarios`, `admin-auditoria`, `admin-mantenimiento`; clínica 10 = `clinic-operaciones`, `clinic-informes`, `clinic-informes-full`, `clinic-logistica`, `clinic-logistica-full`, `clinic-log-metricas`, `clinic-log-rutas`, `clinic-log-visitas`, `clinic-perfil`, `clinic-tokens`. Verificado por lectura textual del archivo (no se ejecutó el módulo: este checkout no tiene `node_modules`).
- **Viewports (13):** 1920×1080, 1600×900, 1440×900, 1366×768, 1280×720, 1024×768, 834×1194, 768×1024, 430×932, 412×915, 390×844, 375×812, 360×800.
- Catálogo: la cohorte `visual-linux` existe y contiene `visual-regression-{authenticated,public,stress}.spec.ts` con snapshots Chromium-Linux (`frontend/e2e/suites/catalog.ts`). El spec autenticado cubre un número reducido de rutas, no la matriz 21 × 13.
- Cobertura actual (measurement §17.8, punto 6): 546 registros geométricos de estado inicial (273 × 2 temas).
- **No verificado:** qué celdas de la matriz 21 × 5 cubren hoy los snapshots visuales; lo establece RM-05 al iniciar.

**Cuenta de la matriz propuesta:** 21 × 13 × 2 × 5 = **2 730** celdas nominales (273 combinaciones × 2 temas = 546 por estado; 546 × 5 = 2 730). Los cinco estados están en ambas listas del rector (§56.5 y §57), de modo que la discrepancia entre ellas (§8, DV-C) no afecta al subconjunto.

| Alternativa | Capturas nominales | Riesgo |
| --- | --- | --- |
| Los 9 estados de §57 | 4 914 | Sin baseline para hover, selección, loading ni disabled; baselines Linux nuevas |
| Inicial + filtros activos + error + empty | 2 184 | Sin cobertura de foco |
| **Inicial, filtros activos, error, empty y foco** | **2 730** | `hover`, `selección`, `loading` y `disabled` quedan fuera de C26 |

**Recomendación de la auditoría:** los cinco estados `initial`, `active filters`, `error`, `empty` y `focus`. Se conservan sin cambios.

**Tratamiento verificable de cada celda (obligatorio en el acta de RM-05).** Cada una de las 2 730 celdas recibe exactamente una clase; sólo la primera cuenta como captura:

| Clase | Significado | Cómo se registra |
| --- | --- | --- |
| Capturada y aprobada | Existe el archivo, con aprobación manual lado a lado y SHA del head | Es la única que puede figurar PASSED |
| FAILED | Existe y la comparación o la aprobación falla | FAILED con la causa |
| BLOCKED | El estado es alcanzable pero falta una precondición (fixture que no lo produce, entorno) | BLOCKED con la precondición nombrada |
| Exención documentada | El estado no existe por diseño en esa superficie (p. ej. `filtros activos` en una superficie sin barra de filtros) | Lista aparte con superficie, estado y razón, **aprobada por Nico**. No se cuenta como captura ni como PASSED; se resta del denominador sólo si está aprobada. Sin aprobación, la celda es BLOCKED |
| NOT_RUN | Estado no seleccionado en esta fase (`hover`, `selección`, `loading`, `disabled`) | NOT_RUN con el motivo «fuera del subconjunto D-§57» |

Ningún archivo inexistente se registra como PASSED, y ninguna celda inaplicable se sustituye por otro estado.

**Riesgos y dependencias.**
- R17-4: ninguna medición de estados interactivos tras #1930–#1934.
- Catálogo y censos compartidos: RM-04, RM-05 y RM-16 van en serie.
- Baselines R13 y Linux-only (dispatch de `visual-linux`). Artefactos fuera de `docs/` y de `test-results/`, sin datos reales (AGENTS §9, §17).
- Consecuencia para §62.18 en §3.

**Criterios de aceptación (medibles).**
1. RM-05 publica la matriz 21 × 5 por tema y viewport con la clase de cada celda y el conteo de capturas producidas frente a 2 730.
2. Capturas aprobadas = celdas «Capturada y aprobada»; cada una con SHA del head.
3. 0 aprobaciones automáticas de diferencias (rector §57).
4. Los cuatro estados excluidos figuran NOT_RUN con el motivo.
5. La lista de exenciones está cerrada y aprobada antes de declarar el denominador.

**Estado: PROPOSED; pendiente de autorización.**

## 6. Bloque de aprobación (a completar por Nico)

El registro no cambia de estado hasta que cada fila tenga fecha, alternativa y texto. Una aprobación en el chat no deja traza en el repositorio. Este bloque se deja vacío a propósito.

| Decisión | Estado | Alternativa elegida | Fecha | Texto de la aprobación |
| --- | --- | --- | --- | --- |
| D-11 | PROPOSED | — | — | — |
| D-01(c) | PROPOSED | — | — | — |
| D-12 / G12 (lectura) | PROPOSED | — | — | — |
| D-12 / G12 (delegación R3) | No solicitada | — | — | — |
| D-§57 | PROPOSED | — | — | — |

## 7. Dependencias de RM-04, RM-05 y RM-06

| ID | Qué necesita | Estado hoy |
| --- | --- | --- |
| RM-04 (sonda de rendimiento §56.7) | D-11 aprobada; RM-02 | Bloqueada por D-11. #1935 está en `main` (`57146f42`, 2026-10-28). El criterio de RM-02 (0 flaky en dos runs completos consecutivos de E2E Completeness sobre `main`) **no se cumple todavía con evidencia**: los dos últimos runs en `main` son programados (2026-10-20 y 2026-10-27, ambos SUCCESS) y anteriores a #1935 |
| RM-05 (regresión visual) | D-§57 aprobada; RM-04 (catálogo en serie); R13 para baselines | Bloqueada por D-§57 y RM-04 |
| RM-06 (acta de cierre) | D-01(c) y la lectura de G12 aprobadas; RM-04, RM-05, RM-02 | Bloqueada por las dos decisiones y por RM-04/RM-05 |

Con D-11 = (b), el camino crítico es RM-01 → RM-12 → RM-13 → RM-14 (V1, V2) → RM-04 → RM-05 → RM-06 (measurement §17.12).

PRs fusionadas relevantes revisadas: #1934–#1940. Ninguna resuelve una dependencia de RM-04/05/06. #1936 (RM-10, anuncios de paginación) cierra un ítem independiente de la hoja de ruta; #1935 es el prerrequisito de RM-02.

Completar este registro **no autoriza abrir ninguna PR** de RM-04, RM-05 ni RM-06: cada una requiere su propio pedido de Nico.

## 8. Divergencias y riesgos residuales

Ninguna fuente rectora ni acta se editó en este registro (fuera del scope RM-01). La corrección de DV-A y DV-C corresponde a RM-03, que requiere autorización propia para tocar fuentes rectoras.

| ID | Ubicación exacta | Naturaleza | Consecuencia | Tratamiento recomendado | Dependencia para resolver |
| --- | --- | --- | --- | --- | --- |
| **DV-A** (= DV-9 de measurement §17.9) | `dashboard-drv-c26-readiness.md` §7.1 (línea 206: «El inicio de C26 sigue bloqueado por G11»), §10 (línea 281: «bloqueado por G11»), §11.1 (línea 415: «Faltan G11 en PASSED»); contra measurement §17.8 punto 1 y §17.9 DV-9: G11 PASSED en CI | Estado obsoleto en un acta | Un lector de readiness concluye que C26 está bloqueado por G11 y omite que lo bloquean sólo las decisiones y la sonda | Bloque de actualización fechado en readiness, sin reescribir el histórico | RM-03; autorización de Nico para editar readiness |
| **DV-B** (colisión de identificadores `D-xx`) | `docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md` línea 58 («D-01..D-11 + D-12»), §D-01 (línea 749), §D-11 (línea 865): defectos de navegación; contra readiness §7 (línea 179) y measurement §17.10: decisiones DRV con los mismos códigos. D-11 y D-12 existen con significados distintos | Dos espacios de nombres con el mismo prefijo | Una cita sin documento («D-12») es ambigua; D-12 = restauración de Clínica muerta (FSM) o G12 (DRV) | En este documento, citar siempre el documento junto al código. Para futuros textos, proponer un prefijo propio para decisiones DRV | Decisión de Nico sobre la convención; RM-03 si se renombra en las actas |
| **DV-C** (estados de regresión visual) | Rector §56.5 (línea 2015: 8 estados, sin `disabled`) contra §57 (línea 2056: 9 estados, con `disabled`; total 4 914) | Discrepancia interna del rector | El total nominal depende de qué lista se lea (8 → 4 368, 9 → 4 914). **No afecta a D-§57:** los cinco estados propuestos están en ambas listas | Tomar §57 como referencia nominal (tabla con total explícito); enmienda docs-only del rector que unifique ambas | Enmienda del rector (D-09 de la hoja de ruta v2), con autorización propia; RM-03 |

**Riesgos residuales.**
- No se verificó el estado de CI de `main` posterior a #1940.
- Las estimaciones de esfuerzo de la auditoría tienen una incertidumbre de ±50 %.
- No se verificó qué celdas de la matriz cubren hoy los snapshots visuales (§5).
- El inventario de superficies se leyó del código fuente sin ejecutar el módulo.

## 9. Validaciones

| Gate | Estado |
| --- | --- |
| `git diff --check` (archivo sin seguimiento: verificado por `git diff --no-index --check`) | PASSED |
| Único archivo modificado en la rama | PASSED: este archivo, sin seguimiento |
| Coherencia con rector, readiness y measurement | Verificada por lectura; citas por sección y línea |
| Gates de código (lint, typecheck, build, E2E) | NOT_RUN: sin cambios de código |
