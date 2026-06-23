# VETNEB — Fix: filtro y visualización de Tokens por nombre de clínica (mobile)

Módulo 6 de 7 del bloque "Admin Mobile Refinement". Cada módulo se entrega
como rama/PR independiente (precedente #1077→#1081; módulos 1-Hub,
2-Clínicas, 3-Auditoría, 4-Alertas y 5-Informes ya entregados en sus propios
worktrees/ramas).

---

## 1. Rama y base

- Rama: `fix/admin-mobile-tokens-clinic-name` (worktree aislado desde
  `main` limpio).
- HEAD base: `aa6bea6 fix(admin): align mobile core pager to canonical
  tokens layout (#1081)`.

## 2. Alcance

`AdminParticularTokensCard` (Tokens, Dashboard Administrador):

1. Cambiar el filtro/buscador de "ID clínica" a "nombre de clínica".
2. Cambiar la lógica de búsqueda para resolver por nombre (no por id
   numérico).
3. Debajo de cada token (mobile), reemplazar el id de clínica por el
   nombre de la clínica.
4. Mantener 10 tokens por página en mobile (ya estaba, #1077).
5. Mantener el paginador inferior anclado (ya estaba, #1078).
6. No tocar la generación de token salvo preservación mínima.

## 3. No alcance

Backend, API, DB, auth, dependencias, lockfiles, CI, rutas públicas,
producción, dashboard Clínica, Hub, Clínicas, Auditoría, Alertas, Informes,
Sesiones (cada uno su propio PR). El flujo de creación de token
("Generar token") no se tocó: sus campos, validaciones y submit son
exactamente los mismos.

## 4. Diagnóstico previo

- El filtro de Tokens (`data-admin-particulars-toolbar`) es **una única
  forma compartida entre desktop y mobile** (no hay variante separada por
  viewport para el filtro) — a diferencia de la lista de tokens en sí, que
  sí tiene ramas independientes. Cualquier cambio al filtro afecta ambos
  layouts por construcción del componente; no se introdujo una nueva
  bifurcación para mantener el diff mínimo.
- El catálogo de clínicas (`clinicOptions`, con `id`+`name`) ya existía,
  pero sólo se cargaba de forma diferida cuando se abría el diálogo
  "Generar token" (`isCreateDialogOpen`). El filtro/lista operativa nunca
  lo usaba.
- Ya existían helpers reutilizables para resolver nombre por id
  (`resolveClinicName`) y para buscar por texto
  (`matchClinicOption`/`normalizeSearchText`, normalización sin tildes,
  insensible a mayúsculas) — usados hoy por el buscador de clínica del
  paso 1 del alta de token. Se reutilizaron tal cual, sin duplicar lógica.
- El filtro aplicado (`appliedClinicId`) y el fetch (`getAdminParticularTokens`)
  siguen funcionando con `clinicId` numérico — **no se tocó el contrato con
  el backend**; sólo cambió cómo el usuario llega a ese id (por nombre, no
  tipeando el id a mano).
- e2e existente: `admin-tokens-mobile-toolbar-layout.spec.ts` (contrato
  dedicado del toolbar/lista mobile de Tokens) tenía una aserción que
  llenaba un `spinbutton` "ID de clínica" con "12" — pieza a actualizar en
  el mismo PR.

## 5. Decisión de riesgo: sin dropdown de autocompletado

Se evaluó agregar un dropdown de sugerencias (mismo patrón visual que el
buscador de clínica del alta de token). Se descartó por riesgo: el `Card`
contenedor de Tokens usa `overflow-hidden`, y un overlay posicionado debajo
del input del toolbar quedaría recortado por ese ancestro, o bien una lista
inline empujaría la lista/paginador hacia abajo, arriesgando el contrato
no-scroll ya validado en #1077-1081. Se eligió la solución de menor riesgo:
el campo de texto resuelve el nombre contra el catálogo ya cargado al
enviar el formulario (botón "Filtrar"), con mensajes de error claros si no
hay coincidencia o si hay varias coincidencias ambiguas. Esto cumple "buscar
por nombre de clínica" sin agregar overlays ni riesgo de overflow.

## 6. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` | (1) Carga del catálogo de clínicas (`clinicOptions`): antes gateada sólo por `isCreateDialogOpen`; ahora también se dispara en mobile aunque el diálogo no esté abierto (`(!isMobileViewport && !isCreateDialogOpen)` → no carga; en cualquier otro caso, carga una sola vez). Desktop conserva el comportamiento original exacto (carga diferida sólo al abrir el diálogo) — confirmado con el contrato e2e de "admin tokens populated" que pinneaba el texto "Clínica #12" en desktop. (2) `applyClinicFilter`: de parsear un id numérico (`parsePositiveInteger`) a resolver el texto contra `clinicOptions` vía `matchClinicOption`/`normalizeSearchText` (match exacto por nombre normalizado, o único match parcial); mensajes de error específicos si no hay clínica o si hay ambigüedad. El resultado sigue siendo un `clinicId` numérico pasado a `getAdminParticularTokens` — fetch sin cambios. (3) Input del toolbar: `type="number"` + placeholder "ID clínica" → `type="text"` + placeholder/aria-label "Nombre de clínica". (4) Fila de token mobile: `Clínica #{token.clinicId}` → `resolveClinicName(clinicOptions, token.clinicId) ?? \`Clínica #${token.clinicId}\`` (mismo patrón ya usado por la tabla desktop y por el diálogo de detalle). |
| `frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts` | Nuevo helper `mockAdminUsersRolesClinicCatalog` (clínica id=12 "Clínica Doce", coincide con el primer token del dataset existente). Test de toolbar: mockea el catálogo, llena el nuevo input de texto con "Clínica Doce" (antes: spinbutton con "12"), y agrega una aserción nueva — el primer ítem de la lista mobile muestra "Clínica Doce" en vez de "Clínica #12". |

No se crearon archivos de test nuevos: se reforzó el spec dedicado ya
existente.

## 7. Decisiones técnicas

1. **Filtro resuelto en el submit, no en cada tecla**: igual al patrón
   anterior (formulario con botón "Filtrar"), minimiza renders y evita
   tocar la UX general del toolbar.
2. **Reutilización total de helpers existentes** (`matchClinicOption`,
   `normalizeSearchText`, `resolveClinicName`): cero lógica de búsqueda
   nueva, sólo nuevo punto de uso fuera del diálogo de creación.
3. **Carga del catálogo gateada por viewport**: la única forma de cumplir
   "buscar/mostrar por nombre" en mobile sin alterar el comportamiento de
   desktop observado por el contrato e2e existente (`admin tokens
   populated`, que verificaba el fallback `Clínica #12` con el catálogo
   vacío en desktop). Bug real encontrado durante TDD (ver §8) y corregido
   antes de cerrar el PR.
4. **Sin dropdown de autocompletado** (ver §5): la opción de menor riesgo,
   documentada explícitamente para no romper el contrato no-scroll.

## 8. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | OK (sin salida) |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend build` | OK (`next build` exitoso, 25 rutas) |
| `npx playwright test e2e/admin-tokens-mobile-toolbar-layout.spec.ts` | **GREEN 12/12** |
| `npx playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts e2e/admin-mobile-final-polish-no-scroll.spec.ts e2e/admin-mobile-module-layer-isolation.spec.ts e2e/admin-mobile-hub-launcher-no-scroll.spec.ts e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts` | **GREEN 79/79** (incluye el contrato real de no-scroll con datos poblados para los 6 módulos admin, antes RED por el bug de §9) |

`pnpm test` (root, suite backend) no se ejecutó: este PR no toca backend ni
archivos bajo `test/`.

> Nota operativa: `frontend/next-env.d.ts` no quedó modificado tras correr
> Playwright/build en este worktree; se verificó explícitamente.

## 9. Resultado de tests (TDD) — bug real encontrado y corregido

- **RED real (no de test):** tras el primer intento (cargar
  `clinicOptions` siempre al montar, sin importar el viewport),
  `dashboard-real-app-shell-no-scroll-contract.spec.ts` falló en
  **desktop** (1440×900 y 1366×768): el test "admin tokens populated"
  esperaba el texto `Clínica #12` (fallback cuando el catálogo está
  vacío), pero con la carga eager el catálogo ya estaba resuelto y la
  tabla desktop mostraba el nombre real de la clínica — un cambio de
  comportamiento de **desktop** no solicitado por este PR (su alcance es
  mobile únicamente).
- **Fix:** la carga del catálogo se gateó por
  `(!isMobileViewport && !isCreateDialogOpen)` en vez de cargar siempre,
  preservando el comportamiento desktop exacto (lazy-on-dialog-open) y
  habilitando la carga eager sólo en mobile.
- **GREEN:** 79/79 tras el fix, incluyendo el contrato de no-scroll real
  con datos poblados para los 6 módulos admin (`admin overview`,
  `tokens`, `reports`, `audit`, `users-roles`, además del filtro de
  auditoría con teclado).

## 10. `git status --short --untracked-files=all`

```
 M frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts
 M frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx
?? docs/audit/admin-mobile-tokens-clinic-name-search.md
```

## 11. Confirmación explícita

- **Filtro por nombre de clínica (no ID):** confirmado (input de texto,
  resolución vía catálogo, e2e con "Clínica Doce").
- **Nombre de clínica debajo de cada token (mobile):** confirmado (e2e:
  primer ítem muestra "Clínica Doce" en vez de "Clínica #12").
- **10 tokens por página en mobile:** confirmado, sin cambios (ya era así
  desde #1077).
- **Paginador inferior anclado:** confirmado, sin cambios (ya era así
  desde #1078).
- **Generación de token no tocada:** confirmado (`handleSubmit`,
  `buildPayload`, los 3 pasos del formulario y sus validaciones no fueron
  modificados; e2e "admin tokens create dialog uses linked-clinic search"
  sigue verde sin cambios).
- **Desktop preservado:** confirmado explícitamente (bug encontrado y
  corregido en §9; el contrato e2e de desktop con datos poblados quedó
  verde sin modificar su aserción).
- **Sin scroll global / interno / `overflow:auto`/`scroll` agregado:**
  confirmado (no se agregó ningún overlay/dropdown, justamente para no
  arriesgar este contrato — ver §5).
- **Appbar / bottom nav preservados:** confirmado.
- **#1074 / #1076 preservados:** no tocados.
- **Backend/API/DB/auth/dependencias/lockfiles/CI/dashboard Clínica/otros
  módulos admin:** no tocados (`git diff --stat`: 1 componente + 1 spec
  e2e).

## 12. Riesgo residual

1. **Ambigüedad de nombres duplicados**: si dos clínicas comparten
   exactamente el mismo nombre normalizado, el filtro pide al usuario ser
   más específico (no hay un desambiguador por localidad/usuario en el
   filtro, a diferencia del buscador del alta de token que sí compone
   id+localidad+usuarios). Aceptado por ser un caso límite poco frecuente
   y para mantener el diff mínimo.
2. **Sin autocompletado visual** (ver §5): el usuario debe conocer el
   nombre exacto o parcial suficientemente específico de la clínica: si
   escribe mal, recibe un error claro en vez de sugerencias. Trade-off
   documentado a favor de cero riesgo de overflow.

---

### Cierre / Git manual (protocolo VETNEB)

Implementación, tests y validaciones completas. Según el protocolo, **Git
lo ejecuta Nico**. Este PR vive en un worktree separado
(`C:\PORTAL-VETNEB-tokens`). Comandos a ejecutar **desde
`C:\PORTAL-VETNEB-tokens`**:

```powershell
cd C:\PORTAL-VETNEB-tokens
git add frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx `
        frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts `
        docs/audit/admin-mobile-tokens-clinic-name-search.md
git status --short --untracked-files=all
git commit -m "fix(admin): search and display tokens by clinic name on mobile"
git push -u origin fix/admin-mobile-tokens-clinic-name
gh pr create --base main --head fix/admin-mobile-tokens-clinic-name --title "fix(admin): search and display tokens by clinic name on mobile" --body "## Summary
- Change the Tokens clinic filter from a numeric clinic ID input to a clinic-name text search (reusing the existing clinic catalogue and matching helpers from the create-token flow)
- Show the resolved clinic name instead of 'Clínica #id' under each mobile token row
- Desktop behavior explicitly preserved (lazy clinic-catalogue load on dialog open only) — a real bug here was found and fixed during TDD (see PR description below)

## Scope
- Admin Dashboard mobile Tokens module only (6 of 7 in the mobile refinement block); the filter form is shared with desktop by construction, so its input type/label changed for both, but desktop's clinic-name resolution behavior was kept byte-for-byte the same

## Not touched
- Backend, API, DB, auth, dependencies, lockfiles, CI, public routes, production, Clínica dashboard, token generation flow, other admin modules

## Real bug found and fixed during TDD
- Eagerly loading the clinic catalogue regardless of viewport leaked a desktop behavior change (the desktop table started resolving real clinic names where it used to show 'Clínica #id' with no catalogue loaded). Fixed by gating the eager load to mobile only; desktop keeps its exact original lazy-on-dialog-open behavior.

## Validation
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build
- playwright admin-tokens-mobile-toolbar-layout.spec.ts (12/12)
- playwright admin-mobile-core-modules-no-scroll.spec.ts + admin-mobile-final-polish-no-scroll.spec.ts + admin-mobile-module-layer-isolation.spec.ts + admin-mobile-hub-launcher-no-scroll.spec.ts + dashboard-real-app-shell-no-scroll-contract.spec.ts (79/79)"
gh pr checks --watch

# Tras mergear los PRs anteriores, eliminar este worktree:
cd C:\PORTAL-VETNEB
git worktree remove ../PORTAL-VETNEB-tokens
```


## Nota de contrato root

- El filtro por nombre de clínica mantiene el ancho mobile-safe canónico `h-8 w-28 text-xs md:w-36`.
- La búsqueda por nombre/localidad/usuario/ID se conserva sin ampliar la toolbar ni romper el contrato no-scroll.
