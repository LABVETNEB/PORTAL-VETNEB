# PR-11 — feat(public): add actionable pricing conversion layer

Base: `1b6e2cf` (PR-10 mergeado en main)
Rama: `feat/claude-pr-11-public-actionable-pricing`

## Objetivo

Convertir la página de precios de una lista pasiva a una superficie comercial accionable, sin tocar backend, API, auth, DB ni dependencias.

## Archivos modificados

| Archivo | Tipo |
|---|---|
| `frontend/src/components/public/PreciosContent.tsx` | Modificado |
| `frontend/e2e/public-pricing-actionable.spec.ts` | Creado |

## Cambios implementados

### PreciosContent.tsx

1. **Hero más corto y accionable**
   - Eyebrow cambiado de "Valores de referencia" a "Histopatología · Citología"
   - H1 cambiado de "Lista de precios" a "Precios y estudios disponibles"
   - Descripción reducida a una línea concisa
   - CTA en el hero: "Consultar por un estudio" → `/contacto` (variante `secondaryOutline` + `public-cta-on-hero`)

2. **Fetch público intacto**
   - `getPublicPricing`, caché, estados, `sortPricingCategories` sin cambios
   - `normalizePriceLabel`, `hasPricingItems`, `toSemanticId` sin cambios
   - Se agregó `hasConsultarItems` para condicionar la banda de Consultar

3. **CTA por categoría**
   - Cada `CardContent` incluye footer con "Consultar este estudio" → `/contacto`
   - Separador visual `border-t border-vetneb-line/50`
   - Variante `primaryDark` + `public-cta-primary`

4. **Skeleton de carga**
   - Reemplaza el texto plano "Cargando precios disponibles..."
   - Usa `clinical-skeleton` (clase ya existente en `globals.css`)
   - `aria-hidden="true"` y `data-pricing-skeleton="true"` para tests
   - 2 columnas de placeholders (espeja el grid real)

5. **Banda de valor incluido**
   - Aparece debajo de las categorías cuando hay ítems
   - Usa `clinical-card` sobre la superficie del hero
   - Ítems: informe diagnóstico digital, acceso al portal, seguimiento según complejidad
   - Sin promesa de vigencia de precios (el contrato no provee timestamp)

6. **Banda de Consultar**
   - Aparece solo cuando `hasConsultarItems(pricingCategories)` es `true`
   - Explica: complejidad, tinciones especiales, coordinación previa
   - CTA: "Coordinar por contacto" → `/contacto`
   - Variante `primaryDark` + `public-cta-primary`

7. **Error/fallback preservado**
   - `role="alert"` y texto sin cambios

### Tests E2E (public-pricing-actionable.spec.ts)

8 tests que cubren:
- Hero con CTA de contacto
- Listado dinámico de categorías e ítems
- Etiqueta "Consultar" con acción clara
- CTA por categoría
- Skeleton visual durante carga (via `data-pricing-skeleton`)
- Estado de error (`role="alert"`)
- Accesibilidad: todos los CTAs habilitados y visibles
- Leyenda de valor incluido
- Sin llamadas a APIs privadas ni de auth

## Decisiones técnicas

- **No se usó querystring en `/contacto`**: no existe patrón seguro previo en el repo.
- **Skeleton con `data-pricing-skeleton`**: permite localizarlo en tests sin depender de clases CSS que podrían cambiar.
- **`hasConsultarItems` separado de `hasPricingItems`**: la banda de Consultar es condicional; la leyenda de valor incluido siempre se muestra cuando hay ítems.
- **Copy en infinitivo** ("Consultar este estudio", no "Consultá"): per instrucción del PR; coherente con voseo profesional de PR-10.
- **Iconos de lucide-react**: `ArrowRight`, `CheckCircle2`, `HelpCircle` — dependencia ya existente (`^1.17.0`).

## Validación ejecutada

```
pnpm --dir frontend lint        ✓
pnpm --dir frontend typecheck   ✓
pnpm --dir frontend build       ✓
pnpm test                       (ver sección Tests)
```

## Scope respetado

- No se tocó producción, DB, auth, secrets, workflows, APIs, dashboard, home, servicios, particulares, login.
- No se modificó el contrato de precios público (`/api/public/pricing`).
- No se inventaron precios ni fechas de vigencia.
- No se agregaron dependencias.
