export interface ApprovedExternalAction {
  repository: string;
  owner: string;
  reason: string;
}

export interface PermissionPolicy {
  topLevel: Readonly<Record<string, string>>;
  forbiddenScalarValues: readonly string[];
  jobLevelExceptions: readonly unknown[];
}

export interface ContainerImageException {
  workflow: string;
  job: string;
  service: string;
  image: string;
  owner: string;
  reason: string;
  reviewBy: string;
}

export interface ContainerImagePolicy {
  exceptions: readonly ContainerImageException[];
}

export const POLICY_VERSION: string;
export const WORKFLOW_PATH_PREFIX: string;
export const WORKFLOW_EXTENSIONS: readonly string[];
export const APPROVED_EXTERNAL_ACTIONS: readonly ApprovedExternalAction[];
export const PERMISSION_POLICY: PermissionPolicy;
export const CONTAINER_IMAGE_POLICY: ContainerImagePolicy;
