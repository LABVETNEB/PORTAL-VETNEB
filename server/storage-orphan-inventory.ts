import crypto from "node:crypto";

/**
 * SEC-09D: inventario de solo lectura de objetos de informe sin referencia en
 * PostgreSQL. Los candidatos son una observacion, nunca una autorizacion de
 * borrado. Este modulo no importa Storage ni la base: recibe puertos.
 */

export const STORAGE_ORPHAN_ROOT_PREFIX = "clinics/";
export const STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const STORAGE_ORPHAN_CANDIDATE_SAMPLE_LIMIT = 100;

export const STORAGE_ORPHAN_DEFAULT_LIMITS = {
  pageSize: 500,
  maxPages: 200,
  maxObjects: 50_000,
  maxDurationMs: 30_000,
  referenceBatchSize: 500,
} as const;

/** Patron exacto de un informe: clinics/<clinicId>/<ts>-<hex12>-<nombre>. */
const REPORT_OBJECT_KEY_PATTERN =
  /^clinics\/([1-9]\d{0,9})\/(\d{10,}-[0-9a-f]{12})-[^/]+$/;

/** Margen de reloj: un objeto "del futuro" por mas que esto no es confiable. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export type StorageListedObject = {
  key: string;
  createdAt: string | null | undefined;
};

export type StorageListPage = {
  objects: StorageListedObject[];
  nextCursor: string | null;
};

export type StorageObjectListingPort = {
  listPage(input: {
    prefix: string;
    cursor: string | null;
    limit: number;
  }): Promise<StorageListPage>;
};

/** Devuelve, de los paths recibidos, los que existen en reports.storage_path. */
export type StorageReferenceLookup = (
  paths: string[],
) => Promise<ReadonlySet<string>>;

export type StorageOrphanInventoryLimits = {
  pageSize: number;
  maxPages: number;
  maxObjects: number;
  maxDurationMs: number;
  referenceBatchSize: number;
};

export type StorageOrphanInventoryFailureReason =
  | "listing_failed"
  | "incomplete_listing"
  | "invalid_page"
  | "reference_check_failed"
  | "inventory_unavailable";

export type StorageOrphanInventoryTruncationReason =
  | "max_pages"
  | "max_objects"
  | "deadline";

export type StorageOrphanInventoryResult = {
  dryRun: true;
  generatedAt: string;
  status: "complete" | "truncated" | "failed";
  /** true solo si status === "complete": unicamente entonces los conteos son totales. */
  complete: boolean;
  truncationReason?: StorageOrphanInventoryTruncationReason;
  failureReason?: StorageOrphanInventoryFailureReason;
  failureErrorName?: string;
  scope: {
    prefix: string;
    excluded: string[];
  };
  minAgeMs: number;
  limits: StorageOrphanInventoryLimits;
  inspected: {
    pages: number;
    uniqueObjects: number;
    duplicateEntries: number;
  };
  observed: {
    unrecognized: number;
    unknownAge: number;
    tooRecent: number;
    referenced: number;
    /** Referencias que aparecieron entre la primera comprobacion y la final. */
    referencedDuringInventory: number;
    /** Elegibles que no pudieron comprobarse por truncamiento. */
    unverified: number;
    orphanCandidates: number;
  };
  candidates: Array<{ objectRef: string; pathDigest: string }>;
  candidatesSampleTruncated: boolean;
  /** Los candidatos no se evaluaron para borrado y no son seguros de eliminar. */
  deletionSafety: "not_assessed";
};

export type StorageOrphanInventoryDependencies = {
  listing: StorageObjectListingPort;
  lookupReferencedPaths: StorageReferenceLookup;
  now?: () => number;
  limits?: Partial<StorageOrphanInventoryLimits>;
  /** Solo se acepta un umbral mayor o igual al por defecto. */
  minAgeMs?: number;
};

const SCOPE = {
  prefix: STORAGE_ORPHAN_ROOT_PREFIX,
  excluded: ["clinic-avatars/", "reports/ (legado)"],
};

export function resolveStorageOrphanMinAgeMs(requested?: number) {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS;
  }

  return Math.max(requested, STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS);
}

