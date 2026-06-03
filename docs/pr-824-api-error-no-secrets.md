# PR 824 - API error no-secrets contract

## Summary

This change adds an explicit contract for API/Fastify JSON error bodies: error responses keep public fields such as `error`, `details`, `path`, and `requestId`, but must not echo sensitive request headers, payload values, cookie names, token names, environment-variable prefixes, or stack traces.

The audit found one central Fastify disclosure path: `path: request.url` could include query strings in 400/404/500 JSON error bodies. The backend adjustment is limited to the central Fastify error and not-found handlers, where the response path now uses only the URL pathname.

## Audited Surface

- `server/fastify-app.ts` central Fastify error handler and not-found handler.
- `server/lib/api-request-id.ts` request id generation and response propagation.
- `test/api-request-id-observability-contract.test.ts` request id body/header/log contract.
- `test/api-error-no-stack-traces-contract.test.ts` existing stack trace disclosure contract.
- Existing tests around secrets, authorization, cookie, token, password, and API error bodies.

## Applied Contract

API JSON error bodies must not include:

- `Authorization`, `Cookie`, `Set-Cookie`, or `Bearer`.
- `token`, `access_token`, `refresh_token`, `password`, `secret`, `session`, or `api_key`.
- `SUPABASE_`, `GMAIL_`, `SMTP_`, `ADMIN_SESSION_COOKIE_NAME`, or `CLINIC_SESSION_COOKIE_NAME`.
- Sensitive values sent through request headers, payload, or sensitive query parameters.

The contract preserves `X-Request-ID` and `body.requestId`; both must continue to match.

## Tests Added

- `test/api-error-no-secrets-contract.test.ts`
  - Covers a generic API 500 response with sensitive headers, payload, and query values.
  - Covers a controlled API 400 response with the same sensitive inputs.
  - Covers an API 404 response with the same sensitive inputs.
  - Asserts `requestId` remains in the JSON body and matches `X-Request-ID`.
  - Asserts no frontend/UI dependencies were introduced.
