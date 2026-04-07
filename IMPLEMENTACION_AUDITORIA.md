# Auditoría técnica y plan de implementación — PORTAL VETNEB

## 1. Diagnóstico principal

### Bloqueante encontrado

El backend estaba intentando leer `reports.storage_path`, pero la base real todavía podía venir con el esquema legado `drive_file_id`.

**Síntoma directo:**

- error SQL `42703: column "storage_path" does not exist`

### Riesgos detectados

1. endpoints de informes sin protección efectiva
2. bucket de Supabase asumido, pero no validado
3. uso de URL pública para archivos clínicos
4. ausencia de validación de tipos de archivo
5. CORS sin configuración completa para cookies
6. healthcheck sin validar Storage
7. errores HTTP poco accionables
8. repo con rastros de transición de Drive -> Supabase sin cierre completo

---

## 2. Solución aplicada

### Storage de Supabase

Se reemplazó el flujo de URL pública por **signed URLs** sobre bucket privado.

### Migración de esquema

Se dejó una migración idempotente para renombrar columnas legacy:

- `clinics.drive_folder_id` -> `clinics.storage_folder_path`
- `reports.drive_file_id` -> `reports.storage_path`

### Seguridad

Se agregó middleware `requireAuth` y protección real para:

- listado de informes
- búsqueda
- tipos de estudio
- descarga
- subida

Además, se restringe acceso cruzado entre clínicas.

### Fluidez operativa

Se agregaron:

- paginación controlada
- validación de límites
- sorting consistente
- healthcheck real
- manejo más claro de errores
- validación de MIME types

---

## 3. Orden recomendado de implementación

### Paso 1

Configurar `.env` real.

### Paso 2

Correr migraciones:

```bash
pnpm db:migrate
```

### Paso 3

Levantar API:

```bash
pnpm dev
```

### Paso 4

Verificar salud:

- `GET /api/health`

### Paso 5

Probar login y sesión con cookies.

### Paso 6

Probar carga y descarga de PDF.

---

## 4. Contrato de frontend sugerido

### Login

```ts
await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ username, password }),
});
```

### Listado

```ts
await fetch("/api/reports?limit=50&offset=0", {
  credentials: "include",
});
```

### Búsqueda

```ts
await fetch("/api/reports/search?query=juan&studyType=rx", {
  credentials: "include",
});
```

### Upload

```ts
const formData = new FormData();
formData.append("file", file);

await fetch("/api/reports/upload", {
  method: "POST",
  credentials: "include",
  body: formData,
});
```

### Descarga

```ts
const response = await fetch(`/api/reports/${reportId}/download-url`, {
  credentials: "include",
});
const { downloadUrl } = await response.json();
window.open(downloadUrl, "_blank");
```

---

## 5. Pendientes recomendados para siguiente fase

1. hash de contraseñas con `bcrypt` en vez de `sha256`
2. rate limiting de login
3. refresh de signed URLs desde frontend al expirar
4. extracción automática de metadatos de informes
5. tests de integración para auth + upload + search
6. soft delete de reportes
7. auditoría de accesos por usuario

---

## 6. Resultado

El backend queda listo para uso real con Supabase Storage privado, sesiones por cookie y migración ordenada del storage legado.
