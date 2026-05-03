## Summary

- add pure logistics compliance metric helpers
- calculate planned vs actual distance deltas
- calculate distance deviation percentage and tolerance compliance
- calculate kilometers per completed visit
- classify time window compliance as early/on_time/late/no_window/missing_actual
- summarize partial window compliance metrics when operational data is incomplete
- add unit tests for distance, stop completion and time-window compliance metrics

## Scope

Pure logic PR for basic logistics compliance metrics.

## Out of scope

- no API endpoints
- no dashboard/reporting UI
- no database schema changes
- no migrations
- no route event ingestion
- no geocoding
- no external map provider
- no route optimization
- no VRP/TSP/A*/Dijkstra/ACO

## Validation

- pnpm typecheck
- pnpm typecheck:test
- pnpm test
