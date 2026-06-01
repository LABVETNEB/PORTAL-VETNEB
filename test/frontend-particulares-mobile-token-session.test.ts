import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ─── Fix 1: Cards duplicadas/fantasma ───────────────────────────────────────

test("particulares content oculta columna info en móvil cuando sesión está activa", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes('"hidden lg:block"'),
    "debe contener clase hidden lg:block para columna info en móvil",
  );
  assert.ok(
    source.includes('session !== null ? "hidden lg:block" : ""'),
    "debe condicionar la visibilidad de la columna izquierda según session",
  );
});

test("particulares content mantiene columna info visible en desktop siempre", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("lg:block"),
    "columna info debe ser visible en desktop (lg:block)",
  );
  assert.equal(
    source.includes('"hidden"'),
    false,
    "columna info no debe ocultarse incondicionalmente",
  );
});

test("particulares content no elimina highlights ni banda de seguridad", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("accessHighlights.map("));
  assert.ok(source.includes("Sesión separada del portal clínico"));
  assert.ok(source.includes("ShieldCheck"));
});

// ─── Fix 2: UX token móvil con portapapeles ──────────────────────────────────

test("particulares content incluye soporte de pegado desde portapapeles", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("clipboardSupported"),
    "debe tener estado clipboardSupported",
  );
  assert.ok(
    source.includes("navigator.clipboard?.readText"),
    "debe detectar disponibilidad de clipboard con optional chaining",
  );
  assert.ok(
    source.includes("handlePasteToken"),
    "debe definir handlePasteToken",
  );
  assert.ok(
    source.includes("Pegar token"),
    "debe tener label visible del botón de pegado",
  );
  assert.ok(
    source.includes("isPasting"),
    "debe tener estado isPasting para feedback visual",
  );
});

test("particulares content botón pegar solo actúa con gesto del usuario", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("onClick={handlePasteToken}"),
    "handlePasteToken debe estar en onClick, no en useEffect ni render directo",
  );
  assert.equal(
    source.includes("navigator.clipboard.readText()"),
    false,
    "no debe leer clipboard sin optional chaining (guard de disponibilidad requerido)",
  );
});

test("particulares content no expone token en logs ni URL", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.equal(
    source.includes("console.log("),
    false,
    "token no debe pasar por console.log",
  );
  assert.equal(
    source.includes("searchParams"),
    false,
    "token no debe ponerse en query params",
  );
  assert.equal(
    source.includes("window.location"),
    false,
    "token no debe ponerse en window.location",
  );
});

test("particulares content botón pegar es condicional y tiene fallback silencioso", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("{clipboardSupported ? ("),
    "botón pegar debe ser condicional a clipboardSupported",
  );
  assert.ok(
    source.includes("// Usuario denegó permiso o portapapeles no disponible"),
    "catch de clipboard debe ser silencioso con comentario explicativo",
  );
  assert.ok(
    source.includes("setIsPasting(false);"),
    "isPasting debe resetearse en finally",
  );
});

// ─── Fix 3: Sesión particular persistente ────────────────────────────────────

test("particulares content refreshSession no borra sesión en errores de conexión", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("setSessionCheckError(true)"),
    "debe marcar sessionCheckError en catch de refreshSession",
  );
  assert.ok(
    source.includes("setSessionCheckError(false)"),
    "debe resetear sessionCheckError en refreshSession y handleSubmit",
  );

  // Verificar que setSession(null) NO aparece dentro del catch de refreshSession.
  // Técnica: el único setSession(null) legítimo es en handleLogout.
  // Buscamos que catch de refreshSession no contenga setSession(null).
  const refreshSessionBlock = source.slice(
    source.indexOf("async function refreshSession()"),
    source.indexOf("useEffect(() => {"),
  );
  assert.equal(
    refreshSessionBlock.includes("setSession(null)"),
    false,
    "refreshSession catch no debe llamar setSession(null); solo handleLogout puede hacerlo",
  );
});

test("particulares content tiene botón de reintento cuando falla la verificación de sesión", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("Reintentar verificación"),
    "debe mostrar opción de reintento cuando sessionCheckError es true",
  );
  assert.ok(
    source.includes("{sessionCheckError ? ("),
    "botón reintento debe ser condicional a sessionCheckError",
  );
  assert.ok(
    source.includes("void refreshSession()"),
    "botón reintento debe llamar refreshSession",
  );
});

test("particulares content resetea sessionCheckError en handleSubmit para no mezclar errores", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  const handleSubmitBlock = source.slice(
    source.indexOf("async function handleSubmit("),
    source.indexOf("async function handleLogout("),
  );
  assert.ok(
    handleSubmitBlock.includes("setSessionCheckError(false)"),
    "handleSubmit debe resetear sessionCheckError antes de intentar login",
  );
});

test("particulares content mantiene invariante de sesión separada por rol", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.equal(source.includes("loginClinic"), false);
  assert.equal(source.includes("app_session_id"), false);
  assert.equal(source.includes("admin_session_id"), false);
  assert.equal(source.includes("useRouter"), false);
  assert.equal(source.includes("useSearchParams"), false);
  assert.equal(source.includes("ROUTES.dashboard"), false);
});

// ─── Guardrails: botón Pegar token y clipboard seguro ────────────────────────────────

test("guardrail: portal particular muestra Pegar token y no Pegar desde portapapeles", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("Pegar token"),
    "botón de pegado debe mostrar 'Pegar token'",
  );
  assert.equal(
    source.includes("Pegar desde portapapeles"),
    false,
    "texto anterior 'Pegar desde portapapeles' no debe existir (reemplazado por 'Pegar token')",
  );
  assert.ok(
    source.includes('aria-label="Pegar token"'),
    "aria-label del botón debe ser 'Pegar token'",
  );
});

test("guardrail: portal conserva navigator.clipboard?.readText?.() con doble optional chaining", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("navigator.clipboard?.readText?.()"),
    "la lectura de clipboard debe usar doble optional chaining para evitar excepciones en entornos sin soporte",
  );
});

test("guardrail: clipboard no se lee en useEffect solo bajo gesto del usuario", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  // Un capability check dentro de useEffect es válido:
  //   typeof navigator.clipboard?.readText === "function"
  // Una llamada real (readText?.() o readText()) dentro de useEffect no lo es.
  const useEffectBlocks = source.split("useEffect(");
  for (let i = 1; i < useEffectBlocks.length; i++) {
    const block = useEffectBlocks[i].slice(0, 400);
    const hasRealCall =
      block.includes("readText?.()") || block.includes("readText()");
    assert.equal(
      hasRealCall,
      false,
      "readText no debe llamarse (readText?.() o readText()) dentro de un useEffect; " +
        "solo capability check (typeof ... readText === \"function\") está permitida",
    );
  }
  assert.ok(
    source.includes("onClick={handlePasteToken}"),
    "handlePasteToken debe estar en onClick para que la lectura real sea bajo gesto del usuario",
  );
  assert.ok(
    source.includes("navigator.clipboard?.readText?.()"),
    "la llamada real al clipboard debe ocurrir con doble optional chaining en el handler",
  );
});
