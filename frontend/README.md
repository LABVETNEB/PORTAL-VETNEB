# Portal VETNEB — Frontend

Frontend Next.js App Router para Portal VETNEB. Sitio público con SEO fuerte y dashboard privado para clínicas y administración.

## Stack

| Tecnologia | Version | Proposito |
|---|---|---|
| Next.js | 15.x (App Router) | Framework principal |
| React | 19.x | UI |
| TypeScript | 5.x | Tipado estatico |
| Tailwind CSS | 3.x (v4 pendiente) | Estilos |
| shadcn/ui (Radix UI) | - | Componentes UI |
| TanStack Query | 5.x | Server state y cache cliente |
| TanStack Table | 8.x | Tablas de datos |
| React Hook Form | 7.x | Formularios |
| Zod | 4.x | Validacion de schemas |
| ECharts | 6.x | Graficos y visualizacion |
| pnpm | 10.x | Gestor de paquetes |

## Instalación

```bash
# Desde la raíz del monorepo
pnpm install

# O desde el directorio frontend
cd frontend
pnpm install
```

## Desarrollo local

```bash
# Desde el directorio frontend
cd frontend
pnpm dev
```

El frontend corre en `http://localhost:3000` por defecto (o el puerto que configure Next.js).

> **Nota:** El backend Fastify debe estar corriendo en el puerto configurado en `NEXT_PUBLIC_API_URL`.

## Variables de entorno

Copiar `frontend/.env.example` a `frontend/.env.local`:

```bash
cp frontend/.env.example frontend/.env.local
```

| Variable | Descripción | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL del backend Fastify | `http://localhost:3000` |
| `NEXT_PUBLIC_SITE_URL` | URL pública del frontend | `http://localhost:3001` |

## Build de producción

```bash
cd frontend
pnpm build
pnpm start
```

## Estructura del proyecto

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Layout raíz (metadata base + JSON-LD)
│   │   ├── page.tsx            # Home público
│   │   ├── robots.ts           # robots.txt
│   │   ├── sitemap.ts          # sitemap.xml
│   │   ├── servicios/          # Página de servicios
│   │   ├── profesionales/      # Página de profesionales
│   │   ├── clinicas/           # Página de clínicas
│   │   ├── contacto/           # Página de contacto
│   │   ├── login/              # Página de login
│   │   └── dashboard/          # Dashboard privado
│   │       ├── layout.tsx      # Layout con sidebar
│   │       ├── page.tsx        # Dashboard principal
│   │       ├── informes/       # Módulo de informes
│   │       ├── logistica/      # Módulo de logística
│   │       │   ├── visitas/    # Visitas de campo
│   │       │   ├── rutas/      # Planes de ruta
│   │       │   └── metricas/   # Métricas de cumplimiento
│   │       └── admin/          # Módulo de administración
│   ├── components/
│   │   ├── layout/             # Navbar, Footer, PublicLayout
│   │   ├── public/             # Componentes de páginas públicas
│   │   ├── dashboard/          # Sidebar, Topbar, StatsCards
│   │   └── ui/                 # Componentes shadcn/ui
│   ├── lib/
│   │   ├── api.ts              # Funciones wrapper de la API
│   │   ├── mock-data.ts        # Datos de prueba (claramente marcados)
│   │   ├── routes.ts           # Rutas centralizadas
│   │   ├── seo.ts              # Utilidades SEO y JSON-LD
│   │   └── utils.ts            # Utilidades generales (cn, formatDate, etc.)
│   └── types/
│       └── index.ts            # Tipos TypeScript del frontend
```

## Integración con el backend

El frontend consume el backend Fastify existente. El flujo de autenticación esperado es:

1. Login con `POST /api/auth/login` (con `credentials: 'include'`)
2. Verificar sesión con `GET /api/auth/me`
3. Listar informes con `GET /api/reports`
4. Buscar informes con `GET /api/reports/search`
5. Descargar informe con `GET /api/reports/:reportId/download-url`

Todos los fetch usan `credentials: 'include'` para enviar cookies de sesión.

## Mock data

Los endpoints de logística y admin usan mock data mientras se confirman los contratos de respuesta:

| Función | Endpoint backend | Estado |
|---|---|---|
| `getReports()` | `GET /api/reports` | Confirmado |
| `searchReports()` | `GET /api/reports/search` | Confirmado |
| `getLogisticsFieldVisits()` | `GET /api/logistics/field-visits` | Mock (auth admin) |
| `getRoutePlans()` | `GET /api/logistics/route-plans` | Mock (auth admin) |
| `getRoutePlanMetrics()` | `GET /api/logistics/route-plans/:id/metrics` | Mock |
| `getAuditEntries()` | `GET /api/admin/audit-log` | Mock (auth admin) |
| `getDashboardStats()` | Sin endpoint | Mock |

## Decisiones técnicas

**Next.js App Router sobre Pages Router:** Permite metadata por página, Server Components para SEO, y layouts anidados para el dashboard sin re-renderizar el sidebar.

**Componentes UI propios (shadcn/ui):** Los componentes están copiados en `src/components/ui/` para control total sin dependencias externas de terceros.

**Mock data aislada:** Todo el mock data está en `src/lib/mock-data.ts` con comentarios `@mock` claros. La función `api.ts` tiene fallback a mock data cuando el backend no está disponible.

**Sin autenticación real todavía:** La estructura visual del dashboard está preparada. La autenticación real se implementará en un PR separado conectando con `POST /api/auth/login` y `GET /api/auth/me`.

**Server Components por defecto:** Las páginas son Server Components. Solo los formularios interactivos (login, contacto) son Client Components (`"use client"`).

## Próximos PRs recomendados

| PR | Descripción | Prioridad |
|---|---|---|
| `feat/auth-integration` | Conectar login con `POST /api/auth/login`, middleware de protección de rutas | Alta |
| `feat/reports-live` | Conectar `getReports()` y `searchReports()` con datos reales, paginación | Alta |
| `feat/logistics-live` | Conectar visitas y rutas con endpoints admin del backend | Media |
| `feat/contact-form` | Integrar formulario de contacto con backend o servicio de email | Media |
| `feat/dark-mode` | Soporte dark mode con `next-themes` | Baja |
| `feat/mobile-nav` | Menú hamburguesa para navegación móvil | Media |
| `feat/dashboard-auth-guard` | Middleware Next.js para proteger rutas `/dashboard/*` | Alta |
| `feat/report-upload` | Interfaz de carga de informes con `POST /api/reports/upload` | Media |


## Validacion local

Desde la raiz del frontend:

    pnpm install
    pnpm lint
    pnpm typecheck
    pnpm build

Tambien se puede ejecutar desde la raiz del repositorio apuntando al directorio del frontend:

    pnpm --dir frontend install
    pnpm --dir frontend lint
    pnpm --dir frontend typecheck
    pnpm --dir frontend build

Validacion recomendada para cambios frontend:

    pnpm --dir frontend lint
    pnpm --dir frontend typecheck
    pnpm --dir frontend build
