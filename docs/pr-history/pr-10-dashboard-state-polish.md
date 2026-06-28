# PR-10 — feat(dashboard): polish loading, empty and error states

## Resumen

Cierre del roadmap base de dashboards privados con polish premium y consistente de estados. Se mejoran los tres componentes de estado compartidos (`LoadingState`, `EmptyState`, `ErrorState`) con atributos de accesibilidad completos, props opcionales no-breaking y mejoras visuales sobrias. Las integraciones existentes en dashboards privados (informes, logística, principal) ya usan estos componentes correctamente desde PRs anteriores.

---

## Archivos modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `frontend/src/components/dashboard/LoadingState.tsx` | componente | mejoras accesibilidad + props opcionales |
| `frontend/src/components/dashboard/EmptyState.tsx` | componente | props opcionales contextualización |
| `frontend/src/components/dashboard/ErrorState.tsx` | componente | tone/supportText + focus-visible |
| `test/frontend-dashboard-state-polish.test.ts` | test | contrato completo PR-10 |
| `docs/pr-10-dashboard-state-polish.md` | docs | este documento |

---

## Mejoras por componente

### LoadingState

**Props nuevas (no-breaking):**
- `label?: string` — texto accesible personalizable (default: `"Cargando..."`)
- `compact?: boolean` — layout compacto para paneles pequeños (default: `false`)

**Accesibilidad:**
- `role="status"` en todos los variants (live region implícita)
- `aria-live="polite"` explícito en todos los variants
- `aria-busy="true"` mantenido (ya existía)
- `<span className="sr-only">{loadingLabel}</span>` en todos los variants

**Visual:**
- Sin cambios de layout relevantes; el `compact` solo reduce padding y `min-h`
- Sin spinner fullscreen ni `animate-spin`
- Skeletons estables vía `Skeleton` de shadcn/ui

**API pública mantenida:** `variant`, `rows`, `className` — sin cambios de firma.

---

### EmptyState

**Props nuevas (no-breaking):**
- `eyebrow?: string` — etiqueta contextual sobre el título (uppercase tracking)
- `secondaryAction?: ReactNode` — acción secundaria debajo de la primaria

**Accesibilidad:**
- `aria-hidden="true"` en el contenedor del ícono y en el `<Icon>` mantenidos
- Ícono decorativo no aporta semántica al lector de pantalla

**Visual:**
- Jerarquía: eyebrow → ícono → título → descripción → action → secondaryAction
- Sin gradientes decorativos fuertes ni `shadow-xl`
- Borde dashed existente mantenido

**API pública mantenida:** `title`, `description`, `action`, `icon`, `className` — sin cambios de firma.

---

### ErrorState

**Props nuevas (no-breaking):**
- `supportText?: string` — texto de soporte secundario bajo el mensaje principal
- `tone?: "warning" | "critical"` — severidad visual (default: `"critical"` = comportamiento anterior)

**Accesibilidad:**
- `role="alert"` mantenido
- `type="button"` en botón retry mantenido
- `focus-visible:ring-2` explícito en el botón retry

**Seguridad:**
- Sin stack traces ni detalles internos expuestos
- Título default: `"No se pudo completar la acción"` (sin "Error desconocido")
- El `message` es responsabilidad del llamador; el componente no procesa ni expone datos sensibles

**Visual:**
- `tone="warning"`: colores amber/amarillo (amber-500/700)
- `tone="critical"`: colores destructive existentes (sin cambio visual para llamadores sin `tone`)
- Ícono cambia a `AlertTriangle` para tone warning, `AlertCircle` para critical

**API pública mantenida:** `title`, `message`, `onRetry`, `className` — sin cambios de firma.

---

## Integraciones realizadas

Las integraciones ya estaban implementadas en PRs anteriores:

| Dashboard | EmptyState | ErrorState | LoadingState |
|---|---|---|---|
| `/dashboard` (principal) | ✓ vía ClinicCommandCenter | ✓ role="alert" inline | ✓ StatsCards propio |
| `/dashboard/informes` | ✓ tabla + detail | ✓ tabla | — |
| `/dashboard/logistica` | ✓ LogisticsCommandCenter | ✓ LogisticsCommandCenter | — |
| `/dashboard/logistica/visitas` | ✓ tabla | ✓ tabla | — |
| `/dashboard/logistica/rutas` | ✓ tabla | — | — |
| `/dashboard/logistica/metricas` | ✓ tarjetas | ✓ tarjetas | — |

No se realizaron cambios en páginas de dashboard. Las mejoras de los componentes se propagan automáticamente.

---

## Decisiones técnicas

- **`role="status"` vs `aria-live`**: Se añaden ambos. `role="status"` crea live region implícita con `aria-live="polite"`, se añade `aria-live` explícito para compatibilidad máxima con lectores de pantalla legacy.
- **sr-only en LoadingState**: El texto `Cargando...` es `sr-only` para no romper layouts visuales. Puede personalizarse via prop `label`.
- **tone en ErrorState**: `"critical"` replica exactamente el comportamiento anterior (destructive colors). `"warning"` usa amber sin tocar variables CSS del proyecto para no requerir cambios en globals.css.
- **eyebrow en EmptyState**: Texto uppercase tracking, muted, para contexto de panel sin ser visual dominante.
- **No se tocan páginas de dashboard**: Las integraciones existentes ya son correctas. Añadir `eyebrow` a instancias existentes sería un cambio de contenido, no de lógica, y no aporta valor suficiente para justificarlo.
- **No se crearon endpoints, rutas, ni componentes nuevos**: Scope estrictamente cumplido.

---

## Validaciones ejecutadas

```
pnpm test                          — suite completa de tests
pnpm build                         — build raíz
pnpm security:public-surface       — superficie pública
pnpm --dir frontend lint           — ESLint frontend
pnpm --dir frontend typecheck      — TypeScript frontend
pnpm --dir frontend build          — build Next.js
```

Ver resultados en sección siguiente.

---

## Riesgos residuales

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `tone="warning"` usa `amber-*` directos no en design tokens | Baja | Solo afecta instancias que pasen `tone="warning"` explícitamente; comportamiento default no cambia |
| `compact` en LoadingState reduce `min-h` | Baja | Solo activo cuando se pasa `compact={true}` explícitamente; default `false` mantiene layout anterior |
| `eyebrow` en EmptyState añade un `<p>` nuevo | Baja | Solo renderizado si `eyebrow` prop es truthy; todos los usos existentes sin prop no se ven afectados |

---

## Confirmación de no-changes en áreas protegidas

- ✅ Sin cambios en backend
- ✅ Sin cambios en API routes
- ✅ Sin cambios en auth / middleware
- ✅ Sin cambios en SEO / metadata
- ✅ Sin cambios en rutas públicas
- ✅ Sin cambios en lógica de negocio
- ✅ Sin cambios en cálculo de fechas
- ✅ Sin cambios en `package.json`
- ✅ Sin cambios en `pnpm-lock.yaml`
- ✅ Sin cambios en `next-env.d.ts`
- ✅ Sin cambios en `tsconfig.json`
- ✅ Sin instalación de dependencias
- ✅ Sin nuevos endpoints
- ✅ Sin nuevas rutas
