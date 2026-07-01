# Server Adaptive Pagination Strategy (PR-SRV-0)

> **PR-SRV-0 — docs-only.** Define la política de migración de los módulos Admin/server (`limit`/`offset`)
> a cardinalidad adaptativa (Zero-Scroll) **antes** de tocar producción. Este PR **no implementa código**.

---

## 1. Estado base y scope

| Campo | Valor |
|---|---|
| Fecha | 2026-07-01 |
| Repositorio | Portal VETNEB (`C:\PORTAL-VETNEB`) |
| Rama | `docs/server-adaptive-pagination-strategy` |
| Base esperada | `main @ 5b28e33 feat(clinic): redesign logistics master-detail workspace (#1219)` |
| Documento rector | `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md` (PR-GLOBAL-0) |
| Alcance | **Docs-only.** Un único archivo Markdown. |
| Cambios de código | **Ninguno.** No toca `frontend/src`, `frontend/e2e`, tests, backend, API, auth, DB, migrations, deps, lockfiles, snapshots, CI, `globals.css` ni producción. |

**Precedentes cerrados que habilitan este PR:**

- `#1212/#1213` Clínica Tokens adaptive (piloto cliente, familia A).
- `#1215` foundation (`useAdaptiveItemsPerPage`, `--dash-row-h`).
- `#1216` Clínica Informes summary adaptive (cliente, familia B).
- `#1217` Admin Maintenance dry-run adaptive (cliente, familia A).
- `#1218` PR-MD-1 docs-only blocked.
- `#1219` Logística Clínica redesign (master-detail).

Todo lo anterior es **cliente** (`usePagedRows` en memoria). Lo que sigue —los módulos Admin de servidor—
es **familia C (`limit`/`offset`)**, con riesgo P1, y por eso la matriz lo bloquea hasta este PR.

**Evidencia de fuente verificada al HEAD base** (grep + lectura; sólo lectura, sin edición):

