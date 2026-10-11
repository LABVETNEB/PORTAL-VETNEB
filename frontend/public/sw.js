/*
 * Service Worker — Portal VETNEB
 * Política: PWA global con fallback offline público, sin cachear dashboards,
 * APIs autenticadas, respuestas con cookies ni HTML privado.
 *
 * Clases de recurso, por identidad de la URL y nunca por el tipo de recurso
 * que declara el request:
 *   - privado            → la red, sin intervención del worker.
 *   - navegación pública → red; sin red, el documento de contingencia
 *                          precacheado. Ningún HTML de navegación se almacena.
 *   - versionado         → la URL cambia con los bytes: cache-first acotado.
 *   - estable precacheado→ red; sin red, la copia precacheada.
 *   - cualquier otro     → la red, sin intervención del worker.
 */

const SW_VERSION = "2026-10-11-offline-fallback-v4";
const CACHE_PREFIX = "portal-vetneb-";
const PRECACHE = `${CACHE_PREFIX}precache-${SW_VERSION}`;
// Las entradas versionadas no dependen de la versión del worker: una URL con
// hash de contenido no envejece, así que sobreviven a la actualización y las
// pestañas de un build anterior siguen encontrando sus chunks ya descargados.
const ASSET_CACHE_PREFIX = `${CACHE_PREFIX}assets-v1-`;
const LEGACY_RUNTIME_PREFIX = `${CACHE_PREFIX}runtime-`;
// Documento autónomo: HTML estático sin scripts ni assets del build, así que
// se muestra entero aunque este navegador no tenga ningún chunk descargado.
// La página /offline de Next es una ruta pública más, no la contingencia.
// Sólo se pide al instalar: cambiar ese archivo exige cambiar SW_VERSION.
const OFFLINE_FALLBACK_URL = "/offline-fallback.html";

// Cache Storage no expira ni desaloja por sí solo. La edad de una entrada es
// la generación (ventana de reloj) de la caché que la contiene: se escribe en
// la generación vigente, se lee de la vigente y de la anterior, y una lectura
// en la anterior la copia a la vigente. Una entrada sin leer vive entre una y
// dos generaciones; borrar una generación vencida es un único caches.delete.
const ASSET_GENERATION_MS = 14 * 24 * 60 * 60 * 1000;
const ASSET_MAX_ENTRIES = 120;
const ASSET_MAX_BYTES = 2 * 1024 * 1024;

const PUBLIC_NAVIGATION_ALLOWLIST = new Set([
  "/",
  "/servicios",
  "/profesionales",
  "/clinicas",
  "/particulares",
  "/contacto",
  "/precios",
  "/login",
  "/offline",
]);

// URLs estables: sus bytes pueden cambiar sin que cambie la URL. Su fallo no
// impide instalar; el de OFFLINE_FALLBACK_URL sí.
const PRECACHE_OPTIONAL_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-192x192.png",
  "/icons/maskable-icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/images/hero-microscope-vetneb.webp",
];

const PRECACHED_STABLE_PATHS = new Set(PRECACHE_OPTIONAL_URLS);

const PRIVATE_PATH_PREFIXES = [
  "/api/",
  "/dashboard",
  "/_next/server",
  "/admin",
];

const PRIVATE_PATH_SEGMENTS = [
  "/download-url",
  "/preview-url",
  "/reports/",
  "/particular/auth",
  "/auth/",
];

// Hash de contenido de 16 hex en el nombre del archivo: la misma identidad
// que next.config.ts exige para servir una ruta como immutable.
const CONTENT_HASHED_PATH = /\.[0-9a-f]{16}\.[a-z0-9]+$/;
const UNSTORABLE_CACHE_CONTROL = /(?:^|[\s,])(?:no-store|private)(?:$|[\s,=])/;
const REVALIDATING_CACHE_CONTROL = /(?:^|[\s,])no-cache(?:$|[\s,=])/;

let sweptGeneration = null;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isPrivatePath(pathname) {
  return (
    PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix)) ||
    PRIVATE_PATH_SEGMENTS.some((segment) => pathname.includes(segment))
  );
}

function isPublicNavigationRequest(request, url) {
  if (request.mode !== "navigate" || !isSameOrigin(url)) {
    return false;
  }

  if (isPrivatePath(url.pathname)) {
    return false;
  }

  return PUBLIC_NAVIGATION_ALLOWLIST.has(url.pathname);
}