function resolveLimits(
  overrides?: Partial<StorageOrphanInventoryLimits>,
): StorageOrphanInventoryLimits {
  const merged = { ...STORAGE_ORPHAN_DEFAULT_LIMITS, ...overrides };
  const positiveInt = (value: number, fallback: number) =>
    Number.isInteger(value) && value > 0 ? value : fallback;

  return {
    pageSize: positiveInt(
      merged.pageSize,
      STORAGE_ORPHAN_DEFAULT_LIMITS.pageSize,
    ),
    maxPages: positiveInt(
      merged.maxPages,
      STORAGE_ORPHAN_DEFAULT_LIMITS.maxPages,
    ),
    maxObjects: positiveInt(
      merged.maxObjects,
      STORAGE_ORPHAN_DEFAULT_LIMITS.maxObjects,
    ),
    maxDurationMs: positiveInt(
      merged.maxDurationMs,
      STORAGE_ORPHAN_DEFAULT_LIMITS.maxDurationMs,
    ),
    referenceBatchSize: positiveInt(
      merged.referenceBatchSize,
      STORAGE_ORPHAN_DEFAULT_LIMITS.referenceBatchSize,
    ),
  };
}

/** Solo el nombre del error, nunca el mensaje (puede contener datos). */
export function resolveInventoryErrorName(error: unknown) {
  const name = error instanceof Error ? error.name : "";

  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ? name : "UnknownError";
}

export function parseReportObjectKey(key: unknown) {
  if (typeof key !== "string") {
    return null;
  }

  const match = REPORT_OBJECT_KEY_PATTERN.exec(key);

  return match ? { clinicId: Number(match[1]), objectRef: match[2] } : null;
}

function resolveCreatedAtMs(createdAt: unknown, nowMs: number) {
  if (typeof createdAt !== "string" || createdAt.length === 0) {
    return null;
  }

  const parsed = Date.parse(createdAt);

  if (!Number.isFinite(parsed) || parsed > nowMs + FUTURE_SKEW_MS) {
    return null;
  }

  return parsed;
}

