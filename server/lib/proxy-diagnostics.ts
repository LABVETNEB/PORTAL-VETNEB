// PR-SEC-10 · hook TEMPORAL de diagnóstico de proxies (E3/E6/E4). Nunca se fusiona a
// `main` ni se despliega a producción. Desactivado por defecto: registra un hook
// `onRequest` solo si TODAS las condiciones de activación se cumplen. No crea rutas,
// no modifica la respuesta, no altera `request.ip` ni las claves de rate limiting.
// E4: observa el valor de CF-Connecting-IP/True-Client-IP frente al XFF y la pertenencia
// de cada salto a rangos de borde aportados en tiempo de medición (booleano, sin IP).
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { BlockList, isIP } from "node:net";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { logInfo, logWarn } from "./logger.ts";
import { UNMATCHED_ROUTE_TEMPLATE } from "./observability-metrics.ts";
import { isValidEdgeCidrList } from "./trusted-proxy.ts";

// Identidad inequívoca de staging (identificadores no secretos del panel de Render).
export const PROXY_DIAG_STAGING_IDENTITY = {
  serviceId: "srv-dbr5u80u01pc73a9e4a0",
  serviceName: "vetneb-api-stg",
  externalHostname: "vetneb-api-stg.onrender.com",
  siteHost: "vetneb-web-stg.onrender.com",
} as const;

export const PROXY_DIAG_MAX_EVENTS = 300;
export const PROXY_DIAG_MAX_TTL_MS = 4 * 60 * 60 * 1000;
export const PROXY_DIAG_PROBE_HEADER = "x-vetneb-diag";
export const PROXY_DIAG_MAX_LIST_ITEMS = 20;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const RUN_ID_PATTERN = /^[a-z0-9-]{4,32}$/;
const EXPIRES_AT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ROUTE_TEMPLATE_PATTERN = /^[A-Za-z0-9/_:*.-]+$/;

// Marcadores sintéticos: direcciones reservadas para documentación (RFC 5737).
const CONTROL_LABELS: ReadonlyMap<string, string> = new Map([
  ["203.0.113.77", "C1"],
  ["198.51.100.9", "C2"],
  ["203.0.113.5", "C3"],
  ["203.0.113.6", "C4"],
]);

// Sal efímera del proceso: las etiquetas solo comparan direcciones dentro de él.
const PROCESS_SALT = randomBytes(32);

export type AddressFamily = "ipv4" | "ipv6" | "ipv4-mapped" | "invalid" | "none";
export type AddressClass =
  | "unspecified"
  | "loopback"
  | "private"
  | "cgnat"
  | "link-local"
  | "ula"
  | "documentation"
  | "multicast"
  | "reserved"
  | "public"
  | "none";

export type ClassifiedAddress = {
  family: AddressFamily;
  class: AddressClass;
  canonical: string | null;
};

function parseIpv4(value: string): number[] | null {
  if (isIP(value) !== 4) return null;
  return value.split(".").map(Number);
}

function classifyIpv4(o: number[]): AddressClass {
  const [a, b, c] = o;
  if (a === 0) return "unspecified";
  if (a === 127) return "loopback";
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 100 && b >= 64 && b <= 127) return "cgnat";
  if (a === 169 && b === 254) return "link-local";
  if (
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) {
    return "documentation";
  }
  if (a >= 224 && a <= 239) return "multicast";
  if (a >= 240 || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && c === 0)) {
    return "reserved";
  }
  return "public";
}

