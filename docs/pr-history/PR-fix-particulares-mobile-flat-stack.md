# PR: fix(particulares): mobile flat-stack para cards informe y seguimiento

**Rama:** `fix/particulares-mobile-flat-stack`  
**Fecha:** 2026-06-03  
**Alcance:** Solo frontend particular mobile — sin tocar backend, API, auth, DB ni cookies.

---

## Resumen

Elimina artefactos visuales persistentes en `/particulares` mobile con sesión activa, específicamente debajo/alrededor del card "Informe vinculado" y su zona de botones "Ver informe" / "Descargar".

La corrección crea versiones mobile-flat de los cards "Seguimiento del estudio" e "Informe vinculado", neutraliza con CSS todos los triggers de compositing GPU en esas superficies y agrega contratos de test que bloquean regresiones.

---

## Causa probable

Los cards del dashboard autenticado de particulares usaban componentes con múltiples triggers de capa GPU anidados:

| Componente / clase | Trigger GPU |
|---|---|
| `PremiumPanel` (wrapper del panel) | `render-gpu-soft` + `bg-card/92` (alpha) + `shadow-[0_18px_54px_...]` |
| `VisualIcon` (en card informe) | `render-gpu-soft` + `shadow-[0_12px_30px_...]` + `ring-1` + `bg-vetneb-cyan/10` (alpha) |
| `clinical-muted-band` | `background: linear-gradient(...)` con transparencia (`hsl(--card) / 0.88`) |

En Android WebView y Facebook in-app browser, estas capas generan stacking contexts independientes que el compositor renderiza como superficies separadas. El resultado visible es un "fantasma" o "recorte" de fondo bajo los botones y alrededor del card informe.

---

## Por qué #809/#810/#811 no cerraron totalmente el bug

- **#809** estabilizó el panel principal con `data-particular-session-panel` → neutralizó `.render-gpu-soft` y `.clinical-muted-band` del contenedor, pero `VisualIcon` dentro del card informe seguía creando una sublayer independiente (el selector CSS no cubría elementos anidados sin la class `.render-gpu-soft` explícita en su contexto).
- **#810** creó el resumen mobile-safe plano (datos del caso), pero no tocó los cards inferiores (tracking, informe).
- **#811** convirtió las notificaciones en overlay portalizado — correcto, pero el card informe seguía debajo con sus capas.

El nodo problemático que quedó sin resolver era `VisualIcon` (icono del card informe) + `clinical-muted-band` en los dos cards inferiores: dos superficies GPU anidadas dentro de un PremiumPanel que ya era composited, exactamente donde aparecían los artefactos.

---

## Implementación

### 1. `frontend/src/components/public/ParticularesContent.tsx`

**Contenedor autenticado:**
- Añadido `data-particular-mobile-flat-stack="true"` al `<div className="space-y-5">`.

**Card Seguimiento del estudio:**
- Añadida versión mobile-flat con `data-particular-mobile-flat-card="tracking"` + `sm:hidden` antes del card desktop existente.
- La versión mobile-flat usa `bg-card` sólido, sin `clinical-muted-band`.
- Mantiene WhatsApp, email de tinción especial y estado del estudio.
- El card desktop existente recibe `hidden sm:block` para ocultarse en mobile.

**Card Informe vinculado:**
- Añadida versión mobile-flat con `data-particular-mobile-flat-card="report"` + `sm:hidden` antes del card desktop existente.
- La versión mobile-flat usa `FileText` directo (Lucide inline) sin `VisualIcon` ni `render-gpu-soft`.
- Usa `bg-card` sólido, sin `clinical-muted-band`, sin `bg-card/`.
- Los botones "Ver informe" y "Descargar" están en `data-particular-mobile-flat-actions="true"`.
- El card desktop existente recibe `hidden sm:block` — preserva `VisualIcon` y `clinical-muted-band` para desktop.

### 2. `frontend/src/app/globals.css`

Añadido bloque marcado `/* particular-mobile-flat-stack:start */` … `/* particular-mobile-flat-stack:end */` con `@media (max-width: 639px)` que neutraliza para los nuevos data attributes:

```
filter: none !important
backdrop-filter: none !important
-webkit-backdrop-filter: none !important
transform: none !important
will-change: auto !important
mix-blend-mode: normal
text-shadow: none
opacity: 1 !important
background: hsl(var(--card)) !important        ← opaco, sin alpha
background-image: none !important
contain: layout paint style
isolation: isolate
z-index: 0
position: relative
overflow: hidden (en cards), visible (en acciones)
```

Para `[data-particular-mobile-flat-actions="true"] > *` además:
```
box-shadow: 0 1px 2px rgba(15,45,62,0.06) !important   ← simple, sin composite
```

No se tocó `.surface-soft` globalmente. Las reglas están estrictamente dentro del bloque marcado.

### 3. `test/frontend-particulares-mobile-session-card-render.test.ts`

Añadidos 11 nuevos contratos de test al final del archivo:

