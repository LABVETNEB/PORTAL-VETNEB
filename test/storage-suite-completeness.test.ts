import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

type FileAnchor = {
  path: string;
  markers: readonly string[];
};

type StorageSuiteEntry = {
  slug: string;
  purpose: string;
  testFiles: readonly FileAnchor[];
  runtimeAnchors: readonly FileAnchor[];
};

const STORAGE_SUITE: readonly StorageSuiteEntry[] = [
  {
    slug: "storage-core-boundaries",
    purpose:
      "The Supabase storage boundary guardrail keeps buckets private, public URLs blocked, TTLs ENV-driven and uploads private.",
    testFiles: [
      {
        path: "test/supabase-storage-boundaries.test.ts",
        markers: [
          "storage boundaries mantienen bucket privado",
          "storage boundaries generan signed URLs",
          "storage boundaries suben archivos con storage path privado",
          "storage boundaries sanitizan nombres",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/supabase.ts",
        markers: [
          "export async function ensureStorageBucketExists",
          "public: false",
          "export async function createSignedStorageUrl",
          "ENV.signedUrlExpiresInSeconds",
          "export async function uploadReport",
          "export async function uploadClinicAvatar",
        ],
      },
    ],
  },
  {
    slug: "storage-mime-validation",
    purpose:
      "Report and avatar uploads keep stable allowlists and reject unsupported MIME types before touching storage.",
    testFiles: [
      {
        path: "test/supabase.test.ts",
        markers: [
          "ALLOWED_MIME_TYPES conserva formatos",
          "ALLOWED_AVATAR_MIME_TYPES conserva formatos",
          "uploadReport rechaza mime type no permitido",
          "uploadClinicAvatar rechaza mime type no permitido",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/supabase.ts",
        markers: [
          "export const ALLOWED_MIME_TYPES",
          "export const ALLOWED_AVATAR_MIME_TYPES",
          "Tipo de archivo no permitido",
          "Tipo de avatar no permitido",
        ],
      },
    ],
  },
  {
    slug: "storage-upload-paths",
    purpose:
      "Report and avatar upload helpers keep deterministic private paths, sanitized filenames and no accidental public URL returns.",
    testFiles: [
      {
        path: "test/supabase-upload-success.test.ts",
        markers: [
          "uploadReport sube archivo con path sanitizado",
          "uploadClinicAvatar sube avatar con path sanitizado",
          "uploadReport neutraliza path traversal",
          "uploadClinicAvatar neutraliza path traversal",
          "upsert: false",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/supabase.ts",
        markers: [
          "function sanitizeFileName",
          "function buildReportStoragePath",
          "function buildClinicAvatarStoragePath",
          ".upload(storagePath, file, {",
          "contentType: mimeType",
          "upsert: false",
          "return storagePath;",
        ],
      },
    ],
  },
  {
    slug: "storage-signed-url-and-delete",
    purpose:
      "Preview, download and delete helpers keep signed URL generation delegated to private storage and remove exact paths only.",
    testFiles: [
      {
        path: "test/supabase-signed-url.test.ts",
        markers: [
          "createSignedStorageUrl devuelve signedUrl",
          "createSignedReportUrl delega",
          "createSignedReportDownloadUrl usa nombre",
          "deleteStorageObject elimina path",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/supabase.ts",
        markers: [
          "export async function createSignedStorageUrl",
          "export async function createSignedReportUrl",
          "export async function createSignedReportDownloadUrl",
          "export async function deleteStorageObject",
          ".remove([storagePath])",
        ],
      },
    ],
  },
  {
    slug: "storage-recovery-edges",
    purpose:
      "Bucket bootstrap and signed URL fallback paths remain explicit when storage returns missing data without explicit errors.",
    testFiles: [
      {
        path: "test/supabase-recovery-edge.test.ts",
        markers: [
          "ensureStorageBucketExists crea bucket",
          "createSignedStorageUrl usa fallback",
          "createSignedReportDownloadUrl usa fallback",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/supabase.ts",
        markers: [
          "await supabase.storage.getBucket",
          "await supabase.storage.createBucket",
          "throw error ?? new Error",
        ],
      },
    ],
  },
  {
    slug: "storage-route-consumers",
    purpose:
      "Admin report upload and clinic public profile avatar routes keep storage helpers injectable and ordered around persistence.",
    testFiles: [
      {
        path: "test/admin-reports.fastify.test.ts",
        markers: [
          "adminReportsNativeRoutes crea POST /upload",
          "requiere clinicId valido antes de storage",
          "bloquea POST /upload sin sesion admin antes de storage",
        ],
      },
      {
        path: "test/clinic-public-profile.fastify.test.ts",
        markers: [
          "clinicPublicProfileNativeRoutes actualiza POST /avatar",
          "reemplazo de avatar previo",
          "elimina DELETE /avatar",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: [
          "uploadReport?:",
          "createSignedReportUrl?:",
          "createSignedReportDownloadUrl?:",
          "uploadReport: storage.uploadReport",
          "createSignedReportUrl: storage.createSignedReportUrl",
          "createSignedReportDownloadUrl: storage.createSignedReportDownloadUrl",
          "const storagePath = await deps.uploadReport({",
          "report: await serializeReport(report, deps)",
        ],
      },
      {
        path: "server/routes/clinic-public-profile.fastify.ts",
        markers: [
          "createSignedStorageUrl?:",
          "uploadClinicAvatar?:",
          "deleteStorageObject?:",
          "createSignedStorageUrl: supabase.createSignedStorageUrl",
          "uploadClinicAvatar: supabase.uploadClinicAvatar",
          "deleteStorageObject: supabase.deleteStorageObject",
          "const avatarStoragePath = await deps.uploadClinicAvatar({",
          "await deps.deleteStorageObject(previousAvatarStoragePath)",
          "const avatarUrl = await deps.createSignedStorageUrl(avatarStoragePath)",
        ],
      },
    ],
  },
  {
    slug: "storage-public-response-consumers",
    purpose:
      "Public report access and public professionals tests keep signed URLs delegated without exposing raw storage paths.",
    testFiles: [
      {
        path: "test/public-report-access.fastify.test.ts",
        markers: [
          "urls firmadas",
          "payload estable, urls firmadas y auditoria",
          "previewUrl",
          "downloadUrl",
        ],
      },
      {
        path: "test/public-professionals.fastify.test.ts",
        markers: [
          "payload estable y helper",
          "createSignedStorageUrl",
          "firmar avatar",
        ],
      },
      {
        path: "test/public-professionals-serialization-invariants.test.ts",
        markers: [
          "serializeProfessional firma avatarStoragePath",
          "sin exponer el path crudo",
          "serializeProfessional(row, createSignedStorageUrl)",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: [
          "createSignedReportUrl",
          "createSignedReportDownloadUrl",
          "const [previewUrl, downloadUrl] = await Promise.all([",
        ],
      },
      {
        path: "server/routes/public-professionals.fastify.ts",
        markers: [
          "createSignedStorageUrl",
          "avatarStoragePath",
        ],
      },
    ],
  },
  {
    slug: "storage-security-registries",
    purpose:
      "Security registries keep storage upload and signed URL coverage tied into the broader critical route surface.",
    testFiles: [
      {
        path: "test/security-critical-route-surface-registry.test.ts",
        markers: [
          "storage-upload-signing-boundaries",
          "supabase-storage-boundaries.test.ts",
          "uploadReport",
          "createSignedStorageUrl devuelve signedUrl",
        ],
      },
      {
        path: "test/security-sensitive-log-redaction-boundaries.test.ts",
        markers: [
          "signed url tests keep storage access delegated",
          "createSignedStorageUrl",
          "getPublicUrl",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/supabase.ts",
        markers: [
          "ENV.supabaseStorageBucket",
          "ENV.signedUrlExpiresInSeconds",
          "createSignedUrl",
        ],
      },
    ],
  },
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertFileExists(relativePath: string): void {
  assert.equal(
    existsSync(resolve(REPO_ROOT, relativePath)),
    true,
    `${relativePath} must exist`,
  );
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function allSuiteTestPaths(): string[] {
  return STORAGE_SUITE.flatMap((entry) =>
    entry.testFiles.map((file) => file.path),
  );
}

test("storage suite completeness registry keeps canonical order", () => {
  const slugs = STORAGE_SUITE.map((entry) => entry.slug);

  assert.deepEqual(slugs, [
    "storage-core-boundaries",
    "storage-mime-validation",
    "storage-upload-paths",
    "storage-signed-url-and-delete",
    "storage-recovery-edges",
    "storage-route-consumers",
    "storage-public-response-consumers",
    "storage-security-registries",
  ]);

  assert.deepEqual(slugs, uniqueValues(slugs));

  for (const entry of STORAGE_SUITE) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(entry.purpose.length >= 80);
    assert.ok(entry.testFiles.length > 0);
    assert.ok(entry.runtimeAnchors.length > 0);
  }
});

test("storage suite registers the canonical supabase storage guardrails", () => {
  const registeredFiles = allSuiteTestPaths().map((filePath) => basename(filePath));

  for (const requiredFile of [
    "supabase.test.ts",
    "supabase-upload-success.test.ts",
    "supabase-signed-url.test.ts",
    "supabase-recovery-edge.test.ts",
    "supabase-storage-boundaries.test.ts",
  ]) {
    assert.equal(
      registeredFiles.includes(requiredFile),
      true,
      `${requiredFile} must be registered in storage suite`,
    );
  }
});

test("storage suite test files exist and keep node test with assert strict", () => {
  for (const filePath of uniqueValues(allSuiteTestPaths())) {
    assertFileExists(filePath);

    const source = readSource(filePath);

    assertContains(source, "node:test", `${filePath} node:test`);
    assertContains(source, "node:assert/strict", `${filePath} assert strict`);
    assert.equal(
      /^\s*export\s+/m.test(source),
      false,
      `${filePath} must stay local to tests`,
    );
  }
});

test("storage suite entries keep their test anchors explicit", () => {
  for (const entry of STORAGE_SUITE) {
    for (const testFile of entry.testFiles) {
      const source = readSource(testFile.path);

      for (const marker of testFile.markers) {
        assertContains(source, marker, `${entry.slug} test anchor ${testFile.path}`);
      }
    }
  }
});

test("storage suite remains connected to runtime anchors", () => {
  for (const entry of STORAGE_SUITE) {
    for (const runtimeAnchor of entry.runtimeAnchors) {
      assertFileExists(runtimeAnchor.path);

      const source = readSource(runtimeAnchor.path);

      for (const marker of runtimeAnchor.markers) {
        assertContains(
          source,
          marker,
          `${entry.slug} runtime anchor ${runtimeAnchor.path}`,
        );
      }
    }
  }
});

test("storage suite keeps public URL usage blocked in runtime storage helper", () => {
  const source = readSource("server/lib/supabase.ts");

  assert.equal(source.includes("getPublicUrl"), false);
  assert.equal(source.includes("createPublicUrl"), false);
  assert.equal(source.includes("public: true"), false);
});

test("storage suite completeness guardrail source stays ascii only", () => {
  const source = readSource("test/storage-suite-completeness.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "storage suite completeness source must not contain replacement characters",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `storage suite completeness source must stay ascii-only at index ${index}`,
    );
  }
});
