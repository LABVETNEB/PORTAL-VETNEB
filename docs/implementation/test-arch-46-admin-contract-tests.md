# TEST-ARCH-46 - Admin contract test relocation

Scope: move three low-risk admin contract tests from root test/ into test/unit/contracts/admin/.

Moved tests:
- test/admin-audit-runtime-timing-contract.test.ts -> test/unit/contracts/admin/admin-audit-runtime-timing-contract.test.ts
- test/admin-auth-runtime-timing-contract.test.ts -> test/unit/contracts/admin/admin-auth-runtime-timing-contract.test.ts
- test/admin-clinics-db-contract.test.ts -> test/unit/contracts/admin/admin-clinics-db-contract.test.ts

Validations:
- pnpm typecheck:test
- pnpm exec tsx --test test/unit/contracts/admin/admin-audit-runtime-timing-contract.test.ts test/unit/contracts/admin/admin-auth-runtime-timing-contract.test.ts test/unit/contracts/admin/admin-clinics-db-contract.test.ts
- git diff --check

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
