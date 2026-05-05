# AuditorÃ­a tÃ©cnica y plan de implementaciÃ³n â€” PORTAL VETNEB

## 1. DiagnÃ³stico principal

### Bloqueante encontrado

El backend estaba intentando leer `reports.storage_path`, pero la base real todavÃ­a podÃ­a venir con el esquema legado `drive_file_id`.

**SÃ­ntoma directo:**

- error SQL `42703: column "storage_path" does not exist`

### Riesgos detectados

1. endpoints de informes sin protecciÃ³n efectiva
2. bucket de Supabase asumido, pero no validado
3. uso de URL pÃºblica para archivos clÃ­nicos
4. ausencia de validaciÃ³n de tipos de archivo
5. CORS sin configuraciÃ³n completa para cookies
6. healthcheck sin validar Storage
7. errores HTTP poco accionables
8. repo con rastros de transiciÃ³n de Drive -> Supabase sin cierre completo

---

## 2. SoluciÃ³n aplicada

### Storage de Supabase

Se reemplazÃ³ el flujo de URL pÃºblica por **signed URLs** sobre bucket privado.

### MigraciÃ³n de esquema

Se dejÃ³ una migraciÃ³n idempotente para renombrar columnas legacy:

- `clinics.drive_folder_id` -> `clinics.storage_folder_path`
- `reports.drive_file_id` -> `reports.storage_path`

### Seguridad

Se agregÃ³ middleware `requireAuth` y protecciÃ³n real para:

- listado de informes
- bÃºsqueda
- tipos de estudio
- descarga
- subida

AdemÃ¡s, se restringe acceso cruzado entre clÃ­nicas.

### Fluidez operativa

Se agregaron:

- paginaciÃ³n controlada
- validaciÃ³n de lÃ­mites
- sorting consistente
- healthcheck real
- manejo mÃ¡s claro de errores
- validaciÃ³n de MIME types

---

## 3. Orden recomendado de implementaciÃ³n

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

Probar login y sesiÃ³n con cookies.

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

### BÃºsqueda

```ts
await fetch("/api/reports/search?query=juan&studyType=rx", {
  credentials: "include",
});
```

### Upload

```ts
const formData = new FormData();
formData.append("file", file);

await fetch("/api/admin/reports/upload", {
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

1. hash de contraseÃ±as con `bcrypt` en vez de `sha256`
2. rate limiting de login
3. refresh de signed URLs desde frontend al expirar
4. extracciÃ³n automÃ¡tica de metadatos de informes
5. tests de integraciÃ³n para auth + upload + search
6. soft delete de reportes
7. auditorÃ­a de accesos por usuario

---

## 6. Resultado

El backend queda listo para uso real con Supabase Storage privado, sesiones por cookie y migraciÃ³n ordenada del storage legado.

