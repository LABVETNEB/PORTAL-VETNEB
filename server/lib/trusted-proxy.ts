import { BlockList, isIP } from "node:net";

// Resolución estructural de proxies confiables para Fastify (`trustProxy` como
// función). proxy-addr invoca `(address, hop)` desde el peer del socket (hop 0)
// hacia la izquierda del X-Forwarded-For y devuelve la primera dirección NO
// confiable. Un hop sólo es confiable si su POSICIÓN está declarada en la cadena
// Y su DIRECCIÓN pertenece a la clase declarada para esa posición. Ninguna
// posición ni clase por sí sola concede confianza; lo demás es el cliente.
// No hay valores por defecto: sin configuración, el contrato previo no cambia.

export const TRUSTED_HOP_CLASSES = ["loopback", "private", "edge"] as const;
export type TrustedHopClass = (typeof TRUSTED_HOP_CLASSES)[number];

export type TrustProxyFunction = (address: string, hop: number) => boolean;
export type TrustProxySetting = string | false | TrustProxyFunction;

export type TrustedProxyChainConfig = {
  hops: readonly TrustedHopClass[];
  edgeCidrs: readonly string[];
};

const MAX_CHAIN_HOPS = 4;
const MIN_EDGE_PREFIX_V4 = 8;
const MIN_EDGE_PREFIX_V6 = 16;

type Family = 4 | 6;

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim());
}

// Devuelve la forma canónica (IPv4-mapped IPv6 se reduce a IPv4) o null si la
// entrada no es una IP literal estricta (puertos, zonas, texto, vacío).
function normalizeAddress(raw: string): { ip: string; family: Family } | null {
  const value = raw.trim();
  if (value.length === 0 || value.length > 45) return null;
  const family = isIP(value);
  if (family === 0) return null;
  if (family === 6) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
    if (mapped && isIP(mapped[1]) === 4) return { ip: mapped[1], family: 4 };
  }
  return { ip: value, family: family as Family };
}

export function parseTrustedHopChain(value: string): TrustedHopClass[] | null {
  const items = splitList(value);
  if (items.length === 0 || items.length > MAX_CHAIN_HOPS) return null;
  const hops: TrustedHopClass[] = [];
  for (const item of items) {
    if (!(TRUSTED_HOP_CLASSES as readonly string[]).includes(item)) return null;
    hops.push(item as TrustedHopClass);
  }
  return hops;
}

function parseCidr(entry: string): { ip: string; prefix: number; family: Family } | null {
  const [address, prefixRaw, ...rest] = entry.split("/");
  if (rest.length > 0) return null;
  const normalized = normalizeAddress(address);
  if (!normalized) return null;
  const maxPrefix = normalized.family === 4 ? 32 : 128;
  if (prefixRaw === undefined) {
    return { ip: normalized.ip, prefix: maxPrefix, family: normalized.family };
  }
  if (!/^\d{1,3}$/.test(prefixRaw)) return null;
  const prefix = Number(prefixRaw);
  if (prefix > maxPrefix) return null;
  return { ip: normalized.ip, prefix, family: normalized.family };
}

// Los rangos del borde deben ser acotados: rechaza 0.0.0.0/0, ::/0 y similares.
export function isValidEdgeCidrList(value: string): boolean {
  const items = splitList(value);
  return items.every((item) => {
    const parsed = parseCidr(item);
    if (!parsed) return false;
    const minPrefix = parsed.family === 4 ? MIN_EDGE_PREFIX_V4 : MIN_EDGE_PREFIX_V6;
    return parsed.prefix >= minPrefix;
  });
}

function buildList(cidrs: readonly string[]): BlockList {
  const list = new BlockList();
  for (const cidr of cidrs) {
    const parsed = parseCidr(cidr);
    if (!parsed) throw new Error("invalid trusted proxy CIDR");
    list.addSubnet(parsed.ip, parsed.prefix, parsed.family === 4 ? "ipv4" : "ipv6");
  }
  return list;
}

const LOOPBACK_LIST = buildList(["127.0.0.0/8", "::1/128"]);
const PRIVATE_LIST = buildList(["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"]);

function matches(list: BlockList, ip: string, family: Family): boolean {
  return list.check(ip, family === 4 ? "ipv4" : "ipv6");
}

export function createTrustedProxyFunction(config: TrustedProxyChainConfig): TrustProxyFunction {
  const hops = [...config.hops];
  const edgeList = buildList(config.edgeCidrs);
  if (hops.includes("edge") && config.edgeCidrs.length === 0) {
    throw new Error("edge hop requires explicit edge CIDRs");
  }

  return (address: string, hop: number): boolean => {
    if (!Number.isInteger(hop) || hop < 0 || hop >= hops.length) return false;
    const normalized = normalizeAddress(address);
    if (!normalized) return false;
    switch (hops[hop]) {
      case "loopback":
        return matches(LOOPBACK_LIST, normalized.ip, normalized.family);
      case "private":
        return matches(PRIVATE_LIST, normalized.ip, normalized.family);
      case "edge":
        return matches(edgeList, normalized.ip, normalized.family);
      default:
        return false;
    }
  };
}

export type ResolveTrustProxyInput = {
  trustProxy?: string;
  chain?: string;
  edgeCidrs?: string;
};

// Contrato: sin TRUST_PROXY_CHAIN el resultado es exactamente el previo
// (`TRUST_PROXY ?? false`). Las variables nuevas son opt-in y excluyentes con
// TRUST_PROXY; cualquier combinación ambigua falla al arrancar, nunca confía.
export function resolveTrustProxy(input: ResolveTrustProxyInput): TrustProxySetting {
  if (input.chain === undefined) {
    if (input.edgeCidrs !== undefined) {
      throw new Error("TRUST_PROXY_EDGE_CIDRS requires TRUST_PROXY_CHAIN");
    }
    return input.trustProxy ?? false;
  }
  if (input.trustProxy !== undefined) {
    throw new Error("TRUST_PROXY and TRUST_PROXY_CHAIN are mutually exclusive");
  }
  const hops = parseTrustedHopChain(input.chain);
  if (!hops) throw new Error("invalid TRUST_PROXY_CHAIN");
  const usesEdge = hops.includes("edge");
  if (usesEdge !== (input.edgeCidrs !== undefined)) {
    throw new Error("TRUST_PROXY_EDGE_CIDRS must be set exactly when the chain has an edge hop");
  }
  if (input.edgeCidrs !== undefined && !isValidEdgeCidrList(input.edgeCidrs)) {
    throw new Error("invalid TRUST_PROXY_EDGE_CIDRS");
  }
  return createTrustedProxyFunction({
    hops,
    edgeCidrs: input.edgeCidrs === undefined ? [] : splitList(input.edgeCidrs),
  });
}
