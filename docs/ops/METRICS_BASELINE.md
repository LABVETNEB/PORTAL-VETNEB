# Ops Metrics Baseline

This document defines the initial operational metrics baseline for VETNEB.

It is a documentation-only baseline. It does not introduce runtime collectors, external observability integrations, alerts, dashboards or database schema changes.

## Goals

- Establish a shared vocabulary for operational health.
- Keep future metrics work incremental and measurable.
- Avoid introducing optimization or alerting before the baseline is explicit.

## Core API metrics

Track these metrics per endpoint and, where applicable, per tenant:

- Request count
- Error count
- Error rate
- Latency p50
- Latency p95
- Latency p99

## Logistics metrics

Track these metrics for route planning and route execution:

- Route plan creation count
- Field visit count per route plan
- Stop count per route plan
- Heuristic planning duration
- Route stop compliance summary
- Late stop count
- Missed hard-window count
- SLA-risk stop count

## SLA metrics

Track these metrics for SLA policies and SLA instances:

- Active SLA instance count
- Breached SLA instance count
- Resolved SLA instance count
- Breach rate
- Mean time to resolution
- Overdue minutes total
- Overdue minutes p95

## Public surface metrics

Track these metrics for public-facing routes:

- Search request count
- Search error rate
- Search latency p95
- Rate-limit hit count
- Empty-result count
- Detail request count

## Security and audit metrics

Track these metrics for security-sensitive flows:

- Login attempts
- Failed login attempts
- Rate-limit hits
- Audit event write failures
- Token creation count
- Token revocation count
- Public token access count

## Initial non-goals

- No external APM provider.
- No alerting rules.
- No dashboard implementation.
- No distributed metrics store.
- No SLA escalation runtime.
- No optimization algorithm changes.

## Future PR candidates

- Add runtime-safe timing helpers.
- Add route planning duration measurements.
- Add public search budget tests.
- Add per-tenant rate-limit metrics.
- Add SLA breach summary endpoint.
- Add dashboard-ready metrics read models.
