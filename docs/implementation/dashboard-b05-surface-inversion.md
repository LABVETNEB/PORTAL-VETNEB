# B05 — Inversión de la relación de superficie en los 7 superbuscadores

**Programa B · Nivel 3 · Dependencia: B04**

| | |
|---|---|
| Base | `8e50e794e00539647fc134fc55da4066f6bec840` (`feat(dashboard): migrate B04 surfaces to foundation tokens (#1661)`) |
| Rama | `feat/dashboard-b05-surface-inversion` |
| Objetivo roadmap (§49, §54) | «Invertir la relación de superficie (tinte al campo, contenedor transparente)» |
| Criterio de cierre | Campo teñido, contenedor transparente en las 7 superficies |
| Riesgo roadmap | Bajo |

---

## 1. Alcance

### Incluido

1. Retirada del fill del contenedor en las 7 superficies (S1–S7).
2. Consumo de `--dash-color-field` (reservado por B03, declarado 0-consumidores
   por B04) desde un único punto: `styles/dashboard/surfaces.css`.
3. Anchor `data-dashboard-filter-field="true"` en los 2 campos directos de S4 y
   los 6 campos directos de S5 (sin `FilterBar` compartido).
4. Evolución fail-closed de las dos garantías B04 que este cambio rompe
   legítimamente («0 consumidores del token de campo»), sustituidas por un
   límite «exactamente un consumidor, en el path canónico».
5. Realineación del className de chrome pinneado de `FilterBar.tsx` en el
   contrato B04 (perdió `bg-card/82`).
6. Corrección de un defecto P3 preexistente en el regex de censo de
   `dashboard-foundation-tokens.test.ts` (`\w` sin doble escape dentro de un
   template literal, degradaba a `w`).
7. Contrato de arquitectura B05 nuevo (`test/architecture/dashboard-b05-surface-inversion.test.ts`).
8. Gate runtime B05 nuevo, cohorte `visual-contract`
   (`frontend/e2e/regression/dashboard-b05-surface-inversion.spec.ts`),
   registrado en `frontend/e2e/suites/catalog.ts`.

### Excluido deliberadamente

| Fuera de alcance | Motivo |
|---|---|
| `frontend/src/components/ui/input.tsx`, `ui/select.tsx` | Tienen consumidores públicos (Contacto, Login, Particulares); `--dash-color-field` sólo resuelve bajo `.dashboard-app-shell` |
| `frontend/src/app/globals.css`, `.field-select` | Regla global compartida con la web pública; consumir el token ahí rompe el boundary B04 |
| B06/B07/B08/B12 | Niveles 4–5; ningún componente de navegación se crea ni retira |
| Backend, DB, dependencias, CI, workflows, config productiva | Fuera de alcance frontend visual |
| Geometría, row pitch, `limit`/`offset`, paginación | A05–A07 siguen siendo el owner; hash byte-idéntico |
| Handlers, submit, query params, endpoints de los 7 superbuscadores | Contrato operativo del audit §17, congelado |
| Bordes de los contenedores | «Contenedor transparente» se interpretó como fill removido, borde conservado — decisión autorizada explícitamente para esta implementación |
| Ampliar el fixture E2E hermético para poblar tokens de clínica | Autorizado explícitamente NO hacerlo; S7 queda BLOCKED con causa documentada |
| Convertir todos los `ModuleDialog` del repo a `dashboardScopedPortal` | Sólo los 4 call sites con dialog mobile+FilterBar compartido (S1/S3/S6/S7) lo activan; los otros 14 usos conservan `document.body` sin cambios (§5b) |
| Añadir un mobile `ModuleDialog`+`FilterBar` a S2 | S2 nunca tuvo uno — su filtro mobile es un formulario de un solo campo, no derivado de `FilterBar`; fuera de alcance construir esa UI ahora |

---

## 2. Censo de `--dash-color-field`

