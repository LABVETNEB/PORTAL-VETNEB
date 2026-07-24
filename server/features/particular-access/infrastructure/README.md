# Particular Access infrastructure

`particular-access-repository.ts` contiene el traslado 1:1 de las queries de
`server/db-particular.ts`. El shim histórico permanece para Auth y consumidores
fuera de M33; las rutas propias sólo llegan aquí mediante composición.
