# App version gate

> **Estado: PARCIAL / NO DEFINITIVO.** Este guard es *frontend-polling* y solo
> protege a clientes que ya están ejecutando el frontend nuevo. Una PWA/app
> instalada vieja o cacheada ejecuta el frontend viejo, que **no contiene este
> guard**, por lo que nunca consulta `/api/app-version` ni se bloquea. Por lo
> tanto **no resuelve** el caso real de "Origen no permitido" en apps viejas.
>
> La solución definitiva (pendiente, en rama limpia separada) es enforcement de
> backend: header `X-VETNEB-Client-Version` validado en los endpoints de auth
> (`login`/`me`) respondiendo `426 CLIENT_VERSION_UNSUPPORTED` cuando la versión
> falta o es menor a la mínima aceptada. Este guard frontend solo mejora la UX
> del bloqueo, no sustituye al contrato backend.

El frontend consulta `/api/app-version` y compara `NEXT_PUBLIC_APP_VERSION` contra la versión vigente publicada por backend. Si no coincide, bloquea el uso de la aplicación y exige actualizar.

## Variables recomendadas

- `APP_VERSION`: versión vigente del backend. En Render puede ser el commit SHA de despliegue.
- `NEXT_PUBLIC_APP_VERSION`: misma versión embebida en el build frontend.
- `CLIENT_MIN_VERSION`: reservado para endurecer política de compatibilidad mínima.

## Comportamiento

- El endpoint de versión usa `cache-control: no-store`.
- El guard corre globalmente desde `RootLayout`.
- En producción verifica al iniciar y cada 60 segundos. No usa `visibilitychange` (prohibido por el contrato de persistencia de sesión `auth-cookie-persistence-contract`).
- Si detecta versión vieja, muestra un `alertdialog` bloqueante.
- El botón de actualización intenta activar el service worker nuevo, limpia caches `portal-vetneb-*` y recarga.

## Límite operativo

Un cliente que ya estaba ejecutando código viejo antes de desplegar este guard no puede recibir este comportamiento hasta hacer una recarga. Desde el primer despliegue con este guard, los despliegues posteriores sí quedan protegidos.
