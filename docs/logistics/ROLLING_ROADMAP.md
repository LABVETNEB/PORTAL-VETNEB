# Logistics Rolling Roadmap

## Purpose

This document converts the logistics audit and planning issues into an incremental implementation roadmap.

Source issues:

- #185: Logistics audit.
- #186: Backlog planning and PR sequencing.

This PR is documentation-only. It does not add schema, routes, migrations, dependencies or runtime behavior.

## Guiding principles

- Keep PRs small and mergeable.
- Do not mix schema, API, metrics and optimization in one large PR.
- Preserve main as the canonical stable branch.
- Preserve existing tests and ownership boundaries.
- Build MVP before optimization.
- Do not add external providers before an explicit architecture decision.
- Do not run heavy calculations in request handlers.

## Phase 0 — Domain contracts and rollout plan

Goal:

- Define vocabulary.
- Define MVP boundaries.
- Define security contract.
- Define rollout order.
- Define advanced optimization boundaries.

Deliverables:

- `docs/logistics/MVP_DOMAIN.md`
- `docs/logistics/SECURITY_CONTRACT.md`
- `docs/logistics/ROLLING_ROADMAP.md`
- Reference in `docs/notes/todo.md`

Exit criteria:

- Domain terms are defined.
- MVP vs advanced scope is explicit.
- Security rules are explicit.
- First implementation PR is clear.
- No runtime code has changed.

## Phase 1 — Base logistics model

### PR 1.1 — Field visits and visit locations schema

Suggested title:

`feat(logistics-schema): add field visits and visit locations base model`

Goal:

- Add `field_visits`.
- Add `visit_locations`.
- Add base DB helpers if required.
- Keep coordinates optional.
- Add tenant-first indexes.

Out of scope:

- No API endpoints.
- No route planning.
- No SLA.
- No geocoding.
- No optimization.

Expected files:

- `drizzle/schema.ts`
- `drizzle/migrations/*`
- `server/db-logistics.ts`
- `server/lib/logistics/field-visit.ts`
- `test/*logistics*`

Required tests:

- Defaults and allowed statuses.
- Clinic ownership in DB helpers.
- Optional coordinates.
- `geoQuality` values.
- Rejection of invalid source type.
- No cross-tenant reads.

### PR 1.2 — Time windows schema and validation

Suggested title:

`feat(logistics-schema): add time windows with validation rules`

Goal:

- Add `time_windows`.
- Validate `windowStart < windowEnd`.
- Define timezone handling.
- Keep the model independent from route optimization.

Out of scope:

- No compliance metrics.
- No route planning.
- No provider integration.

Expected files:

- `drizzle/schema.ts`
- `drizzle/migrations/*`
- `server/db-logistics.ts`
- `server/lib/logistics/time-window.ts`
- `test/*logistics*`

Required tests:

- Valid time window.
- Invalid inverted time window.
- Missing/invalid timezone behavior.
- Ownership through parent visit.
- Case without time window remains valid if product allows.

### PR 1.3 — Field visit API

Suggested title:

`feat(logistics-api): add clinic and admin field visit endpoints`

Goal:

- Add minimal API for field visits, locations and time windows.
- Enforce clinic ownership.
- Add strict pagination.
- Add admin route only if needed.

Out of scope:

- No route plans.
- No route events.
- No metrics.
- No optimization.

Expected files:

- `server/routes/logistics-field-visits.fastify.ts`
- `server/routes/admin-logistics-field-visits.fastify.ts`
- `server/fastify-app.ts`
- `server/db-logistics.ts`
- `server/lib/audit.ts`
- `server/lib/admin-audit.ts`
- `test/*logistics*`
- Existing security boundary tests if needed.

Required tests:

- Auth required.
- Clinic A cannot access Clinic B visits.
- Admin route behavior.
- Payload validation.
- Pagination limit.
- Response disclosure boundary.
- Audit for critical mutations if implemented.

## Phase 2 — Route planning model and API

### PR 2.1 — Route plans and route stops schema

Suggested title:

`feat(logistics-schema): add route plans and route stops`

Goal:

- Add `route_plans`.
- Add `route_stops`.
- Enforce same-clinic route/visit relationship at DB helper layer.
- Add route status lifecycle constants.

Out of scope:

- No route event polling.
- No optimization.
- No metrics.
- No SLA.

Expected files:

- `drizzle/schema.ts`
- `drizzle/migrations/*`
- `server/db-logistics.ts`
- `server/lib/logistics/route-plan.ts`
- `test/*logistics*`

Required tests:

- Route belongs to clinic.
- Stop belongs to route.
- Stop visit belongs to same clinic.
- Stop sequence unique inside route.
- Status defaults.
- Invalid cross-tenant stop rejected.

### PR 2.2 — Route plans API and release lifecycle

Suggested title:

`feat(logistics-api): add route plan endpoints and release lifecycle`

Goal:

- Create route plans.
- Add/reorder/remove stops.
- Release a route.
- Preserve route lifecycle integrity.
- Enforce strict batch limits.

Out of scope:

- No automatic optimization.
- No event stream.
- No metrics.

Expected files:

- `server/routes/logistics-route-plans.fastify.ts`
- `server/routes/admin-logistics-route-plans.fastify.ts`
- `server/fastify-app.ts`
- `server/db-logistics.ts`
- `server/lib/logistics/route-plan.ts`
- `test/*logistics*`

Required tests:

- Clinic ownership.
- Route lifecycle transitions.
- Reorder stops.
- Reject cross-tenant visit in route.
- Batch size limit.
- Pagination.
- Conflict handling for sequence updates.

