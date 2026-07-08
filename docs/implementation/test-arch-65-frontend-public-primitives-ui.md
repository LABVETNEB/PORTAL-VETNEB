# TEST-ARCH-65 - Frontend public primitives UI batch

Moved ten frontend public primitive/page contract root tests from root test/ into test/unit/ui/public/.

Scout found no real relative imports requiring updates; only source.includes(...) string assertions matched relative import text.

Updated global e2e production readiness expected paths for moved public production readiness contracts.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
