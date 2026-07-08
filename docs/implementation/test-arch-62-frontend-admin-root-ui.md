# TEST-ARCH-62 - Frontend admin root UI batch

Moved ten frontend admin root tests from root test/ into test/unit/ui/admin/.

Scout found no real relative imports requiring updates; only source.includes(...) string assertions matched relative import text.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
