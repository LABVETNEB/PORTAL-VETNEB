# B01 — `presentation/shell` + `presentation/navigation` re-export barrels

> **Tipo:** arquitectura de imports. **No mueve componentes, no migra consumidores, no cambia comportamiento, no toca CSS, DOM, rutas, auth ni backend.**
> **Base:** `main` limpio · **HEAD:** `8769f68` fix(ci): realign e2e completeness workflow security digest (#1657)
> **Documento rector:** [`docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md`](../audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md) — §47.2, §49 (B01), §54, §56.1, §59–§62
> **Antecedente estructural:** [`dashboard-presentation-boundaries.md`](./dashboard-presentation-boundaries.md) (PR-PRES-2) · patrón de re-export puro: [`dashboard-surface-primitives.md`](./dashboard-surface-primitives.md) (PR-PRES-5)

## 1. Estado base

`presentation/shell/index.ts` y `presentation/navigation/index.ts` eran barrels
placeholder (`export {};`) creados por PR-PRES-2. Cero exports, cero
consumidores. Las capas hermanas ya habían aterrizado exports reales:
`config` (PR-PRES-3), `application` (PR-PRES-4) y `surfaces` (PR-PRES-5).

La frontera de presentación existía **solo como prosa JSDoc**: no había ninguna
regla de import ejecutable. Verificado: cero ocurrencias de
`no-restricted-imports` en el repo, `frontend/tsconfig.json` sin restricciones, y
ningún guard de `test/architecture/**` cubriendo `features/dashboard/presentation`.

Dependencia de B01 según §49: **A07**, cerrado en `7ef58c1` (#1653). Gate **G3**
(`limit` invariante, A05–A07), exigido por §58 antes de B01: cumplido.

## 2. Scope B01

- Poblar `presentation/shell/index.ts` con re-exports behaviour-preserving.
- Poblar `presentation/navigation/index.ts` con re-exports behaviour-preserving.
- Crear el guard ejecutable de import boundaries.
- Este documento.

## 3. No-alcance

- No se mueve ningún archivo de `frontend/src/components/dashboard/**`.
- No se migra ningún consumidor: los imports actuales quedan idénticos.
- No se retira ni se borra ningún componente (B02).
- No se retiran `DashboardHorizontalNav` ni `DashboardModuleRail` (B08).
- No se tocan tokens, CSS, WorkspaceAppBar, NavigationDrawer/Rail (B03–B07).
- No se tocan `server/**`, `drizzle/**`, `shared/**`, `frontend/src/app/**`,
  `@/lib/api*`, `@/lib/auth*`, `frontend/tsconfig.json`, configs ESLint,
  `package.json`, `pnpm-lock.yaml`, `.github/**`, CI ni dependencias.

## 4. Decisión: re-exports behaviour-preserving

Los barrels re-exportan las implementaciones legacy con path absoluto pinneado
(`@/components/dashboard/*`). Es el paso sancionado por §47.2 ("Reexportar
durante la migración: los barriles de `presentation/*` reexportan desde
`components/dashboard/` hasta que el último consumidor migre") y por la
mitigación **R14** de §60 ("ambas gramáticas conviven sin romper imports").

Se eligieron re-exports explícitos por símbolo en lugar de `export *`, para que
la superficie pública sea declarada y auditable, y en lugar de 15 archivos
wrapper de una línea, que serían churn sin valor.

`isolatedModules: true` obliga al modificador `type` inline en los re-exports de
tipos; se sigue el estilo ya aterrizado en PR-PRES-5.

## 5. Por qué no se movieron componentes

Los 15 componentes están anclados por `readFileSync(".../components/dashboard/X.tsx")`
en ~20 tests de contrato de origen. Mover obligaría a realinear todos esos
anclajes en el mismo PR (AGENTS.md §4) — riesgo alto, sin beneficio, y
contradiciendo §47.2, que pide exactamente lo contrario durante la migración.

Los dos ciclos type-only preexistentes (`DashboardModuleRail` ↔
`ClinicDashboardWorkspaceController` y `DashboardModuleHub` ↔
`AdminMobileHubLauncher`) viven íntegramente dentro de `components/dashboard/`.
Como cada re-export apunta al archivo concreto y nunca a otro barrel, B01 **no
añade ninguna arista** al grafo y no crea ni agrava ciclo alguno.

## 6. Re-exports de `presentation/shell` (5 módulos · 10 símbolos)

| Módulo legacy | Símbolos re-exportados |
|---|---|
| `DashboardShellRouter` | `DashboardShellRouter` |
| `PrivateDashboardShell` | `PrivateDashboardShell`, `type PrivateDashboardShellProps` |
| `DashboardModuleWorkspace` | `DashboardModuleWorkspace` |
| `DashboardModuleHub` | `DashboardModuleHub`, `type DashboardModuleCard` |
| `DashboardHubHero` | `DashboardHubHero`, `type DashboardHubHeroMetric`, `type DashboardHubHeroProps`, `type DashboardHubHeroStatusTone` |

## 7. Re-exports de `presentation/navigation` (9 módulos · 16 símbolos)

| Módulo legacy | Símbolos re-exportados |
|---|---|
| `DashboardHorizontalNav` | `DashboardHorizontalNav`, `type DashboardNavSurface` |
| `DashboardModuleRail` | `DashboardModuleRail`, `CLINIC_MODULE_RAIL_ITEMS` |
| `AdminMobileBottomNav` | `AdminMobileBottomNav` |
| `ClinicMobileBottomNav` | `ClinicMobileBottomNav` |
| `AdminMobileHubLauncher` | `AdminMobileHubLauncher` |
| `AdminMobileHubPager` | `AdminMobileHubPager` |
| `AdminMobileModuleMenu` | `AdminMobileModuleMenu` |
| `DashboardPager` | `DashboardPager`, `type DashboardPagerProps`, `DASHBOARD_PAGER_RESERVATION`, `DASHBOARD_TOUCH_PAGER_RESERVATION`, `DASHBOARD_INLINE_PAGER_RESERVATION` |
| `CompactPager` | `CompactPager`, `type CompactPagerProps` |

El catálogo sigue siendo single-owner: `CLINIC_MODULE_NAV_LABELS` y
`buildDashboardModuleHref` se consumen desde `@/features/dashboard/config` y
`@/features/dashboard/application`; los barrels no redeclaran ids, labels,
storage keys ni tablas de navegación.

## 8. `DashboardTopbar` — excluido temporalmente

`frontend/src/components/dashboard/DashboardTopbar.tsx:12` importa `@/lib/api`
directamente (`logout`, `logoutAdmin`). Exponerlo por `presentation/shell`
convertiría el barrel en la vía sancionada de un componente que viola la regla
de frontera que el propio barrel declara, y obligaría a escribir el guard en su
versión débil para que pasara — exactamente el riesgo **R4** de §59
("realinear tests de contrato degenera en debilitarlos").

**B01 no modifica `DashboardTopbar` ni `DashboardLogoutControl`.** Ambos
concentran la misma responsabilidad de logout (duplicación funcional de
responsabilidad; no se ha verificado igualdad textual). Sacar el logout a
`application` es auth-adjacent y por tanto **R2**: PR separado.

La exclusión **no está congelada**. El guard no afirma en ningún punto que la
violación persista: aplica la regla genérica "ningún módulo re-exportado puede
importar `@/lib/api`". Cuando ese import desaparezca, `DashboardTopbar` pasa a
ser admisible sin editar el guard.

## 8-bis. `AdminMobileKebabMenu` — excluido por frontera transitiva (review fix)

Hallazgo **P2 de Codex** en la revisión de PR #1658, **confirmado como correcto**.

La primera versión del guard afirmaba "ningún módulo reexportado alcanza la data
layer" pero solo inspeccionaba el **target inmediato** de cada re-export. Un
componente sancionado puede alcanzar `@/lib/api` **a través de otro componente
local**, y en ese caso el guard reportaba la frontera como limpia mientras el
export sancionado seguía cruzándola. Falso verde real, no hipotético:

```text
presentation/navigation
  -> AdminMobileKebabMenu
     -> DashboardLogoutControl      -> @/lib/api
     -> DashboardNotificationsBell  -> @/lib/api
```

**Censo transitivo completo** ejecutado sobre los 15 roots sancionados antes de
tocar ningún barrel (no se parcheó solo el ejemplo del review). Resolver
estático con alias `@/`, specifiers relativos, extensiones `.ts`/`.tsx`, index
modules y visited set; **0 specifiers locales sin resolver**, así que el censo no
tiene saltos silenciosos:

| Barrel | Roots | Veredicto |
|---|---|---|
| `shell` | `DashboardShellRouter`, `PrivateDashboardShell`, `DashboardModuleWorkspace`, `DashboardModuleHub`, `DashboardHubHero` | 5/5 **PASS** |
| `navigation` | `DashboardHorizontalNav`, `DashboardModuleRail`, `AdminMobileBottomNav`, `ClinicMobileBottomNav`, `AdminMobileHubLauncher`, `AdminMobileHubPager`, `AdminMobileModuleMenu`, `DashboardPager`, `CompactPager` | 9/9 **PASS** |
| `navigation` | `AdminMobileKebabMenu` | **FAIL** (cadenas arriba) |

**Un solo root falla**, y solo ese se retira. No se sobre-excluyó por sospecha:
toda exclusión exige una cadena concreta hasta la dependencia prohibida.

**Decisión: retirar el re-export, no refactorizar el componente.** B01 no está
autorizado a refactorizar componentes runtime/auth para hacerlos compatibles
(§4 de AGENTS.md: sacar el logout es auth-adjacent, R2, PR separado). Se retira
`AdminMobileKebabMenu` del barrel y de `REQUIRED_EXPORTS`, preservando cero
cambio de runtime, cero migración de consumidores y cero cambio de auth/API.

`AdminMobileKebabMenu` **no es un componente muerto y no pertenece a B02**: es un
componente vivo con consumidores reales. Es una **exclusión de frontera B01**, no
una eliminación. El archivo legacy no se toca, sus consumidores siguen
importándolo por su path actual, y queda admisible automáticamente —sin editar
el guard— en cuanto `DashboardLogoutControl` y `DashboardNotificationsBell`
dejen de importar `@/lib/api`.

## 9. Sidebars muertos — excluidos (dominio B02)

`AdminDashboardSidebar` y `ClinicDashboardSidebar` tienen **cero consumidores
runtime** (verificado en todo el repo; solo se importan entre sí y desde
`DashboardSidebar.tsx`, también muerto). Son parte de los 6 componentes que
**B02** retira (§47.2). Darles superficie de import pública en B01 para
retirarla en B02 sería churn puro, y §56.1 exige "sin componentes muertos".

**B01 no los borra ni los modifica**: simplemente no los incorpora a la nueva
API de `presentation`. El guard lo fija con un `FORBIDDEN_EXPORTS` explícito,
documentado como valla de scope y no como veredicto permanente.

## 10. Architecture guard

`test/architecture/dashboard-presentation-import-boundaries.test.ts` — 8 tests.

Es la forma ejecutable del criterio de cierre de §54 ("sin imports cruzados") y
del plan de pruebas de §56.1. Verifica:

1. `shell/index.ts` expone los REQUIRED_EXPORTS de B01.
2. `navigation/index.ts` expone los REQUIRED_EXPORTS de B01.
3. Todo re-export apunta a un target existente bajo `components/dashboard/`.
4. Cada símbolo declarado está realmente exportado por su target.
5. Ningún source físico bajo `presentation/**` importa `@/lib/api` ni `@/app`.
6. **Nada alcanzable desde los barrels** —a cualquier profundidad— llega a
   `@/lib/api` ni a `@/app`.
7. La valla B02: los sidebars no aparecen en `navigation/index.ts`.
8. Los barrels son módulos de re-export puro, sin declaraciones locales.

**Cierre transitivo (test 6).** El recorrido **arranca en el barrel**, no en la
lista de targets, y sigue recursivamente cada arista de import/re-export
*first-party* hasta agotar la clausura. Cubre por tanto los imports propios del
barrel, cada target sancionado y todo lo que esos targets arrastran a cualquier
profundidad. Consecuencias: un re-export añadido mañana entra solo al recorrido,
y **un import local nuevo dentro de un componente ya sancionado también queda
cubierto automáticamente**. Los specifiers bare (node_modules) no se siguen: la
frontera gobierna arquitectura first-party.

*Ciclos.* `visited: Set<string>` por recorrido; un ciclo local se absorbe sin
colgar y sin fallar (control M3).

*Aristas type-only.* Se recorren **todas** las aristas, incluidas las
`import type`. Es la lectura deliberadamente más estricta: la regla es una
frontera de dependencia de **arquitectura** sobre el grafo de módulos, y un
`import type` sigue acoplando presentation a un módulo que posee un import de la
capa de datos. Se verificó que no fabrica falsos positivos: recorrer con y sin
aristas type-only produce **veredicto idéntico para los 15 roots actuales**
(divergencia medida = 0), y los dos ciclos type-only preexistentes de
`components/dashboard/` son ciclos, no rutas a la capa de datos, así que el
visited set los absorbe.

*Error accionable.* El fallo imprime la cadena completa, no "forbidden import
somewhere":

```text
frontend/src/features/dashboard/presentation/navigation/index.ts
     -> AdminMobileKebabMenu.tsx
     -> DashboardNotificationsBell.tsx
     -> @/lib/api
```

**Por qué no da falso verde.** Un barrel puede pasar un escaneo ingenuo de
carpeta mientras re-exporta un componente legacy que sí llega a la capa de
datos, directamente o **a través de otro componente local**. Por eso el guard no
se limita a recorrer `presentation/**` ni a mirar el target inmediato: **parsea
los barrels, deriva los targets del propio source** y recorre su clausura
completa. La lista de targets se descubre, nunca se declara como allowlist de
escape. Los tests de conjunto vacío se protegen con aserciones anti-vacuas.

**Falsos positivos evitados.** Los JSDoc de los 7 barrels contienen literalmente
el texto `@/lib/api` al documentar la regla. Un `source.includes("@/lib/api")`
marcaría todos. El guard extrae specifiers solo de declaraciones reales:
patrones anclados a inicio de línea (que una línea de continuación JSDoc `* …`
no puede satisfacer) más una forma de llamada para `import()`/`require()`. El
emparejamiento es exacto-o-subpath, de modo que `@/lib/api-error` no se barre por
accidente. Sin dependencias de parser nuevas.

**Verificación fail-closed.** El guard se validó por mutación sobre una copia
aislada del árbol (fuera del repo, ningún archivo versionado tocado, sandbox
eliminada al terminar). Los 6 controles del recorrido transitivo se comportaron
como se exige y el baseline volvió a 8/8:

| Control | Esperado | Observado |
|---|---|---|
| M1 · root → componente local → `@/lib/api` (el falso verde de Codex) | FAIL | **FAIL** 7/1 — cadena `navigation/index.ts → AdminMobileKebabMenu → DashboardNotificationsBell → @/lib/api` |
| M2 · profundidad 3: root → A → B → `@/lib/api` | FAIL | **FAIL** 7/1 — cadena de 8 saltos, desde `shell/index.ts` |
| M3 · ciclo local limpio A ↔ B | PASS, sin colgar | **PASS** 8/0 en 168 ms |
| M4 · escape relativo `../../app/layout` | FAIL | **FAIL** 7/1 |
| M5 · alias `@/app/layout` | FAIL | **FAIL** 7/1 |
| M6 · `@/lib/api-error` | PASS, sin falso positivo | **PASS** 8/0 |
| baseline restaurado | PASS 8/8 | **PASS** 8/0 |

M1 es exactamente el escenario que el diseño anterior no impedía. M2 demuestra
que el recorrido no se detiene en el primer nivel: la cadena reportada atraviesa
`shell → PrivateDashboardShell → DashboardShellRouter → AdminMobileBottomNav →
AdminMobileModuleMenu → MutA → MutB → @/lib/api`. M3 prueba la terminación por
visited set. M6 prueba el emparejamiento exacto-o-subpath.

## 11. Cero cambios de runtime

Ningún consumidor importa todavía los barrels, y ninguna implementación se tocó.
En consecuencia: DOM idéntico, CSS idéntico, geometría idéntica, zero-scroll
idéntico; auth, cookies, sesiones, roles y permisos idénticos; API, endpoints,
query strings y handlers idénticos; `limit`/`offset` y paginación idénticos.
No se introdujeron atributos `data-*`, JSX, llamadas de red ni handlers nuevos.

## 12. Validaciones

Ver el informe de la corrida en la respuesta de entrega. Gates seleccionados
por AGENTS.md §6: el cambio toca `frontend/src/**` y `test/**`, por lo que
aplican la matriz de frontend no visual y `pnpm validate:local` (que además
ejecuta el guard nuevo dentro del runner completo).

Playwright: **NOT_RUN justificado**. B01 no altera DOM, CSS, geometría ni ningún
path de render, y los barrels no los importa nadie: ninguna cohorte de §7 aplica.

## 13. Riesgos residuales

1. Tres componentes vivos quedan fuera de la nueva superficie por alcanzar
   `@/lib/api`: `DashboardTopbar` (directo) y `AdminMobileKebabMenu`
   (transitivo, vía `DashboardLogoutControl` y `DashboardNotificationsBell`).
   Los tres huecos comparten causa raíz —el logout/notificaciones acoplados a la
   capa de datos dentro de `components/dashboard/`— y ninguno está congelado: el
   guard aplica una regla genérica, nunca afirma que la violación persista.
   Cierre = PR separado (R2, auth-adjacent).
2. Los barrels quedan como superficie declarada que todavía nadie importa. Es el
   diseño previsto por §47.2/R14; el valor de B01 es el guard y habilitar B02+.
3. `export` sobre 10 componentes `"use client"`: sin efecto hoy (nadie importa
   los barrels), pero cuando un PR posterior migre el primer consumidor deberá
   vigilarse el arrastre del grafo client del barrel. El precedente PR-PRES-5 no
   cubre este caso: `StatusBadge` no es client component.
4. Ciclos type-only preexistentes: no agravados, no corregidos, fuera de B01.
5. Los sidebars muertos siguen presentes hasta B02, por diseño.

## 14. Rollback

`git revert` del commit. Restaura los dos barrels a `export {};` y elimina guard
y documento. Sin migraciones, sin cambios de esquema, sin efecto runtime que
deshacer. Coincide con §61: "B01–B02 · Revert restaura los barriles · riesgo
residual nulo".

## 15. Estado final

B01 implementado: 2 barrels poblados (5 + 9 módulos, 26 símbolos), 1 guard
ejecutable con cierre transitivo (8/8), 1 documento. Cero movimiento de runtime,
cero migración de consumidores, cero cambios en los componentes legacy, cero
cambios de auth/API.

Revisión de PR #1658: el hallazgo P2 de Codex sobre el alcance del guard fue
confirmado y corregido en un commit adicional —recorrido transitivo de la
clausura de imports y retirada del único root que fallaba
(`AdminMobileKebabMenu`)—, sin refactorizar ningún componente runtime y sin
salir de los 4 paths B01. Pendiente de autorización de merge de Nico.
**B02 no iniciado.**
