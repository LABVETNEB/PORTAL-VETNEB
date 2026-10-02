import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { effectiveAttribute, evaluate, jsxElements, parseTsx, staticAttribute, tagName } from "../dashboard/dashboard-source-oracle.ts";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";

test("login password visibility starts hidden and toggles input type safely", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(
    source.includes(
      'const [isPasswordVisible, setIsPasswordVisible] = useState(false)',
    ),
  );
  assert.ok(source.includes('type={isPasswordVisible ? "text" : "password"}'));
  assert.ok(source.includes('data-auth-credential-input="true"'));
});

test("login password visibility toggle uses explicit button semantics", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("type=\"button\""));
  assert.ok(
    source.includes("onClick={() => setIsPasswordVisible((current) => !current)}"),
  );
  assert.ok(source.includes('aria-controls="password"'));
  assert.ok(source.includes('data-auth-credential-visibility-toggle="true"'));
});

test("login password visibility exposes accessible label and pressed state", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(
    source.includes(
      'aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}',
    ),
  );
  assert.ok(source.includes("aria-pressed={isPasswordVisible}"));
});

test("login password visibility keeps lucide eye icons contract", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(
    source.includes('import { Eye, EyeOff, ShieldCheck } from "lucide-react"'),
  );
  assert.ok(source.includes("<EyeOff className=\"h-4 w-4\" aria-hidden=\"true\" />"));
  assert.ok(source.includes("<Eye className=\"h-4 w-4\" aria-hidden=\"true\" />"));
});

test("login redirects particular surface requests to the dedicated public route", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('if (requestedSurface === "particular") {'));
  assert.ok(source.includes("router.replace(ROUTES.particulares);"));
});

test("login removes explicit role tabs from the clinic form surface", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('aria-label="Formulario de inicio de sesión"'));
  assert.ok(source.includes("Usuario o email"));
  assert.ok(source.includes("Contraseña"));
  assert.equal(source.includes("Clínicas"), false);
  assert.equal(source.includes("Particulares"), false);
  assert.equal(source.includes('data-auth-particular-access-link="true"'), false);
  assert.equal(source.includes('data-auth-clinic-access-tab="true"'), false);
  assert.equal(source.includes('aria-label="Tipo de acceso"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("openParticularAccess"), false);
  assert.equal(source.includes("router.push(ROUTES.particulares);"), false);
});

test("TEST-GLOBAL-08 G06-F10 kills M-F04 with its own password-type execution", () => {
  const source = read(LOGIN_CONTENT_PATH);
  const typeWhenHidden = (candidate: string) => {
    const input = jsxElements(parseTsx(candidate, LOGIN_CONTENT_PATH)).find(
      (element) => tagName(element) === "Input" && staticAttribute(element, "data-auth-credential-input") === "true",
    );
    assert.ok(input, "credential input must exist");
    const type = effectiveAttribute(input, "type");
    assert.equal(type.kind, "value");
    return evaluate(type.expression, { isPasswordVisible: false });
  };
  assert.equal(typeWhenHidden(source), "password");
  const mutant = source.replace(
    'type={isPasswordVisible ? "text" : "password"}',
    'type={isPasswordVisible ? "text" : "password"} {...{ type: "text" }}',
  );
  assert.notEqual(mutant, source, "M-F04 must be applicable");
  assert.equal(typeWhenHidden(mutant), "text", "M-F04 forces the credential visible");
});
