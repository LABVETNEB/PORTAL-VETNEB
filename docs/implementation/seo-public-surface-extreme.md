# SEO Extremo — Superficie Pública VETNEB

**Rama:** `seo/extreme-public-surface-optimization`
**Fecha:** 2026-06-04
**Alcance:** Toda la superficie pública de `frontend/src/app/` (Next.js App Router).

---

## Páginas cubiertas

| Ruta | Indexable | JSON-LD | Canonical | Robots metadata |
|------|-----------|---------|-----------|-----------------|
| `/` | ✓ | Organization + WebSite (layout) | ✓ | index/follow |
| `/servicios` | ✓ | Service + BreadcrumbList | ✓ | index/follow |
| `/citologia-veterinaria` | ✓ | Service + BreadcrumbList | ✓ | index/follow |
| `/histopatologia-veterinaria` | ✓ | Service + BreadcrumbList | ✓ | index/follow |
| `/informes-veterinarios` | ✓ | Service + BreadcrumbList | ✓ | index/follow |
| `/laboratorio-patologico-veterinario` | ✓ | Service + BreadcrumbList | ✓ | index/follow |
| `/clinicas` | ✓ | WebPage + BreadcrumbList **(nuevo)** | ✓ | index/follow |
| `/precios` | ✓ | WebPage + BreadcrumbList **(nuevo)** | ✓ | index/follow |
| `/contacto` | ✓ | ContactPage + BreadcrumbList **(nuevo)** | ✓ | index/follow |
| `/profesionales` | ✓ | SearchResultsPage + BreadcrumbList + SearchAction | ✓ | index/follow |
| `/profesionales/[clinicId]` | ✓ | — (client-rendered) | ✓ | index/follow |
| `/login` | ✗ | — | — | noindex/nofollow |
| `/particulares` | ✗ | — | — | noindex/nofollow |
| `/offline` | ✗ | — | — | noindex/nofollow **(corregido)** |

---

## Decisiones de index/noindex

- **`/login`**: noindex. Es acceso autenticado, no aporta valor de búsqueda.
- **`/particulares`**: noindex. Es portal de acceso por token privado.
- **`/offline`**: noindex **(gap corregido)**. Era una página de fallback PWA sin metadata robots. Agregado `robots: { index: false, follow: false }`.
- **`/dashboard/*`**: bloqueado en robots.txt y sin metadata pública.

---

## Cambios implementados

### `frontend/src/lib/seo.ts`
- **Agregado `getContactPageJsonLd()`**: emite `ContactPage` + `BreadcrumbList` para `/contacto`. Tipo ContactPage (WebPage subtype) con referencias `@id` al Organization y WebSite del graph global.
- **Agregado `getClinicasPageJsonLd()`**: emite `WebPage` + `BreadcrumbList` para `/clinicas`. Consistente con el patrón de otros helpers.
- **Agregado `getPreciosPageJsonLd()`**: emite `WebPage` + `BreadcrumbList` para `/precios`.

### `frontend/src/app/robots.ts`
- **Agregado `/offline` y `/particulares` a `disallow`**. Antes solo bloqueaban `/dashboard` y `/api`. Las páginas noindex que no aportan crawl budget útil deben bloquearse también en robots.txt como segunda capa.

### `frontend/src/app/offline/page.tsx`
- **Agregado `robots: { index: false, follow: false }`**. Era la única página noindex no declarada explícitamente en metadata.

### `frontend/src/app/page.tsx` (home)
- **Corregido título duplicado de marca.** El título anterior `"Portal VETNEB — Laboratorio Patológico Veterinario"` con el template `%s | Portal VETNEB` renderizaba como `"Portal VETNEB — Laboratorio Patológico Veterinario | Portal VETNEB"` — doble marca, mala señal de calidad para Google. Cambiado a `"Laboratorio Patológico Veterinario — Histopatología, Citología y Hematología"` → renderiza como `"Laboratorio Patológico Veterinario — Histopatología, Citología y Hematología | Portal VETNEB"`.

### `frontend/src/app/precios/page.tsx`
- **Mejorado título**: de `"Lista de precios"` (genérico) a `"Precios de Estudios Patológicos Veterinarios"` (descriptivo, keyword-rich).
- **Agregado JSON-LD**: `getPreciosPageJsonLd()`.

### `frontend/src/app/contacto/page.tsx`
- **Agregado JSON-LD**: `getContactPageJsonLd()`. Emitido desde el server component page, antes de que `ContactoContent` (client component) renderice.

### `frontend/src/app/clinicas/page.tsx`
- **Agregado JSON-LD**: `getClinicasPageJsonLd()`.

---

## Structured data implementada / preexistente

| Tipo | Páginas | Función helper |
|------|---------|----------------|
| `Organization` + `WebSite` | Todas (layout global) | `getOrganizationJsonLd()` |
| `Service` + `BreadcrumbList` | `/servicios`, `/citologia-veterinaria`, `/histopatologia-veterinaria`, `/informes-veterinarios`, `/laboratorio-patologico-veterinario` | `getServicesJsonLd()`, `getDiagnosticServiceJsonLd()` |
| `ContactPage` + `BreadcrumbList` | `/contacto` | `getContactPageJsonLd()` |
| `WebPage` + `BreadcrumbList` | `/clinicas`, `/precios` | `getClinicasPageJsonLd()`, `getPreciosPageJsonLd()` |
| `SearchResultsPage` + `SearchAction` + `BreadcrumbList` | `/profesionales` | `getProfessionalsPageJsonLd()` |

