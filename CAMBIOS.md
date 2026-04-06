# CAMBIOS APLICADOS PARA FUSIÓN

## Reducir

- removida la capa tRPC no montada
- removidos módulos legacy de OAuth, SDK, IA, mapas, voice y Vite server legacy
- removidos tests acoplados a una arquitectura inexistente

## Limpiar

- removido `node_modules/`, `dist/`, `index.js`, `.git/` del entregable final
- corregido `.env.example`
- corregida la documentación técnica

## Estandarizar

- nuevo entrypoint en `server/index.ts`
- nueva composición de app en `server/app.ts`
- rutas HTTP separadas por responsabilidad
- validación de entorno con `zod`
- middleware global de logging y manejo de errores
- storage migrado de `driveFileId` a `storagePath`
- clínica migrada de `driveFolderId` a `storageFolderPath`

## Listo para fusionar

- backend enfocado en Express + Supabase + Drizzle
- menos superficie de fallo
- naming coherente para storage
- deploy preparado para Render
- base lista para conectar frontend futuro en Vite 6