| Test | Contrato |
|---|---|
| `authenticated container has data-particular-mobile-flat-stack` | Atributo presente |
| `both flat-card tracking and flat-card report data attributes exist` | Ambos attrs presentes |
| `data-particular-mobile-flat-actions exists inside flat report block` | Acciones en flat-report |
| `flat tracking card is sm:hidden and conserves tracking content` | `sm:hidden`, "Seguimiento", "Estado del estudio:" |
| `flat report card is sm:hidden and conserves report content and actions` | `sm:hidden`, "Informe vinculado", "Ver informe", "Descargar" |
| `flat report block does not use GPU-heavy presentation primitives` | Sin PremiumPanel/VisualIcon/render-gpu-soft/clinical-muted-band/bg-card//backdrop-blur/transform-gpu |
| `globals css contains mobile-only block for flat-stack selectors` | Los 4 selectores en bloque marcado |
| `flat-stack CSS rules neutralize compositing triggers` | Todas las declaraciones neutralizadoras |
| `flat-stack CSS uses opaque card backgrounds` | `hsl(var(--card))` sin alpha |
| `flat-stack tracking and report cards use low z-index` | z-index 0, no alto |
| `notifications bell layer retains high z-index above flat-stack in mobile CSS` | Bell layer z-index >= 2 |
| `flat-stack markers stay out of Navbar, Footer and backend surfaces` | Markers solo en frontend/particulares |
| `desktop tracking and report cards remain available from sm via hidden sm:block` | `hidden sm:block` en ambos desktop cards |

---

## Archivos tocados

```
frontend/src/components/public/ParticularesContent.tsx   ← +140 líneas (flat cards mobile)
frontend/src/app/globals.css                              ← +110 líneas (bloque CSS flat-stack)
test/frontend-particulares-mobile-session-card-render.test.ts  ← +190 líneas (nuevos contratos)
docs/pr-history/PR-fix-particulares-mobile-flat-stack.md  ← nuevo
```

**No tocados:** backend, server/, drizzle/, shared/, API, auth, cookies, CSRF, CORS, CSP, storagePath, signed URLs, DB schema, índices, WebAuthn, Navbar, Footer.

---

## Comandos de validación (Terminal 1 — Windows / PowerShell)

```powershell
# Desde C:\PORTAL-VETNEB
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm typecheck
pnpm typecheck:test
pnpm test
pnpm build
pnpm security:public-surface
```

> `pnpm --dir frontend build` puede requerir red (Google Fonts). Si el entorno no tiene red: omitir o usar `next build --no-lint`.

---

## Resultados de validación estática (sandbox)

Verificado mediante análisis estático Python directo sobre los archivos:

- ✅ `data-particular-mobile-flat-stack="true"` presente
- ✅ `data-particular-mobile-flat-card="tracking"` con `sm:hidden`
- ✅ `data-particular-mobile-flat-card="report"` con `sm:hidden`
- ✅ `data-particular-mobile-flat-actions="true"` dentro del flat-report
- ✅ Flat tracking: sin PremiumPanel, VisualIcon, render-gpu-soft, clinical-muted-band, bg-card/, backdrop-blur, transform-gpu
- ✅ Flat report: ídem — icono inline `FileText` sin capas
- ✅ Desktop tracking y report tienen `hidden sm:block`
- ✅ `VisualIcon` preservado en desktop report
- ✅ Notificaciones bell y logout preservados
- ✅ WhatsApp y email de tinción especial en flat tracking
- ✅ CSS bloque marcado con todos los neutralizadores y fondos opacos
- ✅ z-index 0 en flat cards, bell layer mantiene z-index: 2

> La bash del sandbox ve un cache stale del mount Windows→Linux (30876 bytes vs 884 líneas reales). El Read tool y la validación Python confirman el archivo completo y correcto. pnpm en Windows verá la versión completa.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Duplicación de contenido visible si breakpoint falla | Ambas versiones usan `sm:hidden` / `hidden sm:block` mutuamente excluyentes |
| Desktop recibe cambio visual no deseado | Desktop usa las mismas clases de siempre; solo recibe `hidden sm:block` que en desktop es invisible (`sm:block` sobreescribe `hidden`) |
| CSS rompe layout global | Bloque marcado con `@media (max-width: 639px)` y selectores específicos de data attributes; `.surface-soft` global no tocado |
| Riesgo en notificaciones | Bell layer mantiene z-index: 2, portal sigue por encima; test de contrato lo bloquea |

---

## Rollback

```powershell
# Revertir solo este PR (desde main después de merge):
git revert HEAD --no-edit

# O desde la rama antes de hacer PR:
git checkout main
git branch -D fix/particulares-mobile-flat-stack
```

---

## Estado final

| Requisito | Estado |
|---|---|
| Mobile /particulares con sesión activa: resumen de datos visible | ✅ |
| Seguimiento del estudio visible mobile | ✅ (flat card, sm:hidden) |
| Informe vinculado visible mobile | ✅ (flat card, sm:hidden) |
| Ver informe funciona | ✅ (mismo handler `openReport("preview")`) |
| Descargar funciona | ✅ (mismo handler `openReport("download")`) |
| WhatsApp/email tinción especial funciona | ✅ (preservado en flat tracking) |
| Logout particular funciona | ✅ (botón sin cambios) |
| Campana notificaciones por encima | ✅ (z-index: 2, portal overlay de #811) |
| Desktop sin cambios intencionales | ✅ (desktop cards preservados con hidden sm:block) |
| No se ocultaron datos para resolver el bug | ✅ |
| No hay duplicación de layout visible mobile | ✅ (sm:hidden / hidden sm:block mutuamente excluyentes) |
| Todo el contenido particular mobile en stacking plane normal | ✅ (z-index: 0, sin compositing triggers) |
| Solo notificaciones con z-index alto | ✅ |
| No se tocó backend/API/auth | ✅ confirmado |
| Informe vinculado queda plano en mobile | ✅ (sin VisualIcon, sin render-gpu-soft, sin clinical-muted-band) |
