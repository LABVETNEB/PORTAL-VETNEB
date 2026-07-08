# TEST-ARCH-48 - Admin contracts batch

Moved seven admin contract tests from root test/ into test/unit/contracts/admin/.

Excluded admin-heavy-list-pagination-contract.test.ts because it has a relative server import and requires a dedicated follow-up PR.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