### Tipos deliberadamente NO implementados
- `LocalBusiness` / `VeterinaryCare`: no se cuenta con dirección física verificable (solo ciudad).
- `AggregateRating` / `Review`: sin datos de reseñas reales.
- `FAQPage`: no hay sección FAQ visible en ninguna página pública.
- `MedicalClaim`: sin claims clínicos verificables.
- `openingHours`, `GeoCoordinates`, `PostalAddress`: sin datos de calle verificables.

---

## Contratos de regresión agregados

**Archivo:** `test/frontend-seo-public-surface-extreme.test.ts`

| Test | Contrato |
|------|----------|
| `robots.ts disallows dashboard, api, offline and particulares` | Verifica presencia de los 4 paths en disallow |
| `robots.ts does not allow dashboard or api routes explicitly` | La sección allow no contiene /dashboard ni /api |
| `offline page declares robots noindex` | `robots: { index: false, follow: false }` en offline/page.tsx |
| `login and particulares pages declare robots noindex` | Ambas páginas tienen noindex |
| `home page title does not start with brand name` | El título de home no empieza con "Portal VETNEB —" para evitar duplicación |
| `sitemap includes all public indexable service pages` | 9 URLs de servicios y páginas institucionales presentes |
| `sitemap excludes private, noindex and tokenized routes` | /dashboard, /api, /offline, /particulares, /login ausentes |
| `service pages emit getDiagnosticServiceJsonLd structured data` | 5 páginas de servicio tienen script JSON-LD con JSON.stringify |
| `contacto page emits ContactPage JSON-LD` | getContactPageJsonLd en seo.ts y contacto/page.tsx |
| `clinicas page emits WebPage JSON-LD with breadcrumb` | getClinicasPageJsonLd en seo.ts y clinicas/page.tsx |
| `precios page emits WebPage JSON-LD with breadcrumb` | getPreciosPageJsonLd en seo.ts y precios/page.tsx |
| `profesionales page emits SearchResultsPage JSON-LD` | getProfessionalsPageJsonLd en profesionales/page.tsx |
| `seo.ts JSON-LD helpers do not include unverifiable schema types` | Sin AggregateRating, Review, FAQPage, openingHours, GeoCoordinates, PostalAddress, priceRange, MedicalClaim |
| `JSON-LD across all public pages uses JSON.stringify` | Sin interpolación manual de strings peligrosos |
| `seo.ts does not contain placeholder, localhost or internal domain references` | Sin localhost, example.com, TODO, FIXME |
| `seo.ts canonical URL defaults to production domain` | URL de producción hardcodeada como fallback |
| `all helpers emit BreadcrumbList` | 5 helpers tienen BreadcrumbList |
| `all public indexable pages declare canonical` | 10 páginas usan createPageMetadata o generateMetadata |
| `dashboard routes never in sitemap` | 4 rutas de dashboard ausentes del sitemap |
| `precios page title is descriptive` | No usa el genérico "Lista de precios", incluye keyword veterinario |
| `contacto page title does not contain brand name` | El title no contiene "Portal VETNEB" para evitar `"Contacto — Portal VETNEB \| Portal VETNEB"` |

---

## Validaciones ejecutadas

- `pnpm test` (backend + tests de frontend estáticos)
- `pnpm build` (backend)
- `pnpm security:public-surface`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`

---

## Corrección post-implementación: título de `/contacto`

El riesgo residual de duplicación en `/contacto` fue corregido. El title `"Contacto — Portal VETNEB"` fue reemplazado por `"Contacto — Laboratorio Patológico Veterinario"`, resultando en el title final:

```
Contacto — Laboratorio Patológico Veterinario | Portal VETNEB
```

61 caracteres, sin duplicación de marca, con keyword value. Se agregó el contrato de regresión `contacto page title does not contain brand name`.

---

## Riesgos residuales

1. **`/profesionales/[clinicId]`**: El contenido del perfil se carga client-side. Googlebot ejecuta JS pero el tiempo de renderizado puede limitar la indexación completa. No se agregó JSON-LD porque los datos del perfil no están disponibles en server-side (se cargan desde la API). Riesgo: bajo — las páginas de perfil son de búsqueda interna, no SEO primario.

2. **JSON-LD `dangerouslySetInnerHTML` + `JSON.stringify`**: Técnicamente seguro porque todos los datos son constantes de tiempo de build, pero `JSON.stringify` no escapa `</script>` en valores de string. En este proyecto todos los valores son literales inofensivos, por lo que el riesgo es nulo en la práctica. Si en el futuro se agregan datos dinámicos de usuario, se debe usar un sanitizador que escape `</script>`.

3. **`lastModified` en sitemap**: Se usa `new Date()` que cambia en cada build. Esto genera un sitemap diferente en cada deployment, lo que puede causar reindexaciones innecesarias. Riesgo: bajo — es el patrón existente del proyecto y aceptado.