function digestOf(key: string) {
  return crypto.hash("sha256", key, "hex");
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function buildFailedStorageOrphanInventory(
  generatedAt: Date,
  failureReason: StorageOrphanInventoryFailureReason,
  failureErrorName?: string,
): StorageOrphanInventoryResult {
  return {
    ...buildBaseInventory(generatedAt),
    status: "failed",
    complete: false,
    failureReason,
    ...(failureErrorName ? { failureErrorName } : {}),
  };
}

function buildBaseInventory(generatedAt: Date): StorageOrphanInventoryResult {
  return {
    dryRun: true,
    generatedAt: generatedAt.toISOString(),
    status: "complete",
    complete: true,
    scope: SCOPE,
    minAgeMs: STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS,
    limits: { ...STORAGE_ORPHAN_DEFAULT_LIMITS },
    inspected: { pages: 0, uniqueObjects: 0, duplicateEntries: 0 },
    observed: {
      unrecognized: 0,
      unknownAge: 0,
      tooRecent: 0,
      referenced: 0,
      referencedDuringInventory: 0,
      unverified: 0,
      orphanCandidates: 0,
    },
    candidates: [],
    candidatesSampleTruncated: false,
    deletionSafety: "not_assessed",
  };
}

/**
 * Recorre clinics/ desde la raiz (incluye clinicas ya borradas de PostgreSQL),
 * clasifica cada objeto y comprueba referencias por lotes. Nunca lanza: un
 * fallo produce status "failed", jamas un conteo vacio que parezca limpio.
 */
export async function runStorageOrphanInventory(
  dependencies: StorageOrphanInventoryDependencies,
): Promise<StorageOrphanInventoryResult> {
  const clock = dependencies.now ?? (() => Date.now());
  const startedAtMs = clock();
  const limits = resolveLimits(dependencies.limits);
  const minAgeMs = resolveStorageOrphanMinAgeMs(dependencies.minAgeMs);

  const result = buildBaseInventory(new Date(startedAtMs));
  result.limits = limits;
  result.minAgeMs = minAgeMs;

  const fail = (
    reason: StorageOrphanInventoryFailureReason,
    error?: unknown,
  ) => {
    result.status = "failed";
    result.complete = false;
    result.failureReason = reason;

    if (error !== undefined) {
      result.failureErrorName = resolveInventoryErrorName(error);
    }

    return result;
  };

  const seenKeys = new Set<string>();
  const seenCursors = new Set<string>();
  const eligible: string[] = [];
  let cursor: string | null = null;
  let truncation: StorageOrphanInventoryTruncationReason | null = null;

  while (truncation === null) {
    if (result.inspected.pages >= limits.maxPages) {
      truncation = "max_pages";
      break;
    }

    if (clock() - startedAtMs >= limits.maxDurationMs) {
      truncation = "deadline";
      break;
    }

    let page: StorageListPage;

    try {
      page = await dependencies.listing.listPage({
        prefix: STORAGE_ORPHAN_ROOT_PREFIX,
        cursor,
        limit: limits.pageSize,
      });
    } catch (error) {
      return fail("listing_failed", error);
    }

    const pageIsValid =
      page !== null &&
      typeof page === "object" &&
      Array.isArray(page.objects) &&
      (page.nextCursor === null ||
        (typeof page.nextCursor === "string" && page.nextCursor.length > 0));

    if (!pageIsValid) {
      return fail("invalid_page");
    }

    result.inspected.pages += 1;
    const nowMs = clock();

    for (const object of page.objects) {
      if (seenKeys.has(object.key)) {
        result.inspected.duplicateEntries += 1;
        continue;
      }

      if (seenKeys.size >= limits.maxObjects) {
        truncation = "max_objects";
        break;
      }

      seenKeys.add(object.key);
      result.inspected.uniqueObjects += 1;

      if (!parseReportObjectKey(object.key)) {
        result.observed.unrecognized += 1;
        continue;
      }

      const createdAtMs = resolveCreatedAtMs(object.createdAt, nowMs);

      if (createdAtMs === null) {
        result.observed.unknownAge += 1;
        continue;
      }

      if (nowMs - createdAtMs < minAgeMs) {
        result.observed.tooRecent += 1;
        continue;
      }

      eligible.push(object.key);
    }

    if (truncation !== null || page.nextCursor === null) {
      break;
    }

    if (page.nextCursor === cursor || seenCursors.has(page.nextCursor)) {
      return fail("incomplete_listing");
    }

    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  const candidates: string[] = [];
  const batches = chunk(eligible, limits.referenceBatchSize);

  for (const [batchIndex, batch] of batches.entries()) {
    if (clock() - startedAtMs >= limits.maxDurationMs) {
      truncation = truncation ?? "deadline";
      result.observed.unverified += batches
        .slice(batchIndex)
        .reduce((total, remaining) => total + remaining.length, 0);
      break;
    }

    let referenced: ReadonlySet<string>;

    try {
      referenced = await dependencies.lookupReferencedPaths(batch);
    } catch (error) {
      return fail("reference_check_failed", error);
    }

    for (const key of batch) {
      if (referenced.has(key)) {
        result.observed.referenced += 1;
        continue;
      }

      candidates.push(key);
    }
  }

  const confirmed: string[] = [];

  for (const batch of chunk(candidates, limits.referenceBatchSize)) {
    let referencedNow: ReadonlySet<string>;

    try {
      referencedNow = await dependencies.lookupReferencedPaths(batch);
    } catch (error) {
      return fail("reference_check_failed", error);
    }

    for (const key of batch) {
      if (referencedNow.has(key)) {
        result.observed.referenced += 1;
        result.observed.referencedDuringInventory += 1;
        continue;
      }

      confirmed.push(key);
    }
  }

  result.observed.orphanCandidates = confirmed.length;
  result.candidatesSampleTruncated =
    confirmed.length > STORAGE_ORPHAN_CANDIDATE_SAMPLE_LIMIT;
  result.candidates = confirmed
    .slice(0, STORAGE_ORPHAN_CANDIDATE_SAMPLE_LIMIT)
    .map((key) => ({
      objectRef: parseReportObjectKey(key)?.objectRef ?? "",
      pathDigest: digestOf(key),
    }));

  if (truncation !== null) {
    result.status = "truncated";
    result.complete = false;
    result.truncationReason = truncation;
  }

  return result;
}
