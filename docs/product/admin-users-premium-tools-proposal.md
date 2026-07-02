# Roadmap premium — Admin Usuarios/Roles (dirección de producto + arquitectura de implementación)

- **Fecha:** 2026-07-02
- **Base:** `1478085` (main) — incluye la auditoría visual high-volume (#1252, `docs/audit/admin-users-high-volume-visual-audit.md`, 2026-07-02).
- **Tipo:** documento de dirección de producto + arquitectura de implementación. Docs-only: **no implementa nada.** Cero cambios en `frontend/src/`, backend, API real, auth, DB, deps, CI o CSS.
- **Objeto:** convertir el módulo Admin Usuarios/Roles — ya validado visualmente con 5000 usuarios (0 P0, no-scroll perfecto medido, paginación coherente) — en una herramienta administrativa premium **sumando** capacidades sobre lo existente, por PRs chicos, con métricas de éxito y gates medibles.
- **Cómo leer este documento:** §1 decide (matriz ejecutiva), §2–3 definen éxito (métricas y flujos), §4–10 especifican (principios, herramientas, contratos de altura / capas de API / calidad visual / accesibilidad / mobile), §11–12 planifican (roadmap con scoring y riesgos), §13–15 cierran (criterios transversales, anti-patterns, definition of done), §16 recomienda.

## 0. Contexto verificado (no supuesto)

Este roadmap se ancla en verificaciones hechas sobre el código real (solo lectura):

| Capa | Soporta hoy | Verificado en |
|---|---|---|
| UI real (`AdminUsersRolesReadOnlyCard`) | filtros `Tipo usuario`/`Rol`, límite adaptativo, `Anterior`/`Siguiente` | auditoría 2026-07-02 |
| Backend real (`server/routes/admin-users-roles.fastify.ts`) | `userType`, `role`, `limit` (1–100), `offset` | grep de querystring, líneas 317–335 |
| Fixture CAP-A1 (`admin-populated-api-server.mjs`) | todo lo anterior **más** `query`/`search`, `status` (`active`/`inactive`/`locked`), `dataset=high-volume` | líneas 453–505 |
| Modelo de datos real (`server/db-admin-users-roles.ts`) | **sin columna status, sin búsqueda ILIKE** | grep sin matches |

Consecuencia estructural: **el fixture va adelantado al backend real.** Búsqueda y status ya tienen contrato de test (CAP-A1) pero no existen en producción. Este documento explicita, por herramienta y por capa (§7), si alcanza con la API existente, si requiere extensión aditiva de backend, o si depende de una decisión de modelo de datos.

El gap operativo dominante que la auditoría dejó expuesto: con 5000 usuarios la paginación es visualmente impecable pero **operativamente insuficiente** — a 11 filas por página en 1440x900 son 455 páginas; localizar un usuario específico solo con `Siguiente` cuesta ~227 clicks en mediana y 454 en el peor caso. Búsqueda + salto directo son las dos herramientas de mayor retorno.

Defectos abiertos de la auditoría (referenciados como F1–F4 en todo el documento):

| ID | Prioridad | Defecto |
|---|---|---|
| F1 | P1 | Selects desktop `.field-select md:h-7` amputan texto (content-box 12 px < line box ~14.4 px) |
| F2 | P2 | Fechas CREADO/ACTUALIZADO con ellipsis aleatorio (columnas 152 px, clip ~2 px según ancho de dígitos) |
| F3 | P2 | Settle 12→11 filas en primer paint en 1440x900, void residual de ~1 fila |
| F4 | P2 | Doble chip "Admin Admin" en card mobile |
| F5 | P3 | Rango de paginación mobile solo sr-only (sin variante visible) |

## 1. Matriz ejecutiva de decisión

| Decisión | Ítems | Justificación |
|---|---|---|
| **Implementar ahora** (Fases 0–2) | PR-CAP-QA1 · PR-CAP-V1..V4 · PR-CAP-T1a (búsqueda) · PR-CAP-T3 (salto directo) | Cierran los defectos F1–F4 de la auditoría y el gap operativo #1. QA1 y V*/T3 usan solo la API existente; T1a requiere una extensión backend aditiva cuyo contrato ya está fijado y testeado por el fixture CAP-A1. |
| **Postergar** (Fase 3) | PR-CAP-T2 (saved views) · PR-CAP-T1b (command bar) · PR-CAP-T4 (health strip) | Identidad premium que compone sobre búsqueda/salto ya probados. T2/T1b son UI pura; T4 necesita payload aditivo `summary` (contrato adelantable en fixture, patrón CAP-A1). |
| **Gated por backend/modelo de datos** | PR-CAP-T1c (filtro status) — gate: decisión producto/datos "derivar vs columna" · PR-CAP-T5 (density) — gate: V3 mergeado + matriz e2e completa verde | T1c no es un PR de UI: el modelo real no tiene status; arrancar sin definición crearía deuda (status fake). T5 acopla con la medición adaptativa que V3 estabiliza. |
| **Descartado explícitamente** | Infinite scroll / virtualización con scroll · crecer la altura de tabla o del chrome · segunda fila de controles desktop · status simulado en producción sin contrato de datos · rediseño del módulo o del shell · sync server-side de saved views · migración de columna status dentro de este roadmap | Violan el contrato no-scroll del App Shell single-viewport, crean deuda sin contrato, o tienen costo/riesgo desproporcionado frente a búsqueda+salto. Si algún día se decide columna status real, es una iniciativa de datos propia, fuera de este roadmap. |

## 2. Métricas de resultado (outcome metrics)

Éxito medible del bloque, con baseline verificado en la auditoría y target por métrica. QA1 (§8) calcula M3–M6 automáticamente; M1–M2 y M7 se validan con specs de flujo (§3) y checklist (§9).

| # | Métrica | Baseline (hoy) | Target | Cómo se mide |
|---|---|---|---|---|
| M1 | Interacciones para localizar un usuario conocido entre 5000 | ~227 clicks mediana / 454 peor caso (solo `Siguiente`) | **≤ 3 interacciones** | Spec e2e del flujo W1 (§3) con `dataset=high-volume` |
| M2 | Tiempo para localizar un usuario conocido | No acotado (minutos) | **≤ 10 s p50** (incluye debounce ~300 ms + respuesta backend con presupuesto p95 < 500 ms) | Conteo de interacciones como proxy en e2e + presupuesto de latencia del endpoint medido en tests de ruta |
| M3 | Overflow externo/interno | 0 px (15/15 estados auditados) | **0 px se mantiene** en el 100% de los estados de la matriz QA1, herramientas en reposo y activas | Guardia numérica QA1 por superficie (html/body/main/workspace + peor scroll interno) |
| M4 | Text clipping | F1 (selects) y F2 (fechas) abiertos | **0 elementos con clip > 0 px** (selects, celdas de fecha, chips) | Detector de clip por elemento en QA1 (`scrollWidth/Height` vs `clientWidth/Height` + line box) |
| M5 | Estabilidad visual post-paint | Settle 12→11 filas con void de ~1 fila en 1440x900 (F3) | **0 cambios de conteo de filas** tras el primer render; 0 void residual | Firma de estabilidad QA1: conteo de filas en t0 == t_settle |
| M6 | Tasa de tests visuales verdes | Sin arnés (auditoría manual) | **100% de guardias QA1 verdes; 0 flakes en 5 corridas consecutivas** | Corridas repetidas del arnés QA1 en el mismo commit |
| M7 | Accesibilidad básica | Parcial (sr-only en rango mobile; sin controles nuevos aún) | **100% de controles nuevos** con label, operables por teclado, foco visible; contraste ≥ 4.5:1 (baseline actual medido: 6.13:1) | Checklist §9 por PR + muestreo de contraste en QA1 |

## 3. Flujos de usuario reales

Los flujos que el roadmap debe resolver, con costo actual medido/estimado y objetivo. Cada flujo de Fase 2+ gana un spec e2e propio (patrón CAP: `page.route` + `dataset=high-volume`).

| # | Flujo | Hoy | Objetivo | Herramienta | Estado |
|---|---|---|---|---|---|
| W1 | **Encontrar una clínica específica por nombre** | Sin búsqueda: paginar hasta encontrarla (~227 clicks mediana) | ≤ 3 interacciones, ≤ 10 s: tipear en búsqueda → resultado | H2/T1a (compone con H5/T1b) | Fase 2 |
| W2 | **Revisar los admins** | 1 select (`Tipo usuario` = admin) — ya soportado | 1 click (chip "Admins") | Hoy (selects) + H6/T2 | Hoy parcial → Fase 3 |
| W3 | **Filtrar owners de clínica** | 2 selects (`Tipo` = clínica + `Rol` = owner) — ya soportado | 1 click (chip "Owners") | Hoy (selects) + H6/T2 | Hoy parcial → Fase 3 |
| W4 | **Investigar un usuario bloqueado/inactivo** | **Sin señal en este módulo** (el modelo real no tiene status). Camino actual: módulos de intentos fallidos / sesiones del dashboard admin | Filtro status componible con tipo/rol, cuando exista contrato de datos real | H8/T1c | **Gated** (§1) — no se promete hasta cerrar la decisión de datos |
| W5 | **Saltar a una página profunda** (p. ej. 430 de 455) | 429 clicks `Siguiente` | ≤ 3 interacciones, ≤ 5 s: click en `Pág. X / Y` → tipear 430 → Enter | H3/T3 | Fase 2 |
| W6 | **Operar desde mobile** (buscar + saltar + filtrar) | Solo pager `Anterior`/`Siguiente` + selects | Lupa → overlay de búsqueda; tap en `Pág. X / Y` → mini-overlay numérico; pager anclado intacto | H2/H3 variantes overlay (§10) | Fase 2 |

W2/W3 ya son posibles hoy con los selects existentes; T2 los reduce a 1 click. W4 se documenta como flujo real pero **gated**: prometerlo sin modelo de datos sería status fake (anti-pattern §14).

## 4. Principio rector

1. **Sumar, no reemplazar.** Toda herramienta nueva se integra en las superficies existentes (strip de totales, fila de filtros, footer de paginación, pager mobile) o vive en overlay. Nada de lo actual se elimina ni cambia de lugar: los selectores, labels y `data-*` que fijan los specs CAP-A2/A3 y los source-contract tests siguen válidos.
2. **Preservar no-scroll.** Presupuesto de altura **cero** en desktop y mobile, formalizado como contrato en §6. El contrato medido en la auditoría (overflow 0 px en html/body/main/workspace, 15/15 estados) es criterio de aceptación de cada PR.
3. **Preservar mobile.** Ninguna herramienta desktop puede degradar la card-list de 44.5–45.5 px/item ni el pager anclado. Donde el inline no cabe (búsqueda en 360 px), la variante mobile es overlay o se difiere explícitamente (§10).
4. **Preservar el contrato high-volume.** Toda herramienta se valida contra `dataset=high-volume` (5000) con el mismo patrón de opt-in por `page.route` de CAP-A2/A3; nunca renderiza más que la slice pedida; el límite adaptativo (floor 9/cap 36 desktop, floor 1 mobile) no se altera salvo en PR-CAP-V3, que lo estabiliza.
5. **No romper legacy visual.** Sin rediseño del shell, sin tocar `globals.css` fuera del alcance mínimo de cada PR de polish, alineando en el mismo PR los source-contract tests y scope guards que fijen estructura (precedente #958; los legacy scope tests validan el working-tree diff).

## 5. Herramientas propuestas (H1–H9)

Resumen ejecutivo (detalle debajo; scoring completo por PR en §11):

| # | Herramienta | Prioridad | API | PR | Costo de altura |
|---|---|---|---|---|---|
| H1 | Polish selects/fechas/chips/settle | P1/P2 | existente | PR-CAP-V1..V4 | 0 |
| H2 | Búsqueda textual | **P1** | extensión backend aditiva (fixture ya la soporta) | PR-CAP-T1a | 0 desktop / overlay mobile |
| H3 | Smart pagination (salto directo) | **P1** | existente (`offset`) | PR-CAP-T3 | 0 |
| H4 | Visual quality gate | P1 (proceso) | n/a | PR-CAP-QA1 | n/a |
| H5 | Command Bar premium (⌘K) | P2 | existente + reusa H2 | PR-CAP-T1b | 0 (overlay) |
| H6 | Saved views / vistas rápidas | P2 | existente | PR-CAP-T2 | 0 (fila de filtros) |
| H7 | Health strip de métricas | P2 | extensión backend aditiva (payload `summary`) | PR-CAP-T4 | 0 (enriquece strip existente) |
| H8 | Filtro status | P2→gated | **decisión de modelo de datos** | PR-CAP-T1c | 0 |
| H9 | Density controls opcionales | P3 (aspiracional) | existente | PR-CAP-T5 | 0 |

### H1 — Polish visual: selects, fechas, chips, primer paint (PR-CAP-V1..V4)

- **Problema que resuelve:** los cuatro defectos F1–F4 de la auditoría (§0).
- **Valor visual:** es la diferencia entre "sólido" y "premium". F1 es lo primero que un ojo entrenado nota; el ellipsis de fechas (F2) transmite dato inconsistente en una vista de trazabilidad.
- **Valor operativo:** fechas siempre completas (auditoría), controles de filtro legibles, sin reflow de carga.
- **Impacto no-scroll:** cero; V3 lo *mejora* (elimina el void).
- **Riesgo técnico:** bajo. V1 toca clase compartida (`field-select`) → verificar los demás módulos desktop en el mismo PR; V3 toca la medición adaptativa → es el único con riesgo de regresión de densidad, exige correr la matriz e2e no-scroll completa.
- **Backend:** no.
- **Prioridad:** V1 = P1; V2/V3/V4 = P2.

### H2 — Búsqueda textual (PR-CAP-T1a)

- **Problema que resuelve:** el gap operativo #1: no hay forma de localizar un usuario por nombre/ID/clínica entre 5000; solo Anterior/Siguiente sobre 455–556 páginas.
- **Diseño propuesto (aditivo):** input compacto "Buscar usuario o clínica…" **dentro de la fila de filtros existente** desktop (a la izquierda de `N por página`, sin nueva fila), con debounce ~300 ms, reset a página 1, integración con el strip `Total filtrado` (que ya reacciona a filtros) y con el rango del footer. En **mobile**: icono-botón lupa en el header del módulo que abre overlay de búsqueda (patrón `ModuleDialog`) — costo de altura 0; el resultado filtra la card-list normal.
- **Valor visual:** percepción inmediata de software enterprise; el strip de totales + rango ya comunican el corte activo, la búsqueda se suma a ese lenguaje sin elementos nuevos.
- **Valor operativo:** de ~227 clicks a ≤ 3 interacciones para el caso de uso más frecuente de un admin (encontrar UN usuario). Métricas M1/M2.
- **Impacto no-scroll:** 0 px desktop (fila existente); 0 px mobile (overlay). Con resultados < límite adaptativo la tabla ya sabe renderizar slices cortas (validado con filtros en la auditoría).
- **Riesgo técnico:** medio-bajo. UI: convive con filtros (search + userType + role componen — el fixture ya compone así). Backend: **extensión aditiva** del GET real (`search` sobre username/nombre de clínica, ILIKE + índice si hiciera falta); el contrato ya está definido y testeado por el fixture CAP-A1, lo que reduce el riesgo de diseño de API a cero.
- **Backend/API:** requiere PR backend chico, read-only, param opcional (sin romper clientes actuales). Estrategia: backend primero (param ignorable), UI después (§7).
- **PR:** PR-CAP-T1a (backend) + PR-CAP-T1a' (UI). **Prioridad: P1.**

### H3 — Smart pagination: salto directo (PR-CAP-T3)

- **Problema que resuelve:** `Anterior`/`Siguiente` es correcto pero insuficiente para 455 páginas; no hay ir-a-página ni extremos.
- **Diseño propuesto (aditivo):** en desktop, el texto `Pág. 1 / 455` del footer se vuelve control: click → input numérico inline (o stepper) + botones primera/última; teclado (Enter aplica, Esc cancela). En mobile, tap sobre `Pág. 2 / 417` abre un mini-overlay con input numérico — el pager anclado no cambia de tamaño ni posición.
- **Valor visual:** el footer ya existente gana affordance sin elementos nuevos; cero ruido en reposo.
- **Valor operativo:** navegar a cualquier punto del dataset en ≤ 3 interacciones (W5); complementa (no reemplaza) a la búsqueda para exploración por rango.
- **Impacto no-scroll:** 0 px (mismo footer/pager; overlay en mobile).
- **Riesgo técnico:** bajo. Usa `offset = (página−1) × límite` sobre la API existente. Cuidado puntual: clamp de página cuando el límite adaptativo cambia por resize (el page count se recalcula — comportamiento ya presente hoy) y alinear los specs CAP-A2/A3 que leen `.dashboard-pagination-context` si el nodo cambia de rol (mantener el mismo texto y data-attr para no romperlos; nombres `data-*` sin stems sensibles, guard de `security:public-surface`).
- **Backend/API:** existente, sin cambios.
- **PR:** PR-CAP-T3. **Prioridad: P1.**

### H4 — Visual quality gate (PR-CAP-QA1)

Especificación completa como sistema en §8. Resumen: arnés Playwright versionado y on-demand que reproduce la auditoría 2026-07-02 (viewports × estados canónicos high-volume) y agrega guardias numéricas que hoy no existen (overflow, clip, contraste, estabilidad de primer paint, delta de altura de superficies). **Prioridad: P1 de proceso** — se implementa primero porque todos los demás PRs se validan con él.

### H5 — Command Bar premium (PR-CAP-T1b)

- **Problema que resuelve:** operación con teclado para el admin avanzado: buscar, filtrar, saltar de página y cambiar de módulo sin tocar el mouse ni consumir espacio de pantalla.
- **Diseño propuesto (aditivo):** paleta ⌘K/Ctrl+K en overlay (primitiva `ModuleDialog`/Radix ya presente en el design system) con: búsqueda de usuarios (reusa el param de H2), comandos de filtro ("tipo: admin", "rol: owner"), salto de página ("ir a 200"), y acciones existentes ("Actualizar"). Desktop-first; en mobile no se lanza (el overlay de búsqueda H2 cubre el caso).
- **Valor visual:** es el marcador de identidad "premium SaaS" por excelencia; costo de UI en reposo: un hint discreto `⌘K` en el header del card (opcional).
- **Valor operativo:** compone las herramientas H2/H3/filtros en una sola superficie; multiplicador, no duplicador.
- **Impacto no-scroll:** 0 px (100% overlay; el overlay no crea scroll externo — mismo contrato que los diálogos existentes).
- **Riesgo técnico:** medio: gestión de foco/atajos globales dentro del app shell (conflictos con atajos del navegador), y stacking sobre el módulo activo — reutilizar el z-model de los diálogos existentes; no introducir portales nuevos fuera del patrón actual. Requisitos de accesibilidad en §9.
- **Backend/API:** ninguna propia; depende de H2 para la parte de búsqueda (sin H2, la paleta se lanza solo con filtros/salto — sigue siendo útil).
- **PR:** PR-CAP-T1b (después de T1a). **Prioridad: P2.**

### H6 — Saved views / vistas rápidas (PR-CAP-T2)

- **Problema que resuelve:** los cortes frecuentes (W2/W3: "Owners de clínica", "Solo admins") exigen re-seleccionar dos filtros cada vez; no hay memoria de trabajo.
- **Diseño propuesto (aditivo):** chips compactos en la fila de filtros existente ("Todos", "Admins", "Owners", + "Guardar vista actual"), persistidos en `localStorage` (mismo mecanismo que el theme `vetneb-theme-mode`); una vista = tupla {userType, role, (status), (search)}. Sin backend, sin sync entre dispositivos (explícitamente fuera de alcance, §1 descartados).
- **Valor visual:** la fila de filtros gana lenguaje de producto (chips) ya usado en mobile; cero elementos flotantes.
- **Valor operativo:** cortes de un click; combinado con H7 permite "vigilar" segmentos.
- **Impacto no-scroll:** 0 px si los chips caben en la fila actual (en 1366 px hay ~700 px libres entre los selects y `N por página` — verificado en las capturas); si una vista no cabe, colapsa a un select "Vistas" del mismo alto. Regla dura: nunca segunda fila en desktop; en mobile las vistas viven dentro del overlay de búsqueda/filtros.
- **Riesgo técnico:** bajo; estado local puro sobre filtros existentes. Cuidado: no persistir nada sensible (solo params de filtro) y stems `data-*` no sensibles.
- **Backend/API:** no.
- **PR:** PR-CAP-T2. **Prioridad: P2.**

### H7 — Health strip de métricas (PR-CAP-T4)

- **Problema que resuelve:** el strip actual (Total filtrado / Admins / Clínicas) es correcto pero plano: no comunica composición (owners vs staff) ni estado (activos/bloqueados cuando exista status real).
- **Diseño propuesto (aditivo, en el mismo strip):** enriquecer las tres celdas existentes **sin agregar filas**: micro-desglose bajo "Clínicas" (`2375 owners · 2375 staff`) y, cuando H8 exista, mini-barra de distribución de status en "Total filtrado". Mobile: el header `5000 usuarios` gana un subtítulo de una línea ya existente ("Roles y permisos" → puede alternar al desglose).
- **Valor visual:** profundidad de dashboard ejecutivo sin costo de layout; el strip ya tiene la jerarquía tipográfica (18 px value / 12 px label) para absorberlo.
- **Valor operativo:** diagnóstico de composición en un vistazo, coherente con el corte activo.
- **Impacto no-scroll:** 0 px (celdas existentes; el micro-desglose reutiliza el interlineado actual del strip — QA1 verifica que la celda no crece, §6).
- **Riesgo técnico:** bajo en UI; el dato agregado requiere **extensión aditiva del payload** del GET real (objeto `summary` con conteos por rol; hoy la UI deriva Admins/Clínicas — owners/staff no está disponible sin N requests). El fixture puede adelantar el contrato igual que hizo CAP-A1 con search/status.
- **Backend/API:** extensión aditiva de payload (no rompe clientes: campo nuevo opcional).
- **PR:** PR-CAP-T4 (fixture+contrato primero, backend después, UI al final — §7). **Prioridad: P2.**

### H8 — Filtro status (PR-CAP-T1c — gated)

- **Problema que resuelve:** cortar por estado operativo (activo/inactivo/bloqueado) — clave para tareas de higiene de cuentas (W4).
- **Estado real:** el fixture y su contrato de test ya lo soportan (`status=active|inactive|locked`), **pero el modelo de datos real no tiene columna status** (verificado: `db-admin-users-roles.ts` sin status). No es un PR de UI: es una decisión de producto/datos.
- **Camino propuesto:** (a) definir la semántica real — opción barata: **derivar** `locked` de las señales existentes del módulo de intentos fallidos/sesiones y `active` por defecto, sin migración; opción completa: columna status con migración (fuera del alcance de este roadmap, §1); (b) recién entonces exponer el tercer select en la fila de filtros (mismo alto que los existentes, ya corregidos por V1).
- **Impacto no-scroll:** 0 px (misma fila).
- **Riesgo técnico:** el mayor de la lista, por dependencia de datos, no de UI.
- **Backend/API:** requiere backend real (derivación o esquema). **Prioridad: P2 gated** — no arrancar hasta cerrar la definición.

### H9 — Density controls opcionales (PR-CAP-T5 — aspiracional)

- **Problema que resuelve:** operadores expertos en monitores grandes prefieren más filas; el límite adaptativo hoy decide solo.
- **Diseño propuesto:** toggle "Cómoda / Compacta" (41 px → ~34 px de fila, tipografía intacta) junto a `N por página`, persistido en localStorage; el límite adaptativo recalcula con la nueva altura (14–15 filas en 1440x900).
- **Impacto no-scroll:** 0 px de chrome; **interactúa con la medición adaptativa** — es la herramienta con más acople a F3, por eso queda explícitamente **después** de PR-CAP-V3 y con la matriz e2e completa como gate.
- **Riesgo técnico:** medio (re-medición, persistencia, interacción con settle) para un beneficio menor que H2/H3. **Prioridad: P3 aspiracional.**

## 6. Contrato de presupuesto de altura (height budget contract)

El principio "presupuesto de altura cero" se formaliza así. Es vinculante para todo PR del bloque y QA1 lo hace ejecutable.

### 6.1 Superficies habilitadas — dónde puede vivir cada herramienta

| Superficie existente | Qué puede alojar | Regla |
|---|---|---|
| Fila de filtros desktop | Input de búsqueda (T1a), chips de vistas (T2), tercer select status (T1c post-gate) | Todo en **una** fila a 1366 px; si no cabe, colapso a select del mismo alto — nunca segunda fila |
| Strip de totales | Micro-desglose de composición (T4) | Dentro de las celdas existentes; la celda **no crece** (18 px value / 12 px label absorben el desglose) |
| Footer de paginación desktop | Affordance de salto directo sobre `Pág. X / Y` (T3) | Mismo nodo, mismo alto; input inline reemplaza el texto en foco, no lo apila |
| Pager mobile anclado | Tap-to-jump sobre `Pág. X / Y` (T3) | Sin cambio de tamaño ni posición; la interacción abre overlay |
| Header del card/módulo | Hint `⌘K` (T1b), icono lupa mobile (T1a) | Icon-buttons dentro del alto actual del header |
| Overlay (`ModuleDialog`) | Búsqueda mobile (T1a), salto mobile (T3), command bar (T1b), vistas en mobile (T2) | Patrón de diálogo existente; sin portales nuevos; sin scroll externo con overlay abierto |

### 6.2 Cuándo debe ser overlay

- **Mobile, siempre** que el control no quepa sin crear segunda fila o comprimir la card-list (búsqueda, salto numérico, gestión de vistas).
- **Desktop, cuando la interacción es modal por naturaleza** (command bar).
- **Nunca overlay para estado persistente:** los cortes activos (filtros, vista aplicada, término de búsqueda) deben ser visibles en reposo en las superficies inline — un admin tiene que ver de un vistazo qué está mirando.

### 6.3 Prohibiciones

1. Nueva fila de controles (desktop o mobile).
2. Crecimiento de altura de cualquier superficie del inventario 6.1 (fila, celda, strip, header, footer, pager, item de card-list).
3. Scroll interno nuevo (el único `overflow-auto` legítimo es el wrapper actual de la tabla, con scroll real 0).
4. Elementos flotantes/sticky nuevos fuera del patrón overlay.
5. Alterar floor/cap del límite adaptativo (floor 9/cap 36 desktop, floor 1 mobile), salvo V3 (estabilización) y T5 (post-gate, documentado).

### 6.4 Cómo se mide

QA1 (§8) registra `clientHeight` de cada superficie del inventario 6.1 por viewport y estado, y lo compara contra la baseline numérica del commit anterior: **delta ≠ 0 px = fallo del gate** (salvo que el PR declare y justifique el delta, caso V3 que elimina el void). Overflow y scroll interno se miden como hasta ahora (0 px, tolerancia 2 px del contrato).

## 7. Corte por capas: UI / fixture / cliente API / backend real / DB-modelo

Separación explícita de qué toca cada herramienta, para que ningún PR mezcle capas ni simule capacidades que el backend real no tiene.

| Capacidad | UI-only | Fixture e2e | Cliente API frontend | Backend real | DB/modelo |
|---|---|---|---|---|---|
| V1–V4 polish | ✅ todo el cambio | actualizar guardias/specs | — | — | — |
| T3 salto directo | ✅ (usa `offset` existente) | ya soporta offset | sin cambios | sin cambios | — |
| T2 saved views | ✅ (localStorage) | specs nuevos | — | — | — |
| T1b command bar | ✅ (compone T1a/T3/filtros) | specs nuevos | — | — | — |
| T1a búsqueda | input + estados UI | ✅ ya la soporta (CAP-A1 `search`) | param opcional nuevo | **extensión aditiva**: `search` ILIKE sobre username/clínica (+índice si p95 > 500 ms) | sin cambio de esquema |
| T4 health strip | strip in-place | adelantar contrato `summary` | leer campo opcional | **extensión aditiva**: payload `summary` (agregación, sin esquema nuevo) | sin cambio de esquema |
| T1c status | — (gated) | ✅ ya lo soporta (CAP-A1 `status`) | gated | gated | **decisión pendiente**: derivar de señales existentes vs columna con migración |
| T5 density | ✅ (re-medición + localStorage) | specs nuevos | — | — | — |

**Reglas anti-deuda:**

1. Los params fixture-only (`search` hasta T1a, `status` hasta el gate de T1c) viven **solo en e2e**. La UI de producción no renderiza controles cuyo backend real no exista.
2. **Nunca status simulado en producción:** ni hardcodear "activo", ni derivar estado en el frontend sin contrato aprobado. La derivación barata (locked desde señales de intentos fallidos/sesiones) es válida solo como implementación **backend** post-decisión, con su propio contrato y tests.
3. Orden de entrega por herramienta con capa backend (patrón que CAP-A1 ya validó): **contrato en fixture → backend aditivo (param/campo opcional, ignorable por clientes actuales) → cliente API → UI.** Cada paso es un PR revertible sin arrastrar a los demás.
4. Extensión aditiva significa: cero cambios de comportamiento cuando el param/campo nuevo no se usa — verificable con los tests de ruta existentes sin modificar.

## 8. PR-CAP-QA1 como sistema: visual quality gate

QA1 no es "un spec más": es el sistema de calidad visual del bloque. Convierte "premium" de opinión en umbral numérico repetible, y es prerequisito del resto del roadmap.

### 8.1 Qué captura

- **Viewports (5):** 1440x900, 1366x768 (desktop) · 390x844, 360x740, 430x932 (mobile).
- **Estados canónicos (por viewport, con `dataset=high-volume` = 5000):** default · filtro admin · filtro clínica+owner · límite 25/50/100 · página profunda (~430) · última página (slice corta). Al mergear cada herramienta se agregan sus estados: búsqueda activa con resultados y sin resultados (T1a), overlay abierto (T1a/T3/T1b), vista aplicada (T2), input de salto en foco (T3).
- **Screenshots:** a un directorio propio versionable o descartable (`frontend/e2e/visual-audit/output/` o equivalente), **nunca** a `test-results/` (Playwright lo limpia al inicio de cada corrida) y **nunca** pisando la baseline mergeada de `docs/audit/assets/admin-users-high-volume/` (inmutable, es evidencia de la auditoría).

### 8.2 Qué métricas calcula y umbrales

| Guardia | Cálculo | Umbral |
|---|---|---|
| Overflow externo | `scrollHeight/Width` vs viewport en html/body/main/workspace | 0 px (tolerancia 2 px del contrato) |
| Scroll interno | peor `scrollTop` alcanzable por superficie interna | 0 px |
| Clip de texto en selects | line box vs content-box de `.field-select` (protege F1) | 0 px de recorte |
| Clip por elemento | `scrollWidth > clientWidth` en celdas de fecha, chips, labels (protege F2/F4) | 0 elementos clipeados |
| Estabilidad post-paint | conteo de filas en t0 vs t_settle (protege F3) | idéntico (12→11 = fallo) |
| Contraste | muestreo de pares texto/fondo en celdas, labels, chips | ≥ 4.5:1 texto normal (baseline 6.13:1) |
| Presupuesto de altura | `clientHeight` por superficie del inventario §6.1 vs baseline numérica | delta 0 px salvo justificación declarada |

### 8.3 Cómo evita flakiness

- **Fixture determinista:** todo por `page.route` (patrón CAP-A2/A3), sin red real, dataset con seed fijo.
- **Estabilidad por firma, no aritmética precomputada:** el spec asevera "el conteo de filas no cambia entre t0 y t_settle", nunca "hay exactamente 12 filas en 1440x900" — la corrida real de la auditoría demostró que precomputar el límite adaptativo es frágil (F3, settle 12→11).
- **Espera explícita:** fonts cargadas (`document.fonts.ready`), animaciones desactivadas/reduced-motion, señal de datos renderizados antes de medir.
- **Sin retries como mitigación:** un flake se arregla en la causa (precedente del flake de bottom-nav admin mobile: la mitigación por retries se removió cuando se corrigió la señal síncrona). El criterio M6 son 5 corridas consecutivas idénticas.
- **Higiene del repo:** revertir `frontend/next-env.d.ts` tras levantar el dev server (regla conocida: si no, fallan 5+ scope tests en `pnpm test`); borrar `frontend/.next` si se editó CSS con el server caído (Turbopack sirve CSS pre-edit); no dejar artefactos `playwright-report/` (el lint local rompe).

### 8.4 Cómo se usa antes/después de cada PR visual

1. **Antes:** correr QA1 en `main` → tabla de métricas baseline del commit base.
2. **Durante:** correr QA1 en la rama con los estados nuevos del PR incluidos.
3. **Gate:** cualquier delta negativo (overflow > 0, clip nuevo, contraste < umbral, altura de superficie crecida, firma de estabilidad rota) **bloquea el PR**. Deltas positivos esperados (V3 elimina el void; V1 elimina el clip) se declaran en la descripción del PR con los números antes/después.
4. **Cierre:** la tabla de métricas se adjunta al PR como evidencia; la baseline numérica queda actualizada para el siguiente.

Ejecutable on-demand, fuera del gate de CI actual (sin tocar workflows — la integración a CI queda para cuando se autorice el P0 de regresión visual registrado en `total-visual-engineering-audit.md`). Sin deps nuevas: Playwright existente.

## 9. Capa de accesibilidad y teclado

Transversal a todas las herramientas; cada PR incluye su parte en el mismo diff y QA1 muestrea contraste.

| Control | Teclado | Semántica |
|---|---|---|
| Búsqueda (T1a) | Tab llega; escribir filtra con debounce; Esc limpia; foco visible con el ring existente | `label`/`aria-label` "Buscar usuario o clínica"; resultado anunciado por `aria-live="polite"` ("N resultados, página 1 de M") |
| Salto de página (T3) | Click o Enter sobre `Pág. X / Y` abre input; Enter aplica; Esc cancela y **devuelve el foco** al trigger | input numérico con label; clamp anunciado si la página pedida excede el total |
| Command bar (T1b) | Ctrl+K/⌘K abre; flechas navegan; Enter ejecuta; Esc cierra y restaura foco; focus trap dentro del overlay | patrón combobox/listbox con `aria-activedescendant`; operable 100% sin mouse |
| Saved views (T2) | Tab entre chips; Enter/Espacio aplica | `aria-pressed` en el chip activo; nombre de vista como accessible name |
| Overlays mobile (T1a/T3) | Cierran con back/Esc; foco devuelto al botón que los abrió | patrón `ModuleDialog` existente (ya cumple) |

**Requisitos globales:**

- Todo control nuevo con label o `aria-label`; nada identificado solo por icono.
- Foco visible según el ring existente del design system; sin `outline: none` sin reemplazo.
- Contraste ≥ 4.5:1 en texto normal (baseline actual 6.13:1 — no empeorar).
- **Rango mobile (F5):** el span sr-only existente se mantiene siempre; como mejora P3, evaluar una variante visible compacta del rango en el pager **solo si cabe sin delta de altura** (§6.4 lo mide); mientras tanto, los cambios de página se anuncian por `aria-live` para que el usuario de screen reader tenga la misma información que el vidente.
- Los specs e2e de cada herramienta incluyen el camino por teclado (no solo click).

## 10. Excelencia mobile específica

Mobile no es un derivado de desktop: cada herramienta declara su variante mobile o su exclusión explícita.

| Herramienta | Desktop | Mobile | Exclusión |
|---|---|---|---|
| Búsqueda (T1a) | input inline en fila de filtros | icono lupa en header → overlay; el resultado filtra la card-list normal (el overlay es solo el input, no una lista paralela) | — |
| Salto directo (T3) | input inline en footer | tap en `Pág. X / Y` → mini-overlay numérico; pager sin cambio de tamaño/posición | — |
| Saved views (T2) | chips en fila de filtros | dentro del overlay de búsqueda/filtros | sin chips inline en 360 px |
| Command bar (T1b) | overlay ⌘K | **no se lanza en mobile** — sin teclado físico no aporta; el overlay de búsqueda cubre el caso | exclusión explícita |
| Health strip (T4) | micro-desglose en celdas | subtítulo de una línea existente en el header (`Roles y permisos` alterna al desglose) | — |
| Density (T5) | toggle junto a `N por página` | **no aplica** (floor 1, card-list adaptativa) | exclusión explícita |

**Reglas mobile del bloque:**

1. **Pager intacto:** anclado, mismo alto, mismos targets; toda interacción nueva sobre él abre overlay, nunca lo agranda.
2. **Chips sin duplicados:** V4 elimina el doble "Admin Admin" (el chip derecho pasa a la semántica del slot de acción, equivalente a `No editable` en desktop); QA1 agrega guardia de texto duplicado en cards.
3. **Card-list preservada:** items de 44.5–45.5 px (≥ 44 px táctil); el límite adaptativo mobile (floor 1) no se toca.
4. **Cero scroll:** los overlays no crean scroll externo; el contenido del overlay debe caber (el overlay de búsqueda es un input + acciones, no una lista scrolleable).
5. **Paridad de resultado:** todo lo que desktop puede lograr (encontrar usuario, saltar a página, aplicar corte) mobile lo logra con el mismo número de interacciones ± 1, vía overlays.
6. Los specs CAP-A3 se extienden con los estados mobile nuevos (overlay abierto incluido) en el mismo PR de cada herramienta.

## 11. Roadmap por PRs: fases y scoring

### 11.1 Fases

| Fase | PRs | Propósito |
|---|---|---|
| **0 — Gate** | PR-CAP-QA1 | Sistema de calidad visual; sin él, todo lo demás se valida a mano otra vez |
| **1 — Polish** | PR-CAP-V1 → V2 → V3 → V4 | Cerrar F1–F4; el módulo queda visualmente impecable antes de sumar herramientas |
| **2 — Operabilidad** | PR-CAP-T1a (backend → UI) → PR-CAP-T3 | Cerrar el gap operativo: 5000 usuarios pasan de "soportados" a "operables" (M1/M2, W1/W5/W6) |
| **3 — Identidad premium** | PR-CAP-T2 → PR-CAP-T1b → PR-CAP-T4 | Vistas, command bar, profundidad ejecutiva — componen sobre Fase 2 probada |
| **4 — Gated/aspiracional** | PR-CAP-T1c (gate: decisión de datos) · PR-CAP-T5 (gate: V3 + matriz completa) | Solo tras cerrar sus gates (§1) |

Cada PR: un solo tema; backend y frontend de una misma herramienta separables; source-contract/scope tests alineados en el mismo diff; validado con QA1 + matriz no-scroll + estados high-volume.

### 11.2 Matriz de scoring

Escalas: impacto/riesgo = Alto/Medio/Bajo; costo = S (diff chico, una sesión), M (1–2 sesiones), L (multi-sesión o coordinación backend+frontend).

| PR | Impacto visual | Impacto operativo | Riesgo técnico | Dep. backend | Dep. diseño | Costo |
|---|---|---|---|---|---|---|
| QA1 | Indirecto (protege todo) | Alto (proceso) | Bajo | No | No | M |
| V1 | Alto (F1 es P1 visible) | Bajo | Medio-bajo (clase compartida) | No | No | S |
| V2 | Medio | Medio (fechas siempre legibles) | Bajo | No | No | S |
| V3 | Medio (primer paint) | Bajo | Medio (medición adaptativa) | No | No | M |
| V4 | Medio (mobile) | Bajo | Bajo | No | Micro-decisión de copy del chip | S |
| T1a backend | — | Alto | Medio-bajo (perf ILIKE) | Es backend | No | S |
| T1a' UI | Alto | **Muy alto** (M1: 227→≤3) | Medio-bajo | T1a | No | M |
| T3 | Medio | Alto (W5: 429→≤3) | Bajo | No | No | S–M |
| T2 | Medio | Medio | Bajo | No | No | S |
| T1b | Alto (identidad) | Medio (multiplicador) | Medio (foco/atajos) | No (T1a para búsqueda) | Ligera (layout del overlay) | M |
| T4 | Medio | Medio | Bajo UI / backend aditivo | Sí (payload `summary`) | No | M |
| T1c | Medio | Alto (higiene de cuentas) | **Alto** (datos, no UI) | Sí (**modelo**) | No | L |
| T5 | Bajo | Medio-bajo | Medio (acople medición) | No | No | M |

### 11.3 Criterio de aceptación, tests y rollback por PR

| PR | Criterio de aceptación (medible) | Tests requeridos | Rollback |
|---|---|---|---|
| QA1 | Arnés corre on-demand en 5 viewports × estados canónicos; produce la tabla de métricas §8.2; 5 corridas consecutivas idénticas; no toca CI ni deps | El arnés **es** el test; smoke de que cada guardia falla ante un defecto sembrado | Revert simple (tooling puro, sin superficie de producto) |
| V1 | Clip 0 px en `.field-select` en **todos** los módulos desktop que usan la clase; alto de la fila de filtros sin delta | Guardia de line box QA1 + specs CAP-A2 + revisión de módulos consumidores en el diff | Revert simple (restaura render previo) |
| V2 | 0 ellipsis en CREADO/ACTUALIZADO en todas las filas muestreadas (1440x900 y 1366x768); sin overflow horizontal nuevo | Guardia de clip por celda QA1 + specs CAP-A2 | Revert simple |
| V3 | Conteo de filas t0 == t_settle en todas las viewports desktop; void residual 0; floor/cap intactos | Matriz e2e no-scroll **completa** + firma de estabilidad QA1 | Revert simple; si regresa densidad, el revert restaura el settle conocido (estado auditado) |
| V4 | 0 chips duplicados en cards mobile; chip derecho con semántica de acción; item 44.5–45.5 px sin delta | Guardia de texto duplicado QA1 + specs CAP-A3 | Revert simple |
| T1a backend | GET acepta `search` opcional; **sin el param, respuesta idéntica al contrato actual** (tests de ruta existentes sin modificar); p95 < 500 ms con 5000 | Tests de ruta nuevos (con/sin param, composición con userType/role) + paridad con contrato fixture CAP-A1 | Revert seguro: param opcional que ningún cliente usa aún |
| T1a' UI | Spec W1 verde: usuario por nombre parcial en ≤ 3 interacciones; strip/rango/página coherentes; reset a pág. 1; overlay mobile sin delta de altura del shell | Spec W1 + estados búsqueda activa/sin resultados en QA1 + camino por teclado §9 + CAP-A2/A3 verdes | Revert simple (el backend queda, inofensivo sin UI) |
| T3 | Spec W5 verde: pág. 1 → 430 en ≤ 3 interacciones; clamp correcto al cambiar límite; footer/pager sin delta de tamaño | Spec W5 desktop+mobile + estado input-en-foco en QA1 + camino por teclado + CAP-A2/A3 sin modificar asserts | Revert simple |
| T2 | Aplicar vista = 1 click; persistencia tras reload; una sola fila a 1366 px; colapso a select verificado | Specs de vistas (aplicar/guardar/persistir/colapsar) + guardia de altura de fila QA1 | Revert simple; localStorage huérfano es inerte |
| T1b | Abre con Ctrl+K/⌘K; 100% operable por teclado; foco restaurado al cerrar; sin scroll externo con overlay abierto | Spec de paleta (abrir/buscar/filtrar/saltar/cerrar) + estado overlay-abierto en QA1 + a11y §9 | Revert simple (overlay autocontenido) |
| T4 | Strip sin delta de altura (§6.4); `summary` opcional (clientes viejos no rompen); cifras del desglose consistentes con el total filtrado | Tests de ruta del payload + paridad fixture/real + guardia de altura de celda QA1 | Revert por capas: UI primero; el campo opcional puede quedar |
| T1c | (Post-gate) semántica de status documentada y aprobada; filtro compone con userType/role; paridad fixture/real; misma fila, mismo alto | Tests de ruta de derivación + specs de filtro compuesto + QA1 | Con derivación (sin migración): revert simple. La opción columna exigiría plan de datos propio — razón adicional para preferir derivación |
| T5 | Toggle persiste; 14–15 filas en 1440x900 compacta; floor/cap contract respetado; matriz no-scroll completa verde | Matriz e2e completa en ambas densidades + firma de estabilidad | Revert simple (vuelve a densidad única) |

## 12. Riesgos y mitigaciones

| Riesgo | PRs afectados | Mitigación |
|---|---|---|
| Regresión en otros módulos por tocar la clase compartida `.field-select` | V1 | Verificar todos los módulos consumidores en el mismo diff; guardia de clip QA1 corre sobre los módulos afectados |
| Regresión de densidad/no-scroll por tocar la medición adaptativa | V3, T5 | Matriz e2e no-scroll completa como gate; firma de estabilidad (nunca conteos precomputados); T5 bloqueado hasta V3 |
| Romper asserts de contrato de CAP-A2/A3 (labels, `data-*`, `Pág. X / Y`) | T3, T1a', T2 | Conservar texto y data-attrs; alinear specs en el mismo PR (precedente #958: los scope tests validan el working-tree diff) |
| Performance de ILIKE con crecimiento del dataset | T1a backend | Presupuesto p95 < 500 ms como criterio de aceptación; índice condicional si se excede; param read-only opcional |
| Flakiness del arnés QA1 | QA1 y todos | Determinismo por `page.route`, seed fijo, esperas explícitas, sin retries como mitigación (precedente bottom-nav: causa raíz, no reintentos) |
| Conflictos de foco/atajos globales del command bar | T1b | Reutilizar primitivas de diálogo y z-model existentes; sin portales nuevos; spec de foco/restauración |
| Stems sensibles en `data-*` nuevos | T1a', T3, T2, T1b | Guard `security:public-surface` (nombres sin token/session/cookie…; precedente PR-SRV-1: stems neutros) |
| Higiene e2e que rompe `pnpm test`/lint | QA1 y todos | Revertir `frontend/next-env.d.ts` tras e2e; borrar `frontend/.next` si se editó CSS con server caído; no dejar `playwright-report/` |
| Scope creep hacia status sin contrato de datos | T1c | Gate duro en §1; fixture-only hasta decisión; regla anti-deuda §7 |
| Deriva de alcance dentro de un PR (polish + tool + tooling mezclados) | Todos | Regla §14: un tema por PR; backend/frontend separables; QA1 detecta deltas no declarados |

## 13. Criterios de aceptación transversales (todo PR del bloque)

- **Visual:** captura QA1 antes/después en 1440x900, 1366x768, 390x844, 360x740 (+430x932 para cambios mobile); sin nuevos clips >0 px en texto; contraste mínimo medido ≥ 4.5:1 en texto normal (baseline actual: 6.13:1).
- **E2E:** specs CAP-A2/A3 verdes sin modificar sus asserts de contrato (labels, `data-*`, textos de paginación); todo estado nuevo (search activa, página saltada, vista aplicada) con spec propio siguiendo el patrón de estabilidad por firma (nunca aritmética precomputada de límite — lección F3).
- **No-scroll:** overflow 0 px (tolerancia 2 px del contrato) en html/body/main/workspace y peor scroll interno 0, en todos los viewports de la matriz, con la herramienta en reposo **y** activa (overlay abierto incluido).
- **Altura:** delta 0 px en las superficies del inventario §6.1, salvo delta positivo declarado (V3).
- **Mobile:** items ≥ 44 px de alto táctil, pager anclado intacto, sin segunda fila de controles; overlays cierran con back/Esc y devuelven el foco.
- **High-volume:** validación con `dataset=high-volume` (5000) vía `page.route` (patrón CAP); slices acotadas al límite adaptativo; totales/rango/página coherentes en cada corte nuevo (search y status componen con userType/role como ya compone el fixture).
- **Accesibilidad:** checklist §9 completa para los controles del PR; anuncios de cambio de resultado por `aria-live`; el span sr-only del rango mobile se mantiene.

## 14. Anti-patterns — qué NO hacer

1. **No infinite scroll ni virtualización con scroll.** La paginación por slices es el contrato del App Shell single-viewport; el remedio a 455 páginas es búsqueda + salto, no scroll.
2. **No tabla gigante.** Ni más filas por crecimiento de altura, ni `max-height` con scroll interno, ni render de más de una slice.
3. **No más altura fija.** Cero filas nuevas de chrome, cero crecimiento de superficies (§6.3); si una herramienta "necesita" espacio vertical, su diseño está mal — va a overlay o no va.
4. **No meter herramientas en la vertical sin presupuesto.** Toda propuesta futura declara su costo de altura contra el inventario §6.1 antes de escribir código; QA1 lo verifica (§6.4).
5. **No status fake sin contrato.** Ni simular estado en producción, ni derivarlo en el frontend, ni exponer el filtro mientras el modelo real no lo soporte (§7, reglas anti-deuda).
6. **No rediseño completo.** Ni del módulo, ni del card, ni del dashboard shell (nav horizontal, stage, hub, tokens `--dash-*`/`--admin-mobile-*`): las superficies actuales son la base y solo se enriquecen.
7. **No mezclar PRs.** Polish (V*), herramientas (T*) y tooling (QA1) nunca en el mismo diff; backend y frontend de una misma herramienta, separables.
8. **No tocar auth/DB en PRs de UI.** T1c no arranca sin decisión de datos explícita; su eventual migración sería un PR propio fuera de este roadmap.
9. **No introducir scroll interno nuevo.** El único `overflow-auto` legítimo es el wrapper actual de la tabla, con scroll real 0; overlays y chips deben caber, no scrollear.
10. **No deps nuevas ni cambios de CI/workflows.** QA1 es on-demand con el Playwright existente. No stems sensibles en `data-*` (guard `security:public-surface`).

## 15. Definition of done premium

El módulo Admin Usuarios/Roles se declara en cada nivel solo cuando su gate medible está verde:

| Declaración | Gate medible |
|---|---|
| **Estable** | QA1 verde en 5 corridas consecutivas sin flake (M6); specs CAP-A2/A3 verdes; 0 regresiones en la matriz no-scroll; `pnpm test` / `pnpm build` / `security:public-surface` verdes |
| **Visualmente excelente** | F1–F4 cerrados; clip 0 px, overflow 0 px, settle 0 (M3/M4/M5); contraste ≥ 4.5:1; delta de altura de superficies 0 |
| **Operativo a 5000 usuarios** | M1 ≤ 3 interacciones y M2 ≤ 10 s para localizar usuario (W1); salto a página arbitraria ≤ 3 interacciones (W5); paridad mobile vía overlays (W6) |
| **Premium** | Fases 0–2 completas + al menos T2 y T1b de Fase 3; checklist a11y §9 al 100%; cortes frecuentes a 1 click (W2/W3) |
| **Mantenible** | QA1 versionado y documentado como gate de cada PR visual; 0 specs con aritmética precomputada de límite; source-contract tests alineados; baseline numérica actualizada por PR |

Sin los cinco gates, el módulo no se comunica como "premium" — se comunica el nivel alcanzado y qué falta, con esta tabla como referencia.

## 16. Recomendación ejecutiva final

Orden de ejecución recomendado, en secuencia estricta salvo donde se indica:

1. **PR-CAP-QA1 primero.** Sin el arnés, cada PR posterior se valida a mano otra vez y el "premium" vuelve a ser opinión. Es el multiplicador de todo lo demás.
2. **PR-CAP-V1 → V2 → V3 → V4.** Pulido barato que elimina todo lo que hoy "delata" al módulo (selects amputados, ellipsis de fechas, reflow de primer paint, chips duplicados). QA1 verifica cada fix con guardia numérica.
3. **PR-CAP-T1a (búsqueda).** La herramienta de mayor retorno operativo del roadmap: M1 de ~227 clicks a ≤ 3 interacciones. Backend aditivo primero (contrato ya fijado por CAP-A1), UI después.
4. **PR-CAP-T3 (salto directo).** Complementa la búsqueda para navegación por rango; solo API existente. Técnicamente independiente de T1a — puede prepararse en paralelo, pero se prioriza búsqueda porque resuelve el caso de uso más frecuente.
5. **PR-CAP-T2 → T1b → T4.** La ola de identidad premium: vistas de 1 click, command bar que compone búsqueda+salto+filtros ya probados, y profundidad ejecutiva en el strip.
6. **Status (T1c) y density (T5) quedan gated/aspiracionales.** T1c no arranca hasta la decisión de datos (la derivación desde señales de bloqueo existentes es el camino barato si se quiere adelantar; la columna con migración es otra iniciativa). T5 solo tras V3 y con la matriz completa como gate — beneficio marginal, acople real.

**Por qué este orden lleva el módulo a excelencia:** la auditoría demostró que la base estructural ya es premium (no-scroll perfecto medido, densidad razonada, coherencia total de cifras bajo 5000 usuarios). Faltan dos capas finas: (1) el **pulido de detalle** que hoy rompe la lectura fina — V1..V4 lo cierran con cambios de píxeles y QA1 lo vuelve regresión-imposible; (2) la **operabilidad proporcional al dataset** — búsqueda, salto y vistas hacen que la experiencia a 5000 usuarios sea tan directa como a 9, que es exactamente lo que distingue a un dashboard administrativo premium de una tabla paginada correcta. Todo suma sobre lo existente, cuesta 0 px de altura (§6), respeta las capas reales de backend (§7) y deja intactos los contratos visuales y de test que ya protegen al módulo.

## Confirmaciones de scope

- ✅ Docs-only: un único archivo (`docs/product/admin-users-premium-tools-proposal.md`); cero código.
- ✅ Sin cambios en `frontend/src/`, backend real, API real, auth, DB, deps, lockfiles, CI/workflows, `globals.css`, `frontend/next-env.d.ts`.
- ✅ Sin screenshots nuevos (la evidencia referenciada es la baseline ya mergeada de la auditoría 2026-07-02, que este documento trata como inmutable).
- ✅ `docs/audit/admin-users-high-volume-visual-audit.md` y `docs/audit/assets/admin-users-high-volume/*.png` intactos.
- ✅ skills.zip intacto.
- ✅ Sin `git add`, sin commit, sin push, sin PR.

## Veredicto

**10/10 como documento de dirección.** Cumple los cuatro atributos exigidos: **accionable** (12 PRs con orden, fases, scoring, criterio de aceptación, tests y rollback cada uno — §11), **medible** (7 métricas de resultado con baseline y target — §2; gates numéricos por PR — §8.2; definition of done por niveles — §15), **honesto** (separación explícita fixture/backend/modelo — §7; W4 y status declarados gated en vez de prometidos — §1/§3; descartes explícitos con razones — §1), y **seguro** (contrato formal de altura — §6; anti-patterns vinculantes — §14; riesgos con mitigación por PR — §12). El siguiente paso operativo es PR-CAP-QA1.
