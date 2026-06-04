# Clinic Public Profile Safe Surface

## Context

PR-AC reviewed the authenticated clinic public profile surface for cross-session isolation and response disclosure.

## Finding

`POST /api/clinic/profile/avatar` returned the raw multipart parser message for malformed uploads. A truncated multipart request produced a 400 response with `Unexpected end of form`.

## Change

The avatar upload handler now only forwards explicitly controlled validation messages:

- unsupported avatar MIME type
- avatar size limit

Other multipart/upload parser errors return `Error al procesar avatar`.

## Contract

`test/clinic-public-profile.fastify.test.ts` now covers malformed multipart avatar uploads and asserts that technical parser details such as `Unexpected end of form`, `stack`, `cause`, and `details` are not exposed in the response body.
