# Logistics Security Contract

## Purpose

This document defines the security and isolation contract for the future logistics module in Portal VETNEB.

This PR is documentation-only. It does not add schema, routes, migrations, dependencies or runtime behavior.

## Security baseline

Portal VETNEB already separates operational surfaces:

- Admin.
- Clinics.
- Particulars.
- Public specialist bank.

The logistics module must preserve that separation.

## Tenant ownership

Every private logistics entity must be scoped to one clinic directly or indirectly.

Preferred rule:

- Store `clinicId` directly on high-traffic or security-sensitive logistics tables.

Required for MVP:

- `field_visits` must be scoped by `clinicId`.
- `route_plans` must be scoped by `clinicId`.
- `route_events` should store `clinicId` redundantly for query isolation and auditability.
- `visit_locations`, `time_windows` and `route_stops` may inherit clinic ownership through their parent records, but all DB access helpers must enforce clinic ownership.

## Clinic access

Clinic-authenticated access must only read or mutate logistics records for the authenticated clinic.

Required behavior:

- A clinic cannot list visits from another clinic.
- A clinic cannot read a route from another clinic.
- A clinic cannot add a stop from another clinic to its own route.
- A clinic cannot emit route events for another clinic.
- A clinic cannot poll route events from another clinic.
- Cross-tenant mismatches must fail safely.

Recommended response behavior:

- Use `404` when hiding existence is safer.
- Use `403` when the resource is known but action is unauthorized by role or permission.
- Avoid response bodies that disclose whether another tenant's resource exists.

## Admin access

Admin routes may access cross-clinic operational logistics only where explicitly implemented.

Required behavior:

- Admin access must be audited.
- Admin exports must be bounded.
- Admin list endpoints must use pagination and date filters.
- Admin endpoints must not bypass validation of route/visit relationships.

## Particular access

Particular access must remain token/session scoped.

Required behavior:

- A particular may only see logistics data explicitly linked to their token/session.
- A particular must not see other route stops in the same route unless explicitly approved by product/security.
- A particular must not see internal route assignments, internal notes, other clinics, other visits or operational telemetry.
- Public or token views must not disclose route-wide operational data by default.

Allowed MVP particular data examples:

- Visit status for the particular's own case.
- Planned window for the particular's own visit if product approves.
- Completion status for the particular's own visit if product approves.

Disallowed MVP particular data examples:

- Full route sequence.
- Other stops.
- Staff/specialist assignment details.
- Internal route events.
- Internal SLA policy details.
- Other clinics' locations.

## Public specialist bank

The public specialist bank is a public discovery surface.

It must not expose private logistics operations.

Disallowed public logistics data:

- Route plans.
- Route stops.
- Route events.
- SLA instances.
- SLA breaches.
- Operational locations not already public.
- Internal assignments.
- Visit schedules.
- Mileage efficiency metrics.
- Deviation data.
- Telemetry.

Allowed public data remains limited to curated public profile/search fields already intended for public exposure.

## Route events

Route events are operational evidence and must be treated as private.

Required behavior:

- Events are scoped by `clinicId`.
- Event polling requires authentication unless a dedicated token-scoped public/particular endpoint is explicitly designed.
- Polling must support strict limits.
- Polling must not leak event counts or cursors across tenants.
- Event payloads must avoid secrets and sensitive tokens.
- Event payloads must avoid storing raw credentials or session tokens.

## Audit logging

Critical logistics operations should be auditable.

Suggested audit-worthy operations:

- Visit created.
- Visit canceled.
- Route created.
- Route released.
- Route started.
- Route completed.
- Route canceled.
- Route replanned.
- Stop skipped.
- Stop marked no-show.
- SLA breached.
- SLA resolved.
- Export generated.

Audit constraints:

- Do not log secrets.
- Sanitize URLs and tokens.
- Preserve actor type.
- Preserve target where useful.
- Preserve `clinicId` for filtering.

## Pagination and limits

Every list endpoint must have hard limits.

Required MVP behavior:

- Default limit must be bounded.
- Maximum limit must be bounded.
- Unbounded exports are not allowed.
- Polling endpoints must require cursor, timestamp or bounded page controls.
- Large exports must be deferred or explicitly capped.

## Noisy neighbor protection

The logistics module must avoid one tenant degrading others.

Required MVP guardrails:

- Hard pagination.
- Bounded batch sizes.
- Tenant-scoped indexes.
- No heavy optimization inside request handlers.
- No unbounded event ingestion.
- No unbounded CSV/export endpoints.
- Clear future path to queues/jobs for recalculation.

Future guardrails:

- Tenant-aware rate limits.
- Queue concurrency by tenant.
- Backpressure.
- Event retention policies.
- Snapshots for dashboards.
- Dedicated job workers.

## Capacity testing expectations

Future implementation PRs should add tests or guardrails for:

- Large visit lists.
- Large route stop lists.
- Incremental event polling.
- Cross-tenant access attempts.
- Reordering stops.
- Repeated event writes.
- Export limits.

## Required security tests by implementation area

### Field visits

- Clinic A cannot read Clinic B visits.
- Clinic A cannot mutate Clinic B visits.
- Admin can access according to admin route contract.
- Invalid source links are rejected.

### Visit locations

- Clinic A cannot read locations through Visit B.
- Coordinates are optional.
- Ambiguous/missing geo quality is accepted only where intended.

### Time windows

- Invalid windows are rejected.
- Clinic A cannot create windows for Visit B.
- Timezone handling is explicit.

### Route plans and stops

- Clinic A cannot read Route B.
- Route and visit must belong to same clinic.
- Stop sequence must be unique within a route.
- Reordering must remain scoped.

### Route events

- Clinic A cannot emit events for Route B.
- Clinic A cannot poll events from Clinic B.
- Cursor handling must not leak cross-tenant data.
- Event payload must not include secrets.

### SLA

- Clinic A cannot read SLA instances from Clinic B.
- SLA instance must link to authorized private entity.
- Breach/resolution transitions must be deterministic.

## Public exposure rule

When in doubt, logistics data is private.

A logistics field may only be exposed publicly after a specific product/security decision.
