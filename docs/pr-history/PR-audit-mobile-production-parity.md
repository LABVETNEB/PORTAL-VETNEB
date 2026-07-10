# PR: fix/mobile-production-parity-gaps

## 1. Rama creada

```
fix/mobile-production-parity-gaps
```
Base: `main` @ `a00c4b8` — test(guardrails): lock production progress invariants (#774)

---

## 2. Objetivo del PR

Auditar de forma exhaustiva todas las implementaciones recientes del portal VETNEB
(#769–#774) para confirmar paridad móvil/tablet/desktop. Detectar brechas reales e
implementar correcciones mínimas, trazables y sin romper las invariantes protegidas.

---

## 3. Scope auditado

| Superficie         | Archivos principales revisados                                          | Resultado  |
|--------------------|-------------------------------------------------------------------------|------------|
| Público — home     | `app/page.tsx`, `Navbar.tsx`, `PublicLayout.tsx`, `Footer.tsx`          | ✅ OK      |
| Público — precios  | `app/precios/page.tsx`, `lib/public-pricing-cache.ts`                   | ✅ OK      |
| Público — CTAs     | `PublicRouteControl.tsx`, `PublicHero.tsx`                              | ✅ OK      |
| Auth — login       | `app/login/page.tsx`, `LoginContent.tsx`                                | ✅ OK      |
| Auth — sesiones    | `server/routes/auth.fastify.ts` (y admin/particular)                   | ✅ OK      |
| Admin — dashboard  | `app/dashboard/admin/page.tsx`, `AdminParticularTokensCard.tsx`         | ✅ OK      |
| Admin — tablas     | `ui/table.tsx` (overflow-auto en wrapper), `AdminSessionsReadOnlyCard` | ✅ OK      |
| Admin — modal      | `UploadReportModal.tsx`                                                 | 🔴 CORREGIDO |
| Particular         | `app/particulares/page.tsx`, `ParticularesContent.tsx`                  | ✅ OK      |
| Email templates    | `server/lib/email.ts`                                                   | ✅ OK      |
| PWA — SW           | `public/sw.js`                                                          | ✅ OK      |
| PWA — manifest     | `app/manifest.ts`                                                       | 🔴 CORREGIDO |
| Sidebar dashboard  | `DashboardSidebarFrame.tsx`                                             | 🔴 CORREGIDO |

---

## 4. Hallazgos detectados

### HALLAZGO 1 — CRÍTICO: `UploadReportModal` no scrolleable en móvil
**Archivo:** `frontend/src/components/dashboard/UploadReportModal.tsx`
**Causa:** El overlay usaba `flex items-center justify-center` sin `overflow-y-auto`.
El modal contiene ~10 campos de formulario + clinic search + file upload. En pantallas
320–414px (y 568px como iPhone SE gen 1) el contenido supera el viewport y el botón
"Subir informe" queda fuera de pantalla e inaccesible.

**Reproducción:** Abrir modal en 320×568px → scroll imposible → submit inaccesible.

### HALLAZGO 2 — MEDIO: Manifest PWA fuerza portrait en todas las plataformas
**Archivo:** `frontend/src/app/manifest.ts`
**Causa:** `orientation: "portrait-primary"` bloquea landscape en tablets (768px+)
instalados como PWA. El admin dashboard y el portal clínica son usables en landscape
y esta restricción rompe la experiencia en iPad/tablet Android.

### HALLAZGO 3 — MENOR: Sidebar usa `h-screen` (100vh) — recorte en iOS Safari móvil
**Archivo:** `frontend/src/components/dashboard/DashboardSidebarFrame.tsx`
**Causa:** `100vh` en iOS Safari pre-15.4 equivale al viewport más grande (sin browser
chrome). El último ítem de la sidebar (volver al sitio) puede quedar parcialmente oculto
detrás de la barra inferior del browser en iPhone con barra de navegación visible.
`dvh` (dynamic viewport height) resuelve esto en iOS 15.4+ y Chrome 108+.

---

## 5. Implementaciones aplicadas

### Fix 1: `UploadReportModal.tsx` — overlay scrolleable en móvil

```diff
- className="fixed inset-0 z-[9999] flex items-center justify-center bg-vetneb-ink/45 p-4"
+ className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-vetneb-ink/45 p-4 sm:items-center"

- className="clinical-modal relative z-[10000] w-full max-w-xl p-5 text-card-foreground sm:p-6"
+ className="clinical-modal relative z-[10000] my-auto w-full max-w-xl p-5 text-card-foreground sm:p-6"
```

- `overflow-y-auto` en el overlay → permite scroll cuando el modal supera el viewport.
- `items-start` en móvil → el modal se ancla desde arriba y es completamente scrolleable.
- `sm:items-center` → mantiene centrado en pantallas ≥640px.
- `my-auto` en el dialog → centrado vertical cuando el contenido cabe en pantalla.

### Fix 2: `manifest.ts` — orientation "any"

```diff
- orientation: "portrait-primary",
+ orientation: "any",
```

Permite landscape en tablets con PWA instalada sin forzar orientación en móvil.

### Fix 3: `DashboardSidebarFrame.tsx` — `h-dvh` para iOS Safari

```diff
- className="sticky top-0 flex h-screen w-[4.5rem] shrink-0 flex-col overflow-y-auto ..."
+ className="sticky top-0 flex h-dvh w-[4.5rem] shrink-0 flex-col overflow-y-auto ..."
```

`h-dvh` = `100dvh` (dynamic viewport height). Tailwind 4.x lo soporta nativamente.
Browsers sin soporte `dvh` ignoran el valor y el sidebar mantiene su comportamiento
flex natural con `overflow-y-auto`.

---

## 6. Archivos modificados

| Archivo | Tipo de cambio |
|---------|----------------|
| `frontend/src/components/dashboard/UploadReportModal.tsx` | Fix — overlay scrolleable móvil |
| `frontend/src/app/manifest.ts` | Fix — orientation PWA |
| `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` | Fix — h-dvh iOS Safari |
| `test/mobile-production-parity-invariants.test.ts` | Test — 3 guardrails nuevos |
| `test/frontend-dashboard-shell.test.ts` | Test — actualizado: `h-screen` → `h-dvh` (invariante legacy alineada) |
| `test/unit/ui/frontend/frontend-visual-consistency.test.ts` | Test — actualizado: regex `h-screen` → `h-dvh` (contrato visual alineado) |

---

## 7. Tests agregados

**Archivo:** `test/mobile-production-parity-invariants.test.ts`

| Test | Invariante bloqueada |
|------|---------------------|
| `manifest invariants: orientation allows landscape on tablet` | `orientation: "portrait-primary"` está prohibido; debe ser `"any"` |
| `upload modal invariants: dialog overlay must support scroll on mobile viewports` | `overflow-y-auto`, `items-start`, `sm:items-center`, `my-auto` son obligatorios |
| `sidebar invariants: dashboard sidebar must not lock to 100vh on mobile` | `h-screen` prohibido, `h-dvh` + `overflow-y-auto` obligatorio |

---

## 8. Validaciones ejecutadas

### Tests de guardrails (node --test)

```
node --test test/mobile-production-parity-invariants.test.ts
→ pass 3/3

node --test test/progress-production-invariants.test.ts
→ pass 4/4  (invariantes #774 intactas)

node --test test/architecture/security/security-production-invariants.test.ts
→ pass 11/11

node --test test/frontend-pwa-global-operational-contract.test.ts
→ pass 8/8

node --test test/frontend-dashboard-shell.test.ts
→ pass 5/5  (legacy actualizado: h-screen → h-dvh)

node --test test/unit/ui/frontend/frontend-visual-consistency.test.ts
→ pass 14/14  (legacy actualizado: regex h-screen → h-dvh)

TOTAL: 45/45 pass — 0 fail
```

Los 2 tests legacy (`frontend-dashboard-shell` y `frontend-visual-consistency`) fijaban
`h-screen` como invariante del sidebar. Se actualizaron para exigir `h-dvh`, alineando
el contrato oficial con el fix móvil. El propósito y rigurosidad de ambos tests se
mantiene intacto — `overflow-y-auto` sigue siendo obligatorio, el regex de
`frontend-visual-consistency` sigue siendo estricto (clase completa), y el test de
`frontend-dashboard-shell` sigue confirmando que admin y clínica usan el mismo
`DashboardSidebarFrame`. No se revirtió el fix móvil.

### Typecheck / Lint / Build

`pnpm --dir frontend lint`, `pnpm --dir frontend typecheck` y `pnpm --dir frontend build`
requieren node_modules instalados en el entorno Windows con pnpm. Los errores que aparecen
en el sandbox Linux son todos pre-existentes de tipo `Cannot find module 'next'` /
`lucide-react` por ausencia de módulos instalados en Linux — **no son introducidos por
este PR**. Validar con `pnpm validate:local` en Terminal 1 antes del merge.

---

## 9. Riesgos residuales

| Riesgo | Nivel | Mitigación |
|--------|-------|-----------|
| `h-dvh` no soportado en browsers pre-iOS 15.4 / Chrome 107 | Bajo | El sidebar tiene `overflow-y-auto`; sin `dvh` el browser ignora el valor y el flex-container sigue funcional. |
| `orientation: "any"` en móvil permite que el usuario gire el teléfono en páginas diseñadas para portrait | Muy bajo | Todo el diseño público y dashboard soporta ambas orientaciones. Era el estado deseado correcto desde el inicio. |
| El overlay `overflow-y-auto` + `items-start` cambia la animación visual de apertura del modal en desktop | Nulo | `sm:items-center` restaura el comportamiento exacto en ≥640px. En mobile (<640px) el modal se abre desde arriba, que es el patrón correcto para bottom-scroll. |

---

## 10. Superficies con paridad móvil confirmada (sin cambios requeridos)

Las siguientes superficies fueron auditadas y NO requieren corrección:

- **Público:** `home`, `precios`, `servicios`, `clinicas`, `profesionales`, `contacto`, `particulares`, `login` — todos usan `flex-col`/`sm:flex-row`, `w-full sm:w-auto`, `grid-cols-1 sm:grid-cols-N`, `container px-4 sm:px-6 lg:px-8`. Sin overflow horizontal.
- **Navbar móvil:** `<details>` con `max-w-[calc(100vw-2rem)]` y `w-72` — sin overflow en 320px.
- **Footer:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-[...]` — correctamente responsivo.
- **Login:** `h-12` inputs (target táctil ≥44px), `min-h-screen flex items-center justify-center p-4`.
- **Portal particular:** `grid grid-cols-1 lg:grid-cols-[1fr_0.95fr]`, botones `flex-col sm:flex-row`.
- **Admin tables:** `Table` component ya tiene `overflow-auto` en el wrapper div nativo.
- **Admin tokens:** grids con `grid-cols-1 md:grid-cols-N`, `flex-wrap` en acciones.
- **Email templates:** HTML con `<table role="presentation">`, `meta viewport`, CTA como tabla `<a>`, sin scripts, `escapeHtml` en todos los campos.
- **Service worker:** no cachea `/dashboard`, `/api/`, `Set-Cookie`, rutas con credentials. Solo cachea assets públicos y navegación pública permitida.
- **Invariantes #774:** todas 4/4 intactas (pricing, email HTML, sesiones, hard delete tokens).

---

## 11. Comandos manuales para Nico

**Terminal 1** — verificación previa:
```powershell
cd C:\PORTAL-VETNEB
git status
git branch --show-current
pnpm validate:local
```

**Terminal 1** — commit y push:
```powershell
git status
git add .
git status
git commit -m "fix(mobile): close production parity gaps — modal scroll, manifest orientation, sidebar dvh"
git push -u origin fix/mobile-production-parity-gaps
```

**Terminal 1** — PR y merge:
```powershell
gh pr create
gh pr checks --watch
gh pr merge --squash --delete-branch
```

**Terminal 1** — limpieza local post-merge:
```powershell
git checkout main
git pull --ff-only
git fetch --prune
git status --short
git log -1 --oneline
gh pr list --state open
git branch -r --no-merged origin/main
git branch
```
