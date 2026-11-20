/**
 * Serialización segura de JSON-LD (SEC-17). Módulo sin dependencias para poder
 * usarse desde Server Components y desde tests sin arrastrar tipos de Next.
 */

const JSON_LD_ESCAPES: Readonly<Record<string, string>> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * Único serializer permitido para `<script type="application/ld+json">`.
 * Escapa `<`, `>`, `&`, U+2028 y U+2029 como secuencias unicode JSON: el JSON sigue
 * siendo válido y equivalente, pero nunca puede cerrar el elemento `<script>`.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (character) => JSON_LD_ESCAPES[character] ?? character,
  );
}
