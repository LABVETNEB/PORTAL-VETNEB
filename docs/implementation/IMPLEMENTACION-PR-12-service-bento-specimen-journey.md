# PR-12 — feat(public): add service bento and specimen journey

## Resumen

Continuación del bloque visual Scientific Institutional Premium Niza 44/42.
Sobre la base de PR-10 (hero institucional) y PR-11 (capa de conversión de precios), PR-12 añade dos secciones públicas nuevas:

1. **Service Bento Grid** — el grid uniforme de 4 tarjetas de servicios pasa a un layout bento jerárquico que destaca *Estudio Anatomopatológico* como servicio principal.
2. **Specimen Journey** — sección pública de trazabilidad con 5 etapas derivadas exclusivamente del contenido verificado del Footer/FAQ del portal.

Commit: `19b3e59 feat(public): add service bento and specimen journey`
Rama: `feat/claude-pr-12-service-bento-specimen-journey`
Base: `578bb2e` (PR-11 mergeado a main)

---

## Objetivo

### Service Bento Grid
- Reemplazar el grid `lg:grid-cols-4` uniforme con un layout bento `lg:grid-cols-3`.
- Destacar *Estudio Anatomopatológico* con `lg:col-span-2` y eyebrow "Servicio principal".
- Destacar *Diagnóstico Integral* con `lg:col-span-2` al final del grid.
- Sin cambios en los datos de servicios, solo en la presentación visual.

### Specimen Journey
- Añadir componente `SpecimenJourneySection` reutilizable con prop `stages: SpecimenStage[]`.
- Integrar en Home (`/`) y Servicios (`/servicios`) con contenido idéntico verificado.
- 5 etapas: Toma y fijación → Envío coordinado → Recepción y procesamiento → Evaluación diagnóstica → Informe digital y acceso.
- Todo el contenido proviene del Footer/FAQ del portal; ningún dato es inventado.

---

## Archivos modificados / creados

### Nuevos (3)

| Archivo | Descripción |
|---|---|
| `frontend/src/components/public/SpecimenJourneySection.tsx` | Componente reutilizable. Exporta `SpecimenJourneySection` y la interfaz `SpecimenStage`. Renderiza `<ol aria-label="Etapas del recorrido de la muestra">` con numeración, icono, título, detalle y badge de protocolo opcional. Sin animaciones ni dependencias externas. |
| `test/frontend-public-service-bento-specimen-journey.test.ts` | 18 unit tests de contrato de código fuente: componente, bento home, specimen journey home, specimen journey servicios, API privada ausente. |
| `frontend/e2e/public-service-bento-specimen-journey.spec.ts` | 17 tests Playwright E2E: heading, 5 etapas, datos de protocolo, bento card destacada, CTAs hero, sin llamadas a APIs privadas, sin overflow horizontal en mobile (390 px). |

### Modificados (3)

| Archivo | Cambios |
|---|---|
| `frontend/src/app/page.tsx` | Añade imports `SpecimenJourneySection`, `cn`; const `specimenJourneyStages`; grid de servicios cambiado a bento `gap-5 lg:grid-cols-3`; detección de featured/wide por título; eyebrow en tarjeta destacada; sección Specimen Journey entre how-it-works y beneficios. |
| `frontend/src/app/servicios/page.tsx` | Añade imports `SpecimenJourneySection`, iconos adicionales; const `specimenJourneyStages`; detección de featured por `service.id === "anatomopatologia"`; eyebrow en tarjeta destacada; columnas de features en dos columnas lg para tarjeta wide; sección Specimen Journey entre "Para tener en cuenta" y "Valores que guían". |
| `test/unit/ui/frontend/frontend-visual-consistency.test.ts` | Actualiza regex de clase de grid de servicios de `/gap-6 lg:grid-cols-4/` a `/gap-5 lg:grid-cols-3/` — refleja el cambio intencional de PR-12. |

**Estadísticas del commit:** 6 archivos, +604 líneas, −10 líneas.

---

## Cambios implementados

### Bento de servicios — Home

```
grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3
```

- `const isFeatured = service.title === "Estudio Anatomopatológico"` → `lg:col-span-2` + eyebrow "Servicio principal"
- `const isWide = service.title === "Diagnóstico Integral"` → `lg:col-span-2`
- Mapa preservado como `services.map((service) =>` (contrato bloqueado por tests existentes)