```
DECLARACIONES (2, sin cambios — B03)
  tokens.css:83   hsl(var(--vetneb-surface-muted) / 0.72)   light,  .dashboard-app-shell
  tokens.css:220  hsl(var(--vetneb-surface-muted) / 0.92)   dark,   :root[data-theme="dark-gray"] .dashboard-app-shell

RUNTIME CONSUMER (1, nuevo — B05)
  frontend/src/styles/dashboard/surfaces.css   dashboard-b05-field-inversion:{start,end}
```

Verificado por `test/architecture/dashboard-foundation-tokens.test.ts` (test
«the B05 field token has exactly one runtime consumer») y
`test/architecture/dashboard-b04-surface-token-migration.test.ts` (test «the
B05 field token has exactly one runtime consumer»), ambos comparando contra el
mismo `B05_FIELD_TOKEN_CANONICAL_PATH`.

---

## 3. Matriz S1–S7

| ID | Superficie | Archivo | Contenedor (antes → después) | Campo | Anchor de campo |
|---|---|---|---|---|---|
| S1 | Admin → Auditoría | `AdminAuditFilterBar.tsx` (vía `FilterBar.tsx`) | `bg-card/82`/`bg-muted/15` → transparente | `Select`×2 + `Input`×4 | descendiente de `[data-dashboard-filter-bar="true"]` |
| S2 | Admin → Tokens particulares | `AdminParticularTokensCard.tsx` (vía `FilterBar.tsx`) | ídem | `Input`×6 + `Select`×1 | ídem |
| S3 | Admin → Informes | `AdminReportsCard.tsx` (vía `FilterBar.tsx`) | ídem | `Input`×7 + `Select`×1 | ídem |
| S4 | Admin → Gestión de clínicas | `AdminClinicsManagementCard.tsx` | ya transparente (regresión guardada) | `Input`×2 (desktop+mobile) | `data-dashboard-filter-field="true"` directo |
| S5 | Admin → Usuarios y roles | `AdminUsersRolesReadOnlyCard.tsx` | `bg-muted/15`×3 bandas → transparente | `Input`×2 + `.field-select`×4 | `data-dashboard-filter-field="true"` directo |
| S6 | Clínica → Informes | `ClinicInformesWorkspaceSummary.tsx` (vía `FilterBar.tsx`) | ídem S1 | `Input`×6 + `Select`×1 | descendiente de `[data-dashboard-filter-bar="true"]` |
| S7 | Clínica → Tokens particulares | `ClinicParticularTokensCard.tsx` (vía `FilterBar.tsx`) | ídem S1 | `Input`×5 + `Select`×1 | ídem |

5 de 7 superficies (S1/S2/S3/S6/S7) resuelven su contenedor en un único
archivo (`FilterBar.tsx`); sólo S4 y S5 se tocaron individualmente.

---

## 4. Implementación CSS

`frontend/src/styles/dashboard/surfaces.css`, bloque
`dashboard-b05-field-inversion:{start,end}`, unlayered, después del bloque B04
de elevación de chrome persistente:

```css
.dashboard-app-shell [data-dashboard-filter-bar="true"] input,
.dashboard-app-shell [data-dashboard-filter-bar="true"] select,
.dashboard-app-shell [data-dashboard-filter-field="true"] {
  background-color: var(--dash-color-field);
}
```

`background-color`, no `background`: no despeja ninguna otra capa declarada
sobre el mismo elemento. Unlayered por la misma razón que el bloque B04:
`bg-card/96` y `.field-select` resuelven en `@layer components`/`utilities`,
que una regla sin capa gana.

---

## 5. Mobile filter portal boundary — resuelto (P2, PR #1662 review thread)

### 5a. Hallazgo original

Codex identificó, sobre el commit `0e820061f5` de esta misma PR, que las
superficies compartidas renderizan su versión «mobile» (densidad
`comfortable`) dentro de `ModuleDialog`, que monta vía `Dialog.Portal` de
Radix en `document.body` por defecto — **fuera** de `.dashboard-app-shell`,
el único elemento donde `--dash-color-field` se declara. Esa instancia mobile
no recibía el tinte del campo porque el custom property no resolvía ahí, y el
gate runtime B05 original sólo medía la instancia desktop, ocultando la
regresión (`P2 · Apply the field token inside mobile filter portals`).

