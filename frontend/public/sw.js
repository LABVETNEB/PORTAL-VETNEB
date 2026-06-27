/*
 * Service Worker — Portal VETNEB
 * Política: PWA global con fallback offline público, sin cachear dashboards,
 * APIs autenticadas, respuestas con cookies ni HTML privado.
 */

const SW_VERSION = "2026-06-26-app-version-gate-v1";
const PRECACHE = `portal-vetneb-precache-${SW_VERSION}`;
const RUNTIME = `portal-vetneb-runtime-${SW_VERSION}`;
const OFFLINE_URL = "/offline";

const PUBLIC_NAVIGATION_ALLOWLIST = new Set([
  "/",
  "/servicios",
  "/profesionales",
  "/clinicas",
  "/particulares",
  "/contacto",
  "/precios",
  "/login",
  OFFLINE_URL,
]);

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-192x192.png",
  "/icons/maskable-icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/images/hero-microscope-vetneb.webp",
];

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

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isPrivatePath(pathname) {
  return (
    PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix)) ||
    PRIVATE_PATH_SEGMENTS.some((segment) => pathname.includes(segment))
  );
}

function requestHasCredentials(request) {
  return request.credentials === "include" || request.credentials === "same-origin";
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

function isCacheableStaticAsset(request, url) {
  if (request.method !== "GET" || !isSameOrigin(url) || isPrivatePath(url.pathname)) {
    return false;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/icons/")) {
    return true;
  }

  return ["style", "script", "image", "font"].includes(request.destination);
}

async function putIfCacheable(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") {
    return;
  }

  if (response.headers.has("Set-Cookie")) {
    return;
  }

  // `response` debe ser un clon entregado por el caller antes de cualquier
  // consumo del body. No se llama .clone() aquí para evitar el error
  // "Response body is already used" si el body original ya fue leído.
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    // Error de caché no es crítico; se descarta para evitar unhandled rejection.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("portal-vetneb-") && key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
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

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (!isSameOrigin(url) || isPrivatePath(url.pathname)) {
    return;
  }

  if (isPublicNavigationRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!requestHasCredentials(request)) {
            // Clonar de forma sincrónica antes de retornar al browser.
            // El clon se entrega a putIfCacheable; el original va a la página.
            void putIfCacheable(RUNTIME, request, response.clone());
          }

          return response;
        })
        .catch(async () => {
          const cache = await caches.open(PRECACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }),
    );
    return;
  }

  if (isCacheableStaticAsset(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // Clonar de forma sincrónica antes de retornar al browser.
          void putIfCacheable(RUNTIME, request, response.clone());
          return response;
        });
      }),
    );
  }
});
