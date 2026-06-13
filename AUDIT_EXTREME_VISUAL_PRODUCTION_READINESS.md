# Extreme Visual Production Readiness Audit

> Portal VETNEB — auditoría visual senior y preparación para imágenes profesionales futuras.
> Fecha: 2026-06-13 · Rama base: `main` · Base commit: `fd6e3e9` (paridad con `origin/main`).
> Alcance de este documento: **§9 — Preparación para implementación posterior de imágenes profesionales.**
> Carácter: **solo diagnóstico/preparación.** No se incorporaron imágenes reales ni dependencias nuevas en este trabajo.

## Executive summary

- **Estado del terreno de imágenes:** **listo para una incorporación controlada.** El sistema ya usa `next/image` correctamente (hero con `fill`+`priority`+`sizes`, avatares con dimensiones explícitas), `next.config.ts` declara `formats: ["image/avif","image/webp"]` y los assets estáticos se sirven con cache inmutable de 1 año.
- **Inventario actual:** 1 imagen de contenido (hero WebP, reutilizada como OpenGraph), 6 íconos PWA + apple-touch, favicon, 1 fuente variable WOFF2. **No hay SVGs sueltos, ni logo en imagen (el wordmark "VETNEB" es texto), ni placeholders, ni assets huérfanos, ni stock improvisado.**
- **Riesgos abiertos (bajos):** (1) la imagen OG reutiliza el hero `2400×1000` sin `width/height/type` declarados en metadata; (2) los íconos PWA de `512px` pesan ~130 KB c/u (recompresión sin pérdida de calidad disponible). Ninguno bloquea producción.
- **Recomendación:** dejar el sistema preparado con utilidades/estructura (PR-1 del backlog) **antes** de subir cualquier foto profesional; toda imagen futura debe entrar con dimensiones explícitas, `sizes`, `alt`, validación de peso y prueba en Normal + Dark Gray.

## Methodology

- **Lectura estática** de `frontend/public`, `frontend/next.config.ts`, `frontend/src/app/manifest.ts`, `frontend/src/lib/seo.ts`, `frontend/src/lib/security/csp-policy.ts`, `sitemap.ts`, `robots.ts`, y de todos los puntos donde se usa `next/image` (`page.tsx`, `ProfesionalDetailContent.tsx`, `ProfesionalesSearchContent.tsx`, `ClinicPublicProfileCard.tsx`).
- **Medición de assets:** tamaño en disco (PowerShell) y dimensiones de píxel reales (parser de cabeceras PNG/WebP) — no estimaciones.
- **Skills de referencia:** `vetneb-production-web-optimization-engineer`, `vetneb-pwa-end-to-end`, `vetneb-global-web-security-senior`, `vetneb-protocolos-comunicacion`.
- **Limitación declarada:** no se midió Lighthouse/CLS empírico en este pase (requiere servidor en ejecución); las evaluaciones de CLS/LCP se basan en el patrón de uso de `next/image` y en la estructura del DOM.

---

## Future image implementation readiness

### Current asset inventory

| Asset | Path | Type | Approx. weight | Used by | Production readiness |
|---|---|---|---:|---|---|
| favicon.ico | `/favicon.ico` | ICO | 2.1 KB | Favicon legacy (auto-servido por el navegador) | OK |
| InterVariable.woff2 | `/fonts/InterVariable.woff2` | WOFF2 (fuente) | 344.0 KB | `@font-face` en `globals.css` (`font-display: swap`) | OK — fuente variable única; subsetting es optimización opcional |
| apple-touch-icon.png | `/icons/apple-touch-icon.png` | PNG 180×180 | 26.0 KB | `seo.ts` → `icons.apple` | OK |
| icon-16x16.png | `/icons/icon-16x16.png` | PNG 16×16 | 1.0 KB | Favicon (metadata) | OK |
| icon-32x32.png | `/icons/icon-32x32.png` | PNG 32×32 | 2.1 KB | `seo.ts` → `icons.icon` | OK |
| icon-192x192.png | `/icons/icon-192x192.png` | PNG 192×192 | 28.8 KB | `manifest.ts` + `seo.ts` + shortcuts | OK |
| icon-512x512.png | `/icons/icon-512x512.png` | PNG 512×512 | 127.0 KB | `manifest.ts` + `seo.ts` | ⚠️ Pesado para un ícono — candidato a recompresión |
| maskable-icon-192x192.png | `/icons/maskable-icon-192x192.png` | PNG 192×192 | 30.1 KB | `manifest.ts` (`purpose: maskable`) | OK |
| maskable-icon-512x512.png | `/icons/maskable-icon-512x512.png` | PNG 512×512 | 133.4 KB | `manifest.ts` (`purpose: maskable`) | ⚠️ Pesado — candidato a recompresión |
| hero-microscope-vetneb.webp | `/images/hero-microscope-vetneb.webp` | WebP 2400×1000 | 75.3 KB | Home hero (`next/image` `fill priority sizes="100vw"`) **y** OG/Twitter (`seo.ts`) | OK como hero; ⚠️ como OG reutilizado sin dims declaradas |

