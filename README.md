# PORTAL VETNEB Backend

Backend auditado y endurecido para despliegue con **Supabase + Storage privado + Fastify + Drizzle**.

## Qué quedó resuelto

- migración segura de `drive_file_id` -> `storage_path`
- migración segura de `drive_folder_id` -> `storage_folder_path`
- Storage de Supabase funcionando con bucket privado y signed URLs
- validación fuerte de entorno
- autenticación por sesión con protección real de endpoints de informes
- CORS con credenciales
- healthcheck que valida **DB + Storage**
- errores HTTP más claros para implementación y debugging
- endpoints listos para integrarse con frontend

## Stack

- Node.js
- pnpm
- Fastify
- TypeScript
- Drizzle ORM
- PostgreSQL / Supabase
- Supabase Storage
- Render

## Scripts

```bash
pnpm install
pnpm db:migrate
pnpm dev
pnpm typecheck
pnpm build
pnpm start
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar valores reales.

## Endpoints

- `GET /`
- `GET /health`
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/reports/upload`
- `GET /api/reports`
- `GET /api/reports/search`
- `GET /api/reports/study-types`
- `GET /api/reports/:reportId/download-url`

## Flujo esperado del frontend

1. login con `POST /api/auth/login`
2. mantener cookies con `credentials: 'include'`
3. pedir sesión con `GET /api/auth/me`
4. listar informes con `GET /api/reports`
5. buscar con `GET /api/reports/search`
6. subir archivos con `POST /api/reports/upload`
7. descargar con `GET /api/reports/:reportId/download-url`

## Notas de implementación

- el bucket se crea automáticamente si no existe
- los archivos se guardan en ruta por clínica y fecha
- las URLs son firmadas y expiran
- para frontend separado, el `fetch` debe usar `credentials: 'include'`
