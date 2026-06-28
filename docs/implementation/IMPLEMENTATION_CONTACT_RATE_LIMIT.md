# Contact Rate Limit Implementation

## Summary
- Added a fixed-window rate limit to `POST /api/contact`.
- Reused the repository's internal in-memory rate-limit store and Fastify request IP resolution.
- Added focused runtime and helper tests without adding dependencies.

## Security objective
- Reduce contact-form flood, spam, and SMTP abuse before email delivery work runs.
- Return a stable public response without exposing client identifiers, form contents, or transport internals.

## Scope
- Public `POST /api/contact`.
- Contact-specific rate-limit policy and client-key normalization.
- Unit and Fastify route tests related to contact rate limiting.

## Files changed
- `server/lib/contact-rate-limit.ts`
- `server/routes/contact.fastify.ts`
- `test/contact-rate-limit.test.ts`
- `test/contact-route.test.ts`
- Eight historical frontend scope-contract tests, with an exact exception for
  `server/routes/contact.fastify.ts` so the full repository suite can evaluate
  this backend security change without weakening their other blocked paths.
- `IMPLEMENTATION_CONTACT_RATE_LIMIT.md`

## Rate-limit policy
- Window: 10 minutes, fixed window.
- Max: 5 POST requests per client.
- Key: SHA-256 of a contact-scoped, normalized `request.ip` value.
- Status: `429 Too Many Requests`.
- Retry-After: Remaining window duration in seconds on blocked responses.

Fastify resolves `request.ip` according to the environment-controlled `TRUST_PROXY`
setting. The contact route does not independently trust raw forwarding headers.
The normalized value accepts only a bounded IP address, handles a defensive
comma-separated value by selecting the first item, and maps invalid or oversized
values to a controlled fallback. Only the derived hash is stored.

## Abuse cases covered
- Flood: Requests beyond the per-client fixed-window allowance receive `429`.
- SMTP abuse: Rate-limited requests return before email dependency resolution or delivery.
- Same-client burst: The sixth request within 10 minutes is blocked by default.
- Different clients: Distinct normalized client IPs use separate buckets.

## Privacy / leakage controls
- The store contains only a contact-scoped hash and count/reset metadata.
- No IP, email, clinic name, message, or phone data is logged by the limiter.
- The `429` body contains only a stable public message.
- SMTP failure behavior and its existing safe diagnostic allowlist remain unchanged.

## Tests
- Default policy constants and safe client-key normalization.
- Requests within the limit continue to send successfully.
- Requests over the limit return `429`, `RateLimit-*`, and `Retry-After`.
- SMTP delivery does not run for a blocked request.
- Client buckets remain independent.
- The window can expire through an injected clock without real-time waits.
- Trusted proxy client resolution uses Fastify's configured behavior.
- Rate-limit responses do not expose IP or contact payload values.
- Existing required-field validation remains covered.
- A non-contact public endpoint remains unaffected.

## Validation
- `pnpm audit --prod`
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`

## Limitations
- The in-memory store is best-effort and isolated per application instance.
- Counters reset on process restart and are not shared across horizontally scaled instances.
- This control does not replace an edge, WAF, or distributed rate limit.

## Out of scope
- UI changes, authentication, roles, permissions, pricing, dashboard behavior, PWA assets, visual audits, branded errors, and production observability.
