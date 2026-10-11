import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { INTER_FONT_PATH } from "../../../frontend/src/lib/fonts.ts";
import {
  THEME_INIT_LEGACY_SCRIPT_PATH,
  THEME_INIT_SCRIPT_SRC,
  THEME_INIT_SCRIPT_VERSION,
} from "../../../frontend/src/lib/theme.ts";
import { readSourceFile } from "../../helpers/tracked-source-files.ts";

// A1-4 — runs frontend/public/sw.js exactly as published, inside a VM context
// whose only bindings are a simulated worker scope, Cache Storage, network and
// clock. Every contract drives real install / activate / fetch events and reads
// the outcome from the simulated storage and network, never from the source
// text. The simulation is deliberately hostile where a browser is allowed to
// be: a cache operation still running when the event lifetime ends is lost,
// `waitUntil` outside a live event throws, and `put` rejects what the Cache API
// rejects.
//
// Not proven here: registration by PwaServiceWorkerRegistrar and the browser's
// own update algorithm. Both need a real browser on an HTTPS origin.

const SERVICE_WORKER_PATH = "frontend/public/sw.js";
const ORIGIN = "https://portal.vetneb.example";
const CACHE_PREFIX = "portal-vetneb-";
const PREVIOUS_SW_VERSION = "2026-06-26-app-version-gate-v1";
const PREVIOUS_PRECACHE = `${CACHE_PREFIX}precache-${PREVIOUS_SW_VERSION}`;
const PREVIOUS_RUNTIME = `${CACHE_PREFIX}runtime-${PREVIOUS_SW_VERSION}`;
const FOREIGN_CACHE = "another-app-cache-v1";

// The retention budget this suite holds the worker to.
const DAY_MS = 24 * 60 * 60 * 1000;
const GENERATION_MS = 14 * DAY_MS;
const ASSET_ENTRY_BUDGET = 120;
const ASSET_BYTE_BUDGET = 2 * 1024 * 1024;
const START = 1000 * GENERATION_MS + DAY_MS;

const OFFLINE_PATH = "/offline";
const HERO_PATH = "/images/hero-microscope-vetneb.webp";
const ICON_PATH = "/icons/icon-192x192.png";
const OPTIONAL_PRECACHE_PATHS = [
  "/manifest.webmanifest",
  ICON_PATH,
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-192x192.png",
  "/icons/maskable-icon-512x512.png",
  "/icons/apple-touch-icon.png",
  HERO_PATH,
];

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATING = "public, max-age=3600, must-revalidate";

type ResponseShape = {
  status?: number;
  type?: string;
  redirected?: boolean;
  headers?: Record<string, string>;
};

class FakeResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly type: string;
  readonly redirected: boolean;
  readonly headers: Headers;
  bodyUsed = false;
  #body: string;

  constructor(body: string | null = "", shape: ResponseShape = {}) {
    this.#body = body ?? "";
    this.status = shape.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.type = shape.type ?? "basic";
    this.redirected = shape.redirected ?? false;
    this.headers = new Headers(shape.headers ?? {});
  }

  static error(): FakeResponse {
    return new FakeResponse("", { status: 0, type: "error" });
  }

  clone(): FakeResponse {
    if (this.bodyUsed) {
      throw new TypeError("Response body is already used");
    }

    return this.copy();
  }

  async text(): Promise<string> {
    if (this.bodyUsed) {
      throw new TypeError("Response body is already used");
    }

    this.bodyUsed = true;
    return this.#body;
  }

  // What Cache Storage keeps: the bytes and the metadata, never the stream.
  consumeForStorage(): FakeResponse {
    if (this.bodyUsed) {
      throw new TypeError("Response body is already used");
    }

    const stored = this.copy();
    this.bodyUsed = true;
    return stored;
  }

  copy(): FakeResponse {
    const headers: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return new FakeResponse(this.#body, {
      status: this.status,
      type: this.type,
      redirected: this.redirected,
      headers,
    });
  }
}

type RequestShape = {
  method?: string;
  mode?: string;
  destination?: string;
  credentials?: string;
  cache?: string;
  headers?: Record<string, string>;
};

class FakeRequest {
  readonly url: string;
  readonly method: string;
  readonly mode: string;
  readonly destination: string;
  readonly credentials: string;
  readonly cache: string;
  readonly headers: Headers;

  constructor(input: string | FakeRequest, shape: RequestShape = {}) {
    this.url = typeof input === "string" ? new URL(input, ORIGIN).href : input.url;
    this.method = shape.method ?? "GET";
    this.mode = shape.mode ?? "no-cors";
    this.destination = shape.destination ?? "";
    this.credentials = shape.credentials ?? "include";
    this.cache = shape.cache ?? "default";
    this.headers = new Headers(shape.headers ?? {});
  }
}

type CacheKey = string | FakeRequest;

function cacheKey(key: CacheKey): string {
  return typeof key === "string" ? new URL(key, ORIGIN).href : key.url;
}

function pathOf(url: string): string {
  const parsed = new URL(url);

  return parsed.origin === ORIGIN ? `${parsed.pathname}${parsed.search}` : url;
}

class World {
  now = START;
  offline = false;
  storageBroken = false;
  putFailure: Error | null = null;
  activeEvents = 0;
  readonly routes = new Map<string, () => FakeResponse>();
  readonly fetched: FakeRequest[] = [];
  readonly stores = new Map<string, Map<string, FakeResponse>>();

