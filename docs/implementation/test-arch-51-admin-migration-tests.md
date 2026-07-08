# TEST-ARCH-51 - Admin migration tests

Moved two admin migration tests from root test/ into test/unit/migrations/admin/.

Pre-scout kept schema tests out because they use real relative server imports and require a dedicated follow-up PR.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
