# SETUP

## 1. Instalar dependencias

```bash
pnpm install
```

## 2. Configurar entorno

```bash
cp .env.example .env
```

Completar:

- `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `CORS_ORIGIN`

## 3. Ejecutar migraciones

```bash
pnpm db:migrate
```

## 4. Verificar salud de la API

```bash
curl http://localhost:3000/api/health
```

Debe responder:

```json
{
  "success": true,
  "status": "ok",
  "database": "ok",
  "storage": "ok"
}
```

## 5. Desarrollo

```bash
pnpm dev
```

## 6. Build de producción

```bash
pnpm build
pnpm start
```

## 7. Integración frontend

Todas las llamadas autenticadas deben usar cookies:

```ts
fetch("http://localhost:3000/api/reports", {
  credentials: "include",
});
```
