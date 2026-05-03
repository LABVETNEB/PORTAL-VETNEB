## Summary

- add `time_windows` linked to `field_visits`
- enforce `window_start < window_end` in the SQL migration
- add explicit timezone and hard/soft window fields
- add deterministic time window validation helpers
- add schema/migration/validation guard tests

## Scope

Schema-only PR for logistics Phase 1 time windows.

## Out of scope

- no API endpoints
- no route plans
- no route stops
- no route events
- no SLA tables
- no time-window compliance metrics
- no geocoding
- no external map provider
- no route optimization
- no VRP/TSP/A*/Dijkstra/ACO

## Validation

- pnpm typecheck
- pnpm typecheck:test
- pnpm test