  serve(path: string, body: string, headers: Record<string, string> = {}, shape: ResponseShape = {}): void {
    this.routes.set(
      path,
      () => new FakeResponse(body, { ...shape, headers: { "cache-control": IMMUTABLE, ...headers } }),
    );
  }

  publish(label: string): void {
    this.serve(OFFLINE_PATH, `offline document ${label}`, {
      "cache-control": "s-maxage=31536000",
      "content-type": "text/html; charset=utf-8",
    });

    for (const path of OPTIONAL_PRECACHE_PATHS) {
      this.serve(path, `${path} ${label}`, { "cache-control": REVALIDATING });
    }
  }

  fetchedPaths(): string[] {
    return this.fetched.map((request) => pathOf(request.url));
  }

  timesFetched(path: string): number {
    return this.fetchedPaths().filter((fetchedPath) => fetchedPath === path).length;
  }

  seed(cacheName: string, path: string, body: string, headers: Record<string, string> = {}): void {
    const store = this.stores.get(cacheName) ?? new Map<string, FakeResponse>();

    store.set(cacheKey(path), new FakeResponse(body, { headers: { "cache-control": IMMUTABLE, ...headers } }));
    this.stores.set(cacheName, store);
  }

  cacheNames(): string[] {
    return [...this.stores.keys()];
  }

  cachesHolding(path: string): string[] {
    const key = cacheKey(path);

    return this.cacheNames().filter((name) => this.stores.get(name)?.has(key));
  }

  // Entries of every worker-owned cache except the fixed precache set.
  runtimeEntryCount(): number {
    return this.cacheNames()
      .filter((name) => name.startsWith(CACHE_PREFIX) && !name.includes("precache"))
      .reduce((total, name) => total + (this.stores.get(name)?.size ?? 0), 0);
  }

  // Once no event is alive the browser may stop the worker: the turn given here
  // lets every operation that outlived its event run into that stop.
  async endEvent(): Promise<void> {
    this.activeEvents -= 1;
    await new Promise((resolve) => setImmediate(resolve));
  }

  // A browser may stop an idle worker: whatever is still running is lost.
  async storageTick(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));

    if (this.activeEvents === 0) {
      throw new Error("the worker was stopped before this cache operation finished");
    }

    if (this.storageBroken) {
      throw new Error("Cache Storage is unavailable");
    }
  }

  cacheStorage() {
    const openCache = (name: string) => {
      const entries = (): Map<string, FakeResponse> => {
        const existing = this.stores.get(name);

        if (existing) {
          return existing;
        }

        const created = new Map<string, FakeResponse>();
        this.stores.set(name, created);
        return created;
      };

      return {
        match: async (key: CacheKey): Promise<FakeResponse | undefined> => {
          await this.storageTick();
          return this.stores.get(name)?.get(cacheKey(key))?.copy();
        },
        put: async (key: CacheKey, response: FakeResponse): Promise<void> => {
          await this.storageTick();

          if (this.putFailure) {
            throw this.putFailure;
          }

          if (response.status === 206 || response.headers.get("vary") === "*") {
            throw new TypeError("Cache.put rejects partial and Vary: * responses");
          }

          const stored = response.consumeForStorage();
          const store = entries();

          // Replacing a key moves it to the end: insertion order is write order.
          store.delete(cacheKey(key));
          store.set(cacheKey(key), stored);
        },
        delete: async (key: CacheKey): Promise<boolean> => {
          await this.storageTick();
          return this.stores.get(name)?.delete(cacheKey(key)) ?? false;
        },
        keys: async (): Promise<FakeRequest[]> => {
          await this.storageTick();
          return [...(this.stores.get(name)?.keys() ?? [])].map((url) => new FakeRequest(url));
        },
        addAll: async (urls: string[]): Promise<void> => {
          const responses = await Promise.all(urls.map((url) => this.fetch(new FakeRequest(url))));

          if (responses.some((response) => !response.ok)) {
            throw new TypeError("Cache.addAll rejects when any response is not ok");
          }

          await this.storageTick();
          const store = entries();
          urls.forEach((url, index) => store.set(cacheKey(url), responses[index]!.consumeForStorage()));
        },
      };
    };

    return {
      open: async (name: string) => {
        await this.storageTick();

        if (!this.stores.has(name)) {
          this.stores.set(name, new Map());
        }

        return openCache(name);
      },
      has: async (name: string): Promise<boolean> => {
        await this.storageTick();
        return this.stores.has(name);
      },
      keys: async (): Promise<string[]> => {
        await this.storageTick();
        return this.cacheNames();
      },
      delete: async (name: string): Promise<boolean> => {
        await this.storageTick();
        return this.stores.delete(name);
      },
      match: async (key: CacheKey): Promise<FakeResponse | undefined> => {
        await this.storageTick();

        for (const store of this.stores.values()) {
          const hit = store.get(cacheKey(key));

          if (hit) {
            return hit.copy();
          }
        }

        return undefined;
      },
    };
  }

  fetch = async (input: string | FakeRequest): Promise<FakeResponse> => {
    const request = typeof input === "string" ? new FakeRequest(input) : input;

    this.fetched.push(request);
    await new Promise((resolve) => setImmediate(resolve));

    if (this.offline) {
      throw new TypeError("Failed to fetch");
    }

    const route = this.routes.get(pathOf(request.url));

    return route ? route() : new FakeResponse("not found", { status: 404, headers: { "cache-control": "no-store" } });
  };
}

type Listener = (event: unknown) => void;

