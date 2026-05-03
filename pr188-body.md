## Summary

- add logistics field visit source/status contracts to the schema
- add `field_visits` with tenant-first indexes
- add `visit_locations` with optional coordinates and explicit geo quality
- add migration `0017_logistics_field_visits`
- add schema/migration guard tests for the logistics base model

## Scope

Schema-only PR for logistics Phase 1 base model.

## Out of scope

- no API endpoints
- no route plans
- no route stops
- no route events
- no SLA tables
- no geocoding
- no external map provider
- no route optimization
- no VRP/TSP/A*/Dijkstra/ACO

## Validation

- pnpm typecheck
- pnpm typecheck:test
- pnpm test
