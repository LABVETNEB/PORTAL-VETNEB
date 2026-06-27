# App version gate

El frontend consulta `/api/app-version` y compara `NEXT_PUBLIC_APP_VERSION` contra la versión vigente publicada por backend. Si no coincide, bloquea el uso de la aplicación y exige actualizar.

## Variables recomendadas

- `APP_VERSION`: versión vigente del backend. En Render puede ser el commit SHA de despliegue.
- `NEXT_PUBLIC_APP_VERSION`: misma versión embebida en el build frontend.
- `CLIENT_MIN_VERSION`: reservado para endurecer política de compatibilidad mínima.

## Comportamiento

- El endpoint de versión usa `cache-control: no-store`.
- El guard corre globalmente desde `RootLayout`.
- En producción verifica al iniciar, cada 60 segundos y al volver la pestaña a primer plano.
- Si detecta versión vieja, muestra un `alertdialog` bloqueante.
- El botón de actualización intenta activar el service worker nuevo, limpia caches `portal-vetneb-*` y recarga.

## Límite operativo

Un cliente que ya estaba ejecutando código viejo antes de desplegar este guard no puede recibir este comportamiento hasta hacer una recarga. Desde el primer despliegue con este guard, los despliegues posteriores sí quedan protegidos.
