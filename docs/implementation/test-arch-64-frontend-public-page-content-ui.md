# TEST-ARCH-64 - Frontend public page content UI batch

Moved ten frontend public page/content root tests from root test/ into test/unit/ui/public/.

Scout found no real relative imports requiring updates; only a source.includes(...) string assertion matched relative import text.

Guardrails: no runtime/product/API/auth/DB/schema/migration/dependency/lockfile/CI changes.