type LifecycleOutcome = { failed: boolean; skipWaitingCalls: number; claimCalls: number };

type FetchOutcome = {
  handled: boolean;
  response: FakeResponse | null;
  body: string | null;
  rejected: boolean;
  lifetimeErrors: unknown[];
};

class Worker {
  readonly world: World;
  readonly listeners = new Map<string, Listener[]>();
  skipWaitingCalls = 0;
  claimCalls = 0;

  constructor(source: string, world: World) {
    this.world = world;

    const scope = {
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: Listener) => {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      },
      skipWaiting: async () => {
        this.skipWaitingCalls += 1;
      },
      clients: {
        claim: async () => {
          this.claimCalls += 1;
        },
      },
    };

    vm.runInNewContext(
      source,
      {
        self: scope,
        caches: world.cacheStorage(),
        fetch: world.fetch,
        Request: FakeRequest,
        Response: FakeResponse,
        Headers,
        URL,
        Date: { now: () => world.now },
      },
      { filename: SERVICE_WORKER_PATH },
    );
  }

  async lifecycle(type: "install" | "activate"): Promise<LifecycleOutcome> {
    const extensions: Promise<unknown>[] = [];
    let failed = false;

    this.world.activeEvents += 1;

    try {
      for (const listener of this.listeners.get(type) ?? []) {
        listener({
          waitUntil: (extension: Promise<unknown>) => {
            extensions.push(
              Promise.resolve(extension).catch(() => {
                failed = true;
              }),
            );
          },
        });
      }

      for (let index = 0; index < extensions.length; index += 1) {
        await extensions[index];
      }
    } finally {
      await this.world.endEvent();
    }

    return { failed, skipWaitingCalls: this.skipWaitingCalls, claimCalls: this.claimCalls };
  }

  async fetch(path: string, shape: RequestShape = {}): Promise<FetchOutcome> {
    const request = new FakeRequest(path, shape);
    const extensions: Promise<unknown>[] = [];
    const lifetimeErrors: unknown[] = [];
    let dispatching = true;
    let pending = 0;
    let responded: Promise<FakeResponse> | null = null;

    const extend = (extension: Promise<unknown>, report: boolean) => {
      pending += 1;
      extensions.push(
        Promise.resolve(extension)
          .catch((error: unknown) => {
            if (report) {
              lifetimeErrors.push(error);
            }
          })
          .finally(() => {
            pending -= 1;
          }),
      );
    };

    this.world.activeEvents += 1;

    try {
      for (const listener of this.listeners.get("fetch") ?? []) {
        listener({
          request,
          respondWith: (response: Promise<FakeResponse>) => {
            assert.equal(dispatching, true, "respondWith must be called while the event is dispatched");
            responded = Promise.resolve(response);
            extend(responded, false);
          },
          waitUntil: (extension: Promise<unknown>) => {
            if (!dispatching && pending === 0) {
              throw new Error("InvalidStateError: waitUntil called on an event that is no longer active");
            }

            extend(extension, true);
          },
        });
      }

      dispatching = false;

      let response: FakeResponse | null = null;
      let rejected = false;

      if (responded) {
        try {
          response = await (responded as Promise<FakeResponse>);
        } catch {
          rejected = true;
        }
      }

      // The page reads its body while the worker may still be storing a copy.
      const body = response && response.type !== "error" ? await response.text() : null;

      for (let index = 0; index < extensions.length; index += 1) {
        await extensions[index];
      }

      return { handled: responded !== null, response, body, rejected, lifetimeErrors };
    } finally {
      await this.world.endEvent();
    }
  }

  navigate(path: string): Promise<FetchOutcome> {
    return this.fetch(path, { mode: "navigate", destination: "document", credentials: "include" });
  }
}

async function installAndActivate(source: string, world: World): Promise<Worker> {
  const worker = new Worker(source, world);
  const install = await worker.lifecycle("install");

  assert.equal(install.failed, false, "the worker must install");
  assert.equal(install.skipWaitingCalls, 1, "an installed worker takes over without waiting");

  const activate = await worker.lifecycle("activate");

  assert.equal(activate.failed, false, "the worker must activate");
  assert.equal(activate.claimCalls, 1, "an active worker claims the open clients");

  return worker;
}

async function publishedWorld(source: string): Promise<{ world: World; worker: Worker }> {
  const world = new World();

  world.publish("build-a");

  return { world, worker: await installAndActivate(source, world) };
}

function chunk(name: string): string {
  return `/_next/static/chunks/${name}.js`;
}

function expectNetworkError(outcome: FetchOutcome, message: string): void {
  assert.equal(outcome.handled, true, message);
  assert.ok(outcome.rejected || outcome.response?.type === "error", message);
}

type Contract = (source: string) => Promise<void>;