Notas de inventario:
- **No-imágenes en `/public`:** `sw.js` (4.5 KB, `no-store`) y `theme-init.js` (0.2 KB) son scripts de runtime, no assets visuales.
- **No existen:** SVGs en `/public`, logo en formato imagen (el wordmark es texto + ícono `lucide` `Microscope`), placeholders, imágenes huérfanas ni assets sin propósito.
- **Íconos de UI:** se proveen vía `lucide-react` (componentes SVG en bundle), no como archivos en `/public`.
- **Avatares/logos de profesionales:** **no son assets del repo** — son subidas de usuario validadas en backend (JPG/PNG/WebP, ≤512 KB, cuadradas), almacenadas en object storage y servidas como URL remota pública. Se renderizan con `unoptimized` (ver Technical readiness → Security/privacy).

### Candidate image zones

| Route | Section | Purpose | Recommended image type | Risk | Implementation note |
|---|---|---|---|---|---|
| `/` | Hero | Refuerzo institucional (ya presente) | Foto de laboratorio/microscopio, art-directed | LCP / CLS | Ya implementado con `fill priority sizes="100vw"`; futura mejora = crop móvil dedicado |
| `/` | Sección institucional / "quiénes somos" | Humanizar el laboratorio y el equipo | Foto de entorno profesional, ancho contenido | CLS / peso | `next/image` con dims explícitas o `fill` en contenedor de alto fijo; `loading="lazy"` |
| `/servicios` | Encabezado / tarjetas | Apoyar comprensión del proceso diagnóstico | Foto de proceso (preparación/lectura de muestras) | Peso / competir con CTA | Imagen de apoyo, nunca detrás de CTAs primarios |
| `/laboratorio-patologico-veterinario`, `/histopatologia-veterinaria`, `/citologia-veterinaria`, `/informes-veterinarios` | Landings de servicio | Recordación + prestigio por servicio | Foto temática por servicio | Peso / coherencia | Reusar el sistema de PR-1; misma convención de `sizes`/`alt` |
| `/clinicas` | Encabezado | Contexto de portal para clínicas | Foto de entorno clínico/portal | Confianza (evitar stock genérico) | Solo si aporta valor; alternativa = mantener layout actual |
| `/contacto` | Encabezado / aside | Humanizar contacto | Foto de equipo/laboratorio | Privacidad / peso | Sin pacientes ni casos reales; el mapa ya cubre ubicación |
| `/precios` | — | (Evitar) | — | Distrae de la tabla | **No recomendado** — mantener foco en datos de precios |
| `/login` | Fondo | Marca sutil | Imagen muy ligera o gradiente actual | Peso en ruta de auth | Preferir gradiente CSS existente sobre imagen pesada |
| `/profesionales`, `/profesionales/[clinicId]` | Avatar/logo | Identidad del profesional | (Ya cubierto por subida de usuario) | Privacidad | **No agregar** imágenes decorativas; los avatares ya existen |
| Dashboards (`/dashboard*`) | — | (Evitar salvo valor operativo) | — | Peso / sin valor | No se identificó zona con valor operativo real |
| OG / social preview | Todas las rutas indexadas | Mejorar preview social | OG 1200×630 dedicada | Dimensiones/peso | Hoy reutiliza el hero; ver backlog PR `fix(seo)` y `feat(seo)` |

Propósitos **permitidos** aquí: reforzar prestigio institucional, mostrar laboratorio/entorno profesional, apoyar comprensión del proceso, humanizar contacto, mejorar recordación de marca y OpenGraph, separar visualmente secciones densas.
Propósitos **evitados:** stock genérico que baje confianza, animales decorativos sin propósito, fotos médicas sensibles, pacientes/casos reales sin autorización, reportes reales o datos identificables, fondos pesados, imágenes que compitan con CTAs o vuelvan la web lenta, o que rompan el posicionamiento institucional (clases Niza 42/44).

### Technical readiness

