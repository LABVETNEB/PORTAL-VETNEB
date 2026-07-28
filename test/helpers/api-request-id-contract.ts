import assert from "node:assert/strict";

const { isSafeRequestId } = await import(
  "../../server/lib/http/api-request-id.ts"
);

type ResponseWithHeaders = {
  headers: Record<string, string | string[] | number | undefined>;
};

type ResponseWithBody = {
  body: string;
};

export function assertRequestIdHeader(
  response: ResponseWithHeaders,
  label: string,
) {
  const requestId = response.headers["x-request-id"];

  assert.equal(typeof requestId, "string", `${label} debe incluir X-Request-ID`);
  if (typeof requestId !== "string") {
    throw new Error(`${label} debe incluir X-Request-ID`);
  }

  assert.ok(requestId.length > 0, `${label} debe incluir X-Request-ID no vacio`);
  assert.equal(
    isSafeRequestId(requestId),
    true,
    `${label} debe incluir X-Request-ID seguro`,
  );

  return requestId;
}

export function parseJsonObject(response: ResponseWithBody, label: string) {
  const body = JSON.parse(response.body) as unknown;

  assert.equal(
    body !== null && typeof body === "object" && !Array.isArray(body),
    true,
    `${label} debe devolver JSON object`,
  );

  return body as Record<string, unknown>;
}

export function assertBodyRequestIdMatchesHeader(
  response: ResponseWithBody & ResponseWithHeaders,
  label: string,
) {
  const requestId = assertRequestIdHeader(response, label);
  const body = parseJsonObject(response, label);

  assert.equal(
    body.requestId,
    requestId,
    `${label} debe incluir requestId igual a X-Request-ID`,
  );

  return { body, requestId };
}

export function assertBodyDoesNotIncludeRequestId(
  response: ResponseWithBody,
  label: string,
) {
  const body = parseJsonObject(response, label);

  assert.equal(
    "requestId" in body,
    false,
    `${label} no debe incluir requestId en body`,
  );

  return body;
}

export function serializeConsoleCalls(calls: unknown[][]) {
  return calls
    .map((args) =>
      args
        .map((arg) => {
          if (arg instanceof Error) {
            return arg.stack ?? arg.message;
          }

          try {
            return JSON.stringify(arg, (_key, value) => {
              if (value instanceof Error) {
                return {
                  name: value.name,
                  message: value.message,
                  stack: value.stack,
                };
              }

              return value;
            });
          } catch {
            return String(arg);
          }
        })
        .join(" "),
    )
    .join("\n");
}

export function assertApiErrorLogRequestId(
  consoleCalls: unknown[][],
  index: number,
  expectedRequestId: string,
  label: string,
) {
  const call = consoleCalls[index];

  assert.ok(call, `${label} debe registrar log de error API`);
  assert.equal(call[0], "[API ERROR]");

  const payload = call[1];

  assert.equal(
    payload !== null && typeof payload === "object" && !Array.isArray(payload),
    true,
    `${label} debe registrar payload de log estructurado`,
  );

  const loggedPayload = payload as Record<string, unknown>;

  assert.equal(
    loggedPayload.requestId,
    expectedRequestId,
    `${label} debe registrar el mismo requestId del header/body`,
  );
  assert.equal(
    isSafeRequestId(loggedPayload.requestId),
    true,
    `${label} debe registrar requestId seguro`,
  );

  return loggedPayload;
}
