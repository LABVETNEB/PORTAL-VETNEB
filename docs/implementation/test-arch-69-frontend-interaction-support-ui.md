# TEST-ARCH-69 - Frontend interaction support UI batch

Moved ten frontend login/middleware/notification/route root tests from root test/ into test/unit/ui/frontend/.

Scout found no real relative imports requiring updates; only a source.includes(...) string assertion matched relative import text.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