## Phase 3 — Route events and polling

### PR 3.1 — Route events schema

Suggested title:

`feat(logistics-events): add route event model`

Goal:

- Add `route_events`.
- Store `clinicId` redundantly.
- Add indexes for tenant, route and event time.
- Define event types.

Out of scope:

- No WebSocket.
- No SSE.
- No external telemetry provider.
- No high-volume ingestion pipeline.

Expected files:

- `drizzle/schema.ts`
- `drizzle/migrations/*`
- `server/db-logistics.ts`
- `server/lib/logistics/events.ts`
- `test/*logistics*`

Required tests:

- Event belongs to clinic.
- Route belongs to same clinic.
- Optional stop belongs to same route.
- Event time ordering.
- Payload accepts safe JSON.
- Invalid cross-tenant event rejected.

### PR 3.2 — Route events API and incremental polling

Suggested title:

`feat(logistics-events): add route event endpoints and incremental polling`

Goal:

- Create route events.
- Poll route events by cursor or timestamp.
- Enforce tenant isolation.
- Enforce hard limits.
- Keep MVP on polling, not streaming.

Out of scope:

- No WebSocket.
- No SSE.
- No mobile telemetry batch ingestion.
- No optimization.

Expected files:

- `server/routes/logistics-route-events.fastify.ts`
- `server/fastify-app.ts`
- `server/db-logistics.ts`
- `server/lib/logistics/events.ts`
- `test/*logistics*`

Required tests:

- Auth required.
- Clinic A cannot emit event for Clinic B route.
- Clinic A cannot poll Clinic B events.
- Cursor does not leak cross-tenant data.
- Limit is enforced.
- Events are ordered deterministically.

## Phase 4 — SLA model and basic compliance

### PR 4.1 — SLA schema

Suggested title:

`feat(logistics-sla): add SLA policies and instances`

Goal:

- Add `sla_policies`.
- Add `sla_instances`.
- Support active, paused, breached, resolved and canceled states.
- Keep SLA generic enough for visits/routes/stops/cases.

Out of scope:

- No notifications.
- No escalation.
- No business-hours calendar unless explicitly required.
- No route optimization.

Expected files:

- `drizzle/schema.ts`
- `drizzle/migrations/*`
- `server/db-logistics.ts`
- `server/lib/logistics/sla.ts`
- `test/*logistics*`

Required tests:

- SLA due calculation.
- Breach transition.
- Resolve transition.
- Pause behavior if implemented.
- Ownership by linked entity.
- Invalid link rejected.

### PR 4.2 — Basic compliance metrics

Suggested title:

`feat(logistics-metrics): add basic route compliance metrics`

Goal:

- Compute basic planned vs actual mileage.
- Compute time-window compliance.
- Compute simple deviation flags.
- Return partial metrics when data is missing.

Out of scope:

- No external route distance.
- No map matching.
- No optimization.
- No dashboards unless separately planned.

Expected files:

- `server/lib/logistics/metrics.ts`
- `server/routes/logistics-route-metrics.fastify.ts`
- `server/db-logistics.ts`
- `server/fastify-app.ts`
- `test/*logistics*`

Required tests:

- Planned vs actual km.
- Delta percentage.
- Missing actual data.
- Early arrival.
- On-time arrival.
- Late arrival.
- No window.
- Out-of-sequence stop.
- Tolerance-based deviation.

## Phase 5 — Simple deterministic heuristic

### PR 5.1 — Heuristic route ordering

Suggested title:

`feat(logistics-planning): add deterministic route ordering heuristic`

Goal:

- Add deterministic route ordering.
- Prefer SLA priority and hard windows.
- Use nearest-neighbor only when enough coordinates exist.
- Provide stable fallback when coordinates are missing.

Out of scope:

- No VRP.
- No TSP.
- No A*.
- No Dijkstra.
- No ACO.
- No external distance matrix.
- No heavy optimization in request path.

Expected files:

- `server/lib/logistics/planning.ts`
- `server/routes/logistics-route-plans.fastify.ts`
- `server/db-logistics.ts`
- `test/*logistics*`

Required tests:

- Deterministic output.
- Fallback without coordinates.
- SLA priority ordering.
- Hard window ordering.
- Batch size limit.
- No cross-tenant inputs.

## Phase 6 — Advanced optimization evaluation

Advanced optimization must remain gated until production data justifies it.

Candidates:

- TSP.
- VRP.
- A*.
- Dijkstra.
- ACO.
- External map/geocoding providers.
- Streaming real-time transport.

Entry criteria:

- Real number of active clinics.
- Real routes per day.
- Real stops per route.
- Real recalc frequency.
- Measured bottlenecks.
- ROI justification.
- Architecture decision record.
- Capacity and noisy-neighbor plan.

## Recommended execution order

1. Documentation and contracts.
2. Field visits and visit locations schema.
3. Time windows schema.
4. Field visit API.
5. Route plans and route stops schema.
6. Route plans API and release lifecycle.
7. Route events schema.
8. Route events API with incremental polling.
9. SLA schema.
10. Basic compliance metrics.
11. Deterministic heuristic.
12. Advanced optimization evaluation.

## Release discipline

Each implementation PR should include:

- Small scope.
- Clear out-of-scope section.
- Typecheck.
- Full test suite.
- Ownership tests.
- Pagination/limit tests where endpoints exist.
- No public exposure of private logistics data.
- No heavy calculations in request handlers.