function parseIpv6Words(value: string): number[] | null {
  if (isIP(value) !== 6) return null;
  let text = value.split("%")[0].toLowerCase();
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);

  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    text = `${text.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;

  const words = [...head, ...Array<string>(fill).fill("0"), ...rest].map((w) =>
    Number.parseInt(w, 16),
  );
  return words.length === 8 && words.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffff)
    ? words
    : null;
}

function classifyIpv6(w: number[]): AddressClass {
  if (w.every((x) => x === 0)) return "unspecified";
  if (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) return "loopback";
  if ((w[0] & 0xffc0) === 0xfe80) return "link-local";
  if ((w[0] & 0xfe00) === 0xfc00) return "ula";
  if ((w[0] & 0xff00) === 0xff00) return "multicast";
  if (w[0] === 0x2001 && w[1] === 0x0db8) return "documentation";
  if ((w[0] & 0xe000) === 0x2000) return "public";
  return "reserved";
}

// Quita comillas, corchetes y puerto. No devuelve nada si el token no es una IP.
function normalizeAddressToken(raw: string): string {
  let token = raw.trim().replace(/^"|"$/g, "").trim();
  if (token.startsWith("[")) {
    const end = token.indexOf("]");
    token = end > 0 ? token.slice(1, end) : token;
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(token)) {
    token = token.slice(0, token.lastIndexOf(":"));
  }
  return token;
}

export function classifyAddress(raw: unknown): ClassifiedAddress {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { family: "none", class: "none", canonical: null };
  }

  const token = normalizeAddressToken(raw);
  const v4 = parseIpv4(token);
  if (v4) return { family: "ipv4", class: classifyIpv4(v4), canonical: token };

  const words = parseIpv6Words(token);
  if (!words) return { family: "invalid", class: "none", canonical: null };

  const mapped =
    words.slice(0, 5).every((x) => x === 0) && words[5] === 0xffff;
  if (mapped) {
    const embedded = [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff];
    return {
      family: "ipv4-mapped",
      class: classifyIpv4(embedded),
      canonical: embedded.join("."),
    };
  }

  return { family: "ipv6", class: classifyIpv6(words), canonical: token.toLowerCase() };
}

export function buildAddressTag(canonical: string): string {
  return createHmac("sha256", PROCESS_SALT).update(canonical).digest("hex").slice(0, 8);
}

// Rangos de borde aportados solo para la medición (p. ej. los publicados por
// Cloudflare). Mismas restricciones que TRUST_PROXY_EDGE_CIDRS; inválidos => null.
export function buildEdgeList(value: string): BlockList | null {
  if (!isValidEdgeCidrList(value)) return null;
  const list = new BlockList();
  for (const entry of value.split(",")) {
    const [address, prefix] = entry.trim().split("/");
    const family = classifyAddress(address);
    if (family.canonical === null) return null;
    const type = family.family === "ipv6" ? "ipv6" : "ipv4";
    list.addSubnet(family.canonical, Number(prefix ?? (type === "ipv4" ? 32 : 128)), type);
  }
  return list;
}

function inEdgeList(list: BlockList | null, classified: ClassifiedAddress): boolean | null {
  if (list === null) return null;
  if (classified.canonical === null) return false;
  return list.check(classified.canonical, classified.family === "ipv6" ? "ipv6" : "ipv4");
}

// Solo para saltos internos (privada/ULA/CGNAT): 16 bits de prefijo, nunca la dirección.
function privatePrefixOf(classified: ClassifiedAddress): string | null {
  if (classified.canonical === null) return null;
  if (classified.class !== "private" && classified.class !== "cgnat" && classified.class !== "ula") {
    return null;
  }
  if (classified.family === "ipv6") {
    const words = parseIpv6Words(classified.canonical);
    return words === null ? null : `${words[0].toString(16)}:${words[1].toString(16)}`;
  }
  return classified.canonical.split(".").slice(0, 2).join(".");
}

type AddressObservation = {
  valid: boolean;
  family: AddressFamily;
  class: AddressClass;
  control: string | null;
  tag: string | null;
  equalsPeer: boolean;
  inEdgeRange: boolean | null;
  privatePrefix: string | null;
};

function observeAddress(
  raw: unknown,
  peerCanonical: string | null,
  edgeList: BlockList | null = null,
): AddressObservation {
  const classified = classifyAddress(raw);
  const control =
    classified.canonical !== null ? (CONTROL_LABELS.get(classified.canonical) ?? null) : null;

  return {
    valid: classified.canonical !== null,
    family: classified.family,
    class: classified.class,
    control,
    tag: classified.canonical !== null && control === null ? buildAddressTag(classified.canonical) : null,
    equalsPeer: classified.canonical !== null && classified.canonical === peerCanonical,
    inEdgeRange: inEdgeList(edgeList, classified),
    privatePrefix: privatePrefixOf(classified),
  };
}

// Observación de CF-Connecting-IP / True-Client-IP: valor frente a las posiciones del XFF.
function observeEdgeIpHeader(
  headers: IncomingHttpHeaders,
  rawHeaders: readonly string[],
  name: "cf-connecting-ip" | "true-client-ip",
  peerCanonical: string | null,
  edgeList: BlockList | null,
  xffCanonicals: ReadonlyArray<string | null>,
  markers: Array<{ source: string; label: string; pos: number; posFromRight: number }>,
) {
  const text = headerText(headers[name]);
  if (text === null) return { present: false as const };

  const observed = observeAddress(text, peerCanonical, edgeList);
  const canonical = classifyAddress(text).canonical;
  if (observed.control) markers.push({ source: name, label: observed.control, pos: 0, posFromRight: 0 });

  const matchesXffFromRight: number[] = [];
  if (canonical !== null) {
    xffCanonicals.forEach((entry, pos) => {
      if (entry === canonical && matchesXffFromRight.length < PROXY_DIAG_MAX_LIST_ITEMS) {
        matchesXffFromRight.push(xffCanonicals.length - 1 - pos);
      }
    });
  }

  return {
    present: true as const,
    lineCount: countHeaderLines(rawHeaders, name),
    valueCount: text.split(",").length,
    ...observed,
    matchesXffFromRight,
  };
}

function headerText(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  return Array.isArray(value) ? value.join(",") : value;
}

function countHeaderLines(rawHeaders: readonly string[], name: string): number {
  let lines = 0;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (rawHeaders[i].toLowerCase() === name) lines += 1;
  }
  return lines;
}

export type ProxyDiagnosticInput = {
  runId: string;
  method: string;
  routeTemplate: unknown;
  peerAddress: string | undefined;
  requestIpAddress: string | undefined;
  trustProxyConfigured: boolean;
  headers: IncomingHttpHeaders;
  rawHeaders: readonly string[];
  edgeList?: BlockList | null;
};

export function buildProxyDiagnosticEvent(input: ProxyDiagnosticInput) {
  const edgeList = input.edgeList ?? null;
  const peer = classifyAddress(input.peerAddress);
  const peerObs = observeAddress(input.peerAddress, null);
  const requestIpObs = observeAddress(input.requestIpAddress, peer.canonical);
  const markers: Array<{ source: string; label: string; pos: number; posFromRight: number }> = [];

  const xffText = headerText(input.headers["x-forwarded-for"]);
  const xffEntries =
    xffText === null || xffText.trim() === "" ? [] : xffText.split(",");
  const xffCanonicals = xffEntries.map((entry) => classifyAddress(entry).canonical);
  const xffItems = xffEntries.slice(0, PROXY_DIAG_MAX_LIST_ITEMS).map((entry, pos) => {
    const observed = observeAddress(entry, peer.canonical, edgeList);
    const posFromRight = xffEntries.length - 1 - pos;
    if (observed.control) {
      markers.push({ source: "x-forwarded-for", label: observed.control, pos, posFromRight });
    }
    return { pos, posFromRight, ...observed };
  });

  const realIpText = headerText(input.headers["x-real-ip"]);
  const realIp = realIpText === null ? null : observeAddress(realIpText, peer.canonical);
  if (realIp?.control) {
    markers.push({ source: "x-real-ip", label: realIp.control, pos: 0, posFromRight: 0 });
  }

  const forwardedText = headerText(input.headers.forwarded);
  const forwardedTokens: string[] = [];
  if (forwardedText !== null) {
    for (const element of forwardedText.split(",")) {
      for (const param of element.split(";")) {
        const match = /^\s*for\s*=(.*)$/i.exec(param);
        if (match) forwardedTokens.push(match[1]);
      }
    }
  }
  const forwardedItems = forwardedTokens
    .slice(0, PROXY_DIAG_MAX_LIST_ITEMS)
    .map((token, pos) => {
      const observed = observeAddress(token, peer.canonical);
      const posFromRight = forwardedTokens.length - 1 - pos;
      if (observed.control) {
        markers.push({ source: "forwarded", label: observed.control, pos, posFromRight });
      }
      return { pos, posFromRight, ...observed };
    });

  const protoText = headerText(input.headers["x-forwarded-proto"]);
  const route =
    typeof input.routeTemplate === "string" &&
    input.routeTemplate.length <= 120 &&
    ROUTE_TEMPLATE_PATTERN.test(input.routeTemplate)
      ? input.routeTemplate
      : UNMATCHED_ROUTE_TEMPLATE;

  return {
    runId: input.runId,
    method: input.method,
    routeTemplate: route,
    trustProxyConfigured: input.trustProxyConfigured,
    peer: {
      present: peer.canonical !== null,
      family: peerObs.family,
      class: peerObs.class,
      tag: peerObs.tag,
    },
    requestIp: {
      family: requestIpObs.family,
      class: requestIpObs.class,
      tag: requestIpObs.tag,
      equalsPeer: requestIpObs.equalsPeer,
    },
    xff: {
      present: xffText !== null,
      lineCount: countHeaderLines(input.rawHeaders, "x-forwarded-for"),
      entryCount: xffEntries.length,
      truncated: xffEntries.length > PROXY_DIAG_MAX_LIST_ITEMS,
      items: xffItems,
    },
    xRealIp: realIp === null ? { present: false } : { present: true, ...realIp },
    forwarded: {
      present: forwardedText !== null,
      lineCount: countHeaderLines(input.rawHeaders, "forwarded"),
      forCount: forwardedTokens.length,
      truncated: forwardedTokens.length > PROXY_DIAG_MAX_LIST_ITEMS,
      items: forwardedItems,
    },
    markers,
    edgeIp: {
      rangesConfigured: edgeList !== null,
      cfConnectingIp: observeEdgeIpHeader(
        input.headers,
        input.rawHeaders,
        "cf-connecting-ip",
        peer.canonical,
        edgeList,
        xffCanonicals,
        markers,
      ),
      trueClientIp: observeEdgeIpHeader(
        input.headers,
        input.rawHeaders,
        "true-client-ip",
        peer.canonical,
        edgeList,
        xffCanonicals,
        markers,
      ),
    },
    otherHeaders: {
      cfConnectingIp: input.headers["cf-connecting-ip"] !== undefined,
      trueClientIp: input.headers["true-client-ip"] !== undefined,
      xForwardedHost: input.headers["x-forwarded-host"] !== undefined,
      xForwardedProto:
        protoText === null ? null : protoText === "http" || protoText === "https" ? protoText : "other",
    },
  };
}

export type ProxyDiagnosticsConfig =
  | { active: false; reason: string }
  | {
      active: true;
      runId: string;
      expiresAtMs: number;
      tokenDigest: Buffer;
      edgeList: BlockList | null;
    };

export function resolveProxyDiagnosticsConfig(
  env: NodeJS.ProcessEnv,
  nowMs: number,
): ProxyDiagnosticsConfig {
  if (env.PROXY_DIAG_ENABLED !== "1") return { active: false, reason: "disabled" };

  const id = PROXY_DIAG_STAGING_IDENTITY;
  if (env.RENDER !== "true") return { active: false, reason: "not_render" };
  if (env.RENDER_SERVICE_ID !== id.serviceId) return { active: false, reason: "service_id_mismatch" };
  if (env.RENDER_SERVICE_NAME !== id.serviceName) return { active: false, reason: "service_name_mismatch" };
  if (env.RENDER_EXTERNAL_HOSTNAME !== id.externalHostname) return { active: false, reason: "hostname_mismatch" };

  let siteHost: string | null = null;
  try {
    siteHost = new URL(env.PUBLIC_SITE_URL ?? "").host;
  } catch {
    siteHost = null;
  }
  if (siteHost !== id.siteHost) return { active: false, reason: "site_host_mismatch" };

  const runId = env.PROXY_DIAG_RUN_ID ?? "";
  if (!RUN_ID_PATTERN.test(runId)) return { active: false, reason: "bad_run_id" };

  const token = env.PROXY_DIAG_TOKEN ?? "";
  if (!TOKEN_PATTERN.test(token)) return { active: false, reason: "bad_token" };

  const expiresAt = env.PROXY_DIAG_EXPIRES_AT ?? "";
  const expiresAtMs = EXPIRES_AT_PATTERN.test(expiresAt) ? Date.parse(expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAtMs)) return { active: false, reason: "bad_expiry" };
  if (expiresAtMs <= nowMs) return { active: false, reason: "expired" };
  if (expiresAtMs - nowMs > PROXY_DIAG_MAX_TTL_MS) return { active: false, reason: "ttl_too_long" };

  // Opcional; si está definido y es inválido, el diagnóstico no se activa (falla cerrado).
  let edgeList: BlockList | null = null;
  if (env.PROXY_DIAG_EDGE_CIDRS !== undefined) {
    edgeList = buildEdgeList(env.PROXY_DIAG_EDGE_CIDRS);
    if (edgeList === null) return { active: false, reason: "bad_edge_cidrs" };
  }

  return {
    active: true,
    runId,
    expiresAtMs,
    tokenDigest: createHash("sha256").update(token).digest(),
    edgeList,
  };
}

export type RegisterProxyDiagnosticsOptions = {
  trustProxyConfigured: boolean;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
};

export function registerProxyDiagnostics(
  app: FastifyInstance,
  options: RegisterProxyDiagnosticsOptions,
): { active: boolean; reason: string } {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => Date.now());
  const config = resolveProxyDiagnosticsConfig(env, now());

  if (!config.active) {
    if (config.reason !== "disabled") {
      logWarn("PROXY_DIAG_NOT_ACTIVATED", { reason: config.reason });
    }
    return { active: false, reason: config.reason };
  }

  let events = 0;
  let expiredNotified = false;
  let limitNotified = false;

  logInfo("PROXY_DIAG_ACTIVATED", {
    runId: config.runId,
    expiresAt: new Date(config.expiresAtMs).toISOString(),
    maxEvents: PROXY_DIAG_MAX_EVENTS,
    edgeRangesConfigured: config.edgeList !== null,
  });

  app.addHook("onRequest", async (request: FastifyRequest) => {
    try {
      const presented = request.headers[PROXY_DIAG_PROBE_HEADER];
      if (typeof presented !== "string" || presented.length > 128) return;
      const digest = createHash("sha256").update(presented).digest();
      if (!timingSafeEqual(digest, config.tokenDigest)) return;

      if (now() >= config.expiresAtMs) {
        if (!expiredNotified) {
          expiredNotified = true;
          logInfo("PROXY_DIAG_EXPIRED", { runId: config.runId });
        }
        return;
      }

      if (events >= PROXY_DIAG_MAX_EVENTS) {
        if (!limitNotified) {
          limitNotified = true;
          logInfo("PROXY_DIAG_LIMIT_REACHED", { runId: config.runId, maxEvents: PROXY_DIAG_MAX_EVENTS });
        }
        return;
      }

      events += 1;
      logInfo("PROXY_DIAGNOSTIC_OBSERVED", {
        requestId: request.id,
        ...buildProxyDiagnosticEvent({
          runId: config.runId,
          method: request.method,
          routeTemplate: request.routeOptions?.url,
          peerAddress: request.raw.socket?.remoteAddress,
          requestIpAddress: request.ip,
          trustProxyConfigured: options.trustProxyConfigured,
          headers: request.headers,
          rawHeaders: request.raw.rawHeaders,
          edgeList: config.edgeList,
        }),
      });
    } catch {
      // El diagnóstico nunca debe afectar la respuesta.
    }
  });

  return { active: true, reason: "active" };
}
