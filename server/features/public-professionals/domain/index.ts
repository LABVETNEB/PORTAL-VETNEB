// Public Professionals · domain (barrel público)
//
// Superficie pública del contexto `public-professionals/domain`: re-exporta la
// regla pura de elegibilidad del banco de profesionales sin agregar lógica ni
// cambiar su comportamiento. Es el único punto de entrada que el resto del
// backend y los tests deben consumir; nadie fuera de `domain/` importa sus
// archivos internos (garantizado por
// `public-professionals-domain-boundary-guard`).
//
// - M21 · `professional-bank-eligibility.ts` (ventana rolling UTC de 3 meses,
//          semántica de histopatología, selección de última entrega admin;
//          cero imports, sólo cálculo puro).

export * from "./professional-bank-eligibility.ts";
