# CHANGELOG

## [Unreleased]

### Added
- Backend CI workflow for pull requests and pushes to active development branches.
- Baseline technical audit document for the current backend state.
- Windows-first validation flow documented from a clean local setup.
- `report_access_tokens` lifecycle support with clinic/admin creation, revocation, expiration and access counters.
- Public report access endpoint backed by hashed tokens and signed Supabase URLs.
- Node test baseline for report access token rules and log redaction.
- HTTP bootstrap test coverage with injected dependencies to prepare the Fastify migration.

### Changed
- Local backend baseline stabilized for Windows + pnpm.
- `study-tracking` clinic creation flow now relies on backend delivery estimation instead of reading a clinic payload field that is not part of the validated schema.
- `nodemailer` type support added to restore clean TypeScript validation.
- Backend CI now executes `pnpm test` in addition to typecheck and build.
- Request logging now redacts public report access tokens from URLs before writing to logs.
- Drizzle migration metadata now tracks both the PR4 legacy compatibility migration and the new PR5 token migration.
- Express app construction is now separated from HTTP bootstrap to prepare the migration to Fastify.

### Removed
- `server/app.ts.bak` from the tracked repository state.

### Security
- Revalidated clinic and admin session flows after the local baseline hardening.
- Confirmed database migration flow with Drizzle after environment completion.
- Public report access tokens are stored hashed and no longer leak through request logs.
- Trusted origin enforcement is now applied at router level before cookie auth in clinic public profile and reports routes, including report upload mutations.
- Clinic management permission is now enforced on sensitive clinic mutations for public profile, particular tokens and study tracking.