function isVersionedAsset(url) {
  return url.pathname.startsWith("/_next/static/") || CONTENT_HASHED_PATH.test(url.pathname);
}

function precachedKey(url) {
  return url.search === "" && PRECACHED_STABLE_PATHS.has(url.pathname) ? url.pathname : null;
}

// Set-Cookie no es visible para un worker en un navegador real: la frontera
// efectiva es la identidad de la URL más la política que declara la respuesta.
function isStorablePublicResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) {
    return false;
  }

  if (response.headers.has("Set-Cookie")) {
    return false;
  }

  const cacheControl = (response.headers.get("Cache-Control") || "").toLowerCase();

  return !UNSTORABLE_CACHE_CONTROL.test(cacheControl);
}

// Una entrada cache-first no se revalida nunca: además exige que la respuesta
// no pida revalidación, que no sea un documento servido bajo una URL de asset
// y que su tamaño declarado quepa en el presupuesto.
function isStorableAssetResponse(response) {
  if (!isStorablePublicResponse(response)) {
    return false;
  }

  if (REVALIDATING_CACHE_CONTROL.test((response.headers.get("Cache-Control") || "").toLowerCase())) {
    return false;
  }

  if ((response.headers.get("Content-Type") || "").toLowerCase().includes("text/html")) {
    return false;
  }

  return Number(response.headers.get("Content-Length") || 0) <= ASSET_MAX_BYTES;
}

function assetGeneration(now) {
  return Math.floor(now / ASSET_GENERATION_MS);
}

function assetCacheName(generation) {
  return `${ASSET_CACHE_PREFIX}${generation}`;
}

// Cache.keys() devuelve las entradas en orden de escritura: las primeras son
// las más antiguas.
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();

  for (let index = 0; index < keys.length - maxEntries; index += 1) {
    await cache.delete(keys[index]);
  }
}

// Una generación sólo vence hacia atrás. Quien limpia puede haber leído el
// reloj antes de un cambio de generación, o seguir esperando a Cache Storage
// cuando otro request ya escribió en la siguiente: nunca borra una generación
// igual o posterior a la anterior a la suya, así que ninguna limpieza, por
// tardía o intercalada que llegue, alcanza a la generación vigente.
function isExpiredAssetCache(key, generation) {
  if (!key.startsWith(ASSET_CACHE_PREFIX)) {
    return false;
  }

  return !(Number(key.slice(ASSET_CACHE_PREFIX.length)) >= generation - 1);
}

// Fuera de activate sólo se borran generaciones de assets: la precache de un
// worker más nuevo que todavía espera no se toca.
async function sweepAssetGenerations(generation) {
  const keys = await caches.keys();

  await Promise.all(keys.filter((key) => isExpiredAssetCache(key, generation)).map((key) => caches.delete(key)));
}

// `response` debe ser un clon entregado por el caller antes de cualquier
// consumo del body. Un fallo de almacenamiento nunca llega a la página.
async function storeVersionedAsset(generation, request, response) {
  try {
    const cache = await caches.open(assetCacheName(generation));
    await cache.put(request, response);
    await trimCache(cache, ASSET_MAX_ENTRIES);

    // La marca sólo avanza: una escritura que terminó tarde no la retrocede.
    if (sweptGeneration === null || generation > sweptGeneration) {
      sweptGeneration = generation;
      await sweepAssetGenerations(generation);
    }
  } catch (error) {
    if (error && error.name === "QuotaExceededError") {
      // Sin cuota no se reintenta: se libera la generación anterior.
      await caches.delete(assetCacheName(generation - 1)).catch(() => false);
    }
  }
}

async function matchVersionedAsset(event, generation) {
  const { request } = event;

  try {
    const current = await caches.open(assetCacheName(generation));
    const cached = await current.match(request);

    if (cached) {
      return cached;
    }

    const previousName = assetCacheName(generation - 1);

    if (!(await caches.has(previousName))) {
      return undefined;
    }

    const carried = await (await caches.open(previousName)).match(request);

    if (carried) {
      event.waitUntil(storeVersionedAsset(generation, request, carried.clone()));
    }

    return carried;
  } catch {
    return undefined;
  }
}

async function respondWithVersionedAsset(event) {
  const { request } = event;
  const generation = assetGeneration(Date.now());
  const cached = await matchVersionedAsset(event, generation);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (isStorableAssetResponse(response)) {
    // Clonar de forma sincrónica antes de retornar al browser; waitUntil
    // mantiene vivo al worker hasta que la escritura termina.
    event.waitUntil(storeVersionedAsset(generation, request, response.clone()));
  }

  return response;
}

