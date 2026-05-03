# Logistics MVP Domain

## Purpose

This document defines the MVP domain language for the future logistics module in Portal VETNEB.

The logistics module is intended to support field visits, route planning, route execution evidence, time windows, operational SLAs, deviation detection and mileage efficiency analysis.

This PR is documentation-only. It does not add database schema, routes, migrations, dependencies, jobs, geocoding, maps or optimization algorithms.

## Current baseline

Portal VETNEB already has a strong operational base:

- Multi-tenant ownership through `clinicId`.
- Separate surfaces for admin, clinics, particulars and public specialist bank.
- Audit logging.
- Report tracking.
- Particular token access.
- Public clinic/specialist discovery surface.
- Security and ownership tests.

Portal VETNEB does not yet have a native logistics domain:

- No field visits.
- No route plans.
- No route stops.
- No route events.
- No SLA policies or SLA instances.
- No latitude/longitude fields for operational routing.
- No geocoding.
- No distance engine.
- No route optimizer.
- No near-real-time operational transport.

## Domain terms

### Field visit

A field visit is an operational task that requires a visit to a physical or declared location.

MVP scope:

- A field visit belongs to one clinic.
- A field visit may originate from a report, a study tracking case or a manual operational request.
- A field visit can be planned without coordinates.
- A field visit can have a textual address and optional coordinates.

Future scope:

- Automatic geocoding.
- External map provider integration.
- Advanced matching between visit type, specialist availability and route capacity.

### Visit location

A visit location stores the declared location for a field visit.

MVP scope:

- Raw address text is allowed.
- Normalized address is optional.
- Locality and country are optional but recommended.
- Latitude and longitude are optional.
- Geographic quality must be explicit.

Supported MVP geographic quality values:

- `exact`
- `approx`
- `missing`
- `ambiguous`

Future scope:

- Geocoding source verification.
- Confidence score.
- Provider-specific metadata.
- Address normalization pipeline.

### Time window

A time window defines when a visit is expected or allowed to happen.

MVP scope:

- A time window has a start datetime, end datetime and timezone.
- `windowStart` must be earlier than `windowEnd`.
- A time window can be hard or soft.
- A visit may initially support one or more windows only if schema and validation remain simple.

Future scope:

- Multiple availability windows by day.
- Recurring windows.
- Calendar integration.
- Timezone inference.

### Route plan

A route plan groups visits for a service date.

MVP scope:

- A route plan belongs to one clinic.
- A route plan has a lifecycle.
- A route plan can be manual or heuristic.
- A route plan does not require an external map provider.
- A route plan does not run VRP, TSP, A*, Dijkstra or ACO.

Suggested MVP route statuses:

- `draft`
- `planned`
- `released`
- `in_progress`
- `completed`
- `canceled`

Future scope:

- Multi-resource planning.
- Capacity-aware routing.
- Dynamic re-planning.
- External routing provider support.
- Optimization algorithms.

### Route stop

A route stop links a field visit to a route plan in a specific sequence.

MVP scope:

- Each stop belongs to one route plan.
- Each stop references one field visit.
- Stop sequence is unique inside a route plan.
- The field visit and route plan must belong to the same clinic.
- Planned and actual arrival/departure timestamps can be stored.

Future scope:

- Travel-leg details.
- Per-stop service duration prediction.
- Automatic ETA recalculation.
- Route deviation scoring.

### Route event

A route event records operational execution evidence.

MVP scope:

- A route event belongs to one clinic.
- A route event can reference a route plan and optionally a route stop.
- Events are append-only from the application perspective.
- Events support polling by cursor or timestamp.
- Events may include optional latitude and longitude.
- Events must not be exposed on the public specialist bank surface.

Suggested MVP event types:

- `route.created`
- `route.released`
- `route.started`
- `stop.arrived`
- `stop.departed`
- `stop.skipped`
- `stop.no_show`
- `route.completed`
- `route.canceled`
- `route.replanned`

