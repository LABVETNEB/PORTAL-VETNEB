# Guía de Configuración - Portal VETNEB

## 1. Requisitos del Sistema

- **Node.js**: 24.x o superior
- **pnpm**: 10.4.1 o superior
- **MySQL**: 8.0 o superior

## 2. Instalación Inicial

### Paso 1: Instalar dependencias

```bash
cd PORTALVETNEB_CLEANED
pnpm install
```

### Paso 2: Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores.

### Paso 3: Crear base de datos

```bash
mysql -u root -p
CREATE DATABASE vetneb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### Paso 4: Ejecutar migraciones

```bash
pnpm db:push
```

## 3. Ejecutar el Proyecto

### Desarrollo

```bash
pnpm dev
```

### Producción

```bash
pnpm build
pnpm start
```

## 4. Verificación

```bash
pnpm check      # Verificar tipos
pnpm test       # Ejecutar pruebas
pnpm format     # Formatear código
```

## 5. Troubleshooting

### Error: "DATABASE_URL is required"

Verificar que `.env` existe y contiene `DATABASE_URL`.

### Error: "Cannot find module"

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Error: "Port 3000 already in use"

Cambiar `PORT` en `.env` o matar el proceso.

### Error de base de datos

Verificar que MySQL está corriendo y la BD está creada.
