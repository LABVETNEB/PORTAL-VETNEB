## Summary

- add route event type/source contracts to the schema
- add `route_events` with required clinic scope
- link route events optionally to route plans and route stops
- support event payload, optional coordinates and source attribution
- add tenant-first indexes for event querying
- add migration `0020_logistics_route_events`
- add schema/migration/contract guard tests

## Scope

Schema-only PR for logistics route event model.

## Out of scope

- no API endpoints
- no polling endpoint
- no WebSocket/SSE
- no mobile telemetry batch ingestion
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