| Módulo (archivo) | Constante | Modelo pág. | Estado local | `total` expuesto | matchMedia | Rol de matchMedia |
|---|---|---|---|---|---|---|
| `app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | `PAGE_SIZE=8` | offset | `useState(offset)` | **sí** (`snapshot.total`) | `min-width:768` | **gate de fetch** (`if (!isDesktopViewport) return`) |
| `app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | `PAGE_SIZE=9` | offset | `useState(offset)` | **sí** (`snapshot.total`) | `min-width:768` | **gate de fetch** |
| `app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | `PAGE_SIZE=5` | offset | `useState(offset)` | **sí** (`snapshot.total`) | NO CONFIRMADO | — |
| `app/dashboard/admin/AdminClinicsManagementCard.tsx` | `PAGE_SIZE=9` / `MOBILE_PAGE_SIZE=10` | offset | `currentOffset` | NO CONFIRMADO (usa `hasNext` por página llena) | `max-width:767` | **cardinalidad** (`effectivePageSize = isMobile ? MOBILE : PAGE_SIZE`) |
| `app/dashboard/admin/AdminReportsCard.tsx` | `PAGE_SIZE=9` / `MOBILE_PAGE_SIZE=10` | page | `page` | por página | `max-width:767` | **cardinalidad** (`limit`/`offset` divergen por rama) |
| `app/dashboard/admin/AdminParticularTokensCard.tsx` | `PAGE_SIZE=9` / `MOBILE_PAGE_SIZE=10` | offset | `offset` | **NO** (API sin total; heurística de página llena) | `max-width:767` | **cardinalidad** |
| `app/dashboard/admin/AdminAuditCard.tsx` (+ `AdminAuditDenseTable.tsx`) | `ADMIN_AUDIT_PAGE_SIZE=9` | page | `page` (en `page.tsx`) | **sí** (`totalCount`) | NO CONFIRMADO | — |
| `app/dashboard/informes/page.tsx` | `REPORTS_PAGE_SIZE=6` | page | `page` | **sí** (`reportsTotal`) | NO CONFIRMADO | — |

**Conclusión de evidencia:** existen **tres subgrupos servidor**, no uno solo:

1. **Con `total` + offset/page + matchMedia sólo como gate de fetch** → Sessions, Roles, FailedLogin, Audit, informes route.
2. **matchMedia gobernando la cardinalidad** (peor acoplamiento) → Clinics, Reports, Tokens admin.
3. **Sin `total` expuesto por el endpoint** (no se puede calcular `pageCount`) → Tokens admin (particular).

Esta segmentación es la base de las decisiones §5.

---

## 2. Skills / modelo / esfuerzo

| Rol | Skill / valor |
|---|---|
| Principal | `vetneb-production-web-optimization-engineer` |
| Complementaria | `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` |
| Complementaria | `vetneb-staff-senior-full-stack-engineer` |
| Guardrail | `vetneb-security-production-invariants` |
| Modelo | Opus 4.8 (`claude-opus-4-8`) |
| Esfuerzo | Alto / exhaustivo (verificación de fuente por módulo) |

El ZIP/carpeta de skills **no fue copiado, descomprimido, editado, versionado ni ejecutado** en el repo.

---

## 3. Por qué PR-SRV-0 es necesario antes de PR-SRV-1

Los módulos cliente ya cerrados sustituyen un `pageSize` local por `itemsPerPage` medido y reusan
`usePagedRows`, que ya clampa la página. **En servidor esa sustitución no es libre**, por tres razones
verificadas en la fuente:

1. **`itemsPerPage` es `limit` de red.** Cambiar la cardinalidad al medir/redimensionar dispara un
   **re-fetch**; sin control puede generar N requests por gesto de resize/zoom y **carreras de `offset`**
   (una respuesta vieja pisa a una nueva con distinto `limit`).
2. **Dualidad desktop/mobile.** Cada módulo tiene `AdminXxxReadOnlyCard` (desktop) + `AdminMobileXxxModule`
   (mobile) con constantes divergentes (`PAGE_SIZE` vs `MOBILE_PAGE_SIZE`), decididas por `matchMedia`.
   Migrar sin colapsar la dualidad duplica el trabajo y perpetúa la cardinalidad por dispositivo.
3. **`matchMedia` de cardinalidad.** En Clinics/Reports/Tokens `matchMedia` **elige cuántas filas pedir**,
   violando la regla 10 del contrato global. Reemplazarlo por medición cambia el flujo de fetch, no sólo
   un número.

Sin una política escrita por módulo (qué endpoint tiene `total`, cuál over-fetchea, cuál re-fetchea, cómo
se recomputa `offset`, cómo se corta la carrera), PR-SRV-1 quedaría a criterio ad-hoc y con riesgo P1 en
producción. **PR-SRV-0 fija esa política; PR-SRV-1 la ejecuta en un solo módulo.**

---

## 4. Inventario de módulos servidor bloqueados

| # | Módulo | Archivo | Familia | `total` | matchMedia | Riesgo | Nota clave |
|---|---|---|---|---|---|---|---|
| 1 | Sesiones | `AdminSessionsReadOnlyCard.tsx` | C | sí | gate | P1 | `total` disponible; mm sólo evita fetch en mobile. Candidato PR-SRV-1. |
| 2 | Roles clínica | `AdminUsersRolesReadOnlyCard.tsx` | C | sí | gate | P1 | Idéntico a Sessions; `PAGE_SIZE=9`. Candidato PR-SRV-1. |
| 3 | Clínicas | `AdminClinicsManagementCard.tsx` | C | heurística | **cardinalidad** | P1 | `effectivePageSize` por mm + drawer de edición. |
| 4 | Informes (workflow) | `AdminReportsCard.tsx` | C | por página | **cardinalidad** | P1 | `limit`/`offset` divergen por rama mobile/desktop. |
| 5 | Tokens particulares (admin) | `AdminParticularTokensCard.tsx` | C | **no** | **cardinalidad** | P1 | Endpoint **sin total**: no hay `pageCount`. |
| 6 | Auditoría | `AdminAuditCard.tsx` + `AdminAuditDenseTable.tsx` | C | sí (`totalCount`) | NO CONFIRMADO | P1 (alto volumen) | Paginación por `page` en `page.tsx`; dataset grande. |
| 7 | Alertas login | `AdminFailedLoginAlertsReadOnlyCard.tsx` | C | sí | NO CONFIRMADO | P2 | `PAGE_SIZE=5`; volumen bajo-medio. |
| 8 | Informes (ruta full) | `app/dashboard/informes/page.tsx` | C | sí (`reportsTotal`) | NO CONFIRMADO | P2 | Server component + `page` index. |
| 9 | Mobile Sesiones | `AdminMobileSessionsModule.tsx` | C | sí | `max-width:767` | P2 | Colapsar con #1. |
| 10 | Mobile Usuarios | `AdminMobileUsersModule.tsx` | C | sí | `max-width:767` | P2 | Colapsar con #2 (`MOBILE_PAGE_SIZE=3`). |
| 11 | Mobile Auditoría | `AdminMobileAuditModule.tsx` | C | sí | gate | P2 | Colapsar con #6. |
| 12 | Mobile Command (failed-login) | `AdminMobileCommandModule.tsx` | C | sí | `max-width:767` | P2 | Colapsar con #7. |

> Los `AdminMobile*Module` (#9-#12) **no reciben migración propia**: colapsan en la variante única medida
> del módulo desktop correspondiente (§5, decisión "colapsar mobile/desktop"). No se listan Pricing/Maintenance
> mobile porque son cliente (`slice`), ya cubiertos por PR-CLIENT-2, fuera de scope servidor.

---

## 5. Decisión por módulo

Opciones normalizadas:
- **OF** = over-fetch de superset (una query con `limit` amplio; paginar el superset en cliente con `usePagedRows`).
- **RF** = re-fetch debounced (nueva query con `limit` derivado; `AbortController` + recompute de `offset`).
- **HY** = híbrido (superset con cap; re-fetch sólo al exceder el superset o al cambiar filtros).
- **Colapsar** = fusionar desktop `ReadOnlyCard` + `AdminMobile*Module` en una variante única medida.

| Módulo | Estrategia datos | Colapsar mobile/desktop | Qué queda bloqueado / condición |
|---|---|---|---|
| Sesiones (#1) | **HY** (superset cap 32, re-fetch al exceder) | Sí (con #9) | Nada extra; `total` presente. **Recomendado PR-SRV-1.** |
| Roles (#2) | **HY** (superset cap 36) | Sí (con #10) | Nada extra; `total` presente. Alternativa PR-SRV-1. |
| Clínicas (#3) | **HY** (superset cap 36) + eliminar `effectivePageSize` | Sí | Drawer de edición debe preservar selección al recomputar (§6). |
| Informes workflow (#4) | **HY** (superset cap 36) + unificar `limit` | Sí | Filtros server-side deben resetear `offset` a 0 (§6). |
| Tokens admin (#5) | **OF con cap + "cargar más"** (no hay `total`) | Sí | **Bloqueado** hasta confirmar si el endpoint puede exponer `total`; si no, sin `pageCount` (sólo `hasNext`). Va en PR-SRV-2, no en SRV-1. |
| Auditoría (#6) | **RF debounced** (alto volumen) | Sí (con #11) | **Bloqueado** hasta medir payload real; RF por volumen. PR-SRV-2 tardío. |
| Alertas login (#7) | **RF debounced** (o OF cap 25 si volumen bajo) | Sí (con #12) | Confirmar volumen antes de elegir OF vs RF. |
| Informes ruta (#8) | **RF** (server component; `limit` derivado en el fetch de servidor) | N/A | Requiere pasar viewport medido al server component (client wrapper). Bloqueado hasta diseñar el traspaso. |

**Regla transversal:** en todos los casos, el `PAGE_SIZE`/`MOBILE_PAGE_SIZE` actual **no se elimina**: pasa a
`fallbackItems` (SSR + primer paint). `MOBILE_PAGE_SIZE` deja de ser fuente de verdad y se borra como constante
independiente en **PR-CLEAN-1**, no antes (evita romper la variante mobile mientras coexisten).

---

## 6. Política de offset

Al cambiar `limit` (de `L0` a `L1`), la página debe seguir mostrando **el mismo primer registro visible**,
no el mismo número de página.

**Recompute (pseudo-código, sólo ilustrativo):**

```
// previousFirstVisibleIndex = índice 0-based del primer registro visible ANTES del cambio.
// Para modelo offset: previousFirstVisibleIndex = offset
// Para modelo page:   previousFirstVisibleIndex = (page - 1) * L0

