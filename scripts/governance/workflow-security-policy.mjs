const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

export const POLICY_VERSION = "QGA-4.1";

export const WORKFLOW_PATH_PREFIX = ".github/workflows/";
export const WORKFLOW_EXTENSIONS = deepFreeze([".yml", ".yaml"]);

export const APPROVED_EXTERNAL_ACTIONS = deepFreeze([
  {
    repository: "actions/checkout",
    owner: "CI owner",
    reason: "Repository checkout is required by the tracked CI workflows.",
  },
  {
    repository: "actions/setup-node",
    owner: "CI owner",
    reason: "Node.js setup is required by the tracked Node and frontend workflows.",
  },
  {
    repository: "actions/upload-artifact",
    owner: "QA owner",
    reason: "Artifact upload is required for Playwright diagnostics.",
  },
  {
    repository: "pnpm/action-setup",
    owner: "CI owner",
    reason: "Pinned pnpm setup is required by package-backed CI workflows.",
  },
]);

export const PERMISSION_POLICY = deepFreeze({
  topLevel: {
    contents: "read",
  },
  forbiddenScalarValues: ["write-all", "read-all", "{}"],
  jobLevelExceptions: [],
});

export const CONTAINER_IMAGE_POLICY = deepFreeze({
  exceptions: [
    {
      workflow: ".github/workflows/backend-ci.yml",
      job: "validate-backend",
      service: "postgres",
      image: "postgres:16",
      owner: "Backend owner",
      reason:
        "The current CI service uses the supported PostgreSQL 16 major line. Digest pinning requires a separately governed image-refresh workflow.",
      reviewBy: "2026-10-01",
    },
  ],
});