async function matchPrecached(key) {
  try {
    const cache = await caches.open(PRECACHE);
    return await cache.match(key);
  } catch {
    return undefined;
  }
}

async function refreshPrecached(key, response) {
  try {
    const cache = await caches.open(PRECACHE);
    await cache.put(key, response);
  } catch {
    // La copia offline queda como estaba.
  }
}

async function respondWithStableAsset(event, url) {
  const { request } = event;

  try {
    const response = await fetch(request);
    const key = precachedKey(url);

    if (isStorablePublicResponse(response)) {
      event.waitUntil(refreshPrecached(key, response.clone()));
    }

    return response;
  } catch {
    return (await matchPrecached(precachedKey(url))) || Response.error();
  }
}

async function respondWithOfflineDocument() {
  return (await matchPrecached(OFFLINE_FALLBACK_URL)) || Response.error();
}

// La contingencia responde navegaciones: además de pública y almacenable,
// tiene que ser un documento HTML.
function isOfflineFallbackResponse(response) {
  return (
    isStorablePublicResponse(response) &&
    (response.headers.get("Content-Type") || "").toLowerCase().includes("text/html")
  );
}

// Sin credenciales y sin caché HTTP: la copia precacheada es la respuesta
// pública vigente del origen, no una personalizada ni una vieja.
async function precacheUrl(cache, url, isAcceptable = isStorablePublicResponse) {
  const response = await fetch(new Request(url, { cache: "reload", credentials: "omit" }));

  if (!isAcceptable(response)) {
    throw new TypeError(`precache rejected ${url}`);
  }

  await cache.put(url, response);
}

async function precache() {
  const cache = await caches.open(PRECACHE);

  await precacheUrl(cache, OFFLINE_FALLBACK_URL, isOfflineFallbackResponse);
  await Promise.all(PRECACHE_OPTIONAL_URLS.map((url) => precacheUrl(cache, url).catch(() => undefined)));
}

// El worker anterior guardaba en una sola caché runtime documentos, URLs
// estables y assets. Sólo se adoptan las entradas versionadas, en la
// generación anterior: si nadie las lee, vencen en la próxima.
async function adoptLegacyAssets(legacyName) {
  try {
    const generation = assetGeneration(Date.now());
    const legacy = await caches.open(legacyName);
    const target = await caches.open(assetCacheName(generation - 1));
    const requests = (await legacy.keys()).filter((request) => {
      const url = new URL(request.url);

      return isSameOrigin(url) && !isPrivatePath(url.pathname) && isVersionedAsset(url);
    });

    for (const request of requests.slice(-ASSET_MAX_ENTRIES)) {
      const response = await legacy.match(request);

      if (isStorableAssetResponse(response)) {
        await target.put(request, response);
      }
    }

    await trimCache(target, ASSET_MAX_ENTRIES);
  } catch {
    // Adoptar es una mejora: si falla, la caché anterior se borra igual.
  }
}

async function claimCaches() {
  const generation = assetGeneration(Date.now());
  const keys = await caches.keys();

  for (const key of keys) {
    if (key.startsWith(LEGACY_RUNTIME_PREFIX)) {
      await adoptLegacyAssets(key);
    }
  }

  await Promise.all(
    keys
      .filter(
        (key) =>
          key.startsWith(CACHE_PREFIX) &&
          key !== PRECACHE &&
          (!key.startsWith(ASSET_CACHE_PREFIX) || isExpiredAssetCache(key, generation)),
      )
      .map((key) => caches.delete(key)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    claimCaches()
      .catch(() => undefined)
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "VETNEB_SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || request.headers.has("range")) {
    return;
  }

  const url = new URL(request.url);

  if (!isSameOrigin(url) || isPrivatePath(url.pathname)) {
    return;
  }

  if (isPublicNavigationRequest(request, url)) {
    event.respondWith(fetch(request).catch(() => respondWithOfflineDocument()));
    return;
  }

  if (request.mode === "navigate") {
    return;
  }

  if (isVersionedAsset(url)) {
    event.respondWith(respondWithVersionedAsset(event));
    return;
  }

  if (precachedKey(url)) {
    event.respondWith(respondWithStableAsset(event, url));
  }
});
