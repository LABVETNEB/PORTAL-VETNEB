## Summary

- add pure route event aggregation helpers
- count route events by event type and source
- extract first/last event boundaries by route plan and route stop
- calculate route and stop durations from event pairs
- report missing event types for incomplete operational timelines
- add unit tests for route event aggregation and duration helpers

## Scope

Pure logic PR for route event aggregation metrics.

## Out of scope

- no API endpoints
- no background jobs
- no notifications
- no dashboard/reporting UI
- no database schema changes
- no migrations