const firstVisible = previousFirstVisibleIndex;
let newOffset = Math.floor(firstVisible / L1) * L1;   // alinea al inicio de página con el nuevo limit

// Clamp de página contra el total (cuando el endpoint lo expone):
if (total != null) {
  const lastValidOffset = Math.max(0, (Math.ceil(total / L1) - 1) * L1);
  newOffset = Math.min(newOffset, lastValidOffset);
}
newOffset = Math.max(0, newOffset);

// Modelo page:
const newPage = Math.floor(newOffset / L1) + 1;
```

**Reglas:**

1. `offset = floor(previousFirstVisibleIndex / newLimit) * newLimit`. Nunca conservar el `offset` viejo tal cual.
2. **Clamp de página** contra `total` cuando existe (Sessions/Roles/FailedLogin/Audit/informes). Si el endpoint
   **no expone `total`** (Tokens admin #5), no hay `pageCount`: sólo se clampa `offset ≥ 0` y se usa `hasNext`
   por página llena; nunca saltar a "última página".
3. **Preservación de selección/filtros:** los filtros server-side (rol, estado, búsqueda, razón, surface)
   **resetean `offset` a 0** en su propio handler (comportamiento actual), pero un cambio de **cardinalidad**
   (resize/zoom) **no** toca los filtros. La fila/registro seleccionado (drawer de Clínicas, detalle) se preserva
   por su id estable; si su nuevo `offset` calculado la deja fuera de la página visible, se recoloca el `offset`
   para incluirla (prioridad selección > alineación de página).
4. El fallback inicial (`fallbackItems`) usa `offset` tal cual en SSR; el recompute sólo corre tras la primera
   medición real (`isMeasured === true`).

---

## 7. Política anti-race

El re-fetch por cardinalidad introduce concurrencia que hoy no existe. Reglas obligatorias:

1. **AbortController o request id por fetch.** Cada disparo de carga incrementa un `requestId` (o crea un
   `AbortController`); al resolver, se descarta la respuesta si `requestId` ya no es el vigente. Esto evita que
   una respuesta con `L0` pinte sobre el estado con `L1`.

   ```
   const reqId = ++latestRequestRef.current;
   const res = await fetchPage({ limit, offset, signal });
   if (reqId !== latestRequestRef.current) return; // respuesta obsoleta: descartar
   setSnapshot(res);
   ```

2. **Debounce del `ResizeObserver`.** La medición del contenedor se debounce (~120-160 ms) antes de recomputar
   `itemsPerPage`; sólo se dispara re-fetch si `itemsPerPage` **cambia** respecto al vigente (comparación de
   igualdad, no cada callback del observer). El resize continuo no debe generar una ráfaga de queries.
3. **Mantener el fallback inicial.** Mientras `isMeasured === false` (contenedor aún no existe / loading / empty
   / error), el módulo usa `fallbackItems` y **no** re-fetchea por cardinalidad. La geometría de loading/empty/error
   debe ser estable para no auto-disparar mediciones oscilantes.
4. **No usar `matchMedia` para cardinalidad.** `matchMedia` puede sobrevivir **sólo** como señal de presentación
   (p. ej. layout tabla vs cards), nunca para decidir cuántas filas pedir. La cardinalidad la decide siempre la
   medición del contenedor. El `matchMedia` que hoy actúa como **gate de fetch desktop-only** (Sessions/Roles) se
   sustituye por `enabled` del hook (medición sólo cuando el contenedor existe), no por otro breakpoint.

---

## 8. Política de límites

1. **Cap de superset.** Over-fetch/híbrido nunca piden ilimitado. Cap por módulo según cardinalidad esperada
   máxima (viewport alto + zoom bajo) × margen:

   | Módulo | `fallbackItems` (hoy) | Cap superset propuesto |
   |---|---|---|
   | Sesiones | 8 | 32 |
   | Roles | 9 | 36 |
   | Clínicas | 9 | 36 |
   | Informes workflow | 9 | 36 |
   | Alertas login | 5 | 25 |
   | Tokens admin | 9 (sin total) | 30 + "cargar más" |

2. **Cuándo pedir más.** En híbrido, se re-fetchea un superset mayor **sólo** cuando `itemsPerPage` derivado
   supera el superset actual (viewport enorme) o cuando cambia un filtro server-side. En OF puro (Tokens admin),
   al agotar el superset se ofrece "cargar más" (siguiente lote), nunca auto-scroll infinito.
3. **Datasets de alto volumen.** Auditoría (y potencialmente Alertas) **no** usan over-fetch: RF debounced con
   `limit` derivado, porque el superset sería caro y volátil. El cap superior de `limit` para RF se acota igual
   (p. ej. ≤ 50) para proteger el payload; por encima, se pagina.
4. El cap es una constante documentada por módulo, no un valor mágico disperso; convive con `fallbackItems`.

---

## 9. Plan incremental

| PR | Objetivo | Toca (previsto) | No toca | Riesgo |
|---|---|---|---|---|
| **PR-SRV-0** (este) | Política servidor por módulo | `docs/implementation/*.md` | código/producción | P3 |
| **PR-SRV-1** | 1er módulo servidor adaptativo | `AdminSessionsReadOnlyCard.tsx` + colapsar `AdminMobileSessionsModule.tsx`, tests/e2e | otros admin, Tokens, Audit | **P1** |
| **PR-SRV-2** | Lotes posteriores | Roles → Clínicas/Reports (lote) → Tokens admin/Audit/Alertas/informes | — | P1 |
| **PR-CLEAN-1** | Retirar fuentes ilegítimas | eliminar `MOBILE_PAGE_SIZE` y `matchMedia` de cardinalidad ya migrados | presentación legítima | P2 |

### 9.1 Candidato recomendado PR-SRV-1: **Sesiones** (`AdminSessionsReadOnlyCard`)

**Justificación frente a Roles:**

- **`snapshot.total` disponible** → `pageCount` y clamp de §6 totalmente computables (Roles también, empate).
- **`matchMedia` es sólo gate de fetch** (`if (!isDesktopViewport) return`), no cardinalidad → su reemplazo por
  `enabled` del hook es mecánico y de bajo riesgo (Roles idéntico, empate).
- **Desempate a favor de Sesiones:** `PAGE_SIZE=8` (menor) maximiza el gap muerto en pantallas altas → el
  beneficio adaptativo es más visible y la e2e de "filas varían entre 1080 y 720" tiene mayor señal. Además el
  contenido de fila es más homogéneo (estado/tipo/fecha) que Roles → `--dash-row-h` calibra más limpio.
- **No aparece en snapshots visuales críticos** de la misma forma que Clínicas (con drawer) → rollback trivial
  vía `fallbackItems`.

Roles queda como **primer módulo de PR-SRV-2** (patrón idéntico ya validado en SRV-1 → migración mecánica).

### 9.2 PR-SRV-2 lotes posteriores (orden por riesgo creciente)

1. **Roles** (gemelo de Sessions, mecánico).
2. **Clínicas + Informes workflow** (matchMedia de cardinalidad + drawer/filtros; requieren §6 selección y §6 reset de filtros).
3. **Tokens admin** (sin `total`: OF + "cargar más"; **bloqueado** hasta decidir si el endpoint expone `total`).
4. **Auditoría + Alertas** (RF debounced por volumen; medir payload primero).
5. **informes ruta full** (server component; requiere wrapper cliente para pasar la medición).

### 9.3 PR-CLEAN-1

Sólo tras migrar los módulos que consumían cada constante: elimina `MOBILE_PAGE_SIZE` como fuente de verdad y
el `matchMedia` de cardinalidad de los módulos ya adaptativos. Grep-guard (§10) pasa a bloqueante al cerrar.

---

## 10. Validaciones esperadas para futuros PRs

Aplican a PR-SRV-1/2/CLEAN-1 (no a este PR docs-only):

1. **Source-contract tests** (`pnpm test`, `node --test`): presencia de `useAdaptiveItemsPerPage`/`enabled`;
   `PAGE_SIZE` presente **sólo** como `fallbackItems` (no como `limit` directo tras migrar); recompute de `offset`
   presente; `AbortController`/request-id presente; ausencia de `effectivePageSize` derivado de `matchMedia`.
2. **E2E no-scroll / no-gap** (`assertAdaptiveNoScroll` en `dashboard-viewport-zoom-adaptability.spec.ts`):
   `html/body/main` sin scroll; footer/pager visible; conteo de `data-*-row` varía entre 1080 y 720;
   `currentPage`/`offset` válido tras cambio de `itemsPerPage`; sin clipping de la última fila.
3. **Grep guard** contra `MOBILE_PAGE_SIZE` y `matchMedia` como fuente de cardinalidad:
   - `MOBILE_PAGE_SIZE` no debe aparecer como fuente de verdad en módulos migrados.
   - `matchMedia` no debe alimentar `limit`/`effectivePageSize`.
   - Informativo en SRV-1/2 (coexistencia), **bloqueante** al cerrar PR-CLEAN-1.
4. **Checks CI** (`gh pr checks --watch`, sin número): lint + build + test + e2e verdes; sin regenerar snapshots
   sin autorización; ejecutar bajo el protocolo (Nico corre stage/commit/push/PR/checks/merge).
5. **QA manual obligatorio** (matriz §9 global): iOS/Android real, zoom físico 100–175 %, percepción de regresión
   visual antes de cualquier gate bloqueante.

---

## 11. Riesgos y mitigaciones

| Riesgo | Sev | Causa | Mitigación | Evidencia esperada |
|---|---|---|---|---|
| Carrera de `offset` | **P1** | Respuesta con `L0` pisa estado con `L1` | AbortController/request-id (§7.1) | e2e resize→conteo estable |
| Ráfaga de queries en resize/zoom | **P1** | Re-fetch por cada callback del observer | Debounce + comparar `itemsPerPage` (§7.2) | logs de red / e2e sin flood |
| Cardinalidad por dispositivo persiste | **P1** | `matchMedia` decide `limit` | Medición decide; mm sólo presentación (§7.4) | grep cardinalidad=0 |
| Página inexistente | **P1** | `offset` viejo con nuevo `limit` | Recompute + clamp (§6) | e2e clamp |
| Tokens admin sin `total` | **P1** | Endpoint no expone total | OF + `hasNext` + "cargar más"; **bloquear** hasta confirmar total (§5/§9) | POC endpoint |
| Superset caro (Auditoría) | P2 | Dataset de alto volumen | RF debounced, no OF (§8.3) | tamaño de payload |
| Selección perdida en drawer Clínicas | P2 | Recompute reubica la fila seleccionada | Prioridad selección > alineación (§6.3) | e2e drawer abierto |
| Filtros no resetean página | P2 | Cambio de filtro conserva `offset` | Handler de filtro fuerza `offset=0` (§6.3) | e2e filtro on/off |
| Dualidad no colapsada | P2 | Migrar sólo desktop | Colapsar mobile en la misma PR (§5) | grep `MOBILE_PAGE_SIZE`=0 tras CLEAN-1 |
| e2e flaky por race medición↔fetch | P2 | Timing | `toPass` + tolerancias + 3 corridas verdes | 3 verdes consecutivas |
| informes ruta (server component) | P2 | Medición vive en cliente | Wrapper cliente que pasa `limit` al fetch | diseño en SRV-2 |

---

## 12. Confirmación explícita

- **Docs-only:** este PR toca **un único archivo**: `docs/implementation/server-adaptive-pagination-strategy.md`.
- **No producción:** no altera comportamiento en runtime.
- **No backend / API / auth / DB / CI / deps / lockfiles / snapshots:** ninguno modificado.
- **No `frontend/src`, `frontend/e2e`, tests, `globals.css`:** ninguno modificado (sólo lectura para evidencia).
- **ZIP de skills:** no copiado, no descomprimido, no editado, no versionado, no ejecutado dentro de `C:\PORTAL-VETNEB`.

---

*Documento generado como PR-SRV-0 (docs-only). No implementa código. Evidencia de fuente verificada al HEAD base
por lectura; lo no verificable queda marcado NO CONFIRMADO. La ejecución (SRV-1/2, CLEAN-1) queda sujeta al
protocolo VETNEB: Nico ejecuta stage/commit/push/PR/checks/merge.*
