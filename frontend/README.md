# Portal VETNEB — Frontend

Frontend Next.js App Router para Portal VETNEB. Sitio público con SEO fuerte y dashboard privado para clínicas y administración.

## Stack

| Tecnologia | Version | Proposito |
|---|---|---|
| Next.js | 15.x (App Router) | Framework principal |
| React | 19.x | UI |
| TypeScript | 5.x | Tipado estatico |
| Tailwind CSS | 4.x | Estilos |
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

El frontend consume el backend Fastify existente mediante wrappers en `src/lib/api.ts`.
Todas las llamadas HTTP usan `credentials: 'include'` para enviar cookies de sesión.

## Estado operacional actual

| Superficie | Estado |
|---|---|
| Dashboard `/dashboard/*` | Protegido por middleware (`src/middleware.ts`) |
| Login clínica | Conectado a `POST /api/auth/login` y sesión vía cookies |
| Sesión clínica | Validación con `GET /api/auth/me` |
| Informes listados | Lectura real con `GET /api/reports` |
| Informes filtrados | `query`/`status` conectados a backend (`GET /api/reports/search` y `GET /api/reports?status=...`) |
| Descarga de informe | URL firmada vía `GET /api/reports/:reportId/download-url` |
| Logística (visitas/rutas/métricas) | Lectura real de endpoints backend; si el backend no responde retorna estado vacío seguro |

## Mock data

`src/lib/mock-data.ts` se mantiene como fixture/demo aislado para desarrollo o referencia visual.
No es fallback principal para reportes ni logística en el estado actual.

## Decisiones técnicas vigentes

**Next.js App Router sobre Pages Router:** metadata por página, Server Components para SEO y layouts anidados para dashboard.

**Componentes UI propios (shadcn/ui):** componentes en `src/components/ui/` para control total del frontend.

**Middleware de acceso:** `/dashboard/*` exige cookie de sesión; rutas admin requieren cookie admin y se ocultan con `404` si no existe.

**Lectura live con fallback seguro:** wrappers de API devuelven estados vacíos seguros ante errores de backend para no romper render de dashboard.

## Validación frontend

Ejecutar desde la raíz del repositorio.

Validación rápida:

```bash
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
```

Paridad completa con Frontend CI:

```bash
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
pnpm --dir frontend exec playwright install chromium
pnpm --dir frontend e2e
```

Nota operativa:
- En CI Linux se usa `pnpm --dir frontend exec playwright install --with-deps chromium`.
- En desarrollo local Windows/PowerShell se recomienda `pnpm --dir frontend exec playwright install chromium`.

## Validación repo raíz

```bash
pnpm typecheck
pnpm typecheck:test
pnpm test
pnpm build
```

## CI

El repositorio incluye pipeline de frontend en `.github/workflows/frontend-ci.yml`.
