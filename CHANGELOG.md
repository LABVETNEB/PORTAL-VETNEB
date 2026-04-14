# CHANGELOG

## [Unreleased]

### Added
- Backend CI workflow for pull requests and pushes to active development branches.
- Baseline technical audit document for the current backend state.
- Windows-first validation flow documented from a clean local setup.

### Changed
- Local backend baseline stabilized for Windows + pnpm.
- `study-tracking` clinic creation flow now relies on backend delivery estimation instead of reading a clinic payload field that is not part of the validated schema.
- `nodemailer` type support added to restore clean TypeScript validation.

### Removed
- `server/app.ts.bak` from the tracked repository state.

### Security
- Revalidated clinic and admin session flows after the local baseline hardening.
- Confirmed database migration flow with Drizzle after environment completion.
