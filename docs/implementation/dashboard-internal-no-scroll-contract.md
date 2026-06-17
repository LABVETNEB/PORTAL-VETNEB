# PR-A — Contrato no-scroll interno del Dashboard App Shell

- **Rama:** `fix/dashboard-internal-no-scroll-contract`
- **Base:** `main` @ `d2c6d26` (audit masked master detail no scroll contract, #1013)
- **Fecha:** 2026-06-17
- **Tipo:** Implementación + tests (contrato). No es rediseño de módulos.

## Objetivo del PR

Blindar por contrato que `main.dashboard-main` **deja de ser un scroll container operativo**. El shell ya era de pantalla fija (`h-dvh overflow-hidden`), pero `main` reintroducía scroll vertical operativo vía `overflow-y: auto`, y dos tests E2E **exigían** ese comportamiento incorrecto. Este PR corrige el CSS, reemplaza los contratos E2E incorrectos por el contrato correcto y agrega una suite de medición anti-scroll para `html` / `body` / `main` en desktop y mobile.

No se rediseñan Tokens ni Informes (eso es PR-B / PR-C). El alcance es exclusivamente el contrato del shell/main.

## Auditoría rectora usada

`docs/audit/dashboard-masked-master-detail-no-scroll-audit.md` — §1.2 (distinción body vs `main` interno), §2.1 (escape hatch `overflow-y-auto`), §5 regla 2 (“`main` no debe scrollear; su `overflow-y-auto` es red de seguridad, no mecanismo de navegación”), §6 PR-A.

## Problema corregido

- `main.dashboard-main` tenía `overflow-y: auto`: cuando un módulo excedía el alto disponible, `main` scrolleaba internamente — la “página vertical” que el usuario percibía, pese a que el `body`/`html` nunca crecían.
- Los tests sólo blindaban que el `body` no creciera; **no** prohibían el scroll interno de `main`. Peor: dos specs **exigían** `overflow-y: auto` en `main`, protegiendo el comportamiento incorrecto.

Evidencia empírica (medición e2e con `NEXT_PUBLIC_API_URL=""`, antes y después del cambio): en los shells cubiertos `main.scrollHeight === main.clientHeight` (overflow real = 0) en todos los viewports probados — el `overflow-y: auto` era **inerte** en esas superficies, por lo que cambiarlo a `overflow: hidden` no introduce recorte:

| Superficie | Viewport | main scroll/client | main overflow |
|---|---|---|---|
| Clínica hub | 1366×768 | 675 / 675 | 0 |
| Clínica hub | 390×844 | 772 / 772 | 0 |
| Admin hub | 1366×768 | 675 / 675 | 0 |
| Admin hub | 390×844 | 772 / 772 | 0 |

## Contrato anterior (incorrecto)

```css
/* globals.css */
.dashboard-main { @apply ... overflow-y-auto ... overflow-x-hidden; }
```

```ts
// dashboard-card-navigation-shell.spec.ts (viejo)
expect(mainHasOverflowAuto).toBe(true);            // exigía overflow-y:auto

// dashboard-app-shell-visibility-contract.spec.ts (viejo)
expect(metrics.mainOverflowMode).toBe("auto");     // exigía overflow-y:auto
```

## Contrato nuevo (correcto)

```css
/* globals.css */
.dashboard-main { @apply ... overflow-hidden ...; }   /* NO es scroll container */
```

- `main.dashboard-main`: `overflow-y` computado **nunca** `auto` ni `scroll`.
- `main`, `body` y `documentElement`: `scrollHeight ≤ clientHeight` (tolerancia subpíxel 2px).
- Mensajes de error indican qué contenedor scrolleó y su `overflow-y`/clase.

```ts
// nuevo contrato (3 specs)
expect(mainOverflowY).not.toBe("auto");
expect(mainOverflowY).not.toBe("scroll");
expect(main.scrollHeight).toBeLessThanOrEqual(main.clientHeight + 2);
expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight + 2);
expect(html.scrollHeight).toBeLessThanOrEqual(html.clientHeight + 2);
```

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/globals.css` | `.dashboard-main`: `overflow-y-auto`+`overflow-x-hidden` → `overflow-hidden`. Comentario de contrato. |
| `frontend/e2e/dashboard-card-navigation-shell.spec.ts` | Reemplaza el test “main is scroll container (overflow-y-auto)” por “main is NOT an operational scroll container” (assert NOT auto/scroll). |
| `frontend/e2e/dashboard-app-shell-visibility-contract.spec.ts` | Reemplaza `mainOverflowMode === "auto"` por `not auto / not scroll`. (No agrega bound de fit: ese spec corre a 650px de alto sólo para validar chrome del shell.) |
| `frontend/e2e/dashboard-single-viewport-app-shell.spec.ts` | Sólo comentarios (el contrato `scrollHeight ≤ clientHeight` ya era correcto). |

## Tests agregados

| Archivo | Cobertura |
|---|---|
| `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts` (**nuevo**) | Helper `readScrollContract` (html/body/main: scrollHeight, clientHeight, overflow-y computado, className) + `assertNoInternalScroll`. Mide shells admin y clínica. |

## Viewports cubiertos

- **Desktop:** 1366×768 (mínimo aceptable del producto).
- **Mobile:** 390×844 (viewport mobile estándar de la suite, ver `visual-smoke.spec.ts`).

(El contrato de fit a 1440×900 y 1366×768 sobre todos los módulos sigue cubierto por los specs existentes `dashboard-single-viewport-app-shell` y `dashboard-real-app-shell-no-scroll-contract`, que ahora también validan que `main` no es scroll container.)

## Módulos cubiertos (verde)

- Shell global (clínica y admin).
- Hub clínica `/dashboard` y hub admin `/dashboard/admin` (desktop + mobile).
- Módulos ya conformes vía specs existentes: operaciones, informes (summary in-shell), logística (summary in-shell), perfil; admin clinics, audit-log, pricing, sessions, health, maintenance, upload (1366×768 / 1440×900).

## Módulos pendientes (NO maquillados en este PR)

- **PR-B — Tokens particulares (clínica):** `ClinicParticularTokensCard` (formulario de 13 campos + lista + 6 bandas por token) puede exceder `main` con datos reales → con `overflow: hidden` recortaría en vez de scrollear. Se resuelve con Master-Detail en Cascada + `ModuleDialog` (no en este PR).
- **PR-C — Informes (clínica):** la ruta `/dashboard/informes` apila header + filtros + grid master-detail con paneles `min-height: 18rem`; densidad a resolver con lista limitada + detail pane + overlay mobile.

> A viewports ultracompactos (650px de alto) el módulo operaciones aún excede; queda dentro de la densidad de módulos (PR-B/C). El spec de visibilidad a 650px valida sólo el chrome del shell, no el fit del módulo.

## Riesgos

- **Bajo–medio.** El cambio CSS es una sola propiedad sobre una clase del shell. Empíricamente `main` no desbordaba en las superficies cubiertas (overflow real = 0), por lo que no se introduce recorte en lo cubierto.
- **Módulos diferidos:** con datos reales, Tokens/Informes pasarán de scrollear a **recortar** hasta PR-B/PR-C. Es intencional (no maquillar) y está documentado; el contrato E2E los excluye explícitamente.
- **Contrato CSS pin:** `frontend-visual-consistency.test.ts` fija el bloque `.dashboard-main` por `space-y-6 / sm:px-6 / lg:px-8` (no por `overflow-y-auto`); el cambio los preserva → verde.
- **Pin de sidebar:** `frontend-dashboard-shell.test.ts` exige `overflow-y-auto` en el **sidebar frame** (no en `main`); intacto.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | ✓ OK |
| `pnpm --dir frontend typecheck` | ✓ OK |
| `pnpm test` (nativos) | ✓ 2758 / 2758 |
| `pnpm --dir frontend build` | ✓ OK |
| `pnpm build` (backend) | ✓ OK |
| `pnpm security:public-surface` | ✓ PASS |
| E2E contratos no-scroll (5 specs) | ✓ 119 / 119 |

**E2E afectados (verde):** `dashboard-internal-no-scroll-contract` (nuevo, 8), `dashboard-card-navigation-shell`, `dashboard-app-shell-visibility-contract`, `dashboard-single-viewport-app-shell`, `dashboard-real-app-shell-no-scroll-contract`.

### Hallazgo fuera de scope (no introducido por este PR)

`dashboard-workspace-layout-polish.spec.ts › "/dashboard/informes layout loads"` falla por un `aria-label` obsoleto: espera `region` con nombre **"Informes del dashboard"** que **no existe** en la ruta Informes actual. **Verificado con `git stash`: falla idéntico en la base `d2c6d26` sin mis cambios** → preexistente, independiente del contrato no-scroll. No se modifica aquí (la ruta Informes es PR-C); se recomienda corregir el `aria-label`/expectativa en PR-C.

## Resultado final

Contrato no-scroll interno implementado y blindado:
- `main.dashboard-main` ya **no** es scroll container operativo (`overflow: hidden`).
- Tests dejan de exigir `overflow-y-auto`; ahora fallan si `main` scrollea (auto/scroll) o si `main`/`body`/`html` exceden el viewport.
- Desktop (1366×768) y mobile (390×844) cubiertos para shells admin y clínica.
- Sin scroll interno como parche; sin scroll movido a otro wrapper; sin rediseño de módulos.
- Validaciones nativas, builds, seguridad y E2E de contrato en verde.