### Bento de servicios — Servicios

```
grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8   (sin cambio en el grid base)
```

- `const isFeatured = service.id === "anatomopatologia"` → `lg:col-span-2` + eyebrow "Servicio principal" + título `lg:text-2xl` + features en dos columnas lg
- Mapa preservado como `serviceCategories.map((service) =>` (contrato bloqueado por tests existentes)

### Specimen Journey — contenido verificado del FAQ

| Etapa | Dato verificado incluido |
|---|---|
| Toma y fijación | formol al 10%, Fijación 48–72 h recomendada |
| Envío coordinado | bolsa tipo ziploc, Coordinar antes del despacho |
| Recepción y procesamiento | — |
| Evaluación diagnóstica | — |
| Informe digital y acceso | Hasta 15 días hábiles desde recepción |

### Preservación de CTAs anteriores

- PR-10 hero: "Acceder al portal", "Seguir con código", "Dr. Nicolás E. Barbé", `ROUTES.login`, `ROUTES.particulares` — intactos.
- PR-11 pricing: sección de precios y sus CTAs no fueron tocados.

### Accesibilidad

- `aria-labelledby="specimen-journey-heading"` / `id="specimen-journey-heading"` en home.
- `aria-labelledby="services-specimen-journey-heading"` / `id="services-specimen-journey-heading"` en servicios.
- `aria-label="Etapas del recorrido de la muestra"` en el `<ol>`.
- `aria-hidden="true"` en numeración e iconos decorativos.
- Sin overflow horizontal en mobile (390 px) verificado por E2E.

---

## Tests ejecutados

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | ✔ sin errores |
| `pnpm --dir frontend typecheck` | ✔ sin errores |
| `pnpm --dir frontend build` | ✔ 25/25 páginas estáticas generadas |
| `pnpm test` | ✔ 2601/2601 tests pasan (post-commit) |
| `pnpm --dir frontend e2e frontend/e2e/public-service-bento-specimen-journey.spec.ts` | ✔ 17/17 tests pasan |

---

## Decisiones de diseño

- **Sin assets nuevos**: no se añaden imágenes, fuentes ni archivos estáticos.
- **Sin dependencias nuevas**: se reutilizan Lucide React, `cn()`, `PublicScrollReveal` y tokens CSS Tailwind existentes.
- **Sin APIs ni server**: toda la sección es estática, sin `fetch`, sin `use server`, sin rutas API.
- **Sin tocar dashboard / auth / DB / producción**: scope estrictamente público (`/`, `/servicios`, componentes `public/`).
- **Datos solo del FAQ verificado**: formol 10%, 48–72 h, bolsa tipo ziploc, coordinación previa, 15 días hábiles. No hay métricas, certificaciones ni precios inventados.

---

## Riesgos y notas

### `next-env.d.ts`
El dev server que arranca `pnpm e2e` regenera `next-env.d.ts` cambiando la ruta de tipos de `.next/types/routes.d.ts` a `.next/dev/types/routes.d.ts`. Este archivo fue **revertido manualmente antes del commit** y **no fue incluido en staging**. No debe commitearse en ningún PR.

### Scope tests de PRs anteriores
Los tests `PR-1`, `PR-2`, `PR-4`, `PR-6`, `PR-7`, `PR-8`, `PR-9` y *logistics hub* usan `git diff --name-only` para verificar que sus PRs respectivos no modificaron `page.tsx` ni `servicios/page.tsx`. Mientras los cambios estaban sin commitear en el worktree, esos tests fallaban porque `git diff --name-only` detectaba los archivos como modificados. **Post-commit el worktree quedó limpio** (`git diff --name-only` no devuelve nada) y la suite completa pasó en 2601/2601.

---

## Confirmación de scope

| Superficie | Tocada |
|---|---|
| Producción | No |
| Base de datos | No |
| Auth / sesiones | No |
| Secrets / tokens / `.env` | No |
| Workflows de CI | No |
| APIs / rutas server | No |
| Dashboard (clínicas / admin) | No |
| Pricing / conversión PR-11 | No (preservado) |
| Login / particulares | No |
| Dependencias (`package.json`) | No |
