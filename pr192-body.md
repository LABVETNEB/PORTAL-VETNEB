## Summary

- add SLA policy scope and target contracts to the schema
- add SLA instance lifecycle/status contracts
- add `sla_policies` with optional clinic scoping
- add `sla_instances` with required clinic scope and generic target references
- add due-time validation checks
- add tenant-first indexes for SLA querying
- add migration `0021_logistics_sla`
- add schema/migration/contract guard tests

## Scope

Schema-only PR for logistics SLA policies and instances.

## Out of scope

- no API endpoints
- no notifications
- no escalations
- no dashboard metrics
- no business-hours calendar
- no background jobs
- no route optimization
- no VRP/TSP/A*/Dijkstra/ACO

## Validation

- pnpm typecheck
- pnpm typecheck:test
- pnpm test
