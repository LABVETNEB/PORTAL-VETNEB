# Advanced Logistics Optimization Guardrails

## Purpose

This document defines the discovery guardrails for advanced logistics optimization.

The current logistics planning baseline supports deterministic heuristic planning. Advanced optimization must remain gated until real production usage proves that the extra complexity is justified.

This document is documentation-only. It does not add schema, routes, migrations, dependencies, providers or runtime behavior.

## Current baseline

Implemented baseline:

- Deterministic heuristic route planning.
- Clinic-scoped heuristic route plan generation API.
- Runtime coverage for the heuristic endpoint.
- No external distance matrix.
- No heavy optimization in request handlers.
- No advanced optimization algorithm in production flow.

## Advanced optimization candidates

The following approaches remain candidates, not commitments:

- Traveling Salesperson Problem strategies.
- Vehicle Routing Problem strategies.
- A* search.
- Dijkstra shortest path search.
- Ant Colony Optimization.
- External map, routing, distance matrix or geocoding providers.
- Streaming or real-time transport optimization.

## Non-goals until approval

Do not implement these without a documented architecture decision:

- External provider integration.
- Request-path heavy optimization.
- Long-running synchronous route solving.
- Cross-clinic shared optimization workloads.
- Unbounded batch planning.
- Real-time recomputation loops.
- Provider-specific data retention flows.
- Cost-incurring provider calls from tests.

## Discovery entry criteria

Advanced optimization discovery may start only when the team has production evidence for all required dimensions:

| Dimension | Required evidence |
| --- | --- |
| Active clinics | Number of clinics actively using logistics workflows |
| Routes per day | Daily and peak route count |
| Stops per route | Median, p95 and maximum stop counts |
| Recalculation frequency | Number of route recalculations per route/day |
| SLA impact | Measured late arrivals, missed hard windows or high-risk SLA cases |
| Manual effort | Planner time spent manually reordering routes |
| Performance bottleneck | Measured latency or compute bottleneck in current heuristic flow |
| Cost pressure | Expected cost of external providers or heavier compute |
| ROI | Business value that justifies implementation and operating cost |

## Required pre-implementation artifacts

Before implementing any advanced optimizer, create or update:

- Architecture decision record.
- Capacity plan.
- Provider evaluation, if external providers are considered.
- Data retention and privacy review.
- Failure-mode and fallback plan.
- Cost model.
- Abuse and noisy-neighbor plan.
- Test strategy for deterministic fixtures.
- Operational rollout plan.

## Runtime guardrails

Any approved advanced optimizer must preserve these boundaries:

- Tenant isolation is mandatory.
- Inputs must be clinic scoped before planning starts.
- Batch size must be explicitly bounded.
- The default API path must remain predictable and fast.
- Heavy optimization must run outside request handlers.
- Timeouts must be explicit.
- Fallback to deterministic heuristic planning must remain available.
- Partial or failed optimization must not corrupt existing route plans.
- Provider failures must not leak private logistics data.
- Tests must not rely on live external providers.

## Decision matrix

Use this matrix during discovery:

| Question | Continue only if |
| --- | --- |
| Are routes large enough for heuristic limitations to matter? | Real stop counts show sustained need |
| Is the heuristic causing measurable SLA or planner-effort issues? | Metrics show material impact |
| Can the improvement be validated offline? | Historical or fixture data is available |
| Can the workload run outside request handlers? | Async/job-based path is designed |
| Is tenant isolation preserved? | Inputs and outputs are clinic scoped |
| Is fallback behavior defined? | Heuristic fallback remains safe |
| Are provider and compute costs acceptable? | ROI is documented |
| Is the rollout reversible? | Feature flag or phased rollout exists |

## Recommended discovery sequence

1. Collect production logistics metrics.
2. Define representative route-planning fixtures.
3. Compare deterministic heuristic output against actual planner changes.
4. Estimate optimization benefit.
5. Evaluate whether a simpler heuristic improvement is enough.
6. Draft an architecture decision record.
7. Prototype offline if ROI remains justified.
8. Add runtime implementation only in a later, separately scoped PR.

## Exit criteria for discovery

Discovery can conclude with one of these outcomes:

- Keep deterministic heuristic only.
- Improve deterministic heuristic incrementally.
- Prototype offline advanced optimization.
- Implement advanced optimization behind a guarded runtime path.

No outcome should bypass the required architecture decision record.