Auditado archivo por archivo, el hallazgo aplica a **4 de las 5** superficies
que en teoría comparten `FilterBar`, no a las 5: S1 (`AdminAuditFilterBar`),
S3 (`AdminReportsCard`), S6 (`ClinicInformesWorkspaceSummary`) y S7
(`ClinicParticularTokensCard`) genuinamente invocan
`renderAdvancedFilterForm(true)` (o el equivalente) dentro de un
`ModuleDialog`. **S2** (`AdminParticularTokensCard`) no: su función
`renderAdvancedFilterForm(mobile = false)` nunca se llama con `mobile = true`
en ningún punto del archivo — la rama «comfortable» es código muerto — y su
filtro mobile real es un formulario de un solo campo (`Input` de clínica)
fuera de cualquier `ModuleDialog`, que nunca fue un consumidor de B05 ni
antes ni después de este fix.

### 5b. Fix

`ModuleDialog.tsx` gana una prop opcional, `dashboardScopedPortal` (default
`false`): cuando está activa, resuelve —vía `useLayoutEffect`, antes del
primer paint— el nodo `[data-dashboard-portal-root="true"]` que
`DashboardShellRouter.tsx` ahora renderiza como último hijo de
`.dashboard-app-shell`, y lo pasa como `container` a `Dialog.Portal`. Cuando
la prop está apagada (todo el resto de la app), `container` es `undefined` y
Radix usa su propio default (`document.body`), sin cambio observable.

Reparentar el DOM portalled dentro de `.dashboard-app-shell` es **la única
corrección necesaria**: el selector CSS ya existente
(`.dashboard-app-shell [data-dashboard-filter-bar="true"] input`) y la
herencia del custom property son ambos conceptos de DOM real, no de árbol de
React — al mover el nodo, ambos empiezan a resolver correctamente sin tocar
`surfaces.css` ni `tokens.css`. Verificado: `--dash-color-field` sigue con un
único consumidor runtime (§2), sin cambios.

Activada explícitamente en los 4 call sites afectados
(`dashboardScopedPortal` como prop booleana en el JSX del trigger); los
otros 14 usos de `ModuleDialog` en el repo no la activan y siguen portando a
`document.body` sin cambio de comportamiento.

`position: fixed` de `Dialog.Overlay`/`Dialog.Content` sigue posicionando
contra el viewport: ni `.dashboard-app-shell` ni `[data-vetneb-app-shell-frame]`
declaran `transform`, `filter`, `will-change` ni `contain`, así que ningún
ancestro nuevo crea un containing block para elementos `fixed`. El focus trap
y el `aria-hidden` de hermanos que gestiona Radix operan sobre el DOM
renderizado, no sobre `document.body` específicamente, así que el
comportamiento de foco/teclado del diálogo es idéntico.

### 5c. Estado

El gate runtime B05 (§7) ahora abre el diálogo mobile real (clic en el
trigger «Filtros», espera `[data-module-dialog="true"][data-state="open"]`)
y lee el mismo campo/contenedor que en desktop, en ambos viewports, para
S1/S3/S6 (S7 permanece BLOCKED por el fixture, ver §7). S2 se mantiene
desktop-only **porque nunca tuvo instancia mobile**, no por exclusión.

---

## 6. Contratos estáticos

### 6.1 Evolución de guards B04 heredados

| Test | Antes | Después |
|---|---|---|
| `dashboard-foundation-tokens.test.ts` («the B05 field token is still reserved after B04») | 0 consumidores | Renombrado a «the B05 field token has exactly one runtime consumer»: exactamente `frontend/src/styles/dashboard/surfaces.css` |
| `dashboard-b04-surface-token-migration.test.ts` («B04 leaves the B05 field token unconsumed», T7) | 0 consumidores | Renombrado a «the B05 field token has exactly one runtime consumer»: mismo límite, mismo censo (3 árboles de dashboard) |
| `dashboard-b04-surface-token-migration.test.ts` (`CHROME_COMPONENTS`, `FILTER_BAR_TSX`) | className pinneado con `bg-card/82` | Realineado sin `bg-card/82`; sigue probando ausencia de `shadow-*` |