const contracts: Record<string, Contract> = {
  // Contracts 1 and 2.
  "private surfaces are never answered or stored by the worker": async (source) => {
    const { world, worker } = await publishedWorld(source);
    const privateRequests: [string, RequestShape][] = [
      ["/dashboard", { mode: "navigate", destination: "document" }],
      ["/dashboard/admin?hub=1", { mode: "navigate", destination: "document" }],
      ["/dashboard/logo.0123456789abcdef.png", { destination: "image" }],
      ["/api/app-version?t=1", {}],
      ["/api/reports/7/download-url", {}],
      ["/api/reports/7/preview-url", { destination: "image" }],
      ["/api/files/report.0123456789abcdef.pdf", {}],
      ["/api/auth/session", {}],
      ["/api/particular/auth/login", {}],
      ["/admin/export.0123456789abcdef.js", { destination: "script" }],
      ["/_next/server/app/page.js", { destination: "script" }],
      ["/_next/static/chunks/app/dashboard/reports/page-0123456789abcdef.js", { destination: "script" }],
    ];

    for (const [path, shape] of privateRequests) {
      world.serve(path, `private ${path}`);

      const outcome = await worker.fetch(path, shape);

      assert.equal(outcome.handled, false, `${path} must go straight to the network`);
      assert.deepEqual(world.cachesHolding(path), [], `${path} must not be stored`);
    }

    world.serve("/api/reports/7/download-url", "mutation");
    const mutation = await worker.fetch(chunk("post-target"), { method: "POST", destination: "script" });
    const crossOrigin = await worker.fetch("https://cdn.example/lib.0123456789abcdef.js", { destination: "script" });
    const ranged = await worker.fetch(chunk("ranged"), { destination: "video", headers: { range: "bytes=0-99" } });

    assert.equal(mutation.handled, false, "only GET is ever answered");
    assert.equal(crossOrigin.handled, false, "another origin is never answered or stored");
    assert.equal(ranged.handled, false, "a range request is never answered from a full-body cache");
  },

  // Contract 3, and the A1-2 compatibility: a stable URL can change bytes.
  "stable public URLs are answered from the network while online": async (source) => {
    const { world, worker } = await publishedWorld(source);
    const stableRequests: [string, RequestShape][] = [
      [HERO_PATH, { destination: "image" }],
      [ICON_PATH, { destination: "image" }],
      ["/manifest.webmanifest", { destination: "manifest" }],
      ["/images/og-vetneb.png", { destination: "image" }],
      ["/favicon.ico", { destination: "image" }],
      ["/_next/image?url=%2Fimages%2Fhero-microscope-vetneb.webp&w=1200&q=75", { destination: "image" }],
      ["/legacy-widget.js", { destination: "script" }],
      ["/legacy-theme.css", { destination: "style" }],
      [`${THEME_INIT_LEGACY_SCRIPT_PATH}?v=${THEME_INIT_SCRIPT_VERSION}`, { destination: "script" }],
    ];
    const handledPaths: string[] = [];

    for (const [path, shape] of stableRequests) {
      const fetchedAtInstall = world.timesFetched(path);

      world.serve(path, "first bytes", { "cache-control": REVALIDATING });
      const first = await worker.fetch(path, shape);

      world.serve(path, "second bytes", { "cache-control": REVALIDATING });
      const second = await worker.fetch(path, shape);

      // Left alone, the browser asks the network itself; answered, it must be
      // with what the origin serves now.
      for (const [outcome, bytes] of [[first, "first bytes"], [second, "second bytes"]] as const) {
        if (outcome.handled) {
          assert.equal(outcome.body, bytes, `${path} must carry the bytes the origin serves now`);
        }
      }

      if (second.handled) {
        assert.equal(
          world.timesFetched(path) - fetchedAtInstall,
          2,
          `${path} must reach the network on every online request`,
        );
      }

      handledPaths.push(...(second.handled ? [path] : []));
    }

    assert.deepEqual(
      handledPaths,
      [HERO_PATH, ICON_PATH, "/manifest.webmanifest"],
      "only the precached stable URLs are answered by the worker",
    );

    assert.equal(world.runtimeEntryCount(), 0, "a stable URL never enters the growing asset cache");
  },

  // Contract 4, and the A1-1 / A1-3 compatibility on their real URLs.
  "content-versioned URLs are stored once and answered from the cache": async (source) => {
    const { world, worker } = await publishedWorld(source);
    const versioned = [
      chunk("main-app-8d1f"),
      "/_next/static/css/5e2c.css",
      "/_next/static/media/a1b2c3.woff2",
      INTER_FONT_PATH,
      THEME_INIT_SCRIPT_SRC,
    ];

    for (const path of versioned) {
      world.serve(path, `bytes of ${path}`);

      const first = await worker.fetch(path, { destination: "script" });

      assert.equal(first.body, `bytes of ${path}`, `${path} must reach the page intact on a miss`);
      assert.deepEqual(first.lifetimeErrors, [], `${path} must not leave a rejected lifetime promise`);

      // The origin stops serving it (a later build): only the stored copy can answer.
      world.routes.delete(path);

      const second = await worker.fetch(path, { destination: "script" });

      assert.equal(second.body, `bytes of ${path}`, `${path} must be answered from the cache`);
      assert.equal(world.timesFetched(path), 1, `${path} must be fetched exactly once`);
    }
  },

  // Contract 12.
  "a cached entry answers its exact URL only": async (source) => {
    const { world, worker } = await publishedWorld(source);

    world.serve(`${chunk("page")}?dpl=build-a`, "build-a bytes");
    world.serve(`${chunk("page")}?dpl=build-b`, "build-b bytes");
    world.serve(chunk("page"), "bare bytes");

    assert.equal((await worker.fetch(`${chunk("page")}?dpl=build-a`)).body, "build-a bytes");
    assert.equal((await worker.fetch(`${chunk("page")}?dpl=build-b`)).body, "build-b bytes");
    assert.equal((await worker.fetch(chunk("page"))).body, "bare bytes");
    assert.equal((await worker.fetch(`${chunk("page")}?dpl=build-a`)).body, "build-a bytes");
  },

  // Contract 5.
  "the asset cache holds a bounded number of entries and evicts the oldest": async (source) => {
    const { world, worker } = await publishedWorld(source);
    const total = ASSET_ENTRY_BUDGET + 40;

    for (let index = 0; index < total; index += 1) {
      world.serve(chunk(`bulk-${index}`), `bulk ${index}`);
      await worker.fetch(chunk(`bulk-${index}`));
    }

    assert.equal(world.runtimeEntryCount(), ASSET_ENTRY_BUDGET, "one generation holds exactly its budget");
    assert.deepEqual(world.cachesHolding(chunk("bulk-0")), [], "the oldest entry is the one evicted");
    assert.equal(world.cachesHolding(chunk(`bulk-${total - 1}`)).length, 1, "the newest entry is kept");

    world.now += GENERATION_MS;

    for (let index = 0; index < total; index += 1) {
      world.serve(chunk(`later-${index}`), `later ${index}`);
      await worker.fetch(chunk(`later-${index}`));
    }

    assert.equal(
      world.runtimeEntryCount(),
      2 * ASSET_ENTRY_BUDGET,
      "two live generations bound the whole asset cache",
    );
  },

  // Contract 6.
  "an asset nobody reads expires and one in use survives": async (source) => {
    const { world, worker } = await publishedWorld(source);

    for (const name of ["in-use", "idle"]) {
      world.serve(chunk(name), `${name} bytes`);
      await worker.fetch(chunk(name));
      world.routes.delete(chunk(name));
    }

    world.now += GENERATION_MS;
    assert.equal((await worker.fetch(chunk("in-use"))).body, "in-use bytes", "one generation later it still answers");

    world.now += GENERATION_MS;
    world.serve(chunk("fresh"), "fresh bytes");
    await worker.fetch(chunk("fresh"));

    assert.deepEqual(world.cachesHolding(chunk("idle")), [], "an entry unread for two generations is gone");
    assert.equal((await worker.fetch(chunk("in-use"))).body, "in-use bytes", "an entry read every generation survives");
    assert.equal(world.timesFetched(chunk("in-use")), 1, "the surviving entry never went back to the network");

    const assetCaches = world.cacheNames().filter((name) => !name.includes("precache"));

    assert.equal(assetCaches.length <= 2, true, `at most two generations stay alive, found ${assetCaches.join(", ")}`);
    assert.equal((await worker.fetch(chunk("idle"))).response?.status, 404, "the expired entry is asked to the origin again");
  },

  // Contracts 7 and 8, plus every other response that must not be kept.
  "a response that is not a clean public 200 is never stored": async (source) => {
    const { world, worker } = await publishedWorld(source);
    const rejected: [string, Record<string, string>, ResponseShape][] = [
      ["status-404", {}, { status: 404 }],
      ["status-500", {}, { status: 500 }],
      ["status-206", {}, { status: 206 }],
      ["no-store", { "cache-control": "no-store" }, {}],
      ["private", { "cache-control": "private, max-age=600" }, {}],
      ["no-cache", { "cache-control": "no-cache" }, {}],
      ["set-cookie", { "set-cookie": "sid=1" }, {}],
      ["opaque", {}, { type: "opaque", status: 0 }],
      ["cors", {}, { type: "cors" }],
      ["redirected", {}, { redirected: true }],
      ["html-shell", { "content-type": "text/html; charset=utf-8" }, {}],
      ["oversized", { "content-length": String(ASSET_BYTE_BUDGET + 1) }, {}],
    ];

    for (const [name, headers, shape] of rejected) {
      const path = chunk(name);

      world.serve(path, `${name} body`, headers, shape);

      const first = await worker.fetch(path, { destination: "script" });

      assert.deepEqual(first.lifetimeErrors, [], `${name} must not leave a rejected lifetime promise`);
      assert.deepEqual(world.cachesHolding(path), [], `${name} must not be stored`);

      world.serve(path, `${name} healthy body`);

      const second = await worker.fetch(path, { destination: "script" });

      assert.equal(second.body, `${name} healthy body`, `${name} must not shadow the healthy response`);
    }
  },

  // Contract 9.
  "a failing Cache Storage never breaks a request": async (source) => {
    const { world, worker } = await publishedWorld(source);

    world.serve(chunk("quota"), "quota bytes");
    world.putFailure = Object.assign(new Error("quota"), { name: "QuotaExceededError" });

    const quota = await worker.fetch(chunk("quota"));

    assert.equal(quota.body, "quota bytes", "a failed write still delivers the response");
    assert.deepEqual(quota.lifetimeErrors, [], "a failed write is never an unhandled rejection");

    world.putFailure = null;
    world.storageBroken = true;
    world.serve(chunk("broken"), "broken-storage bytes");
    world.serve("/servicios", "services document", { "cache-control": "s-maxage=31536000" });

    const asset = await worker.fetch(chunk("broken"));
    const icon = await worker.fetch(ICON_PATH, { destination: "image" });
    const navigation = await worker.navigate("/servicios");

    assert.equal(asset.body, "broken-storage bytes", "an asset still loads with storage down");
    assert.equal(icon.body, `${ICON_PATH} build-a`, "a stable asset still loads with storage down");
    assert.equal(navigation.body, "services document", "a navigation still loads with storage down");
    assert.deepEqual(
      [...asset.lifetimeErrors, ...icon.lifetimeErrors, ...navigation.lifetimeErrors],
      [],
      "broken storage is never an unhandled rejection",
    );

    world.offline = true;
    expectNetworkError(await worker.navigate("/servicios"), "offline with storage down is a plain network error");
  },

  // Contract 10, and the public navigation policy.
  "public navigation is network-first, never stored, and falls back to /offline": async (source) => {
    const { world, worker } = await publishedWorld(source);

    for (const path of ["/", "/servicios", "/login", "/?vetnebUpdate=1760000000000"]) {
      world.serve(path, "first document", { "cache-control": "s-maxage=31536000" });
      assert.equal((await worker.navigate(path)).body, "first document");

      world.serve(path, "second document", { "cache-control": "s-maxage=31536000" });
      assert.equal((await worker.navigate(path)).body, "second document", `${path} must never be answered stale online`);
      assert.deepEqual(world.cachesHolding(path), [], `${path} must not be stored`);
    }

    world.serve("/servicios", "server error page", {}, { status: 500 });
    assert.equal((await worker.navigate("/servicios")).response?.status, 500, "an origin error reaches the page as is");

    const unlisted = await worker.navigate("/profesionales/42");
    assert.equal(unlisted.handled, false, "a path outside the allowlist is left to the browser");

    world.offline = true;

    for (const path of ["/", "/servicios", "/login"]) {
      assert.equal((await worker.navigate(path)).body, "offline document build-a", `${path} falls back to /offline`);
    }

    assert.equal((await worker.navigate("/dashboard")).handled, false, "a private navigation never gets the fallback");
    assert.equal((await worker.fetch(ICON_PATH, { destination: "image" })).body, `${ICON_PATH} build-a`);
    assert.equal((await worker.fetch(HERO_PATH, { destination: "image" })).body, `${HERO_PATH} build-a`);
    assert.equal(
      (await worker.fetch("/images/og-vetneb.png", { destination: "image" })).handled,
      false,
      "nothing else is answered offline",
    );
  },

  "the offline copy of a stable asset follows the last bytes seen online": async (source) => {
    const { world, worker } = await publishedWorld(source);

    world.serve(ICON_PATH, "redesigned icon", { "cache-control": REVALIDATING });
    assert.equal((await worker.fetch(ICON_PATH, { destination: "image" })).body, "redesigned icon");

    world.serve(ICON_PATH, "broken icon", { "cache-control": "no-store" });
    assert.equal((await worker.fetch(ICON_PATH, { destination: "image" })).body, "broken icon");

    world.offline = true;
    assert.equal(
      (await worker.fetch(ICON_PATH, { destination: "image" })).body,
      "redesigned icon",
      "offline serves the last storable online bytes, not the install-time ones",
    );
  },

  // Scenario A and scenario D.
  "install keeps only what it can prove and never strands the previous worker": async (source) => {
    const world = new World();

    world.publish("build-a");
    await installAndActivate(source, world);

    const precacheRequests = world.fetched.filter((request) =>
      [OFFLINE_PATH, ...OPTIONAL_PRECACHE_PATHS].includes(pathOf(request.url)),
    );

    assert.equal(precacheRequests.length, 1 + OPTIONAL_PRECACHE_PATHS.length);
    for (const request of precacheRequests) {
      assert.equal(request.credentials, "omit", `${request.url} must be precached without credentials`);
      assert.equal(request.cache, "reload", `${request.url} must bypass the HTTP cache when precached`);
    }

    const installedCaches = world.cacheNames();

    // A second build whose icon is gone still installs: only /offline is essential.
    world.publish("build-b");
    world.routes.delete(ICON_PATH);

    const tolerant = new Worker(source.replace(/const SW_VERSION = "[^"]+";/, 'const SW_VERSION = "next-release";'), world);

    assert.equal((await tolerant.lifecycle("install")).failed, false, "a missing optional asset must not block an update");

    // The offline document is essential: without a clean copy the install fails.
    for (const [headers, shape] of [
      [{}, { status: 500 }],
      [{}, { redirected: true }],
      [{ "cache-control": "private, no-store" }, {}],
    ] as [Record<string, string>, ResponseShape][]) {
      const failing = new World();

      failing.publish("build-a");
      await installAndActivate(source, failing);
      failing.serve(OFFLINE_PATH, "not a clean offline document", headers, shape);

      const next = new Worker(source.replace(/const SW_VERSION = "[^"]+";/, 'const SW_VERSION = "next-release";'), failing);
      const install = await next.lifecycle("install");

      assert.equal(install.failed, true, "install must fail without a clean offline document");
      assert.equal(install.skipWaitingCalls, 0, "a failed install must not take over");
    }

    const offlineWorld = new World();

    offlineWorld.publish("build-a");
    const active = await installAndActivate(source, offlineWorld);

    offlineWorld.offline = true;

    const stranded = new Worker(source.replace(/const SW_VERSION = "[^"]+";/, 'const SW_VERSION = "next-release";'), offlineWorld);

    assert.equal((await stranded.lifecycle("install")).failed, true, "an offline update must fail to install");
    assert.equal(
      (await active.navigate("/")).body,
      "offline document build-a",
      "the worker that stays active keeps its offline document",
    );
    assert.equal(installedCaches.every((name) => name.startsWith(CACHE_PREFIX)), true);
  },

  // Contract 11, scenario B and scenario C.
  "an update adopts versioned entries of the previous worker and drops the rest": async (source) => {
    const world = new World();

    world.publish("build-b");
    world.seed(PREVIOUS_PRECACHE, OFFLINE_PATH, "offline document build-a");
    world.seed(PREVIOUS_RUNTIME, "/", "stale home document", { "cache-control": "s-maxage=31536000" });
    world.seed(PREVIOUS_RUNTIME, ICON_PATH, "stale icon", { "cache-control": REVALIDATING });
    world.seed(PREVIOUS_RUNTIME, "/legacy-widget.js", "stale unversioned script", { "cache-control": REVALIDATING });
    world.seed(PREVIOUS_RUNTIME, "/api/reports/7/preview-url", "private preview");
    world.seed(PREVIOUS_RUNTIME, chunk("no-store"), "must not survive", { "cache-control": "no-store" });
    world.seed(PREVIOUS_RUNTIME, chunk("build-a-page"), "build-a page chunk");
    world.seed(PREVIOUS_RUNTIME, INTER_FONT_PATH, "font bytes");
    world.seed(FOREIGN_CACHE, "/foreign", "owned by something else");
    world.seed(`${CACHE_PREFIX}precache-2025-abandoned`, OFFLINE_PATH, "abandoned");

    const worker = await installAndActivate(source, world);

    assert.equal(world.cacheNames().includes(PREVIOUS_PRECACHE), false, "the previous precache is removed");
    assert.equal(world.cacheNames().includes(PREVIOUS_RUNTIME), false, "the previous runtime cache is removed");
    assert.equal(world.cacheNames().includes(`${CACHE_PREFIX}precache-2025-abandoned`), false);
    assert.deepEqual(world.cachesHolding("/foreign"), [FOREIGN_CACHE], "a cache the worker does not own is untouched");

    for (const dropped of ["/", "/legacy-widget.js", "/api/reports/7/preview-url", chunk("no-store")]) {
      assert.deepEqual(world.cachesHolding(dropped), [], `${dropped} must not be carried over`);
    }

    // A tab of build A asks for a chunk the origin no longer serves.
    assert.equal((await worker.fetch(chunk("build-a-page"), { destination: "script" })).body, "build-a page chunk");
    assert.equal((await worker.fetch(INTER_FONT_PATH, { destination: "font" })).body, "font bytes");
    assert.equal(world.timesFetched(chunk("build-a-page")), 0, "the adopted chunk is answered without the network");

    // A chunk of build A that this browser never downloaded cannot be recovered.
    const missing = await worker.fetch(chunk("build-a-never-downloaded"), { destination: "script" });

    assert.equal(missing.response?.status, 404, "an undownloaded chunk fails as the origin says");
    assert.deepEqual(world.cachesHolding(chunk("build-a-never-downloaded")), []);

    world.offline = true;
    assert.equal((await worker.navigate("/")).body, "offline document build-b", "the fallback is the new build's");
    assert.equal(
      (await worker.fetch(ICON_PATH, { destination: "image" })).body,
      `${ICON_PATH} build-b`,
      "the stale icon of the previous worker is never served",
    );

    // Adopted entries are provisional: unread for one generation, they expire.
    world.offline = false;
    world.now += GENERATION_MS;
    world.serve(chunk("build-b-page"), "build-b page chunk");
    await worker.fetch(chunk("build-b-page"));
    world.now += GENERATION_MS;
    world.serve(chunk("build-c-page"), "build-c page chunk");
    await worker.fetch(chunk("build-c-page"));

    assert.deepEqual(world.cachesHolding(chunk("build-a-page")), [], "an adopted entry does not live forever");
  },

  "adopting a large previous cache stays inside the budget": async (source) => {
    const world = new World();

    world.publish("build-b");

    for (let index = 0; index < ASSET_ENTRY_BUDGET * 3; index += 1) {
      world.seed(PREVIOUS_RUNTIME, chunk(`old-${index}`), `old ${index}`);
    }

    await installAndActivate(source, world);

    assert.equal(world.runtimeEntryCount() <= ASSET_ENTRY_BUDGET, true, `adopted ${world.runtimeEntryCount()} entries`);
    assert.equal(
      world.cachesHolding(chunk(`old-${ASSET_ENTRY_BUDGET * 3 - 1}`)).length,
      1,
      "the most recently written entries are the ones adopted",
    );
  },

  // Contract 13 and scenario E: what AppVersionGate does, in its order.
  "the AppVersionGate recovery leaves nothing behind and a fresh install works": async (source) => {
    const { world, worker } = await publishedWorld(source);

    world.seed(FOREIGN_CACHE, "/foreign", "owned by something else");
    world.serve(chunk("app"), "app bytes");
    await worker.fetch(chunk("app"));
    world.now += GENERATION_MS;
    await worker.fetch(chunk("app"));
    await worker.fetch(ICON_PATH, { destination: "image" });

    const owned = world.cacheNames().filter((name) => name !== FOREIGN_CACHE);

    assert.equal(owned.length >= 2, true, "the worker owns a precache and an asset cache");
    assert.deepEqual(
      owned.filter((name) => !name.startsWith(CACHE_PREFIX)),
      [],
      "every cache the worker creates carries the prefix the gate clears",
    );

    for (const name of owned) {
      world.stores.delete(name);
    }

    // The unregistered worker still controls the page until it navigates.
    world.serve("/?vetnebUpdate=1", "fresh shell", { "cache-control": "s-maxage=31536000" });
    assert.equal((await worker.navigate("/?vetnebUpdate=1")).body, "fresh shell", "the gate's navigation reaches the network");
    assert.equal((await worker.fetch(chunk("app"))).body, "app bytes", "assets load again from the network");

    const reinstalled = await installAndActivate(source, world);

    world.offline = true;
    assert.equal((await reinstalled.navigate("/")).body, "offline document build-a", "the re-registered worker is whole");
    assert.deepEqual(world.cachesHolding("/foreign"), [FOREIGN_CACHE]);
  },

  "concurrent requests for one asset each get a whole response": async (source) => {
    const { world, worker } = await publishedWorld(source);

    world.serve(chunk("shared"), "shared bytes");

    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => worker.fetch(chunk("shared"), { destination: "script" })),
    );

    for (const outcome of outcomes) {
      assert.equal(outcome.body, "shared bytes");
      assert.deepEqual(outcome.lifetimeErrors, []);
    }

    assert.equal(world.cachesHolding(chunk("shared")).length, 1, "the asset is stored once");

    const paths = Array.from({ length: ASSET_ENTRY_BUDGET + 30 }, (_, index) => chunk(`burst-${index}`));

    paths.forEach((path) => world.serve(path, path));

    const burst = await Promise.all(paths.map((path) => worker.fetch(path)));

    assert.deepEqual(burst.flatMap((outcome) => outcome.lifetimeErrors), [], "concurrent eviction never rejects");
    assert.equal(burst.every((outcome, index) => outcome.body === paths[index]), true);
    assert.equal(world.runtimeEntryCount() <= ASSET_ENTRY_BUDGET, true, "concurrent writes stay inside the budget");
  },
};

const serviceWorkerSource = readSourceFile(SERVICE_WORKER_PATH);

for (const [name, contract] of Object.entries(contracts)) {
  test(`service worker: ${name}`, async () => {
    await contract(serviceWorkerSource);
  });
}

// Each mutant restores one unsafe behaviour of the previous worker, or removes
// one guard of this one. A contract must turn red for every one of them.
const mutants: { name: string; from: string; to: string; caughtBy: string }[] = [
  {
    name: "admits any script, style, image or font by its destination",
    from: "if (isVersionedAsset(url)) {",
    to: 'if (isVersionedAsset(url) || ["style", "script", "image", "font"].includes(request.destination)) {',
    caughtBy: "stable public URLs are answered from the network while online",
  },
  {
    name: "ignores the private path boundary",
    from: "if (!isSameOrigin(url) || isPrivatePath(url.pathname)) {",
    to: "if (!isSameOrigin(url)) {",
    caughtBy: "private surfaces are never answered or stored by the worker",
  },
  {
    name: "never trims the asset cache",
    from: "await trimCache(cache, ASSET_MAX_ENTRIES);",
    to: "",
    caughtBy: "the asset cache holds a bounded number of entries and evicts the oldest",
  },
  {
    name: "never starts a new generation",
    from: "Math.floor(now / ASSET_GENERATION_MS)",
    to: "0",
    caughtBy: "an asset nobody reads expires and one in use survives",
  },
  {
    name: "stores error responses",
    from: "response.status !== 200",
    to: "false",
    caughtBy: "a response that is not a clean public 200 is never stored",
  },
  {
    name: "ignores Cache-Control",
    from: "UNSTORABLE_CACHE_CONTROL.test(cacheControl)",
    to: "false",
    caughtBy: "a response that is not a clean public 200 is never stored",
  },
  {
    name: "writes outside the event lifetime",
    from: "event.waitUntil(storeVersionedAsset(generation, request, response.clone()));",
    to: "void storeVersionedAsset(generation, request, response.clone());",
    caughtBy: "content-versioned URLs are stored once and answered from the cache",
  },
  {
    name: "deletes caches it does not own",
    from: "key.startsWith(CACHE_PREFIX) && !keep.has(key)",
    to: "!keep.has(key)",
    caughtBy: "an update adopts versioned entries of the previous worker and drops the rest",
  },
  {
    name: "drops the previous worker's versioned entries",
    from: "await adoptLegacyAssets(key, generation);",
    to: "",
    caughtBy: "an update adopts versioned entries of the previous worker and drops the rest",
  },
  {
    name: "makes every precached URL essential",
    from: "PRECACHE_OPTIONAL_URLS.map((url) => precacheUrl(cache, url).catch(() => undefined))",
    to: "PRECACHE_OPTIONAL_URLS.map((url) => precacheUrl(cache, url))",
    caughtBy: "install keeps only what it can prove and never strands the previous worker",
  },
  {
    name: "precaches with the user's credentials",
    from: 'credentials: "omit"',
    to: 'credentials: "include"',
    caughtBy: "install keeps only what it can prove and never strands the previous worker",
  },
  {
    name: "answers a stable asset from its stored copy first",
    from: "const response = await fetch(request);\n    const key = precachedKey(url);",
    to: "const key = precachedKey(url);\n    const stale = await matchPrecached(key);\n    if (stale) return stale;\n    const response = await fetch(request);",
    caughtBy: "stable public URLs are answered from the network while online",
  },
];

for (const mutant of mutants) {
  test(`service worker mutant is caught: ${mutant.name}`, async () => {
    const source = serviceWorkerSource;
    const mutated = source.replace(mutant.from, mutant.to);

    assert.notEqual(mutated, source, `the mutation anchor must exist in sw.js: ${mutant.from}`);

    const contract = contracts[mutant.caughtBy];

    assert.ok(contract, `unknown contract ${mutant.caughtBy}`);
    await assert.rejects(() => contract(mutated), `${mutant.caughtBy} must fail for this mutant`);
  });
}
