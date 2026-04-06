# PORTAL VETNEB Backend

Backend auditado y estandarizado para una fusión segura, con base lista para un frontend futuro en **Vite 6** usando **pnpm**, **Node.js**, **Supabase**, **Render** y **Express**.

## Stack consolidado

- Node.js
- pnpm
- Express
- TypeScript
- Drizzle ORM
- PostgreSQL / Supabase
- Supabase Storage
- Render
- Preparado para frontend separado con Vite 6

## Estructura

```txt
server/
  app.ts
  index.ts
  db.ts
  lib/
  middlewares/
  routes/
  utils/
```

## Scripts

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm start
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar valores reales.

## Endpoints principales

- `GET /`
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/reports/upload`
- `GET /api/reports`
- `GET /api/reports/search`
- `GET /api/reports/study-types`
- `GET /api/reports/:reportId/download-url`

## Criterios de limpieza aplicados

- eliminada la capa tRPC no montada
- eliminado código legado orientado a OAuth/SDK/IA no utilizado
- eliminado acoplamiento a Google Drive
- estandarizado almacenamiento en `storagePath`
- centralizada validación de entorno
- separada la API por rutas y middlewares
