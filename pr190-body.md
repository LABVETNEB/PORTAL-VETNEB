## Summary

- add route plan lifecycle/status contracts to the schema
- add `route_plans` linked to clinics with tenant-first indexes
- add `route_stops` linked to route plans and field visits
- enforce unique stop sequence per route plan
- add migration `0019_logistics_route_plans_stops`
- add schema/migration/contract guard tests

## Scope

Schema-only PR for logistics Phase 1 route plans and route stops.

## Out of scope

- no API endpoints
- no route events
- no polling
- no SLA tables
- no compliance metrics
- no heuristic planning
- no geocoding
- no external map provider
- no route optimization
- no VRP/TSP/A*/Dijkstra/ACO

## Validation

- pnpm typecheck
- pnpm typecheck:test
- pnpm test
