# Portal VETNEB - Backend

Sistema de gestión de informes veterinarios con autenticación OAuth y base de datos MySQL.

## Requisitos Previos

- Node.js 24+ (se recomienda usar nvm)
- pnpm 10.4.1+
- MySQL 8.0+
- Variables de entorno configuradas

## Instalación

1. **Clonar o descargar el proyecto**

```bash
cd PORTALVETNEB_CLEANED
```

2. **Instalar dependencias**

```bash
pnpm install
```

3. **Configurar variables de entorno**

Crear un archivo `.env` en la raíz del proyecto:

```env
# Base de Datos
DATABASE_URL=mysql://usuario:contraseña@localhost:3306/vetneb

# OAuth
OAUTH_SERVER_URL=https://tu-servidor-oauth.com
APP_ID=tu-app-id
COOKIE_SECRET=tu-secret-key-muy-segura

# Entorno
NODE_ENV=development
PORT=3000
```

4. **Configurar la base de datos**

```bash
pnpm db:push
```

## Ejecución

### Modo Desarrollo

Ejecuta tanto el servidor como el cliente en paralelo:

```bash
pnpm dev
```

Esto iniciará:

- **Servidor**: http://localhost:3000 (con hot reload)
- **Cliente**: Vite dev server

### Modo Producción

1. **Compilar el proyecto**

```bash
pnpm build
```

2. **Iniciar el servidor**

```bash
pnpm start
```

## Scripts Disponibles

| Script            | Descripción                              |
| ----------------- | ---------------------------------------- |
| `pnpm dev`        | Ejecuta servidor y cliente en desarrollo |
| `pnpm dev:server` | Ejecuta solo el servidor                 |
| `pnpm dev:client` | Ejecuta solo el cliente                  |
| `pnpm build`      | Compila para producción                  |
| `pnpm start`      | Inicia el servidor en producción         |
| `pnpm check`      | Verifica tipos TypeScript                |
| `pnpm format`     | Formatea el código con Prettier          |
| `pnpm test`       | Ejecuta pruebas unitarias                |
| `pnpm db:push`    | Sincroniza esquema de base de datos      |

## Estructura del Proyecto

```
.
├── client/              # Frontend React + Vite
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── pages/       # Páginas
│   │   ├── lib/         # Utilidades
│   │   └── main.tsx     # Punto de entrada
│   └── public/          # Archivos estáticos
├── server/              # Backend Express + tRPC
│   ├── _core/           # Lógica central
│   │   ├── index.ts     # Punto de entrada
│   │   ├── oauth.ts     # Rutas OAuth
│   │   ├── sdk.ts       # SDK de autenticación
│   │   └── types/       # Definiciones de tipos
│   ├── routers.ts       # Rutas tRPC
│   ├── db.ts            # Operaciones de BD
│   └── storage.ts       # Gestión de almacenamiento
├── shared/              # Código compartido
│   └── _core/           # Utilidades compartidas
├── drizzle/             # Migraciones de BD
│   ├── schema.ts        # Esquema de tablas
│   └── migrations/      # Archivos de migración
├── package.json         # Dependencias
├── tsconfig.json        # Configuración TypeScript
├── vite.config.ts       # Configuración Vite
└── drizzle.config.ts    # Configuración Drizzle ORM
```

## Tecnologías Utilizadas

### Frontend

- React 19
- TypeScript
- Vite
- TailwindCSS
- Radix UI
- React Query
- tRPC Client

### Backend

- Express.js
- tRPC
- TypeScript
- Drizzle ORM
- MySQL2

### Herramientas

- pnpm (gestor de paquetes)
- tsx (ejecución de TypeScript)
- Prettier (formateador)
- Vitest (pruebas)

## Troubleshooting

### Error: DATABASE_URL no configurado

Asegúrate de que el archivo `.env` existe y contiene `DATABASE_URL`.

### Error: Puerto 3000 en uso

Cambia el puerto en el archivo `.env`:

```env
PORT=3001
```

### Error: Módulos no encontrados

Reinstala las dependencias:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Error de conexión a OAuth

Verifica que `OAUTH_SERVER_URL` y `APP_ID` sean correctos en `.env`.

## Desarrollo

### Agregar nuevas rutas tRPC

Edita `server/routers.ts` para agregar nuevos procedimientos.

### Agregar nuevas tablas de BD

1. Modifica `drizzle/schema.ts`
2. Ejecuta `pnpm db:push`

### Agregar componentes UI

Los componentes están en `client/src/components/` usando Radix UI.

## Despliegue

El proyecto está listo para desplegar en:

- Vercel (frontend)
- Railway, Render, Heroku (backend)
- Servidores VPS propios

Asegúrate de:

1. Configurar variables de entorno en la plataforma
2. Ejecutar migraciones de BD antes de iniciar
3. Usar HTTPS en producción

## Licencia

MIT

## Soporte

Para reportar problemas o sugerencias, contacta al equipo de desarrollo.
