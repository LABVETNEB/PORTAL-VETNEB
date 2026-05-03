## Summary

- add pure SLA compliance helpers to logistics metrics
- classify SLA instances as active, paused, breached, resolved, canceled or missing_due_date
- calculate overdue and remaining minutes
- detect late resolutions against dueAt
- aggregate SLA compliance status counts and breach rate
- add unit tests for active, paused, breached, resolved, canceled and partial SLA cases

## Scope

Pure logic PR for SLA compliance metrics.

## Out of scope

- no API endpoints
- no background jobs
- no notifications
- no escalation workflow
- no dashboard/reporting UI
- no database schema changes
- no migrations

## Validation

- pnpm typecheck
- pnpm typecheck:test
- pnpm test