Future scope:

- Mobile telemetry.
- High-volume event ingestion.
- Event compaction.
- Streaming transport.
- Dedicated retention policy.

### SLA policy

An SLA policy defines an operational commitment.

MVP scope:

- A policy can be global or clinic-specific if the implementation needs tenant customization.
- A policy defines due-time rules.
- A policy does not require advanced optimization.

Future scope:

- SLA calendars.
- Pause/resume rules.
- Business-hour calendars.
- Per-priority SLA calculation.

### SLA instance

An SLA instance tracks one concrete commitment for a visit, route, stop, report or study tracking case.

MVP scope:

- An instance has start and due timestamps.
- An instance can become breached or resolved.
- An instance must be scoped to clinic data when linked to private logistics entities.

Suggested MVP SLA statuses:

- `active`
- `paused`
- `breached`
- `resolved`
- `canceled`

Future scope:

- SLA escalation.
- Automatic notifications.
- SLA breach forecasting.
- Dashboard snapshots.

### Route deviation

A route deviation is a difference between planned and executed behavior.

MVP scope:

- Deviation by stop order.
- Deviation by arrival outside tolerance.
- Deviation by declared actual mileage exceeding tolerance.
- No road-network comparison in MVP.

Future scope:

- GPS path comparison.
- Provider route comparison.
- Distance matrix comparison.
- Real-time alerting.

### Mileage efficiency

Mileage efficiency compares planned and actual travel cost.

MVP scope:

- Planned kilometers.
- Actual kilometers.
- Absolute delta.
- Percentage delta.
- Kilometers per completed visit.
- Partial metrics when actual data is missing.

Future scope:

- Fuel cost.
- Specialist/driver productivity.
- Time-per-stop.
- Traffic-adjusted efficiency.
- External distance matrix.

### ETA

ETA means estimated time of arrival.

MVP scope:

- `etaStart` and `etaEnd` can be manually set or derived from simple heuristics.
- ETA does not imply map-provider accuracy.

Future scope:

- Provider-calculated ETA.
- Dynamic ETA updates.
- SLA-aware ETA.

### No-show

A no-show means a planned visit could not be completed because the target was unavailable or the visit could not proceed.

MVP scope:

- Represented as a stop or visit status.
- Should generate a route event.
- Should preserve auditability.

Future scope:

- Rescheduling workflow.
- SLA pause or breach logic.
- Notification workflow.

### Reprogramming

Reprogramming means changing the planned time, date, sequence or route assignment for a visit.

MVP scope:

- Can be represented by status changes and route events.
- Must preserve audit trail.
- Must remain tenant-scoped.

Future scope:

- Automatic re-optimization.
- Conflict detection.
- Notification workflow.

## MVP boundaries

The MVP includes:

- Domain documentation and contracts.
- Base field visit model.
- Visit location with optional coordinates.
- Time windows.
- Route plans.
- Route stops.
- Route events.
- Incremental polling.
- Basic SLA policies and instances.
- Basic metrics for mileage, time windows and deviations.

The MVP excludes:

- External map providers.
- Automatic geocoding.
- Real-time WebSocket/SSE transport.
- VRP.
- TSP.
- A*.
- Dijkstra.
- ACO.
- Complex combinatorial optimization.
- Heavy route recalculation inside request handlers.
- Public exposure of operational logistics data.

## Implementation principles

- Every private logistics entity must be tenant-scoped.
- All clinic-facing reads and writes must be filtered by authenticated `clinicId`.
- Particular access must remain token/session scoped.
- Public specialist bank endpoints must not expose private logistics operations.
- Large calculations must be outside the interactive request path.
- Endpoints must use strict pagination and explicit limits.
- The initial implementation must favor deterministic behavior over optimization complexity.
- Advanced algorithms require real usage volume, ROI evidence and an architectural decision.
