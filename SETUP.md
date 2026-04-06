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

## 3. Migraciones

```bash
pnpm db:migrate
```

## 4. Desarrollo

```bash
pnpm dev
```

## 5. Build de producción

```bash
pnpm build
pnpm start
```