- **next/image:** ✅ Disponible y bien usado. Hero: `fill` + `priority` + `sizes="100vw"` + `object-cover`. Avatares: `width`/`height` explícitos + `unoptimized` (+ `loading="lazy"` en listado, `priority` en detalle). `next.config.ts` declara `images.formats: ["image/avif","image/webp"]` y `minimumCacheTTL` de 7 días. **No hay `remotePatterns`**, pero solo se necesitaría si imágenes remotas pasaran por el optimizador; los avatares remotos usan `unoptimized`, así que no rompe. Las imágenes estáticas locales sí reciben optimización AVIF/WebP.
- **CLS prevention:** ✅ Base sólida. El hero usa `fill` dentro de `absolute inset-0` sobre una sección de alto definido; los avatares usan dimensiones explícitas. **Regla para imágenes futuras:** siempre `width`/`height` o `fill` dentro de contenedor con alto/aspect-ratio reservado.
- **Responsive sizes:** ⚠️ Solo el hero declara `sizes` (`100vw`). Toda imagen de contenido futura debe declarar `sizes` reales (p. ej. `(max-width: 768px) 100vw, 50vw`) para no sobre-descargar en mobile.
- **Dark Gray compatibility:** ✅ El hero queda cubierto por un gradiente navy en ambos modos; `globals.css` tiene overrides `:root[data-theme="dark-gray"]`. **Regla:** imágenes futuras se prueban en Normal **y** Dark Gray; evitar fondos claros "quemados". (Mantener el bloque de `prefers-reduced-motion` antes de los bloques de dashboard en `globals.css`, según precedente del repo.)
- **SEO/OpenGraph:** ⚠️ OG + Twitter configurados en `seo.ts` (`createPageMetadata` propaga por página) reutilizando el hero `2400×1000`. **Gaps:** (a) sin imagen OG dedicada `1200×630`; (b) las entradas OG/Twitter no declaran `width`/`height`/`type`; (c) sitemap/robots existen pero no hay image sitemap (opcional). `metadataBase` y `alternates.canonical` correctos.
- **PWA/cache:** ✅ `/images/:path*` e `/icons/:path*` → `Cache-Control: public, max-age=31536000, immutable`; `sw.js` → `no-store`; `manifest.webmanifest` → `max-age=3600`. **Caveat:** con cache inmutable, actualizar una imagen requiere **renombrar/versionar el archivo** (los imports estáticos de `next/image` hashean solos; las rutas crudas de `/public` no). **Nunca** colocar imágenes privadas bajo `/public` ni cachearlas en el SW.
- **Accessibility:** ✅ Hero con `alt` descriptivo; avatares con `alt` plantillado por nombre; OG con `alt`. **Regla:** imágenes decorativas → `alt=""`; informativas → `alt` significativo.
- **Security/privacy:** ✅ Sin imágenes privadas en rutas públicas. Los avatares son **datos de perfil público** (perfil público de clínica y directorio de profesionales), validados server-side (`AVATAR_MIME_TYPES` JPG/PNG/WebP, ≤512 KB, ratio cuadrado), guardados en object storage y servidos como URL remota con `unoptimized` (no pasan por el optimizador de Next). CSP `img-src 'self' data: blob: https:` ya los permite. Reportes/informes diagnósticos quedan fuera de `/public` y del cache del SW.

### Future image PR backlog

| Priority | Suggested PR title | Area | Requirements | Validation |
|---|---|---|---|---|
| P1 | `feat(public): add optimized brand image system` | Infra pública | Estructura `frontend/public/images/{brand,public,services,og,icons}`; convención de nombres; wrapper/reglas `next/image` (dims explícitas, presets de `sizes`, util de blur placeholder). **Sin fotos finales.** | `lint` + `typecheck` + `build`; test de contrato de estructura/convención |
| P1 | `fix(seo): declare explicit OpenGraph image dimensions` | SEO | Agregar `width`/`height`/`type` a las entradas OG/Twitter en `seo.ts`; decidir OG dedicada `1200×630` vs. reutilizar hero | Validador OG (debugger social); snapshot de metadata |
| P2 | `feat(public): add professional hero and service imagery` | UI pública | Fotos institucionales **aprobadas**; hero/servicios/clínicas con `next/image`, `sizes`, `alt`, prevención de CLS, AVIF/WebP, prueba en ambos temas | Lighthouse/CLS; e2e sin overflow + presencia de `alt` |
| P2 | `feat(seo): add optimized OpenGraph imagery` | SEO | Imágenes OG oficiales `1200×630` por ruta clave; presupuesto de peso | Validación de preview social; test de dimensiones/peso |
| P3 | `perf(pwa): recompress 512px PWA icons` | Assets / PWA | Recompresión sin pérdida visual de `icon-512` y `maskable-512` (~130 KB → ~50–60 KB) con `oxipng`/`pngquant`; mantener paridad visual e instalación | Test de presupuesto de bytes; verificación de instalación PWA/manifest |
| P3 | `test(public): lock image performance and accessibility contracts` | Tests | `alt` obligatorio (o `alt=""` decorativo), umbral de peso, no imágenes privadas en rutas públicas, no `img` sin dimensiones, no overflow horizontal tras insertar imágenes, ambos temas, OG existe con dims esperadas | `node --test` + Playwright (Chromium) |

### Recommended future guardrails (tests)

Para "blindar" la incorporación futura sin sobreingeniería, los contratos recomendados:

- Toda imagen pública tiene `alt` adecuado, o `alt=""` si es decorativa.
- No hay imágenes mayores a un umbral definido (p. ej. > 200 KB) sin justificación documentada.
- No se usan imágenes privadas/sensibles (informes, datos identificables) en rutas públicas ni bajo `/public`.
- No hay `<img>`/`<Image>` sin dimensiones explícitas o sin wrapper de alto estable (anti-CLS).
- No aparece overflow horizontal en rutas públicas tras insertar imágenes (extiende los guardrails e2e existentes a 375/768/1024/1180/1280).
- No se introducen orígenes externos de imagen no aprobados (coherente con CSP `img-src`).
- No se rompe el render en Normal ni en Dark Gray.
- La imagen OpenGraph existe y tiene las dimensiones esperadas (`1200×630`).
- (Si hay tooling) presupuesto de performance vía Lighthouse para LCP/CLS del hero.
