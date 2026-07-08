# TEST-ARCH-72 - Frontend CSP security UI batch

Moved eight frontend CSP/security/config root tests from root test/ into test/unit/ui/frontend/.

Updated only real relative imports after relocation for CSP nonce, policy, and report endpoint helpers.

Updated global e2e production readiness expected paths for moved frontend CSP/security config tests.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
