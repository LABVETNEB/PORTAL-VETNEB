# Particular Access infrastructure

`particular-access-repository.ts` contiene el traslado 1:1 de las queries de
`server/db-particular.ts` realizado en M33. M44 retiró ese shim histórico: sus
ocho consumidores externos cargan ahora `index.ts` directamente y las rutas
propias continúan llegando aquí mediante composición. Auth no fue reorganizado
y no hubo cambios funcionales.
