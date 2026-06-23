# PR-B — Pager mobile Admin Core (Clínicas / Informes) al canónico Tokens

- **Rama:** `fix/admin-mobile-core-pager-canonical-layout`
- **HEAD base:** `be63ed3 fix(admin): align mobile ops pager to canonical tokens layout (#1080)`
- **Alcance:** únicamente el paginador mobile (`md:hidden`) de Admin Clínicas e
  Informes. No se toca backend, API, DB, auth, dependencias, lockfiles, CI,
  rutas públicas, producción, Tokens, Ops (#1080) ni dashboard Clínica.

---

## 1. Problema observado

La auditoría previa (`docs/audit/admin-mobile-canonical-tokens-layout-audit.md`,
§3) ya había detectado que la familia **Core** (Clínicas/Informes) cumplía
touch target (`h-9`/`h-9 w-9`) pero divergía visualmente del canónico Tokens:

- Paginador `justify-between` (rango a la izquierda, controles a la derecha) en
  vez de **centrado**.
- Controles `ChevronLeft`/`ChevronRight` icon-only (`h-9 w-9 p-0`) en vez de
  texto `Anterior` / `Siguiente`.
- Texto de rango lateral (`X–Y de Z` en Clínicas, `X–Y` en Informes) que Tokens
  no muestra.
- Sin indicador `Pág. X` (o `Pág. X / Y`) visible.

Archivos afectados (antes del fix):

- `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx:696-729`
- `frontend/src/app/dashboard/admin/AdminReportsCard.tsx:433-464`

## 2. Referencia canónica verificada en código (no asumida)

Se leyó directamente el pager mobile real de Tokens
(`AdminParticularTokensCard.tsx:1272-1305`, el `AdminMobileOpsPager.tsx` de
#1080) para confirmar el patrón exacto:

```tsx
<div
  className="flex shrink-0 items-center justify-center gap-1.5 border-t border-vetneb-line/65 pt-1.5 text-xs text-muted-foreground"
  data-admin-mobile-core-pager="true"
>
  <Button variant="outline" size="sm" className="h-9 px-2.5 text-xs" ...>Anterior</Button>
  <span className="min-w-12 text-center">Pág. {mobilePage + 1}</span>
  <Button variant="outline" size="sm" className="h-9 px-2.5 text-xs" ...>Siguiente</Button>
</div>
```

**Hallazgo relevante:** Tokens **no muestra `/Y`** (total de páginas) porque su
paginación mobile (`canGoNextMobile = mobileTokens.length === MOBILE_PAGE_SIZE`)
no tiene un conteo total — solo sabe si la página actual vino llena. El pager
de Ops (#1080, `AdminMobileOpsPager.tsx`) sí muestra `Pág. {page} / {pageCount}`
porque Sesiones/Usuarios/Auditoría **sí** exponen `total` en su snapshot.

## 3. Decisión de implementación por disponibilidad real de datos

| Módulo | Total disponible | Texto aplicado | Justificación |
|---|---|---|---|
| **Clínicas** | Sí (`snapshot.total` → `totalClinics`) | `Pág. {page} / {pageCount}` | Mismo dato ya usado por el rango anterior; sigue el patrón Ops. |
| **Informes** | No (`AdminReportWorkflowSnapshot.pagination` solo expone `hasMore`, sin `total`) | `Pág. {mobilePage + 1}` | Replica Tokens exactamente para el mismo caso (sin total). Mostrar `/Y` habría requerido inventar un total inexistente, lo que viola "no alterar datos" del protocolo VETNEB. |

Esto es una **desviación literal menor** del texto del brief ("Pág. X / Y" para
ambos), pero es la interpretación fiel del canónico Tokens real (que tampoco
muestra `/Y` cuando no hay total) y evita fabricar datos. Documentado aquí para
que Nico lo valide explícitamente.

## 4. Implementación aplicada

### `AdminClinicsManagementCard.tsx`

- Se agregaron `page` y `pageCount` derivados (junto a `hasPrev`/`hasNext`
  existentes, mismos datos, sin nuevo fetch):
  ```ts
  const page = Math.floor(currentOffset / effectivePageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(totalClinics / effectivePageSize));
  ```
- El bloque `data-admin-mobile-core-pager="true"` pasó de `justify-between` +
  rango + 2 botones icon-only (`ChevronLeft`/`ChevronRight`, `h-9 w-9 p-0`) a
  `justify-center` + texto `Anterior` / `Pág. {page} / {pageCount}` /
  `Siguiente`, botones `h-9 px-2.5 text-xs`.
- `pageStart`/`pageEnd`/`ChevronLeft`/`ChevronRight` **se mantienen** porque el
  pager **desktop** (`hidden ... md:flex`, sin tocar) sigue usándolos.

### `AdminReportsCard.tsx`

- El bloque `data-admin-mobile-core-pager="true"` pasó de `justify-between` +
  rango (`{mobileRangeStart}–{mobileRangeEnd}`) + 2 botones icon-only a
  `justify-center` + texto `Anterior` / `Pág. {mobilePage + 1}` / `Siguiente`,
  botones `h-9 px-2.5 text-xs`.
- Se eliminaron `mobileRangeStart`/`mobileRangeEnd`: quedaban sin otro
  consumidor tras quitar el texto de rango, así que se retiraron en vez de
  dejarlos como código muerto.
- El pager **desktop** (`<nav aria-label="Paginación de informes admin">`, sin
  tocar) conserva sus chevrons, `rangeStart`/`rangeEnd` y `ChevronLeft`/
  `ChevronRight`.

### Preservado explícitamente en ambos

- `data-admin-mobile-core-pager="true"` (selector usado por los e2e).
- `aria-label="Página anterior"` / `aria-label="Página siguiente"` en los
  botones (ya existían; se mantienen aunque ahora hay texto visible
  equivalente, por instrucción explícita de preservar accesibilidad existente).
- `disabled` en primera/última página (`hasPrev`/`hasNext`,
  `mobilePage === 0`/`!mobileHasMore`).
- Fetch, page size (`PAGE_SIZE`/`MOBILE_PAGE_SIZE`), lógica de paginación y
  `onClick` sin alterar.

## 5. Archivos modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | Producto | Pager mobile texto-canónico + `page`/`pageCount` derivados |
| `frontend/src/app/dashboard/admin/AdminReportsCard.tsx` | Producto | Pager mobile texto-canónico + limpieza de `mobileRangeStart`/`mobileRangeEnd` |
| `test/admin-mobile-core-pager-canonical-layout.test.ts` | Test nuevo | Contrato TDD del pager Core (Clínicas + Informes) |

No se tocó ningún otro archivo. `git diff --stat`: 2 archivos producto,
51 inserciones / 59 eliminaciones (neto: menos código que antes).

## 6. Tests agregados (TDD)

`test/admin-mobile-core-pager-canonical-layout.test.ts` (mismo estilo que el
precedente `test/admin-mobile-ops-pager-canonical-layout.test.ts` de #1080:
Node `test`/`assert` leyendo el código fuente real, sin necesidad de browser).

Acota el análisis al bloque del pager mobile real (`<div ...
data-admin-mobile-core-pager="true">` hasta un marcador estable posterior:
`<ClinicEditDrawer` en Clínicas, `<nav` en Informes) para no confundirse con el
pager **desktop**, que conserva `justify-between`/chevrons intencionalmente.

7 tests:

1. Clínicas: centrado, sin `justify-between`, texto `Anterior`/`Siguiente`,
   `Pág. {page} / {pageCount}`, sin chevrons, sin rango lateral (`pageStart`).
2. Clínicas: touch target `h-9`, sin botones icon-only (`w-9 p-0`).
3. Informes: centrado, sin `justify-between`, texto `Anterior`/`Siguiente`,
   `Pág. {mobilePage + 1}`, sin chevrons, sin rango lateral
   (`mobileRangeStart`).
4. Informes: touch target `h-9`, sin botones icon-only (`w-9 p-0`).
5. Informes: `mobileRangeStart`/`mobileRangeEnd` eliminados del archivo
   (código muerto).
6. Ambos: preservan `data-admin-mobile-core-pager`, `aria-label` de
   anterior/siguiente, sin `overflow-auto`/`overflow-scroll`.
7. Ambos: no alteran `PAGE_SIZE`/`MOBILE_PAGE_SIZE` ni las funciones de fetch
   (`getAdminClinics`/`getAdminReportWorkflow`).

**Ciclo rojo→verde confirmado:**

- Antes del fix: 6/7 tests fallaban (chevrons/`justify-between`/sin texto
  canónico/variables muertas presentes).
- Después del fix: 7/7 pasan.

## 7. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `node --import tsx --test test/admin-mobile-core-pager-canonical-layout.test.ts` | 7/7 pass (rojo→verde confirmado) |
| `pnpm --dir frontend exec playwright test frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` | 13/13 pass |
| `pnpm --dir frontend exec playwright test frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts` | 12/12 pass |
| `pnpm --dir frontend exec playwright test frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` | 12/12 pass |
| `pnpm --dir frontend exec playwright test frontend/e2e/admin-clinics-mobile-card-layout.spec.ts frontend/e2e/admin-mobile-final-polish-no-scroll.spec.ts` (diligencia extra, no exigido por el protocolo) | 7/7 pass |
| `pnpm test` (raíz, suite completa) | 2825/2825 pass |
| `pnpm --dir frontend lint` | sin errores/warnings |
| `pnpm --dir frontend typecheck` | sin errores |
| `pnpm --dir frontend build` | build OK (Next.js 16.2.7 Turbopack) |
| `pnpm build` (raíz, backend) | build OK |
| `git diff --check` | sin problemas de whitespace |
| Búsqueda `overflow-auto\|overflow-scroll\|overflow:\s*auto\|overflow:\s*scroll` en el diff | 0 coincidencias |

Nota operativa: correr Playwright local inicia el dev server de Next, que
regenera `frontend/next-env.d.ts` apuntando a `./.next/dev/types/routes.d.ts`
(ver `feedback_next_env_regeneration` en memoria). Se revirtió ese archivo con
`git checkout -- frontend/next-env.d.ts` antes de la corrida final de
`pnpm test`, que pasó 2825/2825 en working tree limpio.

## 8. Confirmaciones explícitas

- ✅ Clínicas usa pager canónico (`Anterior` / `Pág. X / Y` / `Siguiente`,
  centrado).
- ✅ Informes usa pager canónico (`Anterior` / `Pág. X` / `Siguiente`,
  centrado) — sin `/Y` por ausencia real de total en la API (ver §3).
- ✅ Grupo `Anterior / Pág. … / Siguiente` centrado (`justify-center`, sin
  `justify-between`).
- ✅ Sin chevrons/icon-only como control principal (`ChevronLeft`/
  `ChevronRight` removidos del bloque mobile; siguen en desktop, fuera de
  alcance).
- ✅ Touch targets `h-9` (36px) preservados/aplicados a los botones de texto.
- ✅ Footer/pager permanece anclado dentro del módulo (`shrink-0`, mismo
  contenedor `data-admin-mobile-core-pager`).
- ✅ Sin scroll global (validado por `admin-mobile-core-modules-no-scroll.spec.ts`
  en 360×740, 390×844, 430×932).
- ✅ Sin scroll interno (mismo spec, contrato `forbiddenOverflow`).
- ✅ Sin `overflow:auto|scroll` agregado (grep del diff, 0 coincidencias).
- ✅ Tokens preservado (spec `admin-tokens-mobile-toolbar-layout.spec.ts`
  12/12, archivo no tocado).
- ✅ Ops (#1080) preservado (spec `admin-mobile-ops-modules-no-scroll.spec.ts`
  12/12, archivo `AdminMobileOpsPager.tsx` no tocado).
- ✅ Backend/API/DB/auth/dependencias/lockfiles/CI no tocados (`git status`
  solo muestra los 2 archivos de producto + 1 test nuevo).

## 9. Riesgo residual

- **Informes sin `/Y`:** decisión documentada en §3; si Nico prefiere mostrar
  un total aproximado en Informes, requeriría exponer `total` desde
  `GET /api/admin/report-workflow` (cambio de API, fuera de alcance de este
  PR — debería ser un PR separado con autorización explícita).
- **`aria-label` redundante:** los botones ahora tienen texto visible
  (`Anterior`/`Siguiente`) **y** `aria-label="Página anterior/siguiente"`
  preexistente. Es inofensivo (etiqueta accesible ligeramente más descriptiva
  que el texto visible) y se mantuvo por instrucción explícita de preservar
  accesibilidad existente; podría simplificarse en un PR de limpieza futuro si
  se considera ruido.
- **Pagers desktop sin cambios:** Clínicas e Informes desktop conservan
  chevrons/`justify-between` (fuera de alcance, brief pide no tocar desktop
  salvo preservación). Queda una asimetría visual mobile/desktop intencional,
  igual a como ya conviven Tokens/Ops.
