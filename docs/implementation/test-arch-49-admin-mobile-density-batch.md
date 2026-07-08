# TEST-ARCH-49 - Admin mobile density UI batch

Moved seven admin mobile/density UI tests from root test/ into test/unit/ui/admin/.

Excluded admin-dashboard-responsive-touch.test.ts because it depends on a relative test helper and requires a dedicated follow-up PR.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
