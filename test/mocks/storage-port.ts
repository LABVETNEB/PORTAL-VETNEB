import { StorageApiError } from "@supabase/supabase-js";
import type { StorageBucketPort, StoragePort } from "../../server/lib/supabase.ts";

// Double of the StoragePort seam (server/lib/supabase.ts, TEST-GLOBAL-10A).
// Owner: storage helpers of server/lib/supabase.ts. Every operation not
// supplied by the test fails closed instead of reaching Supabase.

export type StoragePortFakeOverrides = {
  getBucket?: StoragePort["getBucket"];
  createBucket?: StoragePort["createBucket"];
  upload?: StorageBucketPort["upload"];
  createSignedUrl?: StorageBucketPort["createSignedUrl"];
  remove?: StorageBucketPort["remove"];
};

export type StoragePortFake = {
  storage: StoragePort;
  fromCalls: string[];
};

function unexpectedStorageCall(operation: string): never {
  throw new Error(`storage fake: unexpected ${operation} call`);
}

export function createStoragePortFake(
  overrides: StoragePortFakeOverrides = {},
): StoragePortFake {
  const fromCalls: string[] = [];
  const bucket: StorageBucketPort = {
    upload: overrides.upload ?? (async () => unexpectedStorageCall("upload")),
    createSignedUrl:
      overrides.createSignedUrl ??
      (async () => unexpectedStorageCall("createSignedUrl")),
    remove: overrides.remove ?? (async () => unexpectedStorageCall("remove")),
  };

  return {
    storage: {
      getBucket:
        overrides.getBucket ?? (async () => unexpectedStorageCall("getBucket")),
      createBucket:
        overrides.createBucket ??
        (async () => unexpectedStorageCall("createBucket")),
      from(bucketId: string) {
        fromCalls.push(bucketId);
        return bucket;
      },
    },
    fromCalls,
  };
}

export function createStorageApiError(message: string): StorageApiError {
  return new StorageApiError(message, 500, "500");
}
