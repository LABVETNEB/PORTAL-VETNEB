import { createHmac } from "node:crypto";
import { BlockList, isIP } from "node:net";

// Contrato de firma compartido con el backend (`server/lib/signed-client-ip.ts`).
// Se duplica a propósito (`shared/**` no admite dependencias de Node) y un test
// cruzado verifica que lo firmado aquí lo valida el backend.
const SIGNED_CLIENT_IP_HEADER = "x-vetneb-client-ip";
const SIGNED_CLIENT_IP_TIMESTAMP_HEADER = "x-vetneb-client-ip-ts";
const SIGNED_CLIENT_IP_SIGNATURE_HEADER = "x-vetneb-client-ip-sig";
const SIGNED_CLIENT_IP_HEADERS = [
  SIGNED_CLIENT_IP_HEADER,
  SIGNED_CLIENT_IP_TIMESTAMP_HEADER,
  SIGNED_CLIENT_IP_SIGNATURE_HEADER,
] as const;
const SIGNED_CLIENT_IP_MIN_SECRET_LENGTH = 32;
const SIGNATURE_CONTEXT = "vetneb-client-ip-v1";

export type SignedClientIpHeaders = Record<
  (typeof SIGNED_CLIENT_IP_HEADERS)[number],
  string
>;

function stripQuery(urlOrPath: string): string {
  const index = urlOrPath.search(/[?#]/);
  return index === -1 ? urlOrPath : urlOrPath.slice(0, index);
}

function signClientIp(input: {
  secret: string;
  ip: string;
  timestampSeconds: number;
  method: string;
  path: string;
}): SignedClientIpHeaders | null {
  if (input.secret.length < SIGNED_CLIENT_IP_MIN_SECRET_LENGTH) return null;
  if (input.ip.length === 0 || input.ip.length > 45 || isIP(input.ip) === 0) return null;
  if (!Number.isSafeInteger(input.timestampSeconds) || input.timestampSeconds <= 0) return null;
  const payload = [
    SIGNATURE_CONTEXT,
    String(input.timestampSeconds),
    input.method.toUpperCase(),
    stripQuery(input.path),
    input.ip,
  ].join("\n");
  return {
    [SIGNED_CLIENT_IP_HEADER]: input.ip,
    [SIGNED_CLIENT_IP_TIMESTAMP_HEADER]: String(input.timestampSeconds),
    [SIGNED_CLIENT_IP_SIGNATURE_HEADER]: createHmac("sha256", input.secret)
      .update(payload)
      .digest("hex"),
  };
}

// Proxy de aplicación Next -> Fastify. El navegador no puede aportar su IP: este
// módulo la deriva de la cadena X-Forwarded-For anclada A LA DERECHA y validada
// por dirección, y sólo entonces la firma. Si la estructura no coincide no se
// firma nada y el backend conserva su propia resolución (nunca un valor del
// cliente). Estructura esperada (de derecha a izquierda): salto privado de la
// plataforma, salto de borde dentro de rangos declarados, cliente.
// Los rangos de borde son configuración explícita; no hay valores por defecto.

const MIN_EDGE_PREFIX_V4 = 8;
const MIN_EDGE_PREFIX_V6 = 16;
const PRIVATE_RANGES: ReadonlyArray<readonly [string, number, "ipv4" | "ipv6"]> = [
  ["10.0.0.0", 8, "ipv4"],
  ["172.16.0.0", 12, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["fc00::", 7, "ipv6"],
];

type Family = "ipv4" | "ipv6";

function normalize(raw: string): { ip: string; family: Family } | null {
  const value = raw.trim();
  if (value.length === 0 || value.length > 45) return null;
  const kind = isIP(value);
  if (kind === 0) return null;
  if (kind === 6) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
    if (mapped && isIP(mapped[1]) === 4) return { ip: mapped[1], family: "ipv4" };
  }
  return { ip: value, family: kind === 4 ? "ipv4" : "ipv6" };
}

export function buildEdgeList(cidrs: string | undefined): BlockList | null {
  if (cidrs === undefined || cidrs.trim() === "") return null;
  const list = new BlockList();
  for (const entry of cidrs.split(",")) {
    const [address, prefixRaw, ...rest] = entry.trim().split("/");
    const parsed = normalize(address ?? "");
    if (!parsed || rest.length > 0) return null;
    const max = parsed.family === "ipv4" ? 32 : 128;
    const min = parsed.family === "ipv4" ? MIN_EDGE_PREFIX_V4 : MIN_EDGE_PREFIX_V6;
    if (prefixRaw !== undefined && !/^\d{1,3}$/.test(prefixRaw)) return null;
    const prefix = prefixRaw === undefined ? max : Number(prefixRaw);
    if (prefix > max || prefix < min) return null;
    list.addSubnet(parsed.ip, prefix, parsed.family);
  }
  return list;
}

const PRIVATE_LIST = (() => {
  const list = new BlockList();
  for (const [ip, prefix, family] of PRIVATE_RANGES) list.addSubnet(ip, prefix, family);
  return list;
})();

export function resolveClientIpFromForwardedFor(
  headerValue: string | null | undefined,
  edgeList: BlockList | null,
): string | null {
  if (!headerValue || !edgeList) return null;
  const entries = headerValue.split(",").map((item) => item.trim());
  if (entries.length < 3) return null;
  const privateHop = normalize(entries[entries.length - 1] ?? "");
  const edgeHop = normalize(entries[entries.length - 2] ?? "");
  const client = normalize(entries[entries.length - 3] ?? "");
  if (!privateHop || !edgeHop || !client) return null;
  if (!PRIVATE_LIST.check(privateHop.ip, privateHop.family)) return null;
  if (!edgeList.check(edgeHop.ip, edgeHop.family)) return null;
  return client.ip;
}

export type BuildClientIpHeadersInput = {
  secret: string | undefined;
  edgeCidrs: string | undefined;
  forwardedFor: string | null | undefined;
  method: string;
  path: string;
  nowSeconds: number;
};

export function buildSignedClientIpHeaders(
  input: BuildClientIpHeadersInput,
): SignedClientIpHeaders | null {
  if (!input.secret) return null;
  const ip = resolveClientIpFromForwardedFor(
    input.forwardedFor,
    buildEdgeList(input.edgeCidrs),
  );
  if (!ip) return null;
  return signClientIp({
    secret: input.secret,
    ip,
    timestampSeconds: input.nowSeconds,
    method: input.method,
    path: stripQuery(input.path),
  });
}

// Copia los encabezados de la request eliminando SIEMPRE cualquier valor de
// identidad enviado por el cliente y añadiendo la firma propia si procede.
export function applyClientIpHeaders(
  source: Headers,
  signed: SignedClientIpHeaders | null,
): Headers {
  const headers = new Headers(source);
  for (const name of SIGNED_CLIENT_IP_HEADERS) headers.delete(name);
  if (signed) {
    for (const name of SIGNED_CLIENT_IP_HEADERS) headers.set(name, signed[name]);
  }
  return headers;
}