Ninguna garantía se debilitó: ambas pasaron de «cero» a «exactamente uno, en
el path correcto», que sigue bloqueando `components/ui/**` y
`app/globals.css` (cubierto también por `B04_CONSUMER_PREFIXES`, sin tocar).

### 6.2 Contrato B05 nuevo

`test/architecture/dashboard-b05-surface-inversion.test.ts` — 21 tests
(9 originales + 7 del boundary de portal mobile + 5 de mutación):

| Test | Qué prueba |
|---|---|
| Cardinalidad del manifiesto | 7 anchors de contenedor (FilterBar ×2 + S5 ×3 + S4 ×2), no 8 — corrige la narrativa del audit, deriva del array real |
| Anchors de contenedor resuelven 1x | Cada className/atributo pinneado existe exactamente una vez en su archivo |
| Sin fill en los 7 anchors | Ninguno de los 7 lleva `bg-card/*` ni `bg-muted/*` |
| Anchors de campo directo | 2 en `AdminClinicsManagementCard.tsx`, 6 en `AdminUsersRolesReadOnlyCard.tsx` |
| `FilterBar` conserva su anchor compartido | `data-dashboard-filter-bar="true"` sigue presente |
| Regla CSS declara `background-color: var(--dash-color-field)` una vez | Sin `background` shorthand, sin `box-shadow` (G6 intacto) |
| Regla cubre ambos anchors | shared (`input`/`select` descendientes) y directo (`[data-dashboard-filter-field]`) |
| Regla scoped bajo `.dashboard-app-shell` | Cada selector del grupo empieza con ese prefijo |
| Sin consumidor fuera de alcance | `components/ui/input.tsx`, `ui/select.tsx`, `app/globals.css` no contienen el token |
| Portal-root anchor único dentro de `.dashboard-app-shell` | `DashboardShellRouter.tsx` |
| `dashboardScopedPortal` opcional, default `false`, apunta al anchor exacto | `ModuleDialog.tsx` |
| Exactamente 4 call sites lo activan, una vez cada uno | S1/S3/S6/S7 |
| Ningún otro `ModuleDialog` del repo lo activa | Censo de los 18 usos totales |
| S2 no lo activa — no tiene diálogo mobile con `FilterBar` | `renderAdvancedFilterForm(true)` nunca aparece en `AdminParticularTokensCard.tsx` |
| Anchor/prop nunca alcanzan `components/public/`, `components/ui/` ni `globals.css` | Barrido recursivo de esos árboles |
| El manifiesto E2E ya no restringe SHARED a sólo desktop | Grep del propio spec por el patrón anterior |
| Mutación M1/M3/M3b/M4/M5 | Fail-closed sobre fixtures sintéticas, sin tocar archivos tracked |

### 6.3 Corrección P3 — regex de censo

`dashboard-foundation-tokens.test.ts`, función `foundationConsumers()`: el
patrón `` `${token}(?![\w-])` `` dentro de un template literal degradaba
`\w` a `w` (escape no reconocido). No producía falso positivo/negativo
observable porque el caso que importa (`--dash-color-surface` vs
`-surface-muted`) queda bloqueado igual por la alternativa `-`, pero no era el
patrón previsto. Corregido a `` `${token}(?![\\w-])` `` (doble escape).
Verificado con el propio test suite tras el fix (33/33 PASSED).

---

## 7. Gate runtime B05

`frontend/e2e/regression/dashboard-b05-surface-inversion.spec.ts`, cohorte
`visual-contract`.

