# B12 — retiro de tarjeta de módulo

## Estado base

- Rama: `feat/dashboard-b12-module-card-removal`.
- Base: `9dc4fd2e65b81fc8775bcaa82b6b414ce5e44faa`.
- Árbol de trabajo limpio antes del cambio.

## Alcance

B12 elimina únicamente la pintura de la tarjeta intermedia de los workspaces
de módulo autenticados. Conserva el DOM, la cadena flex/grid, padding, gap,
overflow, anchors, accesibilidad y la caja de borde de 1px.

Quedan fuera B13, B14, B15 y B16; también las alertas, paneles, listas y
estados internos que usan `dashboard-surface` como su propia superficie.

## Implementación

El owner canónico es:

```text
.dashboard-app-shell
  [data-dashboard-module-workspace]
  [data-dashboard-b12-module-card="true"]
```

La regla no layerizada neutraliza `background`, `border-color`, `border-radius`
y `box-shadow`. No altera `border-width` y no
modifica el primitive compartido `frontend/src/components/ui/card.tsx`.

`OWNER_COUNT = 6` y los owners son `admin-report-upload`, `admin-clinics`,
`admin-particular-tokens`, `admin-sessions`, `admin-users-roles` y `audit-log`.
Los otros nueve módulos (`admin`, `admin-health`, `admin-pricing`,
`admin-maintenance`, `operaciones`, `informes`, `logistica`, `perfil` y
`tokens`) no poseen la tarjeta intermedia B12, por lo que su owner count es 0.

## Validación

El guard estático fija el owner, el alcance, las cinco propiedades visuales, la
preservación del borde geométrico y la exclusión de B13–B16. El contrato E2E
recorre los 10 módulos admin y los 5 de clínica en desktop y móvil, y verifica
estilos computados, geometría, zero-scroll, B11 y deep links.

Los resultados ejecutados se registran en la entrega de la tarea.
