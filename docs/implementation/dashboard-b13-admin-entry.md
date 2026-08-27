# B13 · Entrada duradera del panel administrativo

## Base y alcance

Base: `feat/dashboard-b13-admin-entry` en `ab39ec893cf698405eaca6bb22286d31a445f6dd`.

B13 define la entrada del dashboard administrativo. No modifica rutas de clínica,
backend, autenticación, persistencia fuera de la clave existente ni los contratos
visuales de hub.

## Contrato implementado

- Un `?module=` válido, incluidos sus aliases, tiene la mayor prioridad.
- `?hub=1` es la URL explícita y estable del hub administrativo.
- Un `?module=` inválido mantiene el hub heredado y no se reescribe.
- La entrada sin query usa el último módulo válido; ante ausencia, valor obsoleto
  o storage no disponible, usa `DEFAULT_ADMIN_MODULE = "admin"` con `replace`.
- Inicio en drawer, rail y mobile usa `?hub=1` y no borra el último módulo.
- El hub explícito sobrevive reload y la vuelta al hub conserva los guards de
  intención/activación existentes.

## Cobertura

`dashboard-b13-admin-entry.spec.ts` cubre doce escenarios: precedencia de URL,
alias, hub explícito, módulo inválido, restore válido, tres fallbacks, Inicio en
desktop y mobile, reload y Back. La entrada está registrada en los cohortes
`visual-contract` y `admin-mobile`.

## Fuera de alcance

No se cambian módulos de clínica, aliases existentes, contratos adaptativos,
snapshots visuales, base de datos, auth, dependencias ni migraciones.