| Dimensión | Valor |
|---|---|
| Superficies | 7 (S1–S7), no las 21 del gate B04 |
| Temas | `normal`, `dark-gray` |
| Viewports | S1/S3/S6/S7: `1366x768` + `390x844` (mobile abre el diálogo real, §5c). S2: sólo `1366x768` (sin instancia mobile, §5a). S4/S5: `1366x768` + `390x844` (markup real y simultáneo por breakpoint, sin cambios) |
| Apertura mobile | Clic en el trigger accesible «Filtros» (`getByRole("button")`, con retry por posible carrera de hidratación) → espera `[data-module-dialog="true"][data-state="open"]` visible antes de leer campo/contenedor |
| Verificación | `getComputedStyle` real: contenedor con alpha 0, campo con alpha > 0, colores de campo distintos entre sí y entre temas — no una búsqueda de texto por `var(--dash-color-field)` |
| S7 (clinic-tokens) | `test.skip` con causa explícita: el fixture hermético no implementa `/api/particular-tokens`; `ClinicParticularTokensCard` sólo monta su `FilterBar` con `tokens.length > 0`, desktop o mobile |

---

## 8. Validaciones ejecutadas

| Comando | Estado | Nota |
|---|---|---|
| `node --test test/architecture/dashboard-foundation-tokens.test.ts` | PASSED | 21/21 |
| `node --test test/architecture/dashboard-b04-surface-token-migration.test.ts` | PASSED | 12/12 |
| `node --test test/architecture/dashboard-b05-surface-inversion.test.ts` | PASSED | 21/21 (9 originales + 7 boundary + 5 mutación) |
| `node --test test/architecture/e2e-suite-catalog-completeness.test.ts` (`e2e:verify-catalog`) | PASSED | 6/6 |
| Unit tests de las 7 superficies + ModuleDialog + DashboardShellRouter + primitivas de tokens | PASSED | 171/171 |
| `pnpm --dir frontend lint` | PASSED | exit 0 |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| `pnpm --dir frontend build` | PASSED | exit 0 |
| `pnpm security:public-surface` | PASSED | sin hallazgos nuevos |
| `pnpm validate:local` | PASSED | 4249/4250, 1 skip preexistente no relacionado |
| `pnpm --dir frontend e2e:visual-contract` | PASSED | 325 passed, 1 skipped (S7), 0 failed — incluye S1/S3/S6 abriendo el diálogo mobile real |
| `pnpm --dir frontend e2e:admin-mobile` | PASSED | 133/133 |
| `pnpm --dir frontend e2e:extended` | PASSED | 237/237 |

---

## 9. Rollback

Directo: revertir el/los commit(s). `--dash-color-field` vuelve a 0
consumidores runtime, los dos guards B04 heredados vuelven a su forma
«reservado», el manifest B05 se elimina junto con su spec y su entrada de
catálogo. El fix del portal mobile (§5) revierte independientemente:
`dashboardScopedPortal` vuelve a `false` en los 4 call sites (o se elimina la
prop entera), `DashboardShellRouter` pierde el anchor, y las 4 superficies
vuelven a portar a `document.body` sin tinte mobile — mismo estado que antes
del fix, no un estado nuevo roto. Ningún otro programa (B06+) depende de
este cambio.

---

## 10. Riesgos residuales

- S7 (clinic-tokens) queda sin cobertura runtime, desktop y mobile —
  BLOCKED documentado, no inferido como PASSED. Cobertura estática completa
  vía `FilterBar` compartido y el mismo boundary `dashboardScopedPortal` que
  S1/S3/S6 (§6.2).
- S2 (admin-tokens) mobile sigue sin recibir el tinte B05 — pero porque
  nunca tuvo una instancia `FilterBar`+`ModuleDialog` que consumirlo, no por
  un boundary sin resolver. Su formulario mobile de un solo campo queda
  fuera del contrato B05 tal como estaba definido antes de esta PR.
- Los 20 baselines de regresión visual Linux
  (`visual-regression-authenticated.spec.ts`) no se regeneraron en esta
  ejecución (Windows local, `targetGate: manual`, plataforma Linux). Capturan
  `/dashboard` y `/dashboard/admin` sin `?module=`, aterrizando en hub/módulo
  por defecto — es posible que no cambien, pero no se verificó.

---

## 11. Estado

Implementación local completa, incluido el fix P2 del portal mobile (§5).
Todos los gates seleccionados (§8) en PASSED. Pendiente: revisión final de
diff y las acciones `[MANUAL-NICO]` (stage, commit, push).
